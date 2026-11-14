# btc-cent-forecast-01 — persistence, the tilt dropped after validation

Forecasts Bitcoin's US-dollar price 240 minutes after each checkpoint, from
the 4,320 one-minute closes of the 72 hours up to it. Score is mean absolute
error in cents; the optimal point forecast under MAE is the conditional
**median**, and for a 4-hour BTC move the honest conditional median is, to
within measurement noise, the last close itself. This entry forecasts the
**last close** — pure persistence, on the 5-decimal grid.

## Why persistence, not the kernel-table tilt

A tilt was built first and then validated on the full backtest in the
post-open rebuild session — and it did not survive. The candidate was a
13-knot empirical move-quantile table keyed on a drift score
`s = (median 240-min return + 0.5 × OLS trend extrapolated 240 min) / 2`,
each cell holding the quantiles (q05, q25, q50, q75, q95) of realised
240-minute log moves near that knot, Gaussian-kernel weighted (bandwidth
0.002), q50 shrunk 0.3 toward the global median. Built offline from 9,080
realised 4-hour moves: 8,595 hourly moves of Coinbase BTC-USD closes over
2025-11-14 to 2026-11-14, plus 485 moves sampled every 10 minutes from the
kit's own practice recording (2026-11-07–11). The 12-month history does show
a small mean-reverting tilt in the conditional median (median next move
≈ −0.25 × drift score; correlation −0.014) — but a tilt that small does not
beat persistence out of sample.

Full backtest, tilt entry vs pure persistence (MAE in cents):

| Evaluation | Tilt | Persistence | Tilt vs persistence |
| --- | --- | --- | --- |
| 5 known practice cases, entry run | 47,111 | 47,055 | +0.12% (loses) |
| 97 rolling origins every 10 min, entry run | 52,035 | 52,015 | +0.04% (loses) |
| 3-month held-out, table trained on prior 9 months | 41,177 | 41,167 | +0.02% (loses) |
| Full 12-month hourly, shipped table | 45,858 | 45,867 | −0.02% (wins, in-sample) |

The only "win" is the last row, and the table was trained on that history,
so it is in-sample and proves nothing. On every honest out-of-sample check
the tilt loses by 0.02–0.12% — noise, not an edge. The rebuild brief's rule
was explicit: prove the tilt or drop it. It did not prove out, so the tilt
is set to 0 and the shipped entry is pure persistence. The older hand-shaped
drift model (`last × exp(s)`) is worse still: it beat persistence on the
4-day practice window (44,776 vs 47,055, −4.9%) but loses over the full
12 months (46,899 vs 45,867, +2.25%) — one down-trending regime, not a
general signal.

## Honest expectation

This is a near-tie bet by design. The entry is expected to finish within
~±0.2% of the baseline on the 12 unseen final cases; a prize needs strictly
beating the baseline, which no backtest supports any variant doing. It is
submitted anyway because the board is empty and the slot is free — but no
edge is claimed.

## Backtest (local, entry run with Node)

| Evaluation | This entry | Persistence |
| --- | --- | --- |
| 5 known practice cases, MAE cents | 47,055 | 47,055 |
| 97 rolling origins every 10 min, MAE cents | 52,015 | 52,015 |

Practice actuals are recoverable from the kit itself: checkpoints are 4 h
apart and the horizon is 240 min, so case p0k's target is case p0(k+1)'s
checkpoint close (5 of 6 cases; p05's target is outside the kit). Full
6-case practice baseline stated in the kit: 44,521.58 cents; the 5-case
comparison above is the like-for-like one available locally.

## Run

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22, standard library only, no network, no dependencies. Deterministic:
pure functions of the input prices — two runs on the same case write
byte-identical output. Runs in ~0.3 s per case (startup-dominated), far
under the 8 s cap. Output per case:
`{"forecasts":[{"case":"<id>","price":<number>}]}` with the price on the
5-decimal grid, inside (0, 10,000,000). Invalid or missing prices fall back
to an error only when a market has no usable price at all; the forecast is
always the last finite positive close.

## Robustness (editor pass, post-open rebuild)

Two failure modes that would previously have zeroed the whole run are now
isolated per case:

- **Market fallback:** if the named `btc-usdc` market has no finite
  positive close, the entry uses the first market in file order that does,
  instead of failing the case.
- **Per-case fault isolation:** an unreadable or malformed case file is
  logged to stderr and skipped; the run exits 0 and still writes outputs
  for every other case. Previously one bad file aborted the run before any
  output was written.

Both are behaviour-preserving on valid inputs: on the 6 practice cases the
forecasts are unchanged (still exactly the checkpoint closes), and two runs
remain byte-identical. Verified with synthetic cases: a `btc-usdc` market
of all-invalid closes fell back to the other market (forecast 300.12346),
and a malformed `.in` file was skipped while the neighbouring cases were
still written.

## Files

- `main.ts` — the whole entry: persistence forecast + I/O.
- `LICENSE` — MIT.
- `.makefun/owner.json` — payout wallet claim file.

Build scripts, raw history, the dropped kernel table, and the validation
scripts live outside the entry, in
`~/workspace/makefun/btc-kernel-build/` (`build_kernel.py`,
`build_kernel2.py`, `build_kernel3.py`, `build_kernel4.py`,
`check_rules_12mo.py`, `build_final_table.py`, `emit_main.py`,
`coinbase_hourly.json`, `kernel_table_final.json`, `verify.py`).
The post-open tilt validation script is `/tmp/btc-tilt-validate.py`.
