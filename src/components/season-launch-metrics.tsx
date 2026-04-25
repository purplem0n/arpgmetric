import { useEffect, useMemo, useState } from "react"
import { CircleHelp } from "lucide-react"
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ArpgSeasonsData, GameId, SeasonLaunch } from "@/lib/arpg-types"
import { publicUrl } from "@/lib/public-url"
import { cn } from "@/lib/utils"
import { fetchSteamPeaksForGame, steamdbAppPageUrl } from "@/lib/steam-csv"

const GAMES: { id: GameId; label: string; banner: string }[] = [
  { id: "diablo4", label: "Diablo IV", banner: publicUrl("game-banners/diablo4.jpg") },
  { id: "poe1", label: "Path of Exile", banner: publicUrl("game-banners/poe1.jpg") },
  { id: "poe2", label: "Path of Exile 2", banner: publicUrl("game-banners/poe2.jpg") },
  { id: "last_epoch", label: "Last Epoch", banner: publicUrl("game-banners/lastepoch.jpg") },
]

const GAME_IDS = new Set<GameId>(GAMES.map((g) => g.id))

export const DEFAULT_GAME_PATH = `/${GAMES[0]!.id}`

function isValidGameId(s: string): s is GameId {
  return GAME_IDS.has(s as GameId)
}

const STEAM_SHARE_QUERY_KEY = "steam"

/** One shared request — avoids duplicate fetches when Strict Mode remounts in dev. */
let arpgSeasonsJsonPromise: Promise<ArpgSeasonsData> | null = null

function loadArpgSeasonsData(): Promise<ArpgSeasonsData> {
  if (!arpgSeasonsJsonPromise) {
    arpgSeasonsJsonPromise = fetch(publicUrl("arpg-seasons.json"))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<ArpgSeasonsData>
      })
      .catch((err) => {
        arpgSeasonsJsonPromise = null
        throw err
      })
  }
  return arpgSeasonsJsonPromise
}

/** Games with a meaningful split between Steam and another PC client (estimate only). */
const MULTISTORE_PC_ESTIMATE_GAMES = new Set<GameId>(["diablo4", "poe1", "poe2"])

type MultistoreEstimateGameId = "diablo4" | "poe1" | "poe2"

function isMultistoreEstimateGame(id: GameId): id is MultistoreEstimateGameId {
  return MULTISTORE_PC_ESTIMATE_GAMES.has(id)
}

type SourceLink = { label: string; href: string }

/** Rationale and citations for the default Steam share % (PC estimator). */
const PC_ESTIMATE_DEFAULT_SOURCES: Record<
  MultistoreEstimateGameId,
  { intro: string; links: SourceLink[] }
> = {
  diablo4: {
    intro:
      "Blizzard does not publish a Steam vs Battle.net split for PC. The app default (~13%) assumes Steam is a minority share after a Battle.net-first PC launch. Each season may have a different Steam % of total PC players.",
    links: [
      {
        label: "Blizzard: Diablo IV coming to Steam (Oct 2024)",
        href: "https://news.blizzard.com/en-us/diablo4/24009153",
      },
    ],
  },
  poe1: {
    intro:
      "Betrayal launch (Dec 2018): GGG reported 188,970 peak concurrent players, 123,565 on Steam (~65%). The default matches that one launch; the mix may differ in other leagues. Each league may have a different Steam % of total PC players.",
    links: [
      {
        label: "GGG forums: How the Betrayal Launch Went",
        href: "https://www.pathofexile.com/forum/view-thread/2261614",
      },
      {
        label: "GamingBolt: article citing those figures",
        href: "https://gamingbolt.com/path-of-exile-betrayal-hits-nearly-189000-peak-concurrent-players-at-launch",
      },
    ],
  },
  poe2: {
    intro:
      "PoE2 has a large Steam concurrent peak; GGG has not published total PC concurrent including standalone/Epic. The default (~75%) is a midpoint guess that Steam is most but not all of PC. Each league may have a different Steam % of total PC players.",
    links: [
      {
        label: "Game World Observer: Steam peak & other PC clients",
        href: "https://gameworldobserver.com/2024/12/09/path-of-exile-2-peaks-at-over-578k-ccu-steam-ea-launch",
      },
      {
        label: "GamingBolt: PoE2 Steam concurrent peak",
        href: "https://gamingbolt.com/path-of-exile-2-surpasses-578000-concurrent-players-on-steam-becomes-15th-most-played-title-in-history",
      },
    ],
  },
}

