import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
// GitHub project pages need a repo-scoped base; set GITHUB_PAGES_BASE in CI (see .github/workflows).
const base = process.env.GITHUB_PAGES_BASE?.replace(/\/?$/, "/") ?? "/"

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
