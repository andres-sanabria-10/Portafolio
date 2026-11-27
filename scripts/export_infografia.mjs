/**
 * Exporta una infografía de una nota a PNG para compartirla (por ejemplo en LinkedIn).
 *
 * Abre la página en Chrome sin interfaz, espera a que carguen las fuentes y
 * captura solo el elemento indicado, a doble resolución (≈1080 px de ancho).
 *
 * Uso (con `npm run dev` o `npm run preview` corriendo):
 *   node scripts/export_infografia.mjs <url> <selector> <salida.png> [tema]
 *
 * Ejemplo:
 *   node scripts/export_infografia.mjs \
 *     http://localhost:4321/aprende/el-viaje-de-un-dato/ \
 *     "#poster-viaje-dato" public/infografias/el-viaje-de-un-dato.png
 *
 * La ruta de Chrome se puede cambiar con la variable CHROME_PATH.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const [url, selector, salida, tema = 'light'] = process.argv.slice(2);
if (!url || !selector || !salida) {
  console.error('Uso: node scripts/export_infografia.mjs <url> <selector> <salida.png> [light|dark]');
  process.exit(1);
}

const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = 9344;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PUERTO}`,
    '--hide-scrollbars',
    `--user-data-dir=${join(tmpdir(), `infografia-${Date.now()}`)}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  let socket;
  for (let intento = 0; intento < 40 && !socket; intento++) {
    try {
      const pestañas = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
      const pagina = pestañas.find((p) => p.type === 'page');
      if (pagina) socket = new WebSocket(pagina.webSocketDebuggerUrl);
    } catch {
      await esperar(250);
    }
  }
  if (!socket) throw new Error('No se pudo conectar con Chrome.');
  await new Promise((resolve) => socket.addEventListener('open', resolve));

  let id = 0;
  const pendientes = new Map();
  socket.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    pendientes.get(mensaje.id)?.(mensaje);
  });
  const enviar = (method, params = {}) =>
    new Promise((resolve) => {
      const actual = ++id;
      pendientes.set(actual, resolve);
      socket.send(JSON.stringify({ id: actual, method, params }));
    });
  const evaluar = async (expression) =>
    (await enviar('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))
      .result?.result?.value;

  // Ancho de móvil grande: la infografía se ve en una columna, como en un post.
  await enviar('Emulation.setDeviceMetricsOverride', {
    width: 600,
    height: 1600,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await enviar('Page.enable');
  await enviar('Page.navigate', { url });
  await esperar(2500);
  await evaluar(`localStorage.setItem('theme', '${tema}'); document.documentElement.dataset.theme = '${tema}'; 'ok'`);
  await evaluar('document.fonts.ready.then(() => true)');

  const caja = await evaluar(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'start' });
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  })()`);
  if (!caja) throw new Error(`No se encontró el elemento ${selector} en ${url}.`);

  const { result } = await enviar('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { ...caja, scale: 1 },
  });
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, Buffer.from(result.data, 'base64'));
  console.log(`${salida}: ${Math.round(caja.width * 2)} × ${Math.round(caja.height * 2)} px`);
  socket.close();
} finally {
  chrome.kill();
}
