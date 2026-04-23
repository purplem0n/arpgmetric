import { Navigate, Route, Routes } from "react-router-dom"

import {
  DEFAULT_GAME_PATH,
  SeasonLaunchMetrics,
} from "@/components/season-launch-metrics"

export function App() {
  return (
    <div className="mx-auto min-h-svh w-full max-w-7xl p-4 sm:p-6">
      <Routes>
        <Route path="/" element={<Navigate to={DEFAULT_GAME_PATH} replace />} />
        <Route path="/:gameId" element={<SeasonLaunchMetrics />} />
        <Route path="*" element={<Navigate to={DEFAULT_GAME_PATH} replace />} />
      </Routes>
      <footer className="text-muted-foreground mt-8 space-y-3 text-center text-xs">
        <p>
          Data taken from{" "}
          <a
            href="https://steamdb.info"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-90"
          >
            SteamDB
          </a>
          . Not affiliated with SteamDB or Steam.
        </p>
        <p className="font-mono">
          Press <kbd className="rounded border bg-muted px-1.5 py-0.5">d</kbd> to toggle
          dark mode
        </p>
      </footer>
    </div>
  )
}

export default App
