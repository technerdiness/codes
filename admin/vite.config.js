import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      convex: path.resolve(__dirname, "node_modules/convex"),
    },
  },
  server: {
    host: true,
    port: 4173,
  },
});
