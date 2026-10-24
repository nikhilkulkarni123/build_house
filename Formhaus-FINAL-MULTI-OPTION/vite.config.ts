import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ["three", "react", "react-dom"] },
  optimizeDeps: {
    include: [
      "three",
      "three/examples/jsm/renderers/SVGRenderer.js",
      "three/examples/jsm/controls/OrbitControls.js",
      "three/examples/jsm/exporters/GLTFExporter.js",
    ],
  },
  server: {
    proxy: {
      "/api": process.env.BACKEND_URL || "http://127.0.0.1:8000",
      "/health": process.env.BACKEND_URL || "http://127.0.0.1:8000",
    },
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
