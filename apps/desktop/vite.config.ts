import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ORT_DIST = resolve(__dirname, 'node_modules/onnxruntime-web/dist')
const ORT_MJS  = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.asyncify.mjs']
const ORT_WASM = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.asyncify.wasm']

// Plugin: sirve los .mjs de ORT desde node_modules en dev
// y los copia al directorio de salida en build.
// Los .wasm binarios van en public/ (Vite los copia automáticamente a dist/).
function ortWasmPlugin() {
  return {
    name: 'ort-wasm',

    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = (req.url as string).split('?')[0]
        if (/^\/ort-wasm.*\.mjs$/.test(url)) {
          try {
            const content = readFileSync(resolve(ORT_DIST, url.slice(1)))
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            res.end(content)
            return
          } catch { /* no encontrado, deja pasar */ }
        }
        next()
      })
    },

    writeBundle(options: any) {
      const outDir = options.dir ?? resolve(__dirname, 'dist')
      mkdirSync(outDir, { recursive: true })
      for (const f of [...ORT_MJS, ...ORT_WASM]) {
        try { copyFileSync(resolve(ORT_DIST, f), resolve(outDir, f)) } catch { /* ok */ }
      }
    },
  }
}

export default defineConfig(async () => ({
  plugins: [react(), ortWasmPlugin()],

  server: {
    port:       1420,
    strictPort: true,
    host:       process.env.TAURI_DEV_HOST ?? 'localhost',
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },

  envPrefix: ['VITE_', 'TAURI_ENV_*'],

  build: {
    target:    process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify:    !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
