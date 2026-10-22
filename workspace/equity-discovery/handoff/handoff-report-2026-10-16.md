# Equity -> paper-path handoff report — cycle 2026-10-16

- Inputs: 88 qualified equity candidates from the resumable-batch discovery scan
- Handler: integrated issuance path (DbStore /home/hatch/workspace/goals/research-terminal/paper-signals/equity-discovery/handoff/handoff-store-2026-10-16.db) — same orchestrator, same gates as crypto
- Entry semantics: entry-v1 next-XNYS-session-open-print (consolidated tape; sandbox ScriptedFeed)
- Alert acks: simulated (sandbox transport)
- Timestamp rule asserted per entered signal: setupAlertAt < entryObservedAt <= alertedAt

| symbol | direction | score | status | gate | contract | signal | setupAlertAt | entryObservedAt | alertedAt |
|---|---|---|---|---|---|---|---|---|---|---|
| AAPL | long | 56 | expired | expiry | - | - | - | - | - |
| ABBV | long | 95 | expired | expiry | - | - | - | - | - |
| ABT | long | 20 | expired | expiry | - | - | - | - | - |
| ACN | long | 73 | expired | expiry | - | - | - | - | - |
| AMD | long | 20 | expired | expiry | - | - | - | - | - |
| AMGN | long | 78 | expired | expiry | - | - | - | - | - |
| AMT | long | 56 | expired | expiry | - | - | - | - | - |
| ANET | short | -42 | expired | expiry | - | - | - | - | - |
| AVGO | short | -56 | expired | expiry | - | - | - | - | - |
| AXP | short | -20 | expired | expiry | - | - | - | - | - |
| BA | short | -73 | invalidated | first-print-unverifiable | ct_28e6c6316ce137e5cad3e4572be35f4b | - | 2026-10-20T17:31:11.829Z | - | - |
| BAC | short | -73 | invalidated | first-print-unverifiable | ct_261a5d95c389495d50b968e0d3151e0c | - | 2026-10-20T17:31:11.984Z | - | - |
| BKNG | short | -42 | invalidated | first-print-unverifiable | ct_17f5f9e811f9b3b20647fa7539eb6713 | - | 2026-10-20T17:31:12.097Z | - | - |
| BLK | long | 78 | invalidated | first-print-unverifiable | ct_1b2c0864b94efd60ac73a8a9ed09342c | - | 2026-10-20T17:31:12.204Z | - | - |
| BMY | short | -38 | invalidated | first-print-unverifiable | ct_490c30b27bee4a805d500c5808d09e01 | - | 2026-10-20T17:31:12.313Z | - | - |
| BNY | short | -38 | invalidated | first-print-unverifiable | ct_e81db4ed264a881f30e73a389b63e0a5 | - | 2026-10-20T17:31:12.432Z | - | - |
| BRK-B | long | 73 | invalidated | first-print-unverifiable | ct_e023dc625398aede5a3159fa6d02f2bc | - | 2026-10-20T17:31:12.547Z | - | - |
| C | short | -73 | invalidated | first-print-unverifiable | ct_033419040484d712f14321387d509645 | - | 2026-10-20T17:31:12.733Z | - | - |
| CAT | short | -56 | invalidated | first-print-unverifiable | ct_f8d2856c670eadca8a1dc1354f232930 | - | 2026-10-20T17:31:12.901Z | - | - |
| CMCSA | short | -42 | invalidated | first-print-unverifiable | ct_2d72f3d78241fd80546fdcff56126b94 | - | 2026-10-20T17:31:13.133Z | - | - |
| COF | short | -20 | invalidated | first-print-unverifiable | ct_5dabca813b24ae2258116972cd2409a2 | - | 2026-10-20T17:31:13.343Z | - | - |
| COP | long | 95 | invalidated | first-print-unverifiable | ct_7fce3b805d5457c5b8767efcdc1b7101 | - | 2026-10-20T17:31:13.546Z | - | - |
| COST | long | 73 | invalidated | first-print-unverifiable | ct_759e7cc92712af34e162b222f4b97548 | - | 2026-10-20T17:31:13.747Z | - | - |
| CRM | long | 56 | invalidated | first-print-unverifiable | ct_b6daa3ccbf90d8a93c020a9399946b8b | - | 2026-10-20T17:31:13.845Z | - | - |
| CSCO | short | -20 | invalidated | first-print-unverifiable | ct_5bf62ca9f4929b7896368855672e48c1 | - | 2026-10-20T17:31:13.957Z | - | - |
| CVS | long | 38 | invalidated | first-print-unverifiable | ct_111f0e1b58d19cb0651fd59834c01ca6 | - | 2026-10-20T17:31:14.047Z | - | - |
| CVX | long | 73 | invalidated | first-print-unverifiable | ct_9373069ababc1b4b9c7d542a27ff2a20 | - | 2026-10-20T17:31:14.174Z | - | - |
| DE | short | -38 | invalidated | first-print-unverifiable | ct_544809343e9becf895f02ccd6824771f | - | 2026-10-20T17:31:14.302Z | - | - |
| DELL | short | -38 | invalidated | first-print-unverifiable | ct_a4a1ddd7aeab072fdd3c03c1e0230ffc | - | 2026-10-20T17:31:14.416Z | - | - |
| DHR | long | 73 | invalidated | first-print-unverifiable | ct_36e3650431e784ad796a4b7b43a011a5 | - | 2026-10-20T17:31:14.537Z | - | - |
| DIS | long | 56 | invalidated | first-print-unverifiable | ct_80e23a671c09dc3574985a92d9d030bc | - | 2026-10-20T17:31:14.641Z | - | - |
| DUK | long | 38 | invalidated | first-print-unverifiable | ct_462182926b90e49d8a0c756c942ca159 | - | 2026-10-20T17:31:14.835Z | - | - |
| EMR | long | 51 | invalidated | first-print-unverifiable | ct_1715ff94cde2c386a41370f8214c6b1f | - | 2026-10-20T17:31:14.927Z | - | - |
| FDX | short | -42 | invalidated | first-print-unverifiable | ct_0504a7a8dc8d512af21a08c23f42270a | - | 2026-10-20T17:31:15.042Z | - | - |
| GD | short | -42 | invalidated | first-print-unverifiable | ct_d95b2c685ed0a6b8c6cb9c33b7e1732e | - | 2026-10-20T17:31:15.133Z | - | - |
| GE | short | -20 | invalidated | first-print-unverifiable | ct_d996a65786cca164f1c8e4653cb26d6f | - | 2026-10-20T17:31:15.218Z | - | - |
| GEV | short | -56 | invalidated | first-print-unverifiable | ct_0f5f265a753182fbbf4d746f7b11492c | - | 2026-10-20T17:31:15.328Z | - | - |
| GILD | long | 33 | invalidated | first-print-unverifiable | ct_863fcf085dee5c7c3bad3c87cbe3a8a2 | - | 2026-10-20T17:31:15.421Z | - | - |
| GOOG | short | -38 | invalidated | first-print-unverifiable | ct_cd9fbcfdafc545b32aae3793460172c4 | - | 2026-10-20T17:31:15.517Z | - | - |
| GOOGL | short | -20 | invalidated | first-print-unverifiable | ct_e6e4c000ba8deccc97ec605f0e822c1b | - | 2026-10-20T17:31:15.616Z | - | - |
| GS | short | -73 | invalidated | first-print-unverifiable | ct_3e12ebdde02d3837b495c3b626be812e | - | 2026-10-20T17:31:15.707Z | - | - |
| HD | long | 24 | invalidated | first-print-unverifiable | ct_c033a57e70c5b1f8572ae17dbc3b9c6d | - | 2026-10-20T17:31:15.822Z | - | - |
| INTC | short | -38 | invalidated | first-print-unverifiable | ct_e2fc4c89725be55b2f988eda209d3ce4 | - | 2026-10-20T17:31:15.921Z | - | - |
| INTU | long | 38 | invalidated | first-print-unverifiable | ct_757cb9a5b31c019ecb9b7af380e024ff | - | 2026-10-20T17:31:16.043Z | - | - |
| ISRG | long | 38 | invalidated | first-print-unverifiable | ct_bf03b4cb79acc49b65a7df0f232e6025 | - | 2026-10-20T17:31:16.414Z | - | - |
| JNJ | short | -60 | invalidated | first-print-unverifiable | ct_b51531994c2a4048625199b3a06d5a68 | - | 2026-10-20T17:31:16.652Z | - | - |
| JPM | short | -24 | invalidated | first-print-unverifiable | ct_f1409209c4462f5a4ed3a4c30cd3e89e | - | 2026-10-20T17:31:16.837Z | - | - |
| KO | long | 73 | invalidated | first-print-unverifiable | ct_01b7785378d3034279d1a60a964059a0 | - | 2026-10-20T17:31:16.959Z | - | - |
| LIN | long | 56 | invalidated | first-print-unverifiable | ct_28bdb418efb73510e2c39a5098efd3a8 | - | 2026-10-20T17:31:17.069Z | - | - |
| LLY | long | 73 | invalidated | first-print-unverifiable | ct_55ed06f65dcf79b83a705dd4d15b3003 | - | 2026-10-20T17:31:17.196Z | - | - |
| LMT | long | 42 | invalidated | first-print-unverifiable | ct_715a723a77c1b193507ddeb3a19f8efc | - | 2026-10-20T17:31:17.346Z | - | - |
| LRCX | short | -78 | invalidated | first-print-unverifiable | ct_ab94545229257abb88854f72302ffae3 | - | 2026-10-20T17:31:17.515Z | - | - |
| MA | long | 51 | invalidated | first-print-unverifiable | ct_3f567084df6f91f433c9d3f9cdca5fc2 | - | 2026-10-20T17:31:17.736Z | - | - |
| MCD | short | -42 | invalidated | first-print-unverifiable | ct_ba7db63636ee60c88f8e599cb820d4c9 | - | 2026-10-20T17:31:17.899Z | - | - |
| MDLZ | long | 78 | invalidated | first-print-unverifiable | ct_222556fbfe9915a881bbde154abcb5d2 | - | 2026-10-20T17:31:18.036Z | - | - |
| MDT | long | 56 | invalidated | first-print-unverifiable | ct_da5174799020b076af1388e796ff446b | - | 2026-10-20T17:31:18.162Z | - | - |
| META | long | 42 | invalidated | first-print-unverifiable | ct_3d95ef37761cfdc9e9e923217dece621 | - | 2026-10-20T17:31:18.274Z | - | - |
| MO | long | 73 | invalidated | first-print-unverifiable | ct_b9c01847667f003f0ea736e95576c1d4 | - | 2026-10-20T17:31:18.434Z | - | - |
| MS | short | -51 | invalidated | first-print-unverifiable | ct_954f6a65526010b86b69cc1ace5f5e50 | - | 2026-10-20T17:31:18.605Z | - | - |
| MSFT | long | 73 | invalidated | first-print-unverifiable | ct_65fe7bb96bde6251c8a993a01662c8a4 | - | 2026-10-20T17:31:18.715Z | - | - |
| MU | short | -38 | invalidated | first-print-unverifiable | ct_1fa83a1f47a8fa20624a6e110d1e7d43 | - | 2026-10-20T17:31:19.141Z | - | - |
| NEE | short | -42 | invalidated | first-print-unverifiable | ct_e289362d0d98c3511302338fe6ce8d2a | - | 2026-10-20T17:31:19.236Z | - | - |
| NFLX | short | -73 | invalidated | first-print-unverifiable | ct_9e67ee07393acf539c3fd0db8b76cbb8 | - | 2026-10-20T17:31:19.352Z | - | - |
| NOW | long | 56 | invalidated | first-print-unverifiable | ct_12c254e0e5393c228cad6ac1535dae21 | - | 2026-10-20T17:31:19.438Z | - | - |
| NVDA | short | -38 | invalidated | first-print-unverifiable | ct_9cb2e02cbc7573ed77bb629b1961de1e | - | 2026-10-20T17:31:19.539Z | - | - |
| ORCL | short | -73 | invalidated | first-print-unverifiable | ct_f23f5a9fc0f43c88f58009745f448ef2 | - | 2026-10-20T17:31:19.630Z | - | - |
| PANW | short | -38 | invalidated | first-print-unverifiable | ct_ead5217d3ddbe0c21fc338b00ff1fc80 | - | 2026-10-20T17:31:19.719Z | - | - |
| PFE | long | 56 | invalidated | first-print-unverifiable | ct_a5117830e0776ecb37b4a162f71f8782 | - | 2026-10-20T17:31:19.828Z | - | - |
| PG | long | 73 | invalidated | first-print-unverifiable | ct_ac07c807c63f654375179c346ee856cf | - | 2026-10-20T17:31:19.932Z | - | - |
| PLTR | long | 51 | invalidated | first-print-unverifiable | ct_3b4cca266a72621e1eea925a03ca5237 | - | 2026-10-20T17:31:20.035Z | - | - |
| PM | long | 73 | invalidated | first-print-unverifiable | ct_9c891826b8212e79293724439c73ede2 | - | 2026-10-20T17:31:20.223Z | - | - |
| QCOM | short | -38 | invalidated | first-print-unverifiable | ct_5bbc2a35e67f886c5576c2125421f3a1 | - | 2026-10-20T17:31:20.404Z | - | - |
| RTX | short | -42 | invalidated | first-print-unverifiable | ct_d7dcffc7a17ccc27eade6186719d8f17 | - | 2026-10-20T17:31:20.492Z | - | - |
| SCHW | short | -51 | invalidated | first-print-unverifiable | ct_2715e582493016a70c0c4d6f085a1a95 | - | 2026-10-20T17:31:20.591Z | - | - |
| SNDK | short | -60 | invalidated | first-print-unverifiable | ct_4d6a5620877a9020852e5332d9d73518 | - | 2026-10-20T17:31:20.703Z | - | - |
| SO | long | 38 | invalidated | first-print-unverifiable | ct_f48bc106daf40fd3adf1855480a2af86 | - | 2026-10-20T17:31:20.837Z | - | - |
| T | short | -73 | invalidated | first-print-unverifiable | ct_b17cd6aa6a30bdc0224df2f7bfb68dc7 | - | 2026-10-20T17:31:20.938Z | - | - |
| TMO | long | 73 | invalidated | first-print-unverifiable | ct_27c7895fe608e4b1762bc1c091599184 | - | 2026-10-20T17:31:21.055Z | - | - |
| TMUS | short | -73 | invalidated | first-print-unverifiable | ct_6a896ad2d242142283f41d81b5c75b40 | - | 2026-10-20T17:31:21.168Z | - | - |
| UBER | short | -42 | invalidated | first-print-unverifiable | ct_afd363b42a32ac84391087b70d55a36f | - | 2026-10-20T17:31:21.332Z | - | - |
| UNH | long | 56 | invalidated | first-print-unverifiable | ct_08ab425875d6dda913030ff438ffd8f9 | - | 2026-10-20T17:31:21.466Z | - | - |
| UNP | long | 38 | invalidated | first-print-unverifiable | ct_cd70cbe7ffac9e9ba5f629aa2a43c4a1 | - | 2026-10-20T17:31:21.577Z | - | - |
| USB | short | -24 | invalidated | first-print-unverifiable | ct_4fe60014930244f0449bf5fae0506bf7 | - | 2026-10-20T17:31:21.686Z | - | - |
| V | long | 73 | invalidated | first-print-unverifiable | ct_b89fe8a09259beaa2328468615e4b9cf | - | 2026-10-20T17:31:21.774Z | - | - |
| VZ | short | -73 | invalidated | first-print-unverifiable | ct_13e4e8321de8b53c7a24f9f9740e5bac | - | 2026-10-20T17:31:21.979Z | - | - |
| WFC | short | -42 | invalidated | first-print-unverifiable | ct_a5af6648d47e8aa1a85e141f577d2b4c | - | 2026-10-20T17:31:22.078Z | - | - |
| WMT | long | 73 | invalidated | first-print-unverifiable | ct_49354484015865728ae19c095dc539fe | - | 2026-10-20T17:31:22.178Z | - | - |
| XOM | long | 73 | invalidated | first-print-unverifiable | ct_dc37120ae22c344575b01668d91d1deb | - | 2026-10-20T17:31:22.279Z | - | - |

Outcome mix: {"expired":10,"invalidated":78}. Handler check failures: 0.

## State machine coverage

qualified -> awaiting-entry -> entered | expired | invalidated, per the integrated handler.
Rejections carry the deciding gate; deferrals carry the reason + next reassessment.
