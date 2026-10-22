# Frozen proposal for expert review — velocity/reversal cohort v1

**Status: proposal only; not executed, promoted or used for issuance.**

## Cohort identity
- Separate research cohort: `equity-velocity-reversal-shadow-v1`.
- Universe frozen before each session from the existing supported equity universe; constituent additions/removals timestamped.
- Never merged with trend/baseline cohorts, issued-call outcomes or historical contaminated scoreboards.

## Availability and cutoffs
- Candidate features use only completed bars available by the stated cutoff.
- Daily mode cutoff: completed primary-venue bar plus documented provider availability time; decision time must be later than that availability time.
- Intraday mode, if later proposed, requires a separately registered bar duration and exchange-calendar cutoff. No daily bar may be treated as known at its open.

## Entry and contract
- Executable-entry convention proposed for review: next eligible primary-session open after the decision cutoff, with unmatched/missing opens retained as unmatched rather than imputed.
- Direction fixed at decision time.
- Invalidation and target formulas fixed before prospective collection; no hindsight rewrite.
- Expiry fixed in trading sessions using the validated exchange calendar.
- Barrier outcomes use first-touch ordering; same-bar double touches remain ambiguous unless finer evidence was pre-registered and available.

## Eligibility
- Complete identifier/venue mapping and supported exchange calendar.
- Completed-bar coverage through the cutoff.
- Minimum liquidity, price and spread fields fixed before launch; unavailable inputs are excluded with reason, never treated as pass.
- Corporate actions and symbol changes preserved with source/revision metadata.
- Existing 75% drawdown gate remains unchanged. The velocity exception is observed independently; it does not lower or bypass the gate for production issuance.

## Costs
- Pre-register commissions, spread/slippage and borrow/locate treatment before outcomes exist.
- Long and short results separate.
- Gross direction, modeled net return and true execution-measured results separate; unknown funding/borrow remains unknown.

## Comparators
- Same-universe next-open always-long/always-short where meaningful.
- Random-entry comparator matched by date, holding period and eligibility.
- Registered trend baseline and relevant index beta.
- Silence/no-call state graded.

## Unmatched and dependence
- Provider failures, missing next-open, halts and unsupported calendars remain visible unmatched cases in the denominator reconciliation.
- Cluster observations by asset and overlapping horizon; disclose overlap and do not count correlated windows as independent trials.
- Separate detection recall from issued-call precision. A mover detected after its move is late detection, not a caught prediction.

## Trial accounting
- Freeze hypothesis, universe, cutoff, threshold, horizon, entry, invalidation, expiry, matching and deduplication before prospective collection.
- Keep every eligible/rejected candidate with timestamp and reason in an unpromoted shadow log.
- Report candidate count, issued count, unmatched, pending, ambiguous, unverified, excluded and failed.
- Record every examined variant; no winner selection or threshold search during closure.
- Holdout remains locked. Expert review is required before launch; a positive average over 100 overlapping bets is not sufficient evidence without costs, comparator, uncertainty and trial history.
