<script setup lang="ts">
/**
 * "El viaje de un dato": una guía sintética recorre el pipeline paso a paso
 * (API → raw → staging → modelo → métrica). En cada etapa se ve el registro
 * como queda y, en staging, el valor anterior tachado junto al nuevo.
 *
 * Accesible: la barra de etapas usa el patrón ARIA de tabs (flechas, Inicio y
 * Fin), y las transiciones solo corren con prefers-reduced-motion: no-preference.
 */
import { computed, ref, useId } from 'vue';
import type { JourneyContent } from '../../i18n/journey';

const props = defineProps<{ content: JourneyContent }>();

const uid = `journey-${useId()}`;
const index = ref(0);
const steps = computed(() => props.content.steps);
const step = computed(() => steps.value[index.value]!);
const tabs = ref<HTMLButtonElement[]>([]);
const labels = computed(() => props.content.labels);

const stepOf = computed(() =>
  labels.value.stepOf
    .replace('{n}', String(index.value + 1))
    .replace('{total}', String(steps.value.length)),
);

function go(next: number, focus = false) {
  const last = steps.value.length - 1;
  index.value = Math.max(0, Math.min(last, next));
  if (focus) tabs.value[index.value]?.focus();
}

function onKeydown(event: KeyboardEvent) {
  const last = steps.value.length - 1;
  const target =
    event.key === 'ArrowRight' ? Math.min(last, index.value + 1)
    : event.key === 'ArrowLeft' ? Math.max(0, index.value - 1)
    : event.key === 'Home' ? 0
    : event.key === 'End' ? last
    : null;
  if (target === null) return;
  event.preventDefault();
  go(target, true);
}
</script>

<template>
  <div class="journey not-prose my-10">
    <div role="tablist" :aria-label="labels.rail" class="journey-rail">
      <button
        v-for="(s, i) in steps"
        :id="`${uid}-tab-${s.id}`"
        :key="s.id"
        ref="tabs"
        type="button"
        role="tab"
        class="journey-tab"
        :class="{ 'is-done': i < index }"
        :aria-selected="i === index"
        :aria-controls="`${uid}-panel`"
        :tabindex="i === index ? 0 : -1"
        @click="go(i)"
        @keydown="onKeydown"
      >
        <span class="journey-dot" aria-hidden="true">{{ i + 1 }}</span>
        <span class="journey-tab-label">{{ s.label }}</span>
      </button>
    </div>

    <div
      :id="`${uid}-panel`"
      role="tabpanel"
      :aria-labelledby="`${uid}-tab-${step.id}`"
      class="journey-panel"
    >
      <Transition name="journey" mode="out-in">
        <div :key="step.id" class="journey-grid">
          <div>
            <p class="label-mono">{{ stepOf }} · {{ step.where }}</p>
            <h3 class="mt-2 text-xl font-semibold md:text-2xl">{{ step.title }}</h3>
            <p class="mt-3 text-muted">{{ step.body }}</p>
            <p class="label-mono mt-5">{{ labels.changes }}</p>
            <ul class="journey-changes">
              <li v-for="change in step.changes" :key="change">{{ change }}</li>
            </ul>
          </div>

          <div class="journey-record" :aria-label="labels.record" role="group">
            <p class="journey-record-head">{{ step.where }}</p>
            <dl>
              <div v-for="field in step.fields" :key="field.key" class="journey-field" :class="{ 'is-changed': field.before }">
                <dt>{{ field.key }}</dt>
                <dd>
                  <del v-if="field.before">{{ field.before }}</del>
                  <span>{{ field.value }}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </Transition>

      <div class="journey-nav">
        <button type="button" class="journey-btn" :disabled="index === 0" @click="go(index - 1)">
          ← {{ labels.prev }}
        </button>
        <span class="journey-progress" aria-hidden="true">
          <span :style="{ width: `${((index + 1) / steps.length) * 100}%` }" />
        </span>
        <button type="button" class="journey-btn" :disabled="index === steps.length - 1" @click="go(index + 1)">
          {{ labels.next }} →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.journey-rail {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.375rem;
}

.journey-tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.25rem;
  border-radius: var(--radius-ui);
  color: var(--muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

/* Línea que une las etapas, por detrás de los círculos. */
.journey-tab:not(:last-child)::after {
  content: '';
  position: absolute;
  top: calc(0.5rem + 1rem);
  left: calc(50% + 1.125rem);
  right: calc(-50% + 1.125rem);
  height: 2px;
  background: var(--line);
}

.journey-tab.is-done:not(:last-child)::after {
  background: var(--accent);
}

.journey-dot {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--line-strong);
  border-radius: 9999px;
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.journey-tab.is-done .journey-dot {
  border-color: var(--accent);
  color: var(--accent);
}

.journey-tab[aria-selected='true'] {
  color: var(--fg);
}

.journey-tab[aria-selected='true'] .journey-dot {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}

.journey-panel {
  margin-top: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--surface);
}

@media (min-width: 48rem) {
  .journey-panel {
    padding: 1.75rem;
  }
}

.journey-grid {
  display: grid;
  gap: 1.5rem;
  min-height: 19rem;
}

@media (min-width: 56rem) {
  .journey-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 2rem;
  }
}

.journey-changes {
  margin-top: 0.5rem;
  display: grid;
  gap: 0.375rem;
  font-size: 0.9375rem;
}

.journey-changes li {
  position: relative;
  padding-left: 1.125rem;
}

.journey-changes li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.6em;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: var(--accent);
}

.journey-record {
  align-self: start;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 0.5rem;
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.journey-record-head {
  padding: 0.5rem 0.875rem;
  border-bottom: 1px solid var(--line);
  background: var(--surface-raised);
  font-size: 0.75rem;
  color: var(--muted);
}

.journey-field {
  display: grid;
  grid-template-columns: minmax(7.5rem, auto) 1fr;
  gap: 0.75rem;
  padding: 0.45rem 0.875rem;
  border-bottom: 1px solid var(--line);
}

.journey-field:last-child {
  border-bottom: 0;
}

.journey-field dt {
  color: var(--muted);
}

.journey-field dd {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.625rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.journey-field.is-changed {
  background: var(--accent-soft);
}

.journey-field.is-changed dd span {
  font-weight: 700;
}

.journey-field del {
  color: var(--muted);
  text-decoration-thickness: 1px;
}

.journey-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.journey-btn {
  min-height: 2.75rem;
  padding: 0.5rem 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.journey-btn:disabled {
  color: var(--muted);
  opacity: 0.5;
  cursor: not-allowed;
}

.journey-progress {
  position: relative;
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--line);
}

.journey-progress span {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
}

@media (prefers-reduced-motion: no-preference) {
  .journey-enter-active,
  .journey-leave-active {
    transition:
      opacity 160ms ease,
      transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .journey-enter-from {
    opacity: 0;
    transform: translateX(10px);
  }

  .journey-leave-to {
    opacity: 0;
  }

  .journey-progress span {
    transition: width 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
}
</style>
