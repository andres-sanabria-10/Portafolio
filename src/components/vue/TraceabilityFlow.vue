<script setup lang="ts">
/**
 * Diagrama de arquitectura del caso de trazabilidad: 10 etapas en 4 carriles.
 *
 * - Escritorio (≥ 64rem): cada carril es una fila que se lee de izquierda a
 *   derecha; el detalle de la etapa se abre en un panel lateral.
 * - Móvil: el flujo pasa a vertical y el detalle se abre en un <dialog> modal
 *   (el navegador atrapa el foco y cierra con Escape).
 * - Teclado: cada etapa es un botón (Enter o espacio la abre). Escape cierra el
 *   detalle y el foco vuelve a la etapa que lo abrió.
 * - Las transiciones solo se aplican con prefers-reduced-motion: no-preference.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import type { TraceLane, TraceStage } from '../../i18n/trazabilidad';
import TraceStageDetail from './TraceStageDetail.vue';
import { groupByLane, neighborIndex, type TraceLabels } from './trace';

const props = defineProps<{
  lanes: TraceLane[];
  stages: TraceStage[];
  labels: TraceLabels;
}>();

const uid = `trace-${useId()}`;
const groups = computed(() => groupByLane(props.lanes, props.stages));
const laneTitle = (laneId: string) => props.lanes.find((l) => l.id === laneId)?.title ?? '';

const selectedIndex = ref<number | null>(null);
const mode = ref<'panel' | 'dialog'>('panel');
const selected = computed(() =>
  selectedIndex.value === null ? null : (props.stages[selectedIndex.value] ?? null),
);

const dialog = ref<HTMLDialogElement | null>(null);
const panelDetail = ref<InstanceType<typeof TraceStageDetail> | null>(null);
const dialogDetail = ref<InstanceType<typeof TraceStageDetail> | null>(null);
const buttons = new Map<number, HTMLButtonElement>();
let returnFocusTo: number | null = null;

let wideQuery: MediaQueryList | undefined;
onMounted(() => {
  wideQuery = window.matchMedia('(min-width: 64rem)');
});

function setButton(index: number, el: unknown) {
  if (el instanceof HTMLButtonElement) buttons.set(index, el);
  else buttons.delete(index);
}

/**
 * Lleva el foco al título del detalle. En el panel lateral el detalle entra con
 * una transición out-in y todavía no existe tras el nextTick: ahí el foco se
 * pasa en `onPanelEntered`, cuando la transición termina (o de inmediato si no
 * hay animación por prefers-reduced-motion).
 */
let focusPending = false;
async function focusDetail() {
  focusPending = true;
  await nextTick();
  const detail = mode.value === 'dialog' ? dialogDetail.value : panelDetail.value;
  if (detail && (mode.value === 'dialog' || !panelLeaving)) {
    detail.focus();
    focusPending = false;
  }
}

let panelLeaving = false;
function onPanelLeave() {
  panelLeaving = true;
}
function onPanelEntered() {
  panelLeaving = false;
  if (focusPending && mode.value === 'panel') {
    panelDetail.value?.focus();
    focusPending = false;
  }
}

function open(index: number) {
  returnFocusTo = index;
  mode.value = wideQuery?.matches === false ? 'dialog' : 'panel';
  selectedIndex.value = index;
  if (mode.value === 'dialog' && dialog.value && !dialog.value.open) dialog.value.showModal();
  void focusDetail();
}

function close() {
  if (selectedIndex.value === null) return;
  const target = returnFocusTo ?? selectedIndex.value;
  selectedIndex.value = null;
  if (dialog.value?.open) dialog.value.close();
  buttons.get(target)?.focus();
}

function move(step: -1 | 1) {
  if (selectedIndex.value === null) return;
  const next = neighborIndex(selectedIndex.value, props.stages.length, step);
  if (next === null) return;
  selectedIndex.value = next;
  returnFocusTo = next;
  void focusDetail();
}

