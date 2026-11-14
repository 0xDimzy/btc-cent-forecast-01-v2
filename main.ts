// btc-cent-forecast-01 entry (Node 22, standard library only).
//
// Forecast: Bitcoin's US-dollar close 240 minutes after the checkpoint, from
// the 4,320 one-minute closes of the 72 hours up to it.
//
// Score is mean absolute error in cents, so the optimal point forecast is the
// conditional MEDIAN of the price 240 minutes ahead. For a 4-hour BTC move
// the honest conditional median is, to within measurement noise, the last
// close itself: this entry IS persistence — forecast = last close, on the
// price grid's 5 decimals, inside (0, 10,000,000).
//
// Why not the kernel-table tilt: the tilt was built first, then validated on
// the full backtest in the post-open rebuild session, and it did NOT survive.
// A 13-knot empirical move-quantile table keyed on a drift score
// (s = (median 240-min return + 0.5 x OLS trend) / 2, 9,080 realised 4-hour
// moves: 8,595 Coinbase hourly + 485 kit practice) was evaluated against
// pure persistence on every honest out-of-sample check:
//   practice cases p00..p04 (entry run):  tilt 47,111 vs persistence 47,055 cents (+0.12%)
//   97 rolling origins, kit recording:   tilt 52,035 vs persistence 52,015 cents (+0.04%)
//   3-month held-out, 9-month table:     tilt 41,177 vs persistence 41,167 cents (+0.02%)
//   full 12-month hourly, shipped table: tilt 45,858 vs persistence 45,867 cents (-0.02%)
// The only "win" is the last row, and the table was TRAINED on that history,
// so it is in-sample and proves nothing. On every honest check the tilt
// loses by 0.02-0.12% — noise, not an edge. Per the rebuild brief the tilt
// is therefore set to 0 and the shipped entry is pure persistence. A prize
// needs strictly beating the baseline on 12 unseen cases; this entry bets
// that the baseline itself is the best available point forecast, and reports
// that expectation honestly in README.md. The table build scripts and the
// validation script live outside the entry, in
// ~/workspace/makefun/btc-kernel-build/.
//
// Deterministic: pure functions of the input prices, no randomness, no clock,
// no network. Two runs on the same case write byte-identical output.
//
// Format (per the kit): read every <id>.in in the input directory
// ($MAKEFUN_INPUT_DIR, else /input), write <id>.out to the output directory
// ($MAKEFUN_OUTPUT_DIR, else /output) as {"forecasts":[{"case":"<id>",
// "price":<number>}]}, price on the grid's 5 decimals, inside (0, 10,000,000).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/**
 * The last finite positive close of a market, or null when the market has
 * no usable price at all. Invalid entries are dropped, never guessed at.
 */
function usableClose(m: CaseMarket): number | null {
  if (!Array.isArray(m.prices) || m.prices.length === 0) return null;
  const clean = m.prices.filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
  return clean.length === 0 ? null : (clean[clean.length - 1] as number);
}

/**
 * The last finite positive close of a market. A market with no usable
 * price at all is an input error, not a guess.
 */
function lastClose(m: CaseMarket): number {
  const c = usableClose(m);
  if (c === null) throw new Error(`market ${m.id} has no finite positive prices`);
  return c;
}

/**
 * The market to forecast from: the named btc-usdc market when it has a
 * usable price, otherwise the first market in file order that does. A
 * named market whose closes are all invalid must not sink the case when
 * another market in the same file is usable.
 */
function pickMarket(c: Case): CaseMarket {
  const named = c.markets.find((mm) => mm.id === 'btc-usdc');
  if (named !== undefined && usableClose(named) !== null) return named;
  for (const mm of c.markets) if (usableClose(mm) !== null) return mm;
  throw new Error(`no market with a finite positive price`);
}

/**
 * The forecast for one market: persistence — the last close. The tilt is
 * zero by validation (see header): no drift is added, so the forecast is
 * exactly the checkpoint close on the 5-decimal grid.
 */
function forecast(m: CaseMarket): number {
  return price5(lastClose(m));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  try {
    const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
    if (!Array.isArray(c.markets) || c.markets.length < 1) throw new Error(`${file} does not hold a market`);
    writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(pickMarket(c)) }] })}\n`);
  } catch (e) {
    // One unreadable or unusable case must not abort the whole run: the
    // other cases still score, and a crash here would score zero on all
    // of them. The failure is reported on stderr; no output is written
    // for this case.
    console.error(`skipping ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
