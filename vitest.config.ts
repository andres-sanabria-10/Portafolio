import { defineConfig } from 'vitest/config';

// Las pruebas actuales cubren lógica pura (helpers de i18n y de contenido),
// así que no necesitan el pipeline de Astro. Cuando lleguen las pruebas de
// componentes Vue (fase 3+), añadir aquí el plugin de Vue y un entorno DOM.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
