import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite serve `public/` na raiz: caminhos como "/assets/icons/neto.png" funcionam.
// O proxy redireciona /api/* para o backend Express em :3001 durante dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
