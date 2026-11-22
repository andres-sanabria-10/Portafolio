<script setup lang="ts">
/**
 * Animación del pipeline del inicio: registros que viajan por las etapas
 * Fuente → Ingesta → Transformación → Almacén → Consumo.
 *
 * - En pantallas anchas se dibuja en horizontal y en móvil en vertical (dos SVG
 *   que se alternan con CSS, así el HTML del servidor ya trae el correcto).
 * - Con `prefers-reduced-motion: reduce` no hay movimiento: los registros quedan
 *   quietos y repartidos por la pista, y el botón de pausa no se muestra.
 * - Se detiene sola cuando sale de la pantalla o la pestaña queda oculta, y
 *   tiene botón de pausa (WCAG 2.2.2: contenido que se mueve más de 5 s).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  dotAppearance,
  dotProgress,
  layoutPipeline,
  pointOnTrack,
  stageFraction,
  type Orientation,
  type PipelineLayout,
  type PipelineStage,
} from './pipeline';

const props = withDefaults(
  defineProps<{
    stages: PipelineStage[];
    /** Texto alternativo del diagrama. */
    label: string;
    pauseLabel: string;
    playLabel: string;
    rawLabel: string;
    validatedLabel: string;
    /** Etapa donde los registros se validan; por defecto, la del medio. */
    transformIndex?: number;
    /** Segundos que tarda un registro en recorrer todo el pipeline. */
    duration?: number;
    /** Registros en circulación a la vez. */
    dots?: number;
    /** Uno de cada N registros se filtra en la transformación (0 = ninguno). */
    dropEvery?: number;
  }>(),
  { duration: 12, dots: 14, dropEvery: 4 },
);

const transformIndex = computed(() =>
  Math.min(props.transformIndex ?? Math.floor(props.stages.length / 2), props.stages.length - 1),
);

const layouts = computed(
  () =>
    Object.fromEntries(
      (['horizontal', 'vertical'] as const).map((o) => [o, layoutPipeline(props.stages.length, o)]),
    ) as Record<Orientation, PipelineLayout>,
);

const time = ref(0);
const playing = ref(true);
const reducedMotion = ref(false);
const onScreen = ref(true);
const pageVisible = ref(true);

const running = computed(
  () => playing.value && !reducedMotion.value && onScreen.value && pageVisible.value,
);

function dotsFor(layout: PipelineLayout) {
  const transformAt = stageFraction(layout, transformIndex.value);
  return Array.from({ length: props.dots }, (_, i) => {
    const progress = dotProgress(time.value, i, props.dots, props.duration);
    const { validated, visible } = dotAppearance(progress, i, transformAt, props.dropEvery);
    return { ...pointOnTrack(layout.track, progress), validated, visible };
  });
}

const views = computed(() =>
  (['horizontal', 'vertical'] as const).map((orientation) => {
    const layout = layouts.value[orientation];
    return { orientation, layout, dots: dotsFor(layout) };
  }),
);

const root = ref<HTMLElement | null>(null);
let frame = 0;
let last = 0;
let observer: IntersectionObserver | undefined;
let motionQuery: MediaQueryList | undefined;

function tick(now: number) {
  if (last && running.value) time.value += Math.min(now - last, 100) / 1000;
  last = now;
  frame = requestAnimationFrame(tick);
}

const onMotionChange = () => {
  reducedMotion.value = motionQuery?.matches ?? false;
};
const onVisibilityChange = () => {
  pageVisible.value = document.visibilityState === 'visible';
};

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  onMotionChange();
  motionQuery.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  onVisibilityChange();
  if (root.value && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      onScreen.value = entry?.isIntersecting ?? true;
    });
    observer.observe(root.value);
  }
  frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  observer?.disconnect();
  motionQuery?.removeEventListener('change', onMotionChange);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<template>
  <figure ref="root" class="pipeline-flow">
    <svg
      v-for="view in views"
      :key="view.orientation"
      :class="['h-auto w-full', view.orientation === 'horizontal' ? 'hidden md:block' : 'mx-auto max-w-sm md:hidden']"
      :viewBox="`0 0 ${view.layout.width} ${view.layout.height}`"
      role="img"
      :aria-label="label"
    >
      <defs>
        <marker
          :id="`pf-arrow-${view.orientation}`"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M1 1 9 5 1 9" class="fill-none stroke-line-strong" stroke-width="1.6" />
        </marker>
      </defs>

      <line
        v-for="(segment, i) in view.layout.connectors"
        :key="`c${i}`"
        :x1="segment.from.x"
        :y1="segment.from.y"
        :x2="segment.to.x"
        :y2="segment.to.y"
        class="stroke-line-strong"
        stroke-width="1.5"
        :marker-end="`url(#pf-arrow-${view.orientation})`"
      />

      <!-- Los puntos van antes que las cajas: al pasar por una etapa quedan detrás. -->
      <circle
        v-for="(dot, i) in view.dots"
        :key="`d${i}`"
        :cx="dot.x"
        :cy="dot.y"
        :r="dot.validated ? 5 : 3.5"
        :class="dot.validated ? 'fill-accent' : 'fill-muted'"
        :opacity="dot.visible ? 1 : 0"
      />

      <g v-for="(box, i) in view.layout.boxes" :key="stages[i]?.id ?? i">
        <rect
          :x="box.x"
          :y="box.y"
          :width="box.width"
          :height="box.height"
          rx="8"
          :class="['fill-bg', i === transformIndex ? 'stroke-accent' : 'stroke-line-strong']"
          :stroke-width="i === transformIndex ? 2 : 1.25"
        />
        <text
          :x="box.cx"
          :y="box.cy - 5"
          text-anchor="middle"
          class="fill-fg font-sans text-[17px] font-semibold"
        >
          {{ stages[i]?.label }}
        </text>
        <text
          :x="box.cx"
          :y="box.cy + 17"
          text-anchor="middle"
          class="fill-muted font-mono text-[12px]"
        >
          {{ stages[i]?.detail }}
        </text>
      </g>
    </svg>

    <figcaption class="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <ul class="label-mono flex flex-wrap gap-x-5 gap-y-1">
        <li class="flex items-center gap-2">
          <span class="inline-block size-[7px] rounded-full bg-muted" aria-hidden="true" />
          {{ rawLabel }}
        </li>
        <li class="flex items-center gap-2">
          <span class="inline-block size-[10px] rounded-full bg-accent" aria-hidden="true" />
          {{ validatedLabel }}
        </li>
      </ul>
      <button
        v-if="!reducedMotion"
        type="button"
        class="pipeline-toggle"
        :aria-pressed="!playing"
        @click="playing = !playing"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class="fill-current">
          <template v-if="playing">
            <rect x="3" y="2.5" width="3.5" height="11" rx="1" />
            <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" />
          </template>
          <path v-else d="M4 2.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L4.9 2.1a.6.6 0 0 0-.9.5Z" />
        </svg>
        {{ playing ? pauseLabel : playLabel }}
      </button>
    </figcaption>
  </figure>
</template>

<style scoped>
.pipeline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-ui);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg);
  transition:
    border-color 150ms ease,
    color 150ms ease;
}

.pipeline-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
