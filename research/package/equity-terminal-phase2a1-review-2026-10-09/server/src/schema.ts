import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  direction: text("direction", { enum: ["long", "short"] }).notNull(),
  entry: real("entry").notNull(),
  exitPrice: real("exit_price"),
  size: real("size").notNull(),
  thesis: text("thesis").notNull(),
  rMultiple: real("r_multiple"),
  notes: text("notes").notNull().default(""),
  setup: text("setup").notNull().default("Unspecified"),
  tradeDate: text("trade_date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const tradingRules = sqliteTable("trading_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const trackedSignals = sqliteTable("tracked_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  setupType: text("setup_type").notNull(),
  direction: text("direction", { enum: ["long", "short"] }).notNull(),
  confidence: integer("confidence").notNull(),
  entryPrice: real("entry_price").notNull(),
  signalDate: text("signal_date").notNull(),
  factorBreakdownJson: text("factor_breakdown_json").notNull().default("[]"),
  invalidationLevel: real("invalidation_level"),
  invalidationAtr14: real("invalidation_atr14"),
  invalidationAtrMultiple: real("invalidation_atr_multiple"),
  invalidationMethod: text("invalidation_method"),
  target1: real("target_1"),
  target2: real("target_2"),
  strategyId: text("strategy_id").notNull().default("equity-factor-agreement"),
  strategyVersion: text("strategy_version").notNull().default("legacy-pre-phase1"),
  parameterHash: text("parameter_hash").notNull().default("legacy-unversioned"),
  buildId: text("build_id").notNull().default("legacy-unversioned"),
  decisionAt: text("decision_at"),
  availableAt: text("available_at"),
  issuedAt: text("issued_at"),
  entryAt: text("entry_at"),
  expiresAt: text("expires_at"),
  inputSnapshotId: text("input_snapshot_id"),
  issuanceIdentity: text("issuance_identity"),
  barStart: text("bar_start"),
  barEnd: text("bar_end"),
  barIsClosed: integer("bar_is_closed", { mode: "boolean" }).notNull().default(true),
  priceBasis: text("price_basis").notNull().default("legacy-adjusted-daily"),
  entryRule: text("entry_rule").notNull().default("legacy-recorded-entry"),
  riskPerUnit: real("risk_per_unit"),
  primaryHorizon: integer("primary_horizon").notNull().default(30),
  horizonUnit: text("horizon_unit").notNull().default("trading_sessions"),
  featureValuesJson: text("feature_values_json").notNull().default("{}"),
  gateResultsJson: text("gate_results_json").notNull().default("{}"),
  scoreDefinition: text("score_definition").notNull().default("legacy factor agreement"),
  dataCoverage: real("data_coverage").notNull().default(0),
  validationStatus: text("validation_status", { enum: ["unverified", "collecting", "validated", "rejected"] }).notNull().default("unverified"),
  exchangeCalendar: text("exchange_calendar").notNull().default("unknown"),
  venue: text("venue").notNull().default("Yahoo Finance"),
  instrumentType: text("instrument_type").notNull().default("unknown"),
  sourceAsOf: text("source_as_of"),
  barTimestamp: text("bar_timestamp"),
  barState: text("bar_state", { enum: ["closed", "forming"] }).notNull().default("closed"),
  sourceUrl: text("source_url"),
  return5d: real("return_5d"),
  return14d: real("return_14d"),
  return30d: real("return_30d"),
  hit5d: integer("hit_5d", { mode: "boolean" }),
  hit14d: integer("hit_14d", { mode: "boolean" }),
  hit30d: integer("hit_30d", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("tracked_signals_symbol_idx").on(table.symbol),
  uniqueIndex("tracked_signals_issuance_identity_unique").on(table.issuanceIdentity),
]);

export const signalEvents = sqliteTable("signal_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  signalId: integer("signal_id").notNull().references(() => trackedSignals.id, { onDelete: "cascade" }),
  eventType: text("event_type", { enum: ["issued", "amendment", "correction", "outcome"] }).notNull(),
  priorEventId: integer("prior_event_id"),
  reason: text("reason").notNull(),
  payloadJson: text("payload_json").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("signal_events_signal_idx").on(table.signalId, table.createdAt)]);

