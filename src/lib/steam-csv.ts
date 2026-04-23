import type { GameId } from "@/lib/arpg-types"
import { publicUrl } from "@/lib/public-url"

/** SteamDB history CSVs in public/ (see public/steamdb/readme.md). */
export const STEAM_CSV_PATH: Record<GameId, string> = {
  diablo4: publicUrl("steamdb/diablo4_2344520.csv"),
  poe1: publicUrl("steamdb/poe1_238960.csv"),
  poe2: publicUrl("steamdb/poe2_2694490.csv"),
  last_epoch: publicUrl("steamdb/lastepoch_899770.csv"),
}

/** App id in filenames: `poe1_238960.csv` → 238960 */
function steamAppIdFromCsvPath(path: string): number {
  const m = path.match(/_(\d+)\.csv$/)
  if (!m) throw new Error(`Expected *_<appid>.csv, got: ${path}`)
  return Number.parseInt(m[1], 10)
}

export function steamdbAppPageUrl(gameId: GameId): string {
  return `https://steamdb.info/app/${steamAppIdFromCsvPath(STEAM_CSV_PATH[gameId])}/`
}

/**
 * Per UTC date (YYYY-MM-DD), max Steam "Players" over all rows for that day.
 * (SteamDB exports may include hourly rows; the graph peak for a day is the max of those.)
 */
export function parseSteamdbPeakCsv(text: string): ReadonlyMap<string, number | null> {
  const byDate = new Map<string, number | null>()
  const samples = new Map<string, number[]>()
  for (const line of text.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith('"DateTime"')) continue
    const endFirst = t.indexOf('",', 1)
    if (endFirst < 0) continue
    const dateTime = t.slice(1, endFirst)
    const ymd = dateTime.slice(0, 10)
    if (ymd.length !== 10 || ymd[4] !== "-") continue
    const afterFirst = t.slice(endFirst + 2)
    const nextComma = afterFirst.indexOf(",")
    const playersField =
      nextComma >= 0 ? afterFirst.slice(0, nextComma) : afterFirst
    const raw = playersField.replaceAll('"', "").trim()
    if (raw === "") continue
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) continue
    const list = samples.get(ymd)
    if (list) list.push(n)
    else samples.set(ymd, [n])
  }
  for (const [ymd, list] of samples) {
    byDate.set(ymd, Math.max(...list))
  }
  return byDate
}

export async function fetchSteamPeaksForGame(id: GameId): Promise<ReadonlyMap<string, number | null>> {
  const path = STEAM_CSV_PATH[id]
  const r = await fetch(path)
  if (!r.ok) throw new Error(`Failed to load ${path}`)
  return parseSteamdbPeakCsv(await r.text())
}
