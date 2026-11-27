<script setup lang="ts">
/**
 * La misma tubería, dos entornos. El dato fluye sin parar por cinco etapas;
 * el selector cambia las piezas de cada etapa entre on-premise y AWS, en
 * cascada de izquierda a derecha, como si el dato las fuera reemplazando.
 *
 * - Los nombres de las etapas no cambian: solo la tecnología (esa es la idea).
 * - El color de la tubería indica el entorno.
 * - Con prefers-reduced-motion: los puntos quedan quietos y el cambio es inmediato.
 * - Se pausa fuera de pantalla o con la pestaña oculta.
 * - Lectores de pantalla: tabla con el contenido completo y anuncio del cambio.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CloudContent, Environment } from '../../i18n/cloud';
import { dotProgress, layoutPipeline, pointOnTrack, type LayoutSize, type Orientation } from './pipeline';

const props = withDefaults(defineProps<{ content: CloudContent; duration?: number; dots?: number }>(), {
  duration: 9,
  dots: 16,
});

const SIZE: LayoutSize = {
  horizontal: { width: 1100, height: 120, margin: 6, boxWidth: 168, boxHeight: 104 },
  vertical: { width: 340, margin: 6, boxWidth: 300, boxHeight: 84, gap: 30 },
};

const env = ref<Environment>('onprem');
const time = ref(0);
const reducedMotion = ref(false);
const onScreen = ref(true);
const pageVisible = ref(true);
const root = ref<HTMLElement | null>(null);

const views = computed(() =>
  (['horizontal', 'vertical'] as Orientation[]).map((orientation) => {
    const layout = layoutPipeline(props.content.stages.length, orientation, SIZE);
    const dots = Array.from({ length: props.dots }, (_, i) =>
      pointOnTrack(layout.track, dotProgress(time.value, i, props.dots, props.duration)),
    );
    return { orientation, layout, dots };
  }),
);

const announce = computed(() =>
  props.content.labels.showing.replace(
    '{env}',
    env.value === 'aws' ? props.content.labels.aws : props.content.labels.onprem,
  ),
);

let frame = 0;
let last = 0;
let observer: IntersectionObserver | undefined;
let motionQuery: MediaQueryList | undefined;

function tick(now: number) {
  const running = !reducedMotion.value && onScreen.value && pageVisible.value;
  if (last && running) time.value += Math.min(now - last, 100) / 1000;
  last = now;
  frame = requestAnimationFrame(tick);
}

const onMotion = () => (reducedMotion.value = motionQuery?.matches ?? false);
const onVisibility = () => (pageVisible.value = document.visibilityState === 'visible');

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  onMotion();
  motionQuery.addEventListener('change', onMotion);
  document.addEventListener('visibilitychange', onVisibility);
  if (root.value && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => (onScreen.value = entry?.isIntersecting ?? true));
    observer.observe(root.value);
  }
  frame = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  observer?.disconnect();
  motionQuery?.removeEventListener('change', onMotion);
  document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <figure ref="root" class="cloud-pipe not-prose my-10" :data-env="env">
    <div class="cloud-toggle" role="group" :aria-label="content.labels.group">
      <span class="cloud-toggle-pill" aria-hidden="true" />
      <button type="button" :aria-pressed="env === 'onprem'" @click="env = 'onprem'">
        {{ content.labels.onprem }}
      </button>
      <button type="button" :aria-pressed="env === 'aws'" @click="env = 'aws'">
        {{ content.labels.aws }}
      </button>
    </div>
    <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>

    <svg
      v-for="view in views"
      :key="view.orientation"
      :class="['cloud-svg', view.orientation === 'horizontal' ? 'hidden md:block' : 'mx-auto max-w-sm md:hidden']"
      :viewBox="`0 0 ${view.layout.width} ${view.layout.height}`"
      aria-hidden="true"
    >
      <!-- El tubo: un trazo grueso de fondo y uno fino del color del entorno. -->
      <line
        :x1="view.layout.track.from.x"
        :y1="view.layout.track.from.y"
        :x2="view.layout.track.to.x"
        :y2="view.layout.track.to.y"
        class="pipe-shell"
        stroke-width="14"
        stroke-linecap="round"
      />
      <line
        :x1="view.layout.track.from.x"
        :y1="view.layout.track.from.y"
        :x2="view.layout.track.to.x"
        :y2="view.layout.track.to.y"
        class="pipe-core"
        stroke-width="3"
        stroke-linecap="round"
      />
      <circle v-for="(dot, i) in view.dots" :key="i" :cx="dot.x" :cy="dot.y" r="4.5" class="pipe-dot" />

      <g
        v-for="(box, i) in view.layout.boxes"
        :key="content.stages[i]?.id ?? i"
        class="stage"
        :style="{ '--i': i }"
      >
        <rect :x="box.x" :y="box.y" :width="box.width" :height="box.height" rx="10" class="stage-box" />
        <text :x="box.cx" :y="box.y + 22" text-anchor="middle" class="stage-name">
          {{ content.stages[i]?.name }}
        </text>
        <!-- Las dos piezas existen; el entorno decide cuál se ve. -->
        <g class="piece piece-onprem">
          <text :x="box.cx" :y="box.cy + 9" text-anchor="middle" class="piece-tech">
            {{ content.stages[i]?.onprem.tech }}
          </text>
          <text :x="box.cx" :y="box.cy + 29" text-anchor="middle" class="piece-detail">
            {{ content.stages[i]?.onprem.detail }}
          </text>
        </g>
        <g class="piece piece-aws">
          <text :x="box.cx" :y="box.cy + 9" text-anchor="middle" class="piece-tech">
            {{ content.stages[i]?.aws.tech }}
          </text>
          <text :x="box.cx" :y="box.cy + 29" text-anchor="middle" class="piece-detail">
            {{ content.stages[i]?.aws.detail }}
          </text>
        </g>
      </g>
    </svg>

    <table class="sr-only">
      <caption>{{ content.labels.tableCaption }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ content.labels.stage }}</th>
          <th scope="col">{{ content.labels.onprem }}</th>
          <th scope="col">{{ content.labels.aws }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="stage in content.stages" :key="stage.id">
          <th scope="row">{{ stage.name }}</th>
          <td>{{ stage.onprem.tech }} ({{ stage.onprem.detail }})</td>
          <td>{{ stage.aws.tech }} ({{ stage.aws.detail }})</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
/* Color del entorno: verde agua on-premise, ámbar en AWS. */
.cloud-pipe {
  --env: var(--accent);
  --env-soft: var(--accent-soft);
}