/** Escape en el panel lateral (en el <dialog> lo maneja el evento `cancel`). */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mode.value === 'panel' && selectedIndex.value !== null) {
    event.preventDefault();
    close();
  }
}

function onDialogCancel(event: Event) {
  event.preventDefault();
  close();
}

/** Clic en el fondo del <dialog> (fuera de la tarjeta) lo cierra. */
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close();
}

onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close();
});
</script>

<template>
  <div class="trace not-prose my-12" @keydown="onKeydown">
    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <ol class="trace-lanes" :aria-label="labels.label">
        <li v-for="group in groups" :key="group.lane.id" class="trace-lane">
          <p class="lane-title label-mono">{{ group.lane.title }}</p>
          <ol class="lane-stages">
            <li v-for="item in group.items" :key="item.stage.id" class="stage-item">
              <button
                :ref="(el) => setButton(item.index, el)"
                type="button"
                class="stage"
                :class="{ 'is-selected': selectedIndex === item.index }"
                :aria-expanded="selectedIndex === item.index"
                :aria-controls="mode === 'dialog' ? `${uid}-dialog` : `${uid}-panel`"
                @click="selectedIndex === item.index ? close() : open(item.index)"
              >
                <span class="stage-number" aria-hidden="true">{{ item.index + 1 }}</span>
                <span class="min-w-0">
                  <span class="block font-semibold leading-snug">{{ item.stage.title }}</span>
                  <span v-if="item.stage.carriers" class="mt-2 flex flex-wrap gap-1">
                    <span
                      v-for="carrier in item.stage.carriers"
                      :key="carrier.name"
                      :class="carrier.protocol === 'SOAP' ? 'carrier carrier-soap' : 'carrier'"
                    >
                      {{ carrier.name.slice(-1) }}<span class="carrier-protocol">{{ carrier.protocol }}</span>
                    </span>
                  </span>
                  <span v-else class="mt-0.5 block text-sm text-muted">{{ item.stage.subtitle }}</span>
                </span>
              </button>
            </li>
          </ol>
        </li>
      </ol>

      <aside
        :id="`${uid}-panel`"
        class="trace-panel hidden lg:block"
        :aria-labelledby="selected && mode === 'panel' ? `${uid}-panel-title` : undefined"
        :aria-label="selected && mode === 'panel' ? undefined : labels.label"
      >
        <Transition
          name="detail"
          mode="out-in"
          @before-leave="onPanelLeave"
          @after-enter="onPanelEntered"
        >
          <TraceStageDetail
            v-if="selected && mode === 'panel' && selectedIndex !== null"
            ref="panelDetail"
            :key="selected.id"
            :stage="selected"
            :index="selectedIndex"
            :total="stages.length"
            :lane-title="laneTitle(selected.lane)"
            :labels="labels"
            :heading-id="`${uid}-panel-title`"
            @close="close"
            @move="move"
          />
          <p v-else class="text-sm text-muted">{{ labels.hint }}</p>
        </Transition>
      </aside>
    </div>

    <dialog
      :id="`${uid}-dialog`"
      ref="dialog"
      class="trace-dialog"
      :aria-labelledby="`${uid}-dialog-title`"
      @cancel="onDialogCancel"
      @click="onDialogClick"
    >
      <TraceStageDetail
        v-if="selected && mode === 'dialog' && selectedIndex !== null"
        ref="dialogDetail"
        :stage="selected"
        :index="selectedIndex"
        :total="stages.length"
        :lane-title="laneTitle(selected.lane)"
        :labels="labels"
        :heading-id="`${uid}-dialog-title`"
        @close="close"
        @move="move"
      />
    </dialog>
  </div>
</template>

<style scoped>
/* ---------- Flujo (móvil primero: todo vertical) ---------- */
/* align-content: start evita que las filas se estiren hasta la altura del panel. */
.trace-lanes {
  display: grid;
  align-content: start;
  gap: 1.75rem;
}

