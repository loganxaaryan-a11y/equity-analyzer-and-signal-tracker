# Equity -> paper-path handoff report — cycle 2026-10-14

- Inputs: 85 qualified equity candidates from the resumable-batch discovery scan
- Handler: integrated issuance path (DbStore /home/hatch/workspace/goals/research-terminal/paper-signals/equity-discovery/handoff/handoff-store-2026-10-14.db) — same orchestrator, same gates as crypto
- Entry semantics: entry-v1 next-XNYS-session-open-print (consolidated tape; sandbox ScriptedFeed)
- Alert acks: simulated (sandbox transport)
- Timestamp rule asserted per entered signal: setupAlertAt < entryObservedAt <= alertedAt

| symbol | direction | score | status | gate | contract | signal | setupAlertAt | entryObservedAt | alertedAt |
|---|---|---|---|---|---|---|---|---|---|---|
| AAPL | long | 73 | issued | - | ct_2e6b7e006aa1436a1271ffc6b38f8564 | sig_2e6b7e006aa1436a1271ffc6 | 2026-10-14T07:30:14.530Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:14.530Z |
| ABBV | long | 51 | issued | - | ct_b0149153b0baf069a824bc80254a8cb0 | sig_b0149153b0baf069a824bc80 | 2026-10-14T07:30:14.678Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:14.678Z |
| ABT | short | -24 | rejected | min-score | - | - | - | - | - |
| ACN | long | 73 | issued | - | ct_cfbe144d2e685bd08c4df8d8ff4b7d8d | sig_cfbe144d2e685bd08c4df8d8 | 2026-10-14T07:30:14.820Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:14.820Z |
| ADBE | short | -73 | rejected | min-score | - | - | - | - | - |
| AMD | long | 64 | issued | - | ct_343ed00dc51874d75e8241c2fe018273 | sig_343ed00dc51874d75e8241c2 | 2026-10-14T07:30:14.973Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:14.973Z |
| AMGN | long | 33 | issued | - | ct_c8179b4d652b78088ace618177bb808d | sig_c8179b4d652b78088ace6181 | 2026-10-14T07:30:15.139Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:15.139Z |
| AMT | long | 56 | issued | - | ct_76b3e3efcfb6d19e54d955a5f4617e7a | sig_76b3e3efcfb6d19e54d955a5 | 2026-10-14T07:30:15.265Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:15.265Z |
| AMZN | long | 33 | issued | - | ct_c470b74ad1d7b38ed6fadf6ed3a9ee62 | sig_c470b74ad1d7b38ed6fadf6e | 2026-10-14T07:30:15.384Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:15.384Z |
| AXP | short | -42 | rejected | min-score | - | - | - | - | - |
| BA | short | -73 | rejected | min-score | - | - | - | - | - |
| BAC | short | -73 | rejected | min-score | - | - | - | - | - |
| BKNG | short | -73 | rejected | min-score | - | - | - | - | - |
| BMY | short | -73 | rejected | min-score | - | - | - | - | - |
| BNY | short | -38 | rejected | min-score | - | - | - | - | - |
| BRK-B | long | 73 | issued | - | ct_589e8be0067cda275bbdff1759d500e5 | sig_589e8be0067cda275bbdff17 | 2026-10-14T07:30:15.956Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:15.956Z |
| CAT | short | -78 | rejected | min-score | - | - | - | - | - |
| CMCSA | short | -73 | rejected | min-score | - | - | - | - | - |
| COF | short | -73 | rejected | min-score | - | - | - | - | - |
| COP | long | 56 | issued | - | ct_571c2fb428eaf1f986867c98ab5662d6 | sig_571c2fb428eaf1f986867c98 | 2026-10-14T07:30:16.401Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:16.401Z |
| COST | long | 38 | issued | - | ct_7eda55c58f6b3ee21587714c58d4bb77 | sig_7eda55c58f6b3ee21587714c | 2026-10-14T07:30:16.606Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:16.606Z |
| CRM | long | 56 | issued | - | ct_55d173b2fe58ad25723b8d21324eda4b | sig_55d173b2fe58ad25723b8d21 | 2026-10-14T07:30:16.798Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:16.798Z |
| CSCO | long | 56 | issued | - | ct_870ab9bef80ce127666f7046fe87b157 | sig_870ab9bef80ce127666f7046 | 2026-10-14T07:30:16.955Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:16.955Z |
| CVS | short | -24 | rejected | min-score | - | - | - | - | - |
| CVX | long | 73 | issued | - | ct_cd6570d27cf0c9dfa740c055a906b8d6 | sig_cd6570d27cf0c9dfa740c055 | 2026-10-14T07:30:17.096Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.096Z |
| DELL | long | 73 | issued | - | ct_3ab675b689e727029ceb5b1d23377c13 | sig_3ab675b689e727029ceb5b1d | 2026-10-14T07:30:17.211Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.211Z |
| DHR | long | 56 | issued | - | ct_686c941ce9fcc48000384ef39505f9a3 | sig_686c941ce9fcc48000384ef3 | 2026-10-14T07:30:17.323Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.323Z |
| DIS | long | 56 | issued | - | ct_980832918e4943f8e43c4b470775e9c6 | sig_980832918e4943f8e43c4b47 | 2026-10-14T07:30:17.428Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.428Z |
| EMR | long | 73 | issued | - | ct_cbbc357f37db0ecd5f50f267cbe132a9 | sig_cbbc357f37db0ecd5f50f267 | 2026-10-14T07:30:17.538Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.538Z |
| FDX | short | -73 | rejected | min-score | - | - | - | - | - |
| GD | short | -73 | rejected | min-score | - | - | - | - | - |
| GE | short | -73 | rejected | min-score | - | - | - | - | - |
| GEV | long | 73 | issued | - | ct_2296df33d13a8f7d89c125f538cc1803 | sig_2296df33d13a8f7d89c125f5 | 2026-10-14T07:30:17.821Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.821Z |
| GILD | long | 20 | issued | - | ct_991a46387dad399e3b84fc30ffc6f76a | sig_991a46387dad399e3b84fc30 | 2026-10-14T07:30:17.951Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:17.951Z |
| GOOG | long | 56 | issued | - | ct_1a2fea2c558a660c0fb3f966f19dc125 | sig_1a2fea2c558a660c0fb3f966 | 2026-10-14T07:30:18.083Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:18.083Z |
| GOOGL | long | 56 | issued | - | ct_339e220e313889dfb25da32e2c04dcc7 | sig_339e220e313889dfb25da32e | 2026-10-14T07:30:18.250Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:18.250Z |
| GS | short | -95 | rejected | min-score | - | - | - | - | - |
| HD | short | -42 | rejected | min-score | - | - | - | - | - |
| IBM | short | -20 | rejected | min-score | - | - | - | - | - |
| INTC | short | -20 | rejected | min-score | - | - | - | - | - |
| INTU | short | -42 | rejected | min-score | - | - | - | - | - |
| ISRG | long | 60 | issued | - | ct_976f15b1ab5505d396a5f1c0fc635d2e | sig_976f15b1ab5505d396a5f1c0 | 2026-10-14T07:30:18.534Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:18.534Z |
| JNJ | short | -60 | rejected | min-score | - | - | - | - | - |
| KO | long | 56 | issued | - | ct_bbe64ba40ccc2196c80da5ba0fb7e2a0 | sig_bbe64ba40ccc2196c80da5ba | 2026-10-14T07:30:18.685Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:18.685Z |
| LIN | long | 56 | issued | - | ct_e08b48564464e926501c1be8cba350da | sig_e08b48564464e926501c1be8 | 2026-10-14T07:30:18.800Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:18.800Z |
| LMT | short | -73 | rejected | min-score | - | - | - | - | - |
| LOW | short | -42 | rejected | min-score | - | - | - | - | - |
| MA | long | 56 | issued | - | ct_8606106e50227c9b465ee8f2bddbfce8 | sig_8606106e50227c9b465ee8f2 | 2026-10-14T07:30:19.077Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:19.077Z |
| MCD | short | -73 | rejected | min-score | - | - | - | - | - |
| MDLZ | long | 38 | issued | - | ct_028a7769ddc01db669d771222f460d8f | sig_028a7769ddc01db669d77122 | 2026-10-14T07:30:19.322Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:19.322Z |
| MDT | long | 56 | issued | - | ct_ee3e6ca62b007deecaedddb0c16dc28b | sig_ee3e6ca62b007deecaedddb0 | 2026-10-14T07:30:19.500Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:19.500Z |
| META | long | 73 | issued | - | ct_24b9d83b4fb0aa2864990816f51a3776 | sig_24b9d83b4fb0aa2864990816 | 2026-10-14T07:30:19.667Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:19.667Z |
| MMM | short | -38 | rejected | min-score | - | - | - | - | - |
| MO | long | 73 | issued | - | ct_349e892626182d7b6c0d9590d42c93a9 | sig_349e892626182d7b6c0d9590 | 2026-10-14T07:30:19.932Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:19.932Z |
| MRK | short | -38 | rejected | min-score | - | - | - | - | - |
| MS | short | -95 | rejected | min-score | - | - | - | - | - |
| MSFT | long | 73 | issued | - | ct_58cc5c1d81d99a4171cd67e69962c139 | sig_58cc5c1d81d99a4171cd67e6 | 2026-10-14T07:30:20.197Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:20.197Z |
| MU | short | -20 | rejected | min-score | - | - | - | - | - |
| NEE | short | -42 | rejected | min-score | - | - | - | - | - |
| NFLX | short | -73 | rejected | min-score | - | - | - | - | - |
| NVDA | long | 33 | issued | - | ct_dae9132495e69a01af653f03d78e30e7 | sig_dae9132495e69a01af653f03 | 2026-10-14T07:30:20.417Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:20.417Z |
| PANW | long | 33 | issued | - | ct_03f553456792074379a16e262f07bf3d | sig_03f553456792074379a16e26 | 2026-10-14T07:30:20.581Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:20.581Z |
| PEP | short | -73 | rejected | min-score | - | - | - | - | - |
| PFE | long | 56 | issued | - | ct_a2cf051c3d1a4f3d0ccf8323f9fc7f62 | sig_a2cf051c3d1a4f3d0ccf8323 | 2026-10-14T07:30:20.726Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:20.726Z |
| PG | long | 73 | issued | - | ct_2d29a69349ed562a9d2e15a137fb0192 | sig_2d29a69349ed562a9d2e15a1 | 2026-10-14T07:30:20.834Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:20.834Z |
| PLTR | long | 51 | issued | - | ct_d8670045fca56e22f01a54faa4d76724 | sig_d8670045fca56e22f01a54fa | 2026-10-14T07:30:20.941Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:20.941Z |
| PM | long | 73 | issued | - | ct_2be5616fcbbc3d417b13ea70cc4caa70 | sig_2be5616fcbbc3d417b13ea70 | 2026-10-14T07:30:21.046Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:21.046Z |
| RTX | short | -73 | rejected | min-score | - | - | - | - | - |
| SBUX | short | -73 | rejected | min-score | - | - | - | - | - |
| SCHW | short | -73 | rejected | min-score | - | - | - | - | - |
| SNDK | short | -38 | rejected | min-score | - | - | - | - | - |
| SO | long | 20 | issued | - | ct_7eab585daa3b3896109f8ccea98059e0 | sig_7eab585daa3b3896109f8cce | 2026-10-14T07:30:21.303Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:21.303Z |
| T | short | -73 | rejected | min-score | - | - | - | - | - |
| TMO | long | 64 | issued | - | ct_ce8d76037ce9dfe776ef1ae1094e01b8 | sig_ce8d76037ce9dfe776ef1ae1 | 2026-10-14T07:30:21.446Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:21.446Z |
| TMUS | short | -73 | rejected | min-score | - | - | - | - | - |
| TXN | long | 73 | issued | - | ct_19bfedbe2fb4fba326aa3a7adb04d934 | sig_19bfedbe2fb4fba326aa3a7a | 2026-10-14T07:30:21.653Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:21.653Z |
| UBER | short | -20 | rejected | min-score | - | - | - | - | - |
| UNP | short | -24 | rejected | min-score | - | - | - | - | - |
| UPS | short | -73 | rejected | min-score | - | - | - | - | - |
| USB | short | -60 | rejected | min-score | - | - | - | - | - |
| V | long | 56 | issued | - | ct_940f1047d83eecb2cf12e685cc9df767 | sig_940f1047d83eecb2cf12e685 | 2026-10-14T07:30:22.098Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:22.098Z |
| VZ | short | -73 | rejected | min-score | - | - | - | - | - |
| WFC | short | -78 | rejected | min-score | - | - | - | - | - |
| WMT | long | 60 | issued | - | ct_986b452377906f0b271f6159a9c2fa68 | sig_986b452377906f0b271f6159 | 2026-10-14T07:30:22.402Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:22.402Z |
| XOM | long | 73 | issued | - | ct_ba1d012f5eee3198491781287f98d91d | sig_ba1d012f5eee319849178128 | 2026-10-14T07:30:22.600Z | 2026-10-14T13:30:00.000Z | 2026-10-14T13:30:22.600Z |

Outcome mix: {"issued":42,"rejected":43}. Handler check failures: 0.

## State machine coverage

qualified -> awaiting-entry -> entered | expired | invalidated, per the integrated handler.
Rejections carry the deciding gate; deferrals carry the reason + next reassessment.

## Known finding: equity shorts vs the min-score floor

All 43 short candidates were rejected at gate `min-score`: the integrated
handler rejects `score < minScore` (default 0), and equity shorts carry
signed-negative scores (e.g. −73). The repaired path's demos never covered
an equity short, so this lane asymmetry was untested. The handoff kept the
default config (same gates as crypto, unchanged — no reopening accepted
recovery work); whether the floor should apply to |score| for the equity
lane is a parent/expert call requiring a versioned handler change.