export const strategyTrials = sqliteTable("strategy_trials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  strategyId: text("strategy_id").notNull(),
  strategyVersion: text("strategy_version").notNull(),
  parameterHash: text("parameter_hash").notNull(),
  buildId: text("build_id").notNull(),
  status: text("status", { enum: ["frozen_baseline", "active_measurement", "failed", "retired"] }).notNull(),
  hypothesis: text("hypothesis").notNull(),
  result: text("result").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("strategy_trials_version_unique").on(table.strategyId, table.strategyVersion)]);

export const signalEvaluationsV2 = sqliteTable("signal_evaluations_v2", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  signalId: integer("signal_id").notNull().references(() => trackedSignals.id, { onDelete: "cascade" }),
  evaluationVersion: text("evaluation_version").notNull(),
  product: text("product", { enum: ["direction_forecast", "trade_setup"] }).notNull(),
  oldVerdict: text("old_verdict"),
  newVerdict: text("new_verdict", { enum: ["HIT", "MISS", "AMBIGUOUS", "UNVERIFIED", "TIME_EXIT"] }).notNull(),
  reason: text("reason").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  netReturnPct: real("net_return_pct"),
  netR: real("net_r"),
  evaluatedAt: integer("evaluated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("signal_evaluations_v2_unique").on(table.signalId, table.evaluationVersion, table.product)]);

export const signalInputSnapshots = sqliteTable("signal_input_snapshots", {
  id: text("id").primaryKey(),
  signalId: integer("signal_id").notNull().references(() => trackedSignals.id, { onDelete: "cascade" }),
  availableThrough: text("available_through").notNull(),
  rawInputsJson: text("raw_inputs_json").notNull(),
  providerMetadataJson: text("provider_metadata_json").notNull(),
  contentHash: text("content_hash").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("signal_input_snapshots_signal_unique").on(table.signalId)]);

export const signalEvaluationRevisions = sqliteTable("signal_evaluation_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  signalId: integer("signal_id").notNull().references(() => trackedSignals.id, { onDelete: "cascade" }),
  evaluatorVersion: text("evaluator_version").notNull(),
  product: text("product", { enum: ["direction_forecast", "trade_setup"] }).notNull(),
  cohortKey: text("cohort_key").notNull(),
  verdict: text("verdict", { enum: ["HIT", "MISS", "AMBIGUOUS", "UNVERIFIED", "TIME_EXIT", "OPEN"] }).notNull(),
  reasonCode: text("reason_code").notNull(),
  reason: text("reason").notNull(),
  evidenceIdentity: text("evidence_identity").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  predecessorRevisionId: integer("predecessor_revision_id"),
  accepted: integer("accepted", { mode: "boolean" }).notNull().default(true),
  grossReturnPct: real("gross_return_pct"),
  grossR: real("gross_r"),
  modeledNetReturnPct: real("modeled_net_return_pct"),
  modeledNetR: real("modeled_net_r"),
  costStatus: text("cost_status", { enum: ["unknown", "modeled", "measured"] }).notNull().default("unknown"),
  costBps: real("cost_bps"),
  evaluatedAt: integer("evaluated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("signal_eval_revision_evidence_unique").on(table.signalId, table.evaluatorVersion, table.product, table.evidenceIdentity),
  index("signal_eval_revision_current_idx").on(table.signalId, table.product, table.accepted, table.evaluatedAt),
]);

export const suppressedSignalCandidates = sqliteTable("suppressed_signal_candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  setupType: text("setup_type").notNull(),
  direction: text("direction", { enum: ["long", "short"] }).notNull(),
  agreementScore: integer("agreement_score").notNull(),
  entryPrice: real("entry_price").notNull(),
  invalidationLevel: real("invalidation_level").notNull(),
  signalDate: text("signal_date").notNull(),
  signalDayOpen: real("signal_day_open"),
  signalDayHigh: real("signal_day_high"),
  signalDayLow: real("signal_day_low"),
  signalDayClose: real("signal_day_close"),
  reason: text("reason").notNull(),
  origin: text("origin", { enum: ["tracker", "discovery"] }).notNull(),
  sourceAsOf: text("source_as_of").notNull(),
  sourceUrl: text("source_url").notNull(),
  contextJson: text("context_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("suppressed_signal_candidates_unique").on(table.symbol, table.signalDate, table.reason, table.origin),
  index("suppressed_signal_candidates_date_idx").on(table.signalDate),
]);

export const scorecardVerdicts = sqliteTable("scorecard_verdicts", {
  signalId: integer("signal_id").primaryKey().references(() => trackedSignals.id, { onDelete: "cascade" }),
  verdict: text("verdict", { enum: ["HIT", "MISS", "AMBIGUOUS", "STALE", "UNVERIFIED"] }).notNull(),
  gradedDate: text("graded_date").notNull(),
  evidence: text("evidence").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("scorecard_verdicts_verdict_idx").on(table.verdict)]);

export const signalInterimSnapshots = sqliteTable("signal_interim_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  signalId: integer("signal_id").notNull(),
  symbol: text("symbol").notNull(),
  capturedDay: text("captured_day").notNull(),
  currentPrice: real("current_price").notNull(),
  returnPct: real("return_pct").notNull(),
  distanceTarget1Pct: real("distance_target1_pct").notNull(),
  distanceInvalidationPct: real("distance_invalidation_pct").notNull(),
  daysSinceEntry: integer("days_since_entry").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("signal_interim_snapshots_signal_day_unique").on(table.signalId, table.capturedDay),
  index("signal_interim_snapshots_signal_idx").on(table.signalId),
]);

export const signalDailyBriefs = sqliteTable("signal_daily_briefs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  capturedDay: text("captured_day").notNull().unique(),
  summary: text("summary").notNull(),
  trackedCount: integer("tracked_count").notNull(),
  approachingTargetCount: integer("approaching_target_count").notNull(),
  approachingInvalidationCount: integer("approaching_invalidation_count").notNull(),
  sourceAsOf: integer("source_as_of", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  sourceUrl: text("source_url"),
  fingerprint: text("fingerprint").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const theories = sqliteTable("theories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  statement: text("statement").notNull(),
  horizon: text("horizon", { enum: ["short", "long"] }).notNull(),
  linkedTickersJson: text("linked_tickers_json").notNull(),
  snapshotPricesJson: text("snapshot_prices_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const theoryPredictions = sqliteTable("theory_predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theoryId: integer("theory_id").notNull().references(() => theories.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  direction: text("direction", { enum: ["above", "below"] }).notNull(),
  targetLevel: real("target_level"),
  dueDate: text("due_date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const theoryRipples = sqliteTable("theory_ripples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theoryId: integer("theory_id").notNull().references(() => theories.id, { onDelete: "cascade" }),
  fromLabel: text("from_label").notNull(),
  toLabel: text("to_label").notNull(),
  because: text("because").notNull(),
});

export const theoryEvidence = sqliteTable("theory_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theoryId: integer("theory_id").notNull().references(() => theories.id, { onDelete: "cascade" }),
  stance: text("stance", { enum: ["confirming", "challenging"] }).notNull(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  publishedAt: text("published_at"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const machineTheories = sqliteTable("machine_theories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theoryKey: text("theory_key").notNull().unique(),
  title: text("title").notNull(),
  thesis: text("thesis").notNull(),
  domain: text("domain").notNull(),
  horizon: text("horizon", { enum: ["weeks", "months", "quarters"] }).notNull(),
  status: text("status", { enum: ["live", "contested", "invalidated", "degraded"] }).notNull(),
  confidenceTier: text("confidence_tier", { enum: ["high", "medium", "low"] }).notNull(),
  directionalPick: text("directional_pick", { enum: ["long", "short", "none"] }).notNull(),
  primarySymbol: text("primary_symbol").notNull(),
  rivalSymbol: text("rival_symbol"),
  causalChainJson: text("causal_chain_json").notNull(),
  sectorOutlookJson: text("sector_outlook_json").notNull(),
  layersJson: text("layers_json").notNull(),
  sourcesJson: text("sources_json").notNull(),
  countercase: text("countercase").notNull(),
  invalidationText: text("invalidation_text").notNull(),
  invalidationSymbol: text("invalidation_symbol"),
  invalidationOperator: text("invalidation_operator", { enum: ["above", "below"] }),
  invalidationLevel: real("invalidation_level"),
  expectedDirection: text("expected_direction", { enum: ["long", "short", "none"] }).notNull().default("none"),
  invalidationCreationPrice: real("invalidation_creation_price"),
  sourceIntegrity: text("source_integrity", { enum: ["multi_source", "single_source"] }).notNull().default("single_source"),
  independentSourceCount: integer("independent_source_count").notNull().default(0),
  integrityNote: text("integrity_note").notNull().default("Pending integrity audit"),
  integrityAuditedAt: integer("integrity_audited_at", { mode: "timestamp_ms" }),
  originatingScanRunId: integer("originating_scan_run_id"),
  foundAt: integer("found_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const theoryDiscoveryRuns = sqliteTable("theory_discovery_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["ok", "degraded", "failed"] }).notNull(),
  note: text("note").notNull(),
  sourceCount: integer("source_count").notNull(),
  candidateCount: integer("candidate_count").notNull(),
  surfacedCount: integer("surfaced_count").notNull(),
  withheldFloorCount: integer("withheld_floor_count").notNull().default(0),
  contestedCount: integer("contested_count").notNull().default(0),
  originatingScanRunId: integer("originating_scan_run_id"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const theoryLayerRunLogs = sqliteTable("theory_layer_run_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").references(() => theoryDiscoveryRuns.id, { onDelete: "cascade" }),
  layerName: text("layer_name").notNull(),
  agreeCount: integer("agree_count").notNull(),
  disagreeCount: integer("disagree_count").notNull(),
  mixedCount: integer("mixed_count").notNull(),
  unavailableCount: integer("unavailable_count").notNull(),
  failRate: real("fail_rate").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("theory_layer_run_logs_run_idx").on(table.runId)]);

export const theorySourceCache = sqliteTable("theory_source_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  snippet: text("snippet").notNull(),
  publishedAt: text("published_at"),
  retrievedAt: integer("retrieved_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const marketScanRuns = sqliteTable("market_scan_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universe: text("universe", { enum: ["sp100", "sp500"] }).notNull(),
  requestedCount: integer("requested_count").notNull(),
  scannedCount: integer("scanned_count").notNull(),
  availableCount: integer("available_count").notNull(),
  signalCount: integer("signal_count").notNull(),
  newsCount: integer("news_count").notNull(),
  status: text("status", { enum: ["ok", "partial", "degraded", "failed"] }).notNull(),
  note: text("note").notNull(),
  exclusionsJson: text("exclusions_json").notNull().default("[]"),
  eligibleCount: integer("eligible_count").notNull().default(0),
  scoredCount: integer("scored_count").notNull().default(0),
  watchedCount: integer("watched_count").notNull().default(0),
  issuedCount: integer("issued_count").notNull().default(0),
  suppressedCount: integer("suppressed_count").notNull().default(0),
  lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
  marketBriefJson: text("market_brief_json"),
  marketBriefGeneratedAt: integer("market_brief_generated_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const blsMonthlyCache = sqliteTable("bls_monthly_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheMonth: text("cache_month").notNull().unique(),
  payloadJson: text("payload_json").notNull(),
  retrievedAt: integer("retrieved_at", { mode: "timestamp_ms" }).notNull(),
});

export const marketScanUniverseRows = sqliteTable("market_scan_universe_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => marketScanRuns.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  sector: text("sector").notNull(),
  universeTier: text("universe_tier", { enum: ["t1", "t2", "t3"] }).notNull(),
  trackingMode: text("tracking_mode", { enum: ["full", "lightweight"] }).notNull(),
  velocity5d: real("velocity_5d"),
  tierReason: text("tier_reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("market_scan_universe_rows_run_symbol_unique").on(table.runId, table.symbol),
  index("market_scan_universe_rows_run_tier_idx").on(table.runId, table.universeTier),
]);

export const marketScanSignals = sqliteTable("market_scan_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => marketScanRuns.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  sector: text("sector").notNull(),
  direction: text("direction", { enum: ["long", "short", "mixed"] }).notNull(),
  agreementScore: integer("agreement_score").notNull(),
  activeFlags: integer("active_flags").notNull(),
  return15d: real("return_15d"),
  volumeZ: real("volume_z"),
  rankScore: real("rank_score").notNull(),
  confidenceTier: text("confidence_tier", { enum: ["high", "medium", "low"] }).notNull().default("low"),
  dimensionsJson: text("dimensions_json").notNull().default("[]"),
  researchRequiredJson: text("research_required_json").notNull().default("[]"),
  factorBreakdownJson: text("factor_breakdown_json").notNull().default("[]"),
  invalidationLevel: real("invalidation_level"),
  sourceUrl: text("source_url"),
  why: text("why").notNull(),
  sourceAsOf: text("source_as_of"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("market_scan_signals_symbol_unique").on(table.symbol)]);

export const sharedNewsCache = sqliteTable("shared_news_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").notNull().unique(),
  view: text("view", { enum: ["symbol", "discovery"] }).notNull(),
  symbol: text("symbol"),
  payloadJson: text("payload_json").notNull(),
  retrievedAt: integer("retrieved_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const marketScanNews = sqliteTable("market_scan_news", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => marketScanRuns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  publishedAt: text("published_at").notNull(),
  timestampKind: text("timestamp_kind", { enum: ["published", "retrieved"] }).notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  ripplesJson: text("ripples_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const sectorImpacts = sqliteTable("sector_impacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => marketScanRuns.id, { onDelete: "cascade" }),
  sector: text("sector").notNull(),
  direction: text("direction", { enum: ["positive", "negative", "mixed"] }).notNull(),
  evidenceScore: integer("evidence_score").notNull(),
  headline: text("headline").notNull(),
  reason: text("reason").notNull(),
  sourceCount: integer("source_count").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const engineHits = sqliteTable("engine_hits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hitKey: text("hit_key").notNull().unique(),
  hitAt: text("hit_at").notNull(),
  testCaseLabel: text("test_case_label").notNull(),
  thesis: text("thesis").notNull(),
  triggerEvent: text("trigger_event").notNull(),
  engineScore: integer("engine_score").notNull(),
  confidenceTier: text("confidence_tier", { enum: ["high", "medium", "low"] }).notNull(),
  tapeState: text("tape_state").notNull(),
  twist: text("twist").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  rippleChainJson: text("ripple_chain_json").notNull(),
  kind: text("kind", { enum: ["hit", "gem"] }).notNull().default("hit"),
  symbol: text("symbol"),
  anomaly: text("anomaly"),
  tagsJson: text("tags_json").notNull().default("[]"),
  evidenceStrength: integer("evidence_strength").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const historicalCaches = sqliteTable("historical_caches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  currency: text("currency"),
  seriesJson: text("series_json").notNull(),
  sourceUrl: text("source_url").notNull(),
  fetchedOn: text("fetched_on").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const deepAnalysisCaches = sqliteTable("deep_analysis_caches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  currency: text("currency"),
  payloadJson: text("payload_json").notNull(),
  sourceUrl: text("source_url").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const dossierCaches = sqliteTable("dossier_caches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  tradingDay: text("trading_day").notNull(),
  payloadJson: text("payload_json").notNull(),
  generatedAt: integer("generated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("dossier_caches_symbol_day_unique").on(table.symbol, table.tradingDay),
  index("dossier_caches_generated_idx").on(table.generatedAt),
]);

export const equityValuationSnapshots = sqliteTable("equity_valuation_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  yahooPayloadJson: text("yahoo_payload_json").notNull().default("{}"),
  yahooSourceUrl: text("yahoo_source_url"),
  yahooFetchedAt: integer("yahoo_fetched_at", { mode: "timestamp_ms" }),
  keyedAsOf: text("keyed_as_of"),
  keyedPayloadJson: text("keyed_payload_json"),
  keyedSourcesJson: text("keyed_sources_json").notNull().default("[]"),
  taskId: text("task_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("equity_valuation_snapshots_updated_idx").on(table.updatedAt)]);

export const sentimentSnapshots = sqliteTable("sentiment_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  asOf: text("as_of").notNull(),
  articlesJson: text("articles_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("sentiment_snapshots_as_of_idx").on(table.asOf)]);

export const sentimentSnapshotHistory = sqliteTable("sentiment_snapshot_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  asOf: text("as_of").notNull(),
  articlesJson: text("articles_json").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("sentiment_snapshot_history_ticker_as_of_unique").on(table.ticker, table.asOf),
  index("sentiment_snapshot_history_ticker_idx").on(table.ticker),
]);

export const theorySentimentEvidence = sqliteTable("theory_sentiment_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theoryKind: text("theory_kind", { enum: ["user", "machine"] }).notNull(),
  theoryId: integer("theory_id").notNull(),
  ticker: text("ticker").notNull(),
  snapshotAsOf: text("snapshot_as_of").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  publishedAt: text("published_at").notNull(),
  publisher: text("publisher").notNull(),
  overallScore: real("overall_score").notNull(),
  overallLabel: text("overall_label").notNull(),
  tickerScore: real("ticker_score").notNull(),
  tickerLabel: text("ticker_label").notNull(),
  stance: text("stance", { enum: ["confirming", "challenging", "neutral"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("theory_sentiment_evidence_unique").on(table.theoryKind, table.theoryId, table.ticker, table.snapshotAsOf, table.sourceUrl),
  index("theory_sentiment_evidence_theory_idx").on(table.theoryKind, table.theoryId),
]);

export const finnhubNewsSnapshots = sqliteTable("finnhub_news_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  asOf: text("as_of").notNull(),
  articlesJson: text("articles_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("finnhub_news_snapshots_as_of_idx").on(table.asOf)]);

export const finnhubNewsHistory = sqliteTable("finnhub_news_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  asOf: text("as_of").notNull(),
  payloadJson: text("payload_json").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("finnhub_news_history_key").on(table.ticker, table.asOf), index("finnhub_news_history_ticker_idx").on(table.ticker)]);

export const finnhubInsiderSnapshots = sqliteTable("finnhub_insider_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  asOf: text("as_of").notNull(),
  transactionsJson: text("transactions_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("finnhub_insider_snapshots_as_of_idx").on(table.asOf)]);

export const finnhubInsiderHistory = sqliteTable("finnhub_insider_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  asOf: text("as_of").notNull(),
  payloadJson: text("payload_json").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("finnhub_insider_history_key").on(table.ticker, table.asOf), index("finnhub_insider_history_ticker_idx").on(table.ticker)]);

export const finnhubEarningsSnapshots = sqliteTable("finnhub_earnings_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull().unique(),
  asOf: text("as_of").notNull(),
  eventsJson: text("events_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("finnhub_earnings_snapshots_as_of_idx").on(table.asOf)]);

export const finnhubEarningsHistory = sqliteTable("finnhub_earnings_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  asOf: text("as_of").notNull(),
  payloadJson: text("payload_json").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("finnhub_earnings_history_key").on(table.symbol, table.asOf), index("finnhub_earnings_history_symbol_idx").on(table.symbol)]);

export const finnhubFilingSnapshots = sqliteTable("finnhub_filing_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull().unique(),
  asOf: text("as_of").notNull(),
  filingsJson: text("filings_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("finnhub_filing_snapshots_as_of_idx").on(table.asOf)]);

export const finnhubFilingHistory = sqliteTable("finnhub_filing_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  asOf: text("as_of").notNull(),
  payloadJson: text("payload_json").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("finnhub_filing_history_key").on(table.ticker, table.asOf), index("finnhub_filing_history_ticker_idx").on(table.ticker)]);

export const marketRefreshRuns = sqliteTable("market_refresh_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lane: text("lane", { enum: ["market_data", "expensive_analysis", "signal_monitoring"] }).notNull(),
  trigger: text("trigger", { enum: ["manual", "scheduled", "diagnostic"] }).notNull(),
  status: text("status", { enum: ["running", "ok", "partial", "failed"] }).notNull(),
  requestedCount: integer("requested_count").notNull(),
  refreshedCount: integer("refreshed_count").notNull().default(0),
  staleCount: integer("stale_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  note: text("note").notNull().default(""),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
}, (table) => [index("market_refresh_runs_lane_idx").on(table.lane, table.startedAt)]);

export const marketObservations = sqliteTable("market_observations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").references(() => marketRefreshRuns.id, { onDelete: "set null" }),
  symbol: text("symbol").notNull(),
  marketKind: text("market_kind", { enum: ["equity", "crypto"] }).notNull(),
  observationKind: text("observation_kind", { enum: ["quote", "completed_candle", "forming_candle"] }).notNull(),
  venue: text("venue").notNull(),
  quoteCurrency: text("quote_currency"),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  eventAt: text("event_at").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  candleState: text("candle_state", { enum: ["forming", "closed", "not_applicable"] }).notNull(),
  price: real("price"),
  open: real("open"),
  high: real("high"),
  low: real("low"),
  close: real("close"),
  volume: real("volume"),
  correctionVersion: integer("correction_version").notNull().default(1),
  priorObservationId: integer("prior_observation_id"),
  contentHash: text("content_hash").notNull().unique(),
  rawTraceJson: text("raw_trace_json").notNull(),
}, (table) => [
  index("market_observations_symbol_kind_event_idx").on(table.symbol, table.observationKind, table.eventAt),
  index("market_observations_received_idx").on(table.receivedAt),
]);

export const marketRefreshState = sqliteTable("market_refresh_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  observationKind: text("observation_kind", { enum: ["quote", "completed_candle", "forming_candle"] }).notNull(),
  latestObservationId: integer("latest_observation_id").references(() => marketObservations.id, { onDelete: "set null" }),
  status: text("status", { enum: ["fresh", "stale", "error", "market_closed"] }).notNull(),
  lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }).notNull(),
  lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
  error: text("error"),
  nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [uniqueIndex("market_refresh_state_symbol_kind_unique").on(table.symbol, table.observationKind)]);

export const signalStatusEvents = sqliteTable("signal_status_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  signalId: integer("signal_id").notNull().references(() => trackedSignals.id, { onDelete: "cascade" }),
  observationId: integer("observation_id").notNull().references(() => marketObservations.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["target_observed", "stop_observed", "stale", "entry_no_longer_eligible"] }).notNull(),
  settlement: text("settlement", { enum: ["observed_only", "unsettled", "evaluated"] }).notNull(),
  observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
  supportJson: text("support_json").notNull(),
  dedupKey: text("dedup_key").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("signal_status_events_signal_idx").on(table.signalId, table.observedAt)]);
