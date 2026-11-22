<script setup lang="ts">
/**
 * Detalle de una etapa del diagrama de trazabilidad. Se usa en el panel lateral
 * (escritorio) y dentro del <dialog> (móvil); el contenedor decide el rol.
 */
import { ref } from 'vue';
import type { TraceStage } from '../../i18n/trazabilidad';
import { fillTemplate, type TraceLabels } from './trace';

defineProps<{
  stage: TraceStage;
  index: number;
  total: number;
  laneTitle: string;
  labels: TraceLabels;
  headingId: string;
}>();

const emit = defineEmits<{ close: []; move: [step: -1 | 1] }>();

const heading = ref<HTMLElement | null>(null);
defineExpose({ focus: () => heading.value?.focus() });
</script>

<template>
  <div class="trace-detail">
    <div class="flex items-start justify-between gap-4">
      <p class="label-mono pt-1">
        {{ fillTemplate(labels.stageOf, { n: index + 1, total }) }} · {{ laneTitle }}
      </p>
      <button type="button" class="detail-icon" :aria-label="labels.close" @click="emit('close')">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" class="stroke-current" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <h3 :id="headingId" ref="heading" tabindex="-1" class="mt-2 text-xl font-semibold">
      {{ stage.title }}
    </h3>

    <dl class="mt-5 space-y-5 text-[0.9375rem]">
      <div>
        <dt class="label-mono">{{ labels.inputs }}</dt>
        <dd class="mt-1">{{ stage.inputs }}</dd>
      </div>
      <div>
        <dt class="label-mono">{{ labels.transform }}</dt>
        <dd class="mt-1">{{ stage.transform }}</dd>
      </div>
      <div class="problem">
        <dt class="label-mono">{{ labels.problem }}</dt>
        <dd class="mt-1">{{ stage.problem }}</dd>
      </div>
      <div v-if="stage.carriers?.length">
        <dt class="label-mono">{{ labels.carriers }}</dt>
        <dd class="mt-2">
          <ul class="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.8125rem]">
            <li v-for="carrier in stage.carriers" :key="carrier.name" class="flex justify-between gap-2">
              <span>{{ carrier.name.replace('Transportadora ', 'Transp. ') }}</span>
              <span :class="carrier.protocol === 'SOAP' ? 'protocol protocol-soap' : 'protocol'">
                {{ carrier.protocol }}
              </span>
            </li>
          </ul>
        </dd>
      </div>
      <div>
        <dt class="label-mono">{{ labels.tech }}</dt>
        <dd class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="item in stage.tech" :key="item" class="chip">{{ item }}</span>
        </dd>
      </div>
    </dl>

    <div class="mt-6 flex justify-between gap-3 border-t border-line pt-4">
      <button type="button" class="detail-nav" :disabled="index === 0" @click="emit('move', -1)">
        ← {{ labels.prev }}
      </button>
      <button type="button" class="detail-nav" :disabled="index === total - 1" @click="emit('move', 1)">
        {{ labels.next }} →
      </button>
    </div>
  </div>
</template>

<style scoped>
h3:focus {
  outline: none;
}

h3:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.problem dd {
  padding-left: 0.75rem;
  border-left: 1px solid var(--accent);
}

.protocol {
  padding: 0 0.375rem;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: var(--muted);
}

.protocol-soap {
  border-color: transparent;
  background-color: var(--surface-raised);
  color: var(--fg);
}

.detail-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-radius: var(--radius-ui);
  color: var(--muted);
}

.detail-icon:hover {
  background-color: var(--surface-raised);
  color: var(--fg);
}

.detail-nav {
  min-height: 2.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent);
}

.detail-nav:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.detail-nav:disabled {
  color: var(--muted);
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
