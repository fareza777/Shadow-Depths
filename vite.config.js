// Vite config for Shadow Depths.
// Kept intentionally minimal: zero plugins until v0.2 (Capacitor wrap)
// when we will need `base: './'` and an asset-copy hook.
//
// Why these choices:
// - server.host = true → bisa diakses dari device fisik di LAN saat playtest mobile.
// - build.target = 'es2020' → modern enough untuk semua browser Capacitor-compatible.
// - build.assetsInlineLimit = 0 → spritesheet (v0.3) tidak di-inline jadi base64.
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: './',
  server: {
    host: true,
    port: 5173,
    strictPort: true
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    // Source maps balloon deploy size (~1.7MB) and have caused Vercel deploy failures.
    sourcemap: false
  }
});
