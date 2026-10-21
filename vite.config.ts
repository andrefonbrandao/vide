import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const versao = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string;

export default defineConfig({
  plugins: [react()],
  // Versão do app, usada para a janela de projeção saber se está atualizada.
  define: { __VERSAO__: JSON.stringify(versao) },
  test: {
    environment: 'happy-dom',
  },
} as never);
