<script setup lang="ts">
/**
 * Editor SQL que corre DuckDB-WASM en el navegador sobre el dataset sintético
 * de envíos (vista `envios`). Las consultas de ejemplo salen de `scripts/queries`.
 *
 * El motor se descarga solo cuando alguien ejecuta la primera consulta. Ctrl o
 * Cmd + Enter ejecuta desde el editor; Tab conserva su función normal (mover el
 * foco) para no atrapar a quien navega con teclado.
 */
import { computed, onBeforeUnmount, ref, shallowRef, useId } from 'vue';
import type { PlaygroundQuery } from '../../lib/sql-queries';
import type { PlaygroundLabels } from './playground-labels';
import type { QueryResult, SqlEngine } from './sql-engine';

const props = withDefaults(
  defineProps<{
    queries: PlaygroundQuery[];
    parquetUrl: string;
    labels: PlaygroundLabels;
    maxRows?: number;
  }>(),
  { maxRows: 200 },
);

// useId da el mismo id en el servidor y en el navegador (sin desajustes de hidratación).
const uid = `sqlpg-${useId()}`;
const selectedId = ref(props.queries[0]?.id ?? '');
const sql = ref(props.queries[0]?.sql ?? 'SELECT * FROM envios LIMIT 10;');
const status = ref<'idle' | 'loading' | 'running' | 'done' | 'error'>('idle');
const result = shallowRef<QueryResult | null>(null);
const errorMessage = ref('');
const engine = shallowRef<SqlEngine | null>(null);
let enginePromise: Promise<SqlEngine> | null = null;

const selected = computed(() => props.queries.find((q) => q.id === selectedId.value));
const busy = computed(() => status.value === 'loading' || status.value === 'running');

const fill = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

const statusText = computed(() => {
  if (status.value === 'loading') return props.labels.loading;
  if (status.value === 'running') return props.labels.running;
  if (status.value === 'done' && result.value) {
    const { total, ms, rows } = result.value;
    const base = fill(props.labels.rows, { n: total, ms });
    return total > rows.length ? `${base} ${fill(props.labels.truncated, { n: rows.length })}` : base;
  }
  return '';
});

function getEngine(): Promise<SqlEngine> {
  if (!enginePromise) {
    enginePromise = import('./sql-engine')
      .then(({ createSqlEngine }) => createSqlEngine(props.parquetUrl))
      .then((created) => {
        engine.value = created;
        return created;
      })
      .catch((error: unknown) => {
        enginePromise = null;
        throw error;
      });
  }
  return enginePromise;
}

async function run() {
  if (busy.value || !sql.value.trim()) return;
  errorMessage.value = '';
  try {
    if (!engine.value) status.value = 'loading';
    const db = await getEngine();
    status.value = 'running';
    result.value = await db.run(sql.value, props.maxRows);
    status.value = 'done';
  } catch (error) {
    result.value = null;
    errorMessage.value = error instanceof Error ? error.message : String(error);
    status.value = 'error';
  }
}

function choose(query: PlaygroundQuery) {
  selectedId.value = query.id;
  sql.value = query.sql;
  void run();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void run();
  }
}

function onInput() {
  // Si el texto deja de ser el de un ejemplo, ningún ejemplo queda marcado.
  if (selected.value && selected.value.sql !== sql.value) selectedId.value = '';
}

onBeforeUnmount(() => {
  void engine.value?.close();
});
</script>

<template>
  <div class="sql-playground not-prose my-10 rounded-ui border border-line bg-surface">
    <div class="border-b border-line p-4 md:p-5">
      <p class="label-mono">{{ labels.badge }}</p>
      <p :id="`${uid}-examples`" class="mt-4 text-sm font-semibold">{{ labels.examples }}</p>
      <div class="mt-2 flex flex-wrap gap-2" role="group" :aria-labelledby="`${uid}-examples`">
        <button
          v-for="query in queries"
          :key="query.id"
          type="button"
          class="example"
          :aria-pressed="query.id === selectedId"
          :disabled="busy"
          @click="choose(query)"
        >
          {{ query.title }}
        </button>
      </div>
      <p v-if="selected?.description" class="mt-3 max-w-3xl text-sm text-muted">
        {{ selected.description }}
      </p>
    </div>

    <div class="p-4 md:p-5">
      <label :for="`${uid}-editor`" class="sr-only">{{ labels.editor }}</label>
      <textarea
        :id="`${uid}-editor`"
        v-model="sql"
        class="editor"
        rows="12"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        :aria-describedby="`${uid}-shortcut`"
        @keydown="onKeydown"
        @input="onInput"
      />

      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="run">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class="fill-current">
            <path d="M4 2.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L4.9 2.1a.6.6 0 0 0-.9.5Z" />
          </svg>
          {{ busy ? labels.running : labels.run }}
        </button>
        <span :id="`${uid}-shortcut`" class="label-mono">{{ labels.shortcut }}</span>
        <span class="label-mono ml-auto" role="status" aria-live="polite">{{ statusText }}</span>
      </div>

      <div
        v-if="status === 'error'"
        role="alert"
        class="mt-4 rounded-ui border border-line-strong bg-bg p-4"
      >
        <p class="text-sm font-semibold">{{ labels.error }}</p>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted">{{ errorMessage }}</pre>
      </div>

      <div
        v-if="result && status !== 'error'"
        class="results mt-4"
        role="region"
        :aria-label="labels.results"
        tabindex="0"
      >
        <p v-if="result.rows.length === 0" class="p-4 text-sm text-muted">{{ labels.empty }}</p>
        <table v-else class="w-full text-sm">
          <thead>
            <tr>
              <th
                v-for="column in result.columns"
                :key="column.name"
                scope="col"
                :class="column.numeric ? 'text-right' : 'text-left'"
              >
                {{ column.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in result.rows" :key="r">
              <td
                v-for="(cell, c) in row"
                :key="c"
                :class="result.columns[c]?.numeric ? 'text-right tabular-nums' : 'text-left'"
              >
                <span v-if="cell === null" class="text-muted">NULL</span>
                <template v-else>{{ cell }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.example {
  min-height: 2.25rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-ui);
  font-size: 0.8125rem;
  color: var(--muted);
  text-align: left;
  transition:
    border-color 150ms ease,
    color 150ms ease,
    background-color 150ms ease;
}

.example:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--fg);
}

.example[aria-pressed='true'] {
  border-color: var(--accent);
  background-color: var(--accent-soft);
  color: var(--fg);
}

.example:disabled {
  cursor: progress;
}

.editor {
  display: block;
  width: 100%;
  padding: 0.875rem 1rem;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-ui);
  background-color: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.6;
  tab-size: 4;
  resize: vertical;
}

.editor:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.btn:disabled {
  cursor: progress;
  opacity: 0.75;
}

.results {
  max-height: 28rem;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-ui);
  background-color: var(--bg);
}

.results th {
  position: sticky;
  top: 0;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--line-strong);
  background-color: var(--surface-raised);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
  white-space: nowrap;
}

.results td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  white-space: nowrap;
}

.results tbody tr:last-child td {
  border-bottom: 0;
}
</style>
