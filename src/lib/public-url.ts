/** `public/` asset URL for the current Vite `base` (e.g. GitHub project pages under `/repo-name/`). */
export function publicUrl(relative: string): string {
  const p = relative.replace(/^\/+/, "")
  return `${import.meta.env.BASE_URL}${p}`
}