.cloud-pipe[data-env='aws'] {
  --env: #d97706;
  --env-soft: rgb(217 119 6 / 0.14);
}

:global([data-theme='dark']) .cloud-pipe[data-env='aws'] {
  --env: #fbbf24;
  --env-soft: rgb(251 191 36 / 0.14);
}

/* ---------- Selector con píldora deslizante ---------- */
.cloud-toggle {
  position: relative;
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 1.25rem;
  padding: 0.25rem;
  border: 1px solid var(--line-strong);
  border-radius: 9999px;
  background: var(--surface);
}

.cloud-toggle button {
  position: relative;
  z-index: 1;
  min-height: 2.5rem;
  min-width: 7.5rem;
  padding: 0.25rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--muted);
  transition: color 200ms ease;
}

.cloud-toggle button[aria-pressed='true'] {
  color: var(--bg);
}

/* Sobre el ámbar, texto oscuro en ambos temas (contraste AA). */
.cloud-pipe[data-env='aws'] .cloud-toggle button[aria-pressed='true'] {
  color: #1c1206;
}

.cloud-toggle-pill {
  position: absolute;
  top: 0.25rem;
  bottom: 0.25rem;
  left: 0.25rem;
  width: calc(50% - 0.25rem);
  border-radius: 9999px;
  background: var(--env);
  transition:
    transform 320ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 320ms ease;
}

.cloud-pipe[data-env='aws'] .cloud-toggle-pill {
  transform: translateX(100%);
}

/* ---------- Tubería ---------- */
.cloud-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.pipe-shell {
  stroke: var(--env-soft);
  transition: stroke 400ms ease;
}

.pipe-core {
  stroke: var(--env);
  opacity: 0.5;
  transition: stroke 400ms ease;
}

.pipe-dot {
  fill: var(--env);
  transition: fill 400ms ease;
}

.stage-box {
  fill: var(--surface);
  stroke: var(--line-strong);
  stroke-width: 1.25;
  transition: stroke 400ms ease;
  transition-delay: calc(var(--i) * 70ms);
}

.cloud-pipe[data-env='aws'] .stage-box {
  stroke: var(--env);
}

.stage-name {
  fill: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
}

.piece-tech {
  fill: var(--fg);
  font-size: 18px;
  font-weight: 700;
}

.piece-detail {
  fill: var(--muted);
  font-size: 12.5px;
}

/*
 * Cambio de pieza: la saliente sube y se desvanece, la entrante llega desde
 * abajo. Cada etapa empieza 70 ms después de la anterior: la cascada va en el
 * sentido del flujo.
 */
.piece {
  transform-box: fill-box;
  transform-origin: center;
  transition:
    opacity 260ms ease,
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--i) * 70ms);
}

.piece-aws,
.cloud-pipe[data-env='aws'] .piece-onprem {
  opacity: 0;
  transform: translateY(10px);
}

.cloud-pipe[data-env='aws'] .piece-onprem {
  transform: translateY(-10px);
}

.cloud-pipe[data-env='aws'] .piece-aws {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .piece,
  .stage-box,
  .cloud-toggle-pill,
  .pipe-shell,
  .pipe-core,
  .pipe-dot {
    transition: none;
  }
}
</style>
