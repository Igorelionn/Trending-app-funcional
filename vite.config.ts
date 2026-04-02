import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: process.cwd(),
  base: "/",
  publicDir: "public",
  define: {
    global: 'globalThis',
  },
  server: {
    host: "127.0.0.1", // Alterado de "0.0.0.0" para "127.0.0.1"
    port: 8090, // Alterado de 3000 para 8090
    strictPort: false, // Permitir fallback para outra porta se 8090 estiver ocupada
    cors: true,
    open: false,
    fs: {
      strict: false
    },
    hmr: true,
    headers: {
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    watch: {
      usePolling: false,
      interval: 1000,
      ignored: [
        '**/public/images/**/*.html',
        '**/email_template.html',
        '**/node_modules/**',
        '**/.git/**'
      ]
    },
    proxy: {
      // Proxy para API serverless local (desenvolvimento)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('⚠️ Proxy error (API serverless não está rodando?):', err.message);
          });
        },
      },
    },
  },
  preview: {
    port: 8090, // Alterado de 3000 para 8090
    host: "127.0.0.1", // Alterado de "0.0.0.0" para "127.0.0.1"
    strictPort: false
  },
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime"),
      "react-tiny-popover": path.resolve(__dirname, "./node_modules/react-tiny-popover"),
    },
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-tiny-popover',
      '@radix-ui/react-toast',
      '@livekit/components-react',
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react-router-dom',
      '@tanstack/react-query',
      '@radix-ui/react-toast',
      '@livekit/components-react',
      'hls.js',
    ],
  },
  build: {
    outDir: 'dist',
    sourcemap: mode === 'development',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    manifest: true,
  },
}));
