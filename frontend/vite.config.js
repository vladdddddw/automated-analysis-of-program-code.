import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BASE задає підкаталог для GitHub Pages (за замовчуванням "/").
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
