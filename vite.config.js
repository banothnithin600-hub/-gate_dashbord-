import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // must match your GitHub repo name exactly, wrapped in slashes
  base: "/-gate-ece-dashboard-/",
});
