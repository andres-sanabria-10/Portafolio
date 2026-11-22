<script setup lang="ts">
/**
 * Tablero del caso de trazabilidad, con datos 100 % sintéticos:
 * - "Tiempo por ruta": matriz ruta × transportadora con los días de despacho a
 *   entrega, resaltando la más rápida de cada ruta (solo rutas compartidas).
 * - "Flete vs venta": semáforo de la meta del 1 % por transportadora y costo del
 *   flete por kg según el tipo de destino.
 *
 * Pestañas con el patrón ARIA de tabs: flechas, Inicio y Fin mueven entre
 * pestañas; la pestaña activa es la única en el orden de tabulación.
 */
import { computed, ref, useId } from 'vue';
import {
  buildCostMatrix,
  buildRouteMatrix,
  carrierLetter,
  formatCop,
  formatNumber,
  type DashboardLabels,
  type FreightSummary,
  type RouteTimes,
} from './dashboard';

const props = defineProps<{
  routes: RouteTimes[];
  freight: FreightSummary;
  lang: 'es' | 'en';
  labels: DashboardLabels;
}>();

const uid = `dash-${useId()}`;
const tabs = computed(() => [
  { id: 'rutas', label: props.labels.tabRoutes },
  { id: 'flete', label: props.labels.tabFreight },
]);
const active = ref<'rutas' | 'flete'>('rutas');
const tabEls = ref<HTMLButtonElement[]>([]);

function onTabKeydown(event: KeyboardEvent, index: number) {
  const last = tabs.value.length - 1;
  const next =
    event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
    : event.key === 'Home' ? 0
    : event.key === 'End' ? last
    : null;
  if (next === null) return;
  event.preventDefault();
  active.value = tabs.value[next]!.id as 'rutas' | 'flete';
  tabEls.value[next]?.focus();
}

const matrix = computed(() => buildRouteMatrix(props.routes));
const costs = computed(() => buildCostMatrix(props.freight.costo_kg_por_destino));
const n = (value: number, digits = 0) => formatNumber(value, props.lang, digits);
const cop = (value: number) => formatCop(value, props.lang);
const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

const freightIntro = computed(() =>
  fill(props.labels.freightIntro, {
    pct: n(props.freight.general.pct_en_rojo, 1),
    meta: n(props.freight.meta_pct),
    total: cop(props.freight.general.pesos_sobre_la_meta),
  }),
);
</script>

