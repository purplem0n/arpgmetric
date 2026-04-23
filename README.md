# ARPG season metrics (arpgmetric)

A small static web app that compares **launch-day Steam concurrent player peaks** for seasons and leagues in major ARPGs, and (for games that also run outside Steam) an **optional estimated total PC peak** by applying a user-chosen *Steam share* percentage.

[SteamDB](https://steamdb.info) history (bundled CSVs in this repo) supplies the **Steam peak** for the UTC calendar day used per release. Season names and launch dates are maintained in `public/arpg-seasons.json`.

## Example numbers (illustrative)

These are **sample rows** with the app’s **default** “% of PC players on Steam” for each multistore title. **Est. PC peak** is `Steam peak ÷ (Steam % / 100)` and is **not** an official all-platform figure from the publishers.

### Diablo IV — default Steam share **22%**

| Season / league | Peak day (UTC) | Steam peak | Est. PC peak |
| --- | --- | ---:| ---:|
| Season 10 — Season of Infernal Chaos | September 28, 2025 | 49,001 | 222,732 |

### Path of Exile 1 — default Steam share **65%**

| League | Version | Peak day (UTC) | Steam peak | Est. PC peak |
| --- | --- | --- | ---:| ---:|
| Mirage | 3.28.0 | March 6, 2026 | 190,653 | 293,312 |

### Path of Exile 2 — default Steam share **75%**

| League | Version | Peak day (UTC) | Steam peak | Est. PC peak |
| --- | --- | --- | ---:| ---:|
| The Last of the Druids | 0.4.0 | December 12, 2025 | 290,305 | 387,073 |

*Figures and dates reflect the data and methodology in the app at the time of writing; SteamDB and patch timing can be revised over time.*

## Steam % and “Est. PC peak” (important)

For **Diablo IV**, **Path of Exile**, and **Path of Exile 2**, a large part of the PC player base may use **Battle.net** or **standalone** clients, not only Steam. The **default** Steam share % in the app is a **rough assumption** so that total PC can be *estimated* from the Steam number you can actually observe. It is **not** a publisher-provided, season-by-season fact.

- The UI explains the thinking behind each default and links **citation sources** (e.g. Blizzard’s Diablo IV on Steam announcement, GGG’s Betrayal launch post with Steam vs total PC concurrent figures, and press coverage for PoE2’s Steam peak context). See the in-app cards under each game for those links and optional feedback.
- **You can and should set your own %** in the app if you believe a different split is more accurate. The value is stored per game in the browser (local storage), and **Est. PC peak** recalculates from your choice.

**Last Epoch** and other Steam-only–style entries in the list use **100%** Steam for PC by default, since there is no multistore estimate there.

## Development

```bash
bun install
bun dev
```

```bash
bun run build   # production build
bun run preview # serve dist locally
```

Stack: React, TypeScript, Vite, Tailwind CSS, and [shadcn/ui](https://ui.shadcn.com). Player history is read from `public/steamdb/*.csv`.

## License

MIT — see [LICENSE](LICENSE).
