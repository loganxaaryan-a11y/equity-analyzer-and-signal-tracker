# Equity -> paper-path handoff report — cycle 2026-10-15

- Inputs: 83 qualified equity candidates from the resumable-batch discovery scan
- Handler: integrated issuance path (DbStore /home/hatch/workspace/goals/research-terminal/paper-signals/equity-discovery/handoff/handoff-store-2026-10-15.db) — same orchestrator, same gates as crypto
- Entry semantics: entry-v1 next-XNYS-session-open-print (consolidated tape; sandbox ScriptedFeed)
- Alert acks: simulated (sandbox transport)
- Timestamp rule asserted per entered signal: setupAlertAt < entryObservedAt <= alertedAt

| symbol | direction | score | status | gate | contract | signal | setupAlertAt | entryObservedAt | alertedAt |
|---|---|---|---|---|---|---|---|---|---|---|
| AAPL | long | 73 | invalidated | first-print-unverifiable | ct_9df3a5a35bb7af092eda35e14e6aa781 | - | 2026-10-16T17:36:42.248Z | - | - |
| ABBV | long | 73 | invalidated | first-print-unverifiable | ct_f116b8d8c63d9884f671d2825ae758ef | - | 2026-10-16T17:36:42.395Z | - | - |
| ACN | long | 73 | invalidated | first-print-unverifiable | ct_b30fd746eda0fd5df80c11c3564fee9e | - | 2026-10-16T17:36:42.510Z | - | - |
| ADBE | short | -42 | invalidated | first-print-unverifiable | ct_307af9215d61ed56c463058af985095a | - | 2026-10-16T17:36:42.683Z | - | - |
| AMD | long | 42 | invalidated | first-print-unverifiable | ct_957e9f276b3f562c21350564195125c2 | - | 2026-10-16T17:36:42.798Z | - | - |
| AMGN | long | 56 | invalidated | first-print-unverifiable | ct_ed766fcce0a720bd80305a50f77bfe47 | - | 2026-10-16T17:36:42.905Z | - | - |
| AMT | long | 56 | invalidated | first-print-unverifiable | ct_ae61b43b72a2927aad5a16835671d827 | - | 2026-10-16T17:36:43.033Z | - | - |
| ANET | short | -20 | invalidated | first-print-unverifiable | ct_80788c15e51ab4c4a1611d9130f84e9f | - | 2026-10-16T17:36:43.136Z | - | - |
| AXP | short | -64 | invalidated | first-print-unverifiable | ct_92a1ba0a567bc8ba4e7772cce22f7d1b | - | 2026-10-16T17:36:43.251Z | - | - |
| BA | short | -73 | invalidated | first-print-unverifiable | ct_2a25a1450ce187cbd58b4e8f31d1c0bf | - | 2026-10-16T17:36:43.350Z | - | - |
| BAC | short | -73 | invalidated | first-print-unverifiable | ct_535980ff8db006d3fa3a6c37e8fc1ac4 | - | 2026-10-16T17:36:43.496Z | - | - |
| BKNG | short | -73 | invalidated | first-print-unverifiable | ct_6e7e95e98e0b66c97de0c6797546a63a | - | 2026-10-16T17:36:43.599Z | - | - |
| BLK | long | 20 | invalidated | first-print-unverifiable | ct_689e0a2cd27cc266f2c1b5e03ee2cfd7 | - | 2026-10-16T17:36:43.706Z | - | - |
| BMY | short | -60 | invalidated | first-print-unverifiable | ct_a0aa2ab70059584c51228eca5c285caf | - | 2026-10-16T17:36:43.866Z | - | - |
| BNY | short | -60 | invalidated | first-print-unverifiable | ct_a01553742f5f3081179d188945af4f3f | - | 2026-10-16T17:36:43.993Z | - | - |
| BRK-B | long | 73 | invalidated | first-print-unverifiable | ct_7dc9856cf064325b13938837e204336a | - | 2026-10-16T17:36:44.115Z | - | - |
| C | short | -73 | invalidated | first-print-unverifiable | ct_92288671f763beb9812517bd3392b388 | - | 2026-10-16T17:36:44.236Z | - | - |
| CAT | short | -78 | invalidated | first-print-unverifiable | ct_457bffb422e6bd1e9f9fdec7857ecdfd | - | 2026-10-16T17:36:44.368Z | - | - |
| CMCSA | short | -73 | invalidated | first-print-unverifiable | ct_bf99c41ae139c1db1d0cfa5f77fc1645 | - | 2026-10-16T17:36:44.488Z | - | - |
| COF | short | -73 | invalidated | first-print-unverifiable | ct_8dd658a87e41c7e0888d9a51fbeaf381 | - | 2026-10-16T17:36:44.615Z | - | - |
| COP | long | 56 | invalidated | first-print-unverifiable | ct_ad08372e13d16b416e1d5529702da783 | - | 2026-10-16T17:36:44.728Z | - | - |
| COST | long | 73 | invalidated | first-print-unverifiable | ct_112a97838f1c126d4e0b0ae800bc0863 | - | 2026-10-16T17:36:44.853Z | - | - |
| CRM | long | 33 | invalidated | first-print-unverifiable | ct_5392031dde335803c94f11a30c38e7f4 | - | 2026-10-16T17:36:45.009Z | - | - |
| CSCO | long | 33 | invalidated | first-print-unverifiable | ct_b9415c805c5598424c4312a6113063ac | - | 2026-10-16T17:36:45.111Z | - | - |
| CVS | short | -24 | invalidated | first-print-unverifiable | ct_641d9c73fc29927c051970fc41a719a0 | - | 2026-10-16T17:36:45.197Z | - | - |
| CVX | long | 56 | invalidated | first-print-unverifiable | ct_b8132567b0ea76276cd4c6e5e3f357ff | - | 2026-10-16T17:36:45.301Z | - | - |
| DELL | short | -20 | invalidated | first-print-unverifiable | ct_22b89d1ec26407ac199b628f672604df | - | 2026-10-16T17:36:45.456Z | - | - |
| DHR | long | 73 | invalidated | first-print-unverifiable | ct_36f27edd989b3175ed8d10306f80efec | - | 2026-10-16T17:36:45.598Z | - | - |
| DIS | long | 56 | invalidated | first-print-unverifiable | ct_f5bfc64b4890ca701c76e84e8a5005b4 | - | 2026-10-16T17:36:45.676Z | - | - |
| DUK | long | 20 | invalidated | first-print-unverifiable | ct_76496944bef88690eb7983775f0952f8 | - | 2026-10-16T17:36:45.757Z | - | - |
| EMR | long | 73 | invalidated | first-print-unverifiable | ct_27cd5058ab8671b9f9670723b34369ae | - | 2026-10-16T17:36:45.836Z | - | - |
| FDX | short | -64 | invalidated | first-print-unverifiable | ct_3a8b8d9c97070cb783bf62ef23754aa1 | - | 2026-10-16T17:36:45.915Z | - | - |
| GD | short | -73 | invalidated | first-print-unverifiable | ct_90268181f8d606968228f8207d60860b | - | 2026-10-16T17:36:46.053Z | - | - |
| GE | short | -73 | invalidated | first-print-unverifiable | ct_35e1d26f3d74190c25e4e153fdc243a6 | - | 2026-10-16T17:36:46.148Z | - | - |
| GILD | long | 56 | invalidated | first-print-unverifiable | ct_ea82c7c38b444ef59b0e150a090d1fc7 | - | 2026-10-16T17:36:46.225Z | - | - |
| GOOG | long | 33 | invalidated | first-print-unverifiable | ct_b5bea0b66c1444af0d8f8c8571606fc4 | - | 2026-10-16T17:36:46.322Z | - | - |
| GOOGL | long | 33 | invalidated | first-print-unverifiable | ct_99bddbcc7123632243d873112fc2fd2e | - | 2026-10-16T17:36:46.421Z | - | - |
| GS | short | -95 | invalidated | first-print-unverifiable | ct_3d635948105502c15f1448ad49900767 | - | 2026-10-16T17:36:46.527Z | - | - |
| HD | short | -42 | invalidated | first-print-unverifiable | ct_31ceff82bd70fb62c32901e21bae5e72 | - | 2026-10-16T17:36:46.626Z | - | - |
| IBM | short | -20 | invalidated | first-print-unverifiable | ct_c43fa6fa3ded2252f21c3b59f771083e | - | 2026-10-16T17:36:46.705Z | - | - |
| INTC | short | -38 | invalidated | first-print-unverifiable | ct_bf2aff3ab1a74d427aaa9c808a961bf3 | - | 2026-10-16T17:36:46.881Z | - | - |
| ISRG | long | 60 | invalidated | first-print-unverifiable | ct_c3522da821983131080ead4d7453859b | - | 2026-10-16T17:36:47.073Z | - | - |
| JNJ | short | -38 | invalidated | first-print-unverifiable | ct_294df31ab594ee7f66f13fda6e810ca3 | - | 2026-10-16T17:36:47.275Z | - | - |
| KO | long | 73 | invalidated | first-print-unverifiable | ct_5af3805ec941030d6c0f1dbd56010118 | - | 2026-10-16T17:36:47.368Z | - | - |
| LIN | long | 56 | invalidated | first-print-unverifiable | ct_201ecedc962cf6f18a4947dbdd162987 | - | 2026-10-16T17:36:47.481Z | - | - |
| LLY | long | 78 | invalidated | first-print-unverifiable | ct_784a8200023adaf41ada9c1af8869bb3 | - | 2026-10-16T17:36:47.585Z | - | - |
| LMT | short | -20 | invalidated | first-print-unverifiable | ct_f1a06a7f35c9110d7de3d243283980cd | - | 2026-10-16T17:36:47.727Z | - | - |
| LOW | short | -20 | invalidated | first-print-unverifiable | ct_e09525b90493db49bd44c5469b08de96 | - | 2026-10-16T17:36:47.888Z | - | - |
| MA | long | 56 | invalidated | first-print-unverifiable | ct_15a0cc3924fcc9efce684189ce6edf8c | - | 2026-10-16T17:36:48.061Z | - | - |
| MCD | short | -64 | invalidated | first-print-unverifiable | ct_72946326045a72d8747a1050d362c15c | - | 2026-10-16T17:36:48.214Z | - | - |
| MDLZ | long | 56 | invalidated | first-print-unverifiable | ct_d1e44cfa8c454e0fcd24d3abe9b890af | - | 2026-10-16T17:36:48.342Z | - | - |
| MDT | long | 56 | invalidated | first-print-unverifiable | ct_d3bafa7e6ea6c8d47b8eb3f50db36b3e | - | 2026-10-16T17:36:48.475Z | - | - |
| META | long | 73 | invalidated | first-print-unverifiable | ct_e486d80963b336a32d96a78da256192e | - | 2026-10-16T17:36:48.609Z | - | - |
| MO | long | 73 | invalidated | first-print-unverifiable | ct_31c0e6558c9e115ddd680aba65462855 | - | 2026-10-16T17:36:48.822Z | - | - |
| MS | short | -51 | invalidated | first-print-unverifiable | ct_d59f7923b8e5f7c73b6bd4e2c031952f | - | 2026-10-16T17:36:48.981Z | - | - |
| MSFT | long | 73 | invalidated | first-print-unverifiable | ct_eb630a92023cfd669d52378619063fa8 | - | 2026-10-16T17:36:49.145Z | - | - |
| NEE | short | -42 | invalidated | first-print-unverifiable | ct_fca92e364cead74a7de81090df1706a4 | - | 2026-10-16T17:36:49.291Z | - | - |
| NFLX | short | -42 | invalidated | first-print-unverifiable | ct_c839e5a2910c3d9a76ea2a633c296e96 | - | 2026-10-16T17:36:49.401Z | - | - |
| NOW | long | 78 | invalidated | first-print-unverifiable | ct_d7fb1ebbf28ede6c53c2492a6c3960d3 | - | 2026-10-16T17:36:49.496Z | - | - |
| NVDA | short | -20 | invalidated | first-print-unverifiable | ct_1d2e4cb76354c460133b58c0f7eec1fa | - | 2026-10-16T17:36:49.648Z | - | - |
| ORCL | short | -56 | invalidated | first-print-unverifiable | ct_1db485ca7ba47a8d9e69a3471e711bc1 | - | 2026-10-16T17:36:49.777Z | - | - |
| PANW | short | -20 | invalidated | first-print-unverifiable | ct_808d08ab5703a04b96cb7a4bf114ef0d | - | 2026-10-16T17:36:49.939Z | - | - |
| PEP | short | -42 | invalidated | first-print-unverifiable | ct_ba3913a94ae1ea0e2e6c28379861e348 | - | 2026-10-16T17:36:50.081Z | - | - |
| PFE | long | 56 | invalidated | first-print-unverifiable | ct_b632cc18b0f614585dd6b13140f2b098 | - | 2026-10-16T17:36:50.273Z | - | - |
| PG | long | 95 | invalidated | first-print-unverifiable | ct_d3647bed9fd94faac4c581a0b326dcc5 | - | 2026-10-16T17:36:50.406Z | - | - |
| PLTR | long | 73 | invalidated | first-print-unverifiable | ct_c9b06cab7966d8b07fe3ee2d03056be6 | - | 2026-10-16T17:36:50.551Z | - | - |
| PM | long | 51 | invalidated | first-print-unverifiable | ct_df987c642c3d583a325068fd27fa99f8 | - | 2026-10-16T17:36:50.703Z | - | - |
| RTX | short | -73 | invalidated | first-print-unverifiable | ct_8b453c805161b377a90d898db9acb425 | - | 2026-10-16T17:36:50.915Z | - | - |
| SCHW | short | -95 | invalidated | first-print-unverifiable | ct_20474726b5795437ea348d4e1b5d8d29 | - | 2026-10-16T17:36:51.058Z | - | - |
| SNDK | short | -60 | invalidated | first-print-unverifiable | ct_901ec7ef8b47ff3fec35297f2c110da2 | - | 2026-10-16T17:36:51.206Z | - | - |
| SO | long | 38 | invalidated | first-print-unverifiable | ct_1fe173b519c0324c0d60bd9271713f26 | - | 2026-10-16T17:36:51.349Z | - | - |
| T | short | -73 | invalidated | first-print-unverifiable | ct_76e9edb9f497b7fec6305d2660b17933 | - | 2026-10-16T17:36:51.521Z | - | - |
| TMO | long | 95 | invalidated | first-print-unverifiable | ct_f238f2af73c691c16df6c0be7c7af231 | - | 2026-10-16T17:36:51.694Z | - | - |
| TMUS | short | -73 | invalidated | first-print-unverifiable | ct_319766221143ac5f7484521192238607 | - | 2026-10-16T17:36:51.902Z | - | - |
| TXN | long | 42 | invalidated | first-print-unverifiable | ct_6cc39d8d21094a25aff50fa8b75861a3 | - | 2026-10-16T17:36:52.072Z | - | - |
| UNH | long | 78 | invalidated | first-print-unverifiable | ct_2418a77a3e4d9ba309dee4e1d40f0812 | - | 2026-10-16T17:36:52.261Z | - | - |
| UNP | long | 38 | invalidated | first-print-unverifiable | ct_841fd10fe8e75ed4c809aef5349d7a35 | - | 2026-10-16T17:36:52.475Z | - | - |
| USB | short | -38 | invalidated | first-print-unverifiable | ct_320d750fc3587dba7098b0e71932b8c1 | - | 2026-10-16T17:36:52.660Z | - | - |
| V | long | 73 | invalidated | first-print-unverifiable | ct_8f72ba229634076c58172b9309e0734c | - | 2026-10-16T17:36:52.866Z | - | - |
| VZ | short | -73 | invalidated | first-print-unverifiable | ct_57fea2d8fbfd77b21cf9ba7b7b927208 | - | 2026-10-16T17:36:53.018Z | - | - |
| WFC | short | -42 | invalidated | first-print-unverifiable | ct_bcf23df37fd74be993f921b5511b0aaa | - | 2026-10-16T17:36:53.240Z | - | - |
| WMT | long | 95 | invalidated | first-print-unverifiable | ct_52d5d81e5fe24d8b523685f6aba796f0 | - | 2026-10-16T17:36:53.352Z | - | - |
| XOM | long | 73 | invalidated | first-print-unverifiable | ct_28a0e9db551731fb9868c2af61865c6a | - | 2026-10-16T17:36:53.489Z | - | - |

Outcome mix: {"invalidated":83}. Handler check failures: 0.

## State machine coverage

qualified -> awaiting-entry -> entered | expired | invalidated, per the integrated handler.
Rejections carry the deciding gate; deferrals carry the reason + next reassessment.