<template>
  <div class="dashboard not-prose my-10 rounded-ui border border-line bg-surface">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 pt-3 md:px-5">
      <div role="tablist" :aria-label="labels.tablist" class="flex gap-1">
        <button
          v-for="(tab, i) in tabs"
          :id="`${uid}-tab-${tab.id}`"
          :key="tab.id"
          ref="tabEls"
          type="button"
          role="tab"
          class="tab"
          :aria-selected="active === tab.id"
          :aria-controls="`${uid}-panel-${tab.id}`"
          :tabindex="active === tab.id ? 0 : -1"
          @click="active = tab.id as 'rutas' | 'flete'"
          @keydown="onTabKeydown($event, i)"
        >
          {{ tab.label }}
        </button>
      </div>
      <p class="label-mono pb-3">{{ labels.badge }}</p>
    </div>

    <!-- Tiempo por ruta -->
    <div
      v-show="active === 'rutas'"
      :id="`${uid}-panel-rutas`"
      role="tabpanel"
      :aria-labelledby="`${uid}-tab-rutas`"
      tabindex="0"
      class="panel"
    >
      <p class="max-w-3xl text-sm text-muted">{{ labels.routesIntro }}</p>
      <div class="table-wrap mt-4">
        <table class="w-full text-sm">
          <caption class="sr-only">{{ labels.routesCaption }}</caption>
          <thead>
            <tr>
              <th scope="col" class="text-left">{{ labels.route }}</th>
              <th v-for="carrier in matrix.carriers" :key="carrier" scope="col" class="text-right">
                <abbr :title="carrier">{{ carrierLetter(carrier) }}</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in matrix.rows" :key="row.ruta">
              <th scope="row" class="route-name">
                {{ row.ruta }}
                <span class="block font-mono text-[0.6875rem] font-normal text-muted">
                  {{ n(row.entregas) }} {{ labels.deliveries }}
                </span>
              </th>
              <td
                v-for="(cell, c) in row.cells"
                :key="matrix.carriers[c]"
                class="text-right tabular-nums"
                :class="{ 'is-fastest': cell?.fastest }"
              >
                <template v-if="cell">
                  {{ n(cell.dias, 2) }}
                  <span v-if="cell.fastest" class="sr-only">({{ labels.fastest }})</span>
                </template>
                <template v-else>
                  <span aria-hidden="true" class="text-muted">—</span>
                  <span class="sr-only">{{ labels.noData }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span class="flex items-center gap-1.5">
          <span class="legend-swatch is-fastest" aria-hidden="true" />{{ labels.fastest }}
        </span>
        <span>{{ labels.days }}</span>
        <span>{{ labels.routesNote }}</span>
      </p>
    </div>

    <!-- Flete vs venta -->
    <div
      v-show="active === 'flete'"
      :id="`${uid}-panel-flete`"
      role="tabpanel"
      :aria-labelledby="`${uid}-tab-flete`"
      tabindex="0"
      class="panel"
    >
      <p class="max-w-3xl text-sm">{{ freightIntro }}</p>

      <div class="table-wrap mt-4">
        <table class="w-full text-sm">
          <caption class="sr-only">{{ labels.freightCaption }}</caption>
          <thead>
            <tr>
              <th scope="col" class="text-left">{{ labels.carrier }}</th>
              <th scope="col" class="text-right">{{ labels.shipments }}</th>
              <th scope="col" class="w-[38%] text-left">{{ labels.red }}</th>
              <th scope="col" class="text-right">{{ labels.freightOverSale }}</th>
              <th scope="col" class="text-right">{{ labels.overTarget }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in freight.por_transportadora" :key="row.transportadora">
              <th scope="row" class="text-left font-medium">{{ row.transportadora }}</th>
              <td class="text-right tabular-nums">{{ n(row.guias) }}</td>
              <td>
                <span class="flex items-center gap-2">
                  <span class="semaforo" aria-hidden="true">
                    <span class="semaforo-red" :style="{ width: `${row.pct_en_rojo}%` }" />
                  </span>
                  <span class="w-12 shrink-0 text-right tabular-nums">{{ n(row.pct_en_rojo, 1) }} %</span>
                </span>
              </td>
              <td class="text-right tabular-nums" :class="{ 'text-danger': row.flete_pct_venta > freight.meta_pct }">
                {{ n(row.flete_pct_venta, 2) }} %
              </td>
              <td class="text-right tabular-nums">{{ cop(row.pesos_sobre_la_meta) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span class="flex items-center gap-1.5">
          <span class="legend-dot bg-danger" aria-hidden="true" />{{ labels.red }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="legend-dot bg-accent" aria-hidden="true" />{{ labels.green }}
        </span>
      </p>

      <h3 class="mt-8 text-sm font-semibold">{{ labels.costCaption }}</h3>
      <div class="table-wrap mt-3">
        <table class="w-full text-sm">
          <caption class="sr-only">{{ labels.costCaption }}</caption>
          <thead>
            <tr>
              <th scope="col" class="text-left">{{ labels.destination }}</th>
              <th v-for="carrier in costs.carriers" :key="carrier" scope="col" class="text-right">
                <abbr :title="carrier">{{ carrierLetter(carrier) }}</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in costs.rows" :key="row.tipo">
              <th scope="row" class="text-left font-medium">
                {{ labels.destinationTypes[row.tipo] ?? row.tipo }}
              </th>
              <td v-for="(value, c) in row.cells" :key="costs.carriers[c]" class="text-right tabular-nums">
                <template v-if="value !== null">{{ cop(value) }}</template>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-muted">{{ labels.freightNote }}</p>
    </div>
  </div>
</template>

<style scoped>
.tab {
  min-height: 2.75rem;
  padding: 0.5rem 0.875rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--muted);
  transition:
    color 150ms ease,
    border-color 150ms ease;
}

.tab:hover {
  color: var(--fg);
}

.tab[aria-selected='true'] {
  border-bottom-color: var(--accent);
  color: var(--fg);
}

.panel {
  padding: 1.25rem 1rem;
}

@media (min-width: 48rem) {
  .panel {
    padding: 1.5rem 1.25rem;
  }
}

.panel:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-ui);
  background-color: var(--bg);
}

th,
td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}

thead th {
  background-color: var(--surface-raised);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}

tbody tr:last-child > * {
  border-bottom: 0;
}

abbr {
  text-decoration: none;
}

.route-name {
  text-align: left;
  font-weight: 500;
  position: sticky;
  left: 0;
  background-color: var(--bg);
}

td.is-fastest {
  background-color: var(--accent-soft);
  font-weight: 700;
  color: var(--fg);
}

.legend-swatch {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 2px;
}

.legend-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
}

/* Barra del semáforo: verde de fondo y la parte en rojo encima. */
.semaforo {
  position: relative;
  display: block;
  flex: 1;
  height: 0.5rem;
  min-width: 5rem;
  overflow: hidden;
  border-radius: 9999px;
  background-color: var(--accent);
  opacity: 0.9;
}

.semaforo-red {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: var(--danger);
}
</style>