/**
 * Defaults are rough PC-only “Steam as % of concurrent PC players” guesses for the estimator.
 * D4: no official split; Battle.net-first PC → minority Steam share; default 13%.
 * PoE1: GGG Betrayal launch ~65% Steam / ~35% standalone (188,970 peak, 123,565 Steam).
 * PoE2: Steam-heavy early access; total PC CCU undisclosed → ~75% Steam as a midpoint guess.
 */
const DEFAULT_STEAM_SHARE_PCT: Record<GameId, number> = {
  diablo4: 13,
  poe1: 65,
  poe2: 75,
  last_epoch: 100,
}

const STEAM_SHARE_STORAGE_KEY = "arpgmetric-pc-steam-share-pct"

function hasMultistorePcEstimate(gameId: GameId): boolean {
  return isMultistoreEstimateGame(gameId)
}

const tooltipContentClass =
  "max-w-sm flex-col items-stretch gap-2 py-2.5 text-left [overflow-wrap:anywhere] pointer-events-auto"

function SteamPeakSourcesTooltip({ gameId }: { gameId: GameId }) {
  const steamdbUrl = steamdbAppPageUrl(gameId)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Sources: Steam peak column"
        >
          <CircleHelp className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className={tooltipContentClass}>
        <p className="text-background/90 leading-snug">
          Values are the max Steam &quot;Players&quot; for that UTC day from bundled SteamDB
          history CSVs in this project.
        </p>
        <ul className="space-y-1 border-t border-background/20 pt-2">
          <li>
            <a
              href={steamdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-90"
            >
              SteamDB app page (live data &amp; graphs)
            </a>
          </li>
          <li>
            <a
              href="https://steamdb.info/faq/#players"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-90"
            >
              SteamDB FAQ: player counts
            </a>
          </li>
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

function EstPcPeakHeaderTooltip({ gameId }: { gameId: MultistoreEstimateGameId }) {
  const text =
    gameId === "diablo4"
      ? "This estimate is Steam + Battle.net peak."
      : "This estimate is Steam + standalone PC peak."
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          aria-label="About Est. PC peak column"
        >
          <CircleHelp className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className={tooltipContentClass}>
        <p className="text-background/90 leading-snug">{text}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/** Former tooltip body for default % — shown as a card under the steam-share field. */
function PcEstimateDefaultSourcesInfoCard({
  gameId,
  className,
}: {
  gameId: MultistoreEstimateGameId
  className?: string
}) {
  const src = PC_ESTIMATE_DEFAULT_SOURCES[gameId]
  return (
    <Card
      id={`pc-estimate-default-sources-${gameId}`}
      size="sm"
      className={cn("w-full max-w-md py-0", className)}
    >
      <CardContent className="space-y-2 px-3 py-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed [overflow-wrap:anywhere]">
          {src.intro}
        </p>
        <ul className="space-y-1.5 border-t border-border pt-2 text-xs">
          {src.links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:opacity-90"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="border-t border-border pt-2 text-xs">
          <a
            href="https://forms.gle/bMxDi7ZjYy8yAWXV9"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2 hover:opacity-90"
          >
            Help us improve estimates by answering this poll.
          </a>
        </p>
      </CardContent>
    </Card>
  )
}

function PeakDateMethodInfoCard({ className }: { className?: string }) {
  return (
    <Card size="sm" className={cn("w-full max-w-md py-0", className)}>
      <CardContent className="px-3 py-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed [overflow-wrap:anywhere]">
          <span className="text-foreground font-medium">How we pick the date.</span> For each
          release we look at the days around launch and use the one calendar day (in UTC) when
          Steam saw the <em>most people playing at the same time</em> for that day. The busiest
          day is often a few days after the season or league actually starts. Example: Season of
          Slaughter went live March 11 2026, but it peaked on March 15 2026 so we used it instead.
        </p>
      </CardContent>
    </Card>
  )
}

function readStoredSteamSharePct(gameId: GameId): number {
  if (typeof localStorage === "undefined") {
    return DEFAULT_STEAM_SHARE_PCT[gameId]
  }
  try {
    const raw = localStorage.getItem(STEAM_SHARE_STORAGE_KEY)
    if (!raw) return DEFAULT_STEAM_SHARE_PCT[gameId]
    const obj = JSON.parse(raw) as Partial<Record<GameId, number>>
    const v = obj[gameId]
    if (typeof v === "number" && v > 0 && v <= 100) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_STEAM_SHARE_PCT[gameId]
}

function persistSteamSharePct(gameId: GameId, sharePct: number) {
  try {
    const raw = localStorage.getItem(STEAM_SHARE_STORAGE_KEY)
    const all: Partial<Record<GameId, number>> = raw ? JSON.parse(raw) : {}
    all[gameId] = sharePct
    localStorage.setItem(STEAM_SHARE_STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

/** Valid Steam share in (0, 100] for the estimate; null if the field is empty or invalid. */
function parseSteamShareInput(s: string): number | null {
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null
  return n
}

function initialSteamShareStrFromLocation(gameId: GameId, isActiveTab: boolean): string {
  if (
    !isActiveTab ||
    !hasMultistorePcEstimate(gameId) ||
    typeof window === "undefined"
  ) {
    return String(readStoredSteamSharePct(gameId))
  }
  const parsed = parseSteamShareInput(
    new URLSearchParams(window.location.search).get(STEAM_SHARE_QUERY_KEY) ?? "",
  )
  if (parsed != null) return String(parsed)
  return String(readStoredSteamSharePct(gameId))
}

const dateUtcFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
  timeZone: "UTC",
})

function formatLaunchDate(isoDate: string) {
  return dateUtcFormatter.format(new Date(`${isoDate}T00:00:00.000Z`))
}

const peakCountFormatter = new Intl.NumberFormat()

function formatPeak(
  byDate: ReadonlyMap<string, number | null> | undefined,
  dateKey: string,
) {
  if (!byDate) return "…"
  const p = byDate.get(dateKey)
  if (p == null) return "—"
  return peakCountFormatter.format(p)
}

/** Rounded PC peak estimate for ranking; null when not computable. */
function estimatedPcPeakNumber(
  byDate: ReadonlyMap<string, number | null> | undefined,
  dateKey: string,
  steamSharePercent: number | null,
): number | null {
  if (!byDate) return null
  const steam = byDate.get(dateKey)
  if (steam == null) return null
  if (steamSharePercent == null || steamSharePercent <= 0 || steamSharePercent > 100) {
    return null
  }
  return Math.round(steam / (steamSharePercent / 100))
}

function formatEstimatedPcPeak(
  byDate: ReadonlyMap<string, number | null> | undefined,
  dateKey: string,
  steamSharePercent: number | null,
) {
  if (!byDate) return "…"
  const n = estimatedPcPeakNumber(byDate, dateKey, steamSharePercent)
  if (n == null) return "—"
  return peakCountFormatter.format(n)
}

const EST_PC_PEAK_RANK_VALUE_CLASS: Record<1 | 2 | 3, string> = {
  1: "text-teal-800 dark:text-teal-300",
  2: "text-blue-800 dark:text-blue-300",
  3: "text-orange-900 dark:text-orange-300",
}

const EST_PC_PEAK_RANK_BADGE_CLASS: Record<1 | 2 | 3, string> = {
  1: "border-teal-500/40 bg-teal-500/15 text-teal-800 dark:text-teal-300 dark:bg-teal-500/20 dark:border-teal-500/35",
  2: "border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-300 dark:bg-blue-500/20 dark:border-blue-500/35",
  3: "border-orange-500/40 bg-orange-500/15 text-orange-900 dark:text-orange-300 dark:bg-orange-500/20 dark:border-orange-500/35",
}

function rankTopThreeByNumericRow<T extends { date_utc: string; name: string }>(
  rows: T[],
  valueForRow: (row: T) => number | null,
): Map<string, 1 | 2 | 3> {
  const entries: { key: string; n: number }[] = []
  for (const row of rows) {
    const n = valueForRow(row)
    if (n != null) entries.push({ key: `${row.date_utc}-${row.name}`, n })
  }
  const distinctDesc = [...new Set(entries.map((e) => e.n))].sort((a, b) => b - a)
  const rankByValue = new Map<number, 1 | 2 | 3>()
  for (let i = 0; i < Math.min(3, distinctDesc.length); i++) {
    rankByValue.set(distinctDesc[i]!, (i + 1) as 1 | 2 | 3)
  }
  const out = new Map<string, 1 | 2 | 3>()
  for (const { key, n } of entries) {
    const r = rankByValue.get(n)
    if (r) out.set(key, r)
  }
  return out
}

function steamPeakNumber(
  byDate: ReadonlyMap<string, number | null> | undefined,
  dateKey: string,
): number | null {
  if (!byDate) return null
  const v = byDate.get(dateKey)
  return v ?? null
}

function steamPeakRankByRowKey(
  rows: SeasonLaunch[],
  peaksByDate: ReadonlyMap<string, number | null> | undefined,
): Map<string, 1 | 2 | 3> {
  return rankTopThreeByNumericRow(rows, (row) =>
    steamPeakNumber(peaksByDate, row.date_utc),
  )
}

function estPcPeakRankByRowKey(
  rows: SeasonLaunch[],
  peaksByDate: ReadonlyMap<string, number | null> | undefined,
  steamSharePercent: number | null,
): Map<string, 1 | 2 | 3> {
  return rankTopThreeByNumericRow(rows, (row) =>
    estimatedPcPeakNumber(peaksByDate, row.date_utc, steamSharePercent),
  )
}

function RankedMetricTableCell({
  text,
  rank,
  rankAriaLabelPrefix,
}: {
  text: string
  rank: 1 | 2 | 3 | undefined
  rankAriaLabelPrefix: string
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className={cn(
          rank != null ? EST_PC_PEAK_RANK_VALUE_CLASS[rank] : "text-muted-foreground",
        )}
      >
        {text}
      </span>
      {rank != null && (
        <Badge
          variant="outline"
          className={EST_PC_PEAK_RANK_BADGE_CLASS[rank]}
          aria-label={`${rankAriaLabelPrefix} rank ${rank} in this table`}
        >
          {rank}
        </Badge>
      )}
    </div>
  )
}

function SteamPeakTableCell({
  peaksByDate,
  dateKey,
  rank,
}: {
  peaksByDate: ReadonlyMap<string, number | null> | undefined
  dateKey: string
  rank: 1 | 2 | 3 | undefined
}) {
  return (
    <RankedMetricTableCell
      text={formatPeak(peaksByDate, dateKey)}
      rank={rank}
      rankAriaLabelPrefix="Steam peak"
    />
  )
}

function EstPcPeakTableCell({
  peaksByDate,
  dateKey,
  steamSharePercent,
  rank,
}: {
  peaksByDate: ReadonlyMap<string, number | null> | undefined
  dateKey: string
  steamSharePercent: number | null
  rank: 1 | 2 | 3 | undefined
}) {
  return (
    <RankedMetricTableCell
      text={formatEstimatedPcPeak(peaksByDate, dateKey, steamSharePercent)}
      rank={rank}
      rankAriaLabelPrefix="Est. PC peak"
    />
  )
}

function SeasonTable({
  gameId,
  rows,
  peaksByDate,
  showVersionColumn,
  pcEstimateSteamSharePct,
}: {
  gameId: GameId
  rows: SeasonLaunch[]
  peaksByDate: ReadonlyMap<string, number | null> | undefined
  showVersionColumn: boolean
  /**
   * `undefined` = hide estimate column. `number | null` = show column (null = invalid share, cells show —).
   * Formula: Steam peak ÷ (share / 100). PC only.
   */
  pcEstimateSteamSharePct: number | null | undefined
}) {
  const showEstPcPeak = pcEstimateSteamSharePct !== undefined
  const steamPeakRanks = useMemo(
    () => steamPeakRankByRowKey(rows, peaksByDate),
    [rows, peaksByDate],
  )
  const estPcPeakRanks = useMemo(
    () =>
      estPcPeakRankByRowKey(rows, peaksByDate, pcEstimateSteamSharePct ?? null),
    [rows, peaksByDate, pcEstimateSteamSharePct],
  )
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[min(100%,32rem)] text-left text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 font-medium">Season / league</th>
            {showVersionColumn && (
              <th className="px-3 py-2 font-medium whitespace-nowrap">Version</th>
            )}
            <th className="px-3 py-2 font-medium">Peak day (UTC)</th>
            <th className="px-3 py-2 text-right font-medium">
              <div className="flex items-center justify-end gap-0.5">
                <span>Steam peak</span>
                <SteamPeakSourcesTooltip gameId={gameId} />
              </div>
            </th>
            {showEstPcPeak && isMultistoreEstimateGame(gameId) && (
              <th className="px-3 py-2 text-right font-medium">
                <div className="flex items-center justify-end gap-0.5">
                  <span>Est. PC peak</span>
                  <EstPcPeakHeaderTooltip gameId={gameId} />
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.date_utc}-${row.name}`}
              className="border-b last:border-0"
            >
              <td className="px-3 py-2 align-top">{row.name}</td>
              {showVersionColumn && (
                <td className="px-3 py-2 align-top tabular-nums text-muted-foreground whitespace-nowrap">
                  {row.version ?? "—"}
                </td>
              )}
              <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">
                {formatLaunchDate(row.date_utc)}
              </td>
              <td className="px-3 py-2 align-top text-right tabular-nums">
                <SteamPeakTableCell
                  peaksByDate={peaksByDate}
                  dateKey={row.date_utc}
                  rank={steamPeakRanks.get(`${row.date_utc}-${row.name}`)}
                />
              </td>
              {showEstPcPeak && (
                <td className="px-3 py-2 align-top text-right tabular-nums">
                  <EstPcPeakTableCell
                    peaksByDate={peaksByDate}
                    dateKey={row.date_utc}
                    steamSharePercent={pcEstimateSteamSharePct ?? null}
                    rank={estPcPeakRanks.get(`${row.date_utc}-${row.name}`)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GamePanel({
  gameId,
  label,
  banner,
  rows,
  peaksByDate,
  isActiveTab,
}: {
  gameId: GameId
  label: string
  banner: string
  rows: SeasonLaunch[]
  peaksByDate: ReadonlyMap<string, number | null> | undefined
  isActiveTab: boolean
}) {
  const showVersionColumn =
    gameId === "poe1" || gameId === "poe2" || gameId === "last_epoch"
  const multistorePc = hasMultistorePcEstimate(gameId)
  const [searchParams, setSearchParams] = useSearchParams()
  const [steamShareStr, setSteamShareStr] = useState(() =>
    initialSteamShareStrFromLocation(gameId, isActiveTab),
  )

  useEffect(() => {
    if (!multistorePc || !isActiveTab) return
    const raw = searchParams.get(STEAM_SHARE_QUERY_KEY)
    if (raw == null || raw === "") return
    const parsed = parseSteamShareInput(raw)
    if (parsed == null) return
    const next = String(parsed)
    queueMicrotask(() => {
      setSteamShareStr((prev) => (prev !== next ? next : prev))
    })
  }, [multistorePc, isActiveTab, searchParams])

  useEffect(() => {
    if (!multistorePc || !isActiveTab) return
    const effective = parseSteamShareInput(steamShareStr)
    const defaultPct = DEFAULT_STEAM_SHARE_PCT[gameId]
    const next = new URLSearchParams(searchParams)
    if (effective != null && effective !== defaultPct) {
      next.set(STEAM_SHARE_QUERY_KEY, String(effective))
    } else {
      next.delete(STEAM_SHARE_QUERY_KEY)
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [
    multistorePc,
    isActiveTab,
    gameId,
    steamShareStr,
    searchParams,
    setSearchParams,
  ])

  useEffect(() => {
    if (!multistorePc) return
    const parsed = parseSteamShareInput(steamShareStr)
    if (parsed == null) return
    persistSteamSharePct(gameId, parsed)
  }, [gameId, multistorePc, steamShareStr])

  const effectiveSteamSharePct = parseSteamShareInput(steamShareStr)
  const defaultSteamSharePct = DEFAULT_STEAM_SHARE_PCT[gameId]
  const steamShareDiffersFromDefault =
    effectiveSteamSharePct !== null && effectiveSteamSharePct !== defaultSteamSharePct

  const countLabel = `${rows.length} release${rows.length === 1 ? "" : "s"} in this list`
  const storeUrl = steamdbAppPageUrl(gameId)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 sm:gap-4">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`${label} on SteamDB`}
        >
          <img
            src={banner}
            alt=""
            width={230}
            height={108}
            className="h-12 w-auto aspect-[460/215] rounded-md object-cover sm:h-14"
          />
        </a>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <a
            data-slot="card-title"
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-heading inline pr-0 align-baseline text-base font-medium leading-snug text-foreground underline-offset-2 hover:underline",
            )}
          >
            {label}
          </a>
          <span className="text-muted-foreground" aria-hidden> · </span>
          <CardDescription className="inline">{countLabel}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {multistorePc ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex min-w-0 flex-col gap-2 sm:max-w-md">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <Label
                  htmlFor={`steam-share-${gameId}`}
                  className="text-xs font-medium leading-tight"
                >
                  About what % of PC players use Steam?
                </Label>
                <div
                  className={cn(
                    "flex h-8 w-[4.75rem] shrink-0 items-center justify-center gap-0.5 rounded-lg border border-input bg-transparent px-1.5",
                    "transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                    "dark:bg-input/30",
                  )}
                >
                  <input
                    id={`steam-share-${gameId}`}
                    className="h-full min-w-0 w-10 max-w-10 border-0 bg-transparent p-0 text-center text-base tabular-nums shadow-none outline-none [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:outline-none md:text-sm"
                    type="number"
                    min={1}
                    max={100}
                    step={0.1}
                    inputMode="decimal"
                    value={steamShareStr}
                    onChange={(e) => setSteamShareStr(e.target.value)}
                    onBlur={() => {
                      const parsed = parseSteamShareInput(steamShareStr)
                      if (parsed == null) {
                        setSteamShareStr(String(readStoredSteamSharePct(gameId)))
                      } else {
                        setSteamShareStr(String(parsed))
                      }
                    }}
                    aria-describedby={`pc-estimate-default-sources-${gameId}`}
                  />
                  <span className="shrink-0 text-muted-foreground text-xs" aria-hidden>
                    %
                  </span>
                </div>
                {steamShareDiffersFromDefault && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setSteamShareStr(String(defaultSteamSharePct))
                    }}
                  >
                    Set to Default
                  </Button>
                )}
              </div>
            </div>
            {isMultistoreEstimateGame(gameId) && (
              <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
                <div className="md:min-w-0 md:flex-1">
                  <PcEstimateDefaultSourcesInfoCard
                    gameId={gameId}
                    className="h-full max-w-none"
                  />
                </div>
                <div className="md:min-w-0 md:flex-1">
                  <PeakDateMethodInfoCard className="h-full max-w-none" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <PeakDateMethodInfoCard className="max-w-none" />
        )}
        <SeasonTable
          gameId={gameId}
          rows={rows}
          peaksByDate={peaksByDate}
          showVersionColumn={showVersionColumn}
          pcEstimateSteamSharePct={multistorePc ? effectiveSteamSharePct : undefined}
        />
      </CardContent>
    </Card>
  )
}

export function SeasonLaunchMetrics() {
  const { gameId: routeGameId } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState<ArpgSeasonsData | null>(null)
  const [peaks, setPeaks] = useState<Partial<Record<GameId, ReadonlyMap<string, number | null>>>>(
    {},
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [steamError, setSteamError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadArpgSeasonsData()
      .then((json) => {
        if (!cancelled) {
          setData(json)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not load season data.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!data) return
    let cancelled = false
    const ids: GameId[] = ["diablo4", "poe1", "poe2", "last_epoch"]
    Promise.all(
      ids.map((id) => fetchSteamPeaksForGame(id).then((m) => [id, m] as const)),
    )
      .then((entries) => {
        if (cancelled) return
        const next: Partial<Record<GameId, ReadonlyMap<string, number | null>>> = {}
        for (const [id, m] of entries) {
          next[id] = m
        }
        setPeaks(next)
        setSteamError(null)
      })
      .catch(() => {
        if (!cancelled) {
          setSteamError("Could not load Steam player history.")
        }
      })
    return () => {
      cancelled = true
    }
  }, [data])

  if (!routeGameId || !isValidGameId(routeGameId)) {
    return <Navigate to={DEFAULT_GAME_PATH} replace />
  }
  const activeGameId = routeGameId

  if (loadError) {
    return <p className="text-destructive">{loadError}</p>
  }

  if (!data) {
    return <p className="text-muted-foreground">Loading season metrics…</p>
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex w-full min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h1 className="font-heading min-w-0 text-lg font-medium">
              ARPG season metrics
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="https://github.com/purplem0n/arpgmetric/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground text-sm underline underline-offset-2 hover:opacity-90"
              >
                Report a bug
              </a>
              <Button
                asChild
                size="icon"
                variant="outline"
                className="bg-white dark:bg-white hover:bg-white/90 dark:hover:bg-white/90"
              >
                <a
                  href="https://github.com/purplem0n/arpgmetric"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View repository on GitHub"
                >
                  <img
                    src={publicUrl("github_icon.png")}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5"
                  />
                </a>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            The goal of this website is to show pc player metrics of popular ARPGs by
            estimating Steam + Battle.net or Standalone clients. And finally settle the
            arpg war (kidding)
          </p>
        </div>

        {steamError && (
          <p className="text-destructive text-sm" role="status">
            {steamError} Peak player counts are hidden until this load succeeds.
          </p>
        )}

        <Tabs
          value={activeGameId}
          onValueChange={(id) => {
            if (isValidGameId(id)) navigate(`/${id}`, { replace: false })
          }}
          className="w-full min-w-0 gap-4"
        >
          <div className="overflow-x-auto pb-0.5">
            <TabsList variant="line" className="min-w-0 w-max max-w-full">
              {GAMES.map((g) => (
                <TabsTrigger key={g.id} value={g.id}>
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {GAMES.map((g) => (
            <TabsContent key={g.id} value={g.id} className="min-w-0">
              <GamePanel
                gameId={g.id}
                label={g.label}
                banner={g.banner}
                rows={data[g.id]}
                peaksByDate={peaks[g.id]}
                isActiveTab={g.id === activeGameId}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