/* En móvil el título del carril se corre a la derecha de la línea que baja. */
.lane-title {
  margin-bottom: 0.75rem;
  padding-left: 2.75rem;
}

.lane-stages {
  display: grid;
  gap: 1.25rem;
}

.stage-item {
  position: relative;
}

/* Conector vertical entre etapas y entre carriles (flecha hacia abajo). */
.stage-item::after,
.trace-lane:not(:last-child) .stage-item:last-child::after {
  content: '';
  position: absolute;
  left: 1.5rem;
  top: 100%;
  width: 1px;
  height: 1.25rem;
  background: var(--line-strong);
}

.trace-lane:last-child .stage-item:last-child::after {
  display: none;
}

/* Cruza el espacio entre carriles y el título del siguiente: 1.75rem de separación,
   0.75rem de margen y 1.1375rem de alto del título (0.8125rem × 1.4). */
.trace-lane:not(:last-child) .stage-item:last-child::after {
  height: 3.6375rem;
}

.stage {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-ui);
  background-color: var(--surface);
  text-align: left;
  /* Palabras largas ("reexpediciones") se cortan con guion en columnas angostas. */
  hyphens: auto;
  overflow-wrap: break-word;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.stage:hover {
  border-color: var(--accent);
}

.stage.is-selected {
  border-color: var(--accent);
  background-color: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.stage-number {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
}

.stage.is-selected .stage-number {
  border-color: var(--accent);
  color: var(--accent);
}

.carrier {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  padding: 0 0.375rem;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.6;
}

.carrier-soap {
  border-color: transparent;
  background-color: var(--surface-raised);
}

.carrier-protocol {
  font-size: 0.625rem;
  font-weight: 400;
  color: var(--muted);
}

/* ---------- Escritorio: cada carril es una fila, etapas de izquierda a derecha ---------- */
@media (min-width: 64rem) {
  .lane-stages {
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 1.75rem;
  }

  /* Flecha horizontal entre etapas del mismo carril. */
  .stage-item:not(:last-child)::after {
    left: 100%;
    top: 50%;
    width: 1.75rem;
    height: 1px;
  }

  /* Punta de la flecha: un triángulo con clip-path al final del conector. */
  .stage-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: calc(100% + 1.75rem - 6px);
    top: calc(50% - 4px);
    width: 6px;
    height: 8px;
    background: var(--line-strong);
    clip-path: polygon(0 0, 100% 50%, 0 100%);
  }

  /* Bajada al siguiente carril, desde la primera etapa de la fila. */
  .trace-lane:not(:last-child) .stage-item:last-child::after {
    display: none;
  }

  .trace-lane:not(:last-child) .stage-item:first-child .stage::after {
    content: '';
    position: absolute;
    left: 1.5rem;
    top: 100%;
    width: 1px;
    height: 3.6375rem;
    background: var(--line-strong);
  }

  .stage {
    position: relative;
  }

  .trace-panel {
    position: sticky;
    top: 6rem;
    align-self: start;
    min-height: 12rem;
    padding: 1.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-ui);
    background-color: var(--surface);
  }
}

/* ---------- Diálogo (móvil) ---------- */
.trace-dialog {
  width: min(32rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: 1.25rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-ui);
  background-color: var(--surface);
  color: var(--fg);
  overflow-y: auto;
}

.trace-dialog::backdrop {
  background: rgb(4 10 14 / 0.6);
}

@media (prefers-reduced-motion: no-preference) {
  .detail-enter-active,
  .detail-leave-active {
    transition:
      opacity 160ms ease,
      transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .detail-enter-from {
    opacity: 0;
    transform: translateY(6px);
  }

  .detail-leave-to {
    opacity: 0;
  }

  .trace-dialog[open] {
    animation: dialog-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
}
</style>
