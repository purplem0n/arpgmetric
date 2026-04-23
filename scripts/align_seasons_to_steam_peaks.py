"""Cross-check and recalibrate arpg-seasons.json against SteamDB CSVs (public/steamdb/*).

Each CSV may list multiple rows per UTC calendar day (e.g. hourly). We use the
**maximum** Players value for that day — that matches the CSV as source of
truth (SteamDB’s chart “max” view can mislabel dates in the UI).

``date_utc`` in JSON is set to the day in a launch window
``[nominal - 7d, nominal + 14d]`` with the highest max-daily-CCU in the file.
If the window has no data (e.g. pre-Steam), the original date is kept.

Usage:
  python3 scripts/align_seasons_to_steam_peaks.py
  python3 scripts/align_seasons_to_steam_peaks.py --apply-peak
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JP = ROOT / "public" / "arpg-seasons.json"
STEAMDB = ROOT / "public" / "steamdb"

# Match peak within this window around the listed patch / release day.
PEAK_LOOKBACK_DAYS = 7
PEAK_LOOKAHEAD_DAYS = 14


def load_csv_max_per_day(path: Path) -> dict[str, int]:
    """Map YYYY-MM-DD -> max Players for that whole UTC day across all rows."""
    best: dict[str, int] = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            dt = row["DateTime"].strip('"').split()[0]
            ymd = dt[:10]
            raw = (row.get("Players") or "").strip().strip('"')
            if not raw:
                continue
            p = int(raw)
            if ymd not in best or p > best[ymd]:
                best[ymd] = p
    return best


def peak_day_in_window(
    nominal: str, by: dict[str, int], back: int, forward: int
) -> str:
    d0 = datetime.strptime(nominal, "%Y-%m-%d")
    best_p = -1
    best_d = nominal
    for k in range(-back, forward + 1):
        ds = (d0 + timedelta(days=k)).strftime("%Y-%m-%d")
        p = by.get(ds)
        if p is not None and p > best_p:
            best_p = p
            best_d = ds
    if best_p < 0:
        return nominal
    return best_d


def report(by: dict[str, int], name: str, d: str) -> None:
    d0 = datetime.strptime(d, "%Y-%m-%d")
    ond = by.get(d, None)
    mx, mxd = -1, ""
    for i in range(PEAK_LOOKBACK_DAYS + PEAK_LOOKAHEAD_DAYS + 1):
        ds = (d0 + timedelta(days=i - PEAK_LOOKBACK_DAYS)).strftime("%Y-%m-%d")
        p = by.get(ds, None)
        if p is not None and p > mx:
            mx, mxd = p, ds
    ons = f"{ond:,}" if ond is not None else "—"
    mxs = f"{mx:,} @ {mxd}" if mx >= 0 else "—"
    print(f"  {d}  on_day={ons:>12}  best_{PEAK_LOOKBACK_DAYS+PEAK_LOOKAHEAD_DAYS+1}d={mxs:>30}  {name[:45]}")


def recalibrate_item(item: dict[str, str], by: dict[str, int]) -> dict[str, str]:
    row = dict(item)
    row["date_utc"] = peak_day_in_window(
        item["date_utc"],
        by,
        PEAK_LOOKBACK_DAYS,
        PEAK_LOOKAHEAD_DAYS,
    )
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--apply-peak",
        action="store_true",
        help="Recalibrate every date_utc to the best Steam peak in the search window.",
    )
    args = ap.parse_args()

    data = json.loads(JP.read_text(encoding="utf-8"))
    poe1 = load_csv_max_per_day(STEAMDB / "poe1_238960.csv")
    d4 = load_csv_max_per_day(STEAMDB / "diablo4_2344520.csv")
    poe2 = load_csv_max_per_day(STEAMDB / "poe2_2694490.csv")
    le = load_csv_max_per_day(STEAMDB / "lastepoch_899770.csv")

    if not args.apply_peak:
        print("=== poe1 (poe1_238960.csv) ===")
        for item in data["poe1"]:
            report(poe1, item["name"], item["date_utc"])
        print("=== diablo4 (diablo4_2344520.csv) ===")
        for item in data["diablo4"]:
            report(d4, item["name"], item["date_utc"])
        print("=== poe2 ===")
        for item in data["poe2"]:
            report(poe2, item["name"], item["date_utc"])
        print("=== last_epoch ===")
        for item in data["last_epoch"]:
            report(le, item["name"], item["date_utc"])
        return

    for key, by in [
        ("poe1", poe1),
        ("diablo4", d4),
        ("poe2", poe2),
        ("last_epoch", le),
    ]:
        data[key] = [recalibrate_item(x, by) for x in data[key]]

    JP.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote", JP)


if __name__ == "__main__":
    main()
