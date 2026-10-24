import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

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
  // EQ-3 additive invalidation provenance (new issues only; legacy rows stay
  // null here and are labeled provenance-incomplete at read time when their
  // stored set cannot produce the full derivation).
  roomToBreatheAtr: real("room_to_breathe_atr"),
  tightInvalidation: integer("tight_invalidation", { mode: "boolean" }),
  invalidationGrade: text("invalidation_grade"),
  provenanceIncomplete: integer("provenance_incomplete", { mode: "boolean" }),
  provenanceReferenceEntryPrice: real("provenance_reference_entry_price"),
  provenanceSourceAsOf: text("provenance_source_as_of"),
  // Equity paper fill rule (migration 0051, prospective only). Legacy rows
  // keep every fill field null; only signals recorded after the fill rule
  // deployed carry fillRuleVersion = "equity-paper-fill-v1".
  entryState: text("entry_state", { enum: ["pending_entry", "filled", "expired_unfilled"] }),
  fillRuleVersion: text("fill_rule_version"),
  costScenario: text("cost_scenario"),
  fillWindowSessions: integer("fill_window_sessions"),
  fillPrice: real("fill_price"),
  fillSessionDate: text("fill_session_date"),
  fillSource: text("fill_source"),
  fillRecordedAt: integer("fill_recorded_at", { mode: "timestamp_ms" }),
  expiryReason: text("expiry_reason", { enum: ["invalidated_before_fill", "fill_window_expired_no_observation"] }),
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
  sourceCandidateId: integer("source_candidate_id").references((): AnySQLiteColumn => marketScanSignals.id),
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
  index("tracked_signals_source_candidate_idx").on(table.sourceCandidateId),
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
  newVerdict: text("new_verdict", { enum: ["HIT", "MISS", "AMBIGUOUS", "UNVERIFIED", "TIME_EXIT", "OPEN", "PENDING_ENTRY", "UNKNOWN"] }).notNull(),
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
  verdict: text("verdict", { enum: ["HIT", "MISS", "AMBIGUOUS", "UNVERIFIED", "TIME_EXIT", "OPEN", "PENDING_ENTRY", "UNKNOWN"] }).notNull(),
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
  costStatus: text("cost_status", { enum: ["unknown", "modeled", "measured", "paper-costs-v1"] }).notNull().default("unknown"),
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

export const assetProfiles = sqliteTable("asset_profiles", {
  symbol: text("symbol").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  instrumentType: text("instrument_type", { enum: ["equity", "crypto", "future", "fund", "other"] }).notNull(),
  instrumentDetail: text("instrument_detail").notNull(),
  description: text("description").notNull(),
  revenueModel: text("revenue_model").notNull(),
  sourceTitle: text("source_title").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceAsOf: text("source_as_of"),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// Company identity cache (migration 0053): one row per canonical symbol with
// the full company name, sector/industry, and a sourced plain-English
// description of what the company does. Written only by the on-demand
// getCompanyProfile fetch (Yahoo quoteSummary assetProfile, SEC EDGAR
// submissions, or a sourced web-search summary); list surfaces read it
// through the stored-only resolver and never trigger fetches. A row with a
// null description is a negative cache entry (looked, nothing sourced yet).
export const companyProfiles = sqliteTable("company_profiles", {
  symbol: text("symbol").primaryKey(),
  name: text("name"),
  sector: text("sector"),
  industry: text("industry"),
  description: text("description"),
  descriptionSourceTitle: text("description_source_title"),
  descriptionSourceUrl: text("description_source_url"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export const assetContextLinks = sqliteTable("asset_context_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  recordKind: text("record_kind", { enum: ["news", "theory", "alert", "signal", "assessment"] }).notNull(),
  recordId: text("record_id").notNull(),
  stance: text("stance", { enum: ["surface", "logic", "confirming", "challenging", "next_check"] }).notNull(),
  evidenceClass: text("evidence_class", { enum: ["verified_fact", "source_claim", "caller_opinion", "terminal_measurement", "interpretation"] }).notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  sourceTitle: text("source_title").notNull(),
  sourceUrl: text("source_url"),
  observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("asset_context_links_record_unique").on(table.symbol, table.recordKind, table.recordId, table.stance),
  index("asset_context_links_symbol_observed_idx").on(table.symbol, table.observedAt),
]);

export const assetAssessments = sqliteTable("asset_assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  assessmentKind: text("assessment_kind", { enum: ["dossier", "alert", "research"] }).notNull(),
  sourceRecordKind: text("source_record_kind"),
  sourceRecordId: text("source_record_id"),
  explanationJson: text("explanation_json").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  contextSnapshotJson: text("context_snapshot_json").notNull(),
  assessedAt: integer("assessed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("asset_assessments_symbol_assessed_idx").on(table.symbol, table.assessedAt)]);

export const assetAssessmentOutcomes = sqliteTable("asset_assessment_outcomes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assessmentId: integer("assessment_id").notNull().references(() => assetAssessments.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["strengthened", "weakened", "invalidated", "ambiguous", "late"] }).notNull(),
  summary: text("summary").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [index("asset_assessment_outcomes_assessment_idx").on(table.assessmentId, table.observedAt)]);

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
  // Batch 5 Part 6 proof stamps: when this run finished computing, and the
  // last completed XNYS session its inputs actually reached. Both are written
  // once at run completion from the data the run used; null on rows that
  // predate stamping (reads derive a fallback from the run's stored rows).
  computedAt: integer("computed_at", { mode: "timestamp_ms" }),
  dataThroughSession: text("data_through_session"),
  marketBriefJson: text("market_brief_json"),
  marketBriefGeneratedAt: integer("market_brief_generated_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// Batch 5 Part 6 — minimal run-state record for the equity scan's on-demand
// path. The non-batched scan pipeline (runAutomatedMarketScan) writes its
// market_scan_runs row only at completion, so it has no in-flight record of
// its own; this table is that record. One row per on-demand execution:
// "running" with a heartbeat + deadline while in flight (the only lock — a
// second trigger returns this row's identity instead of starting a
// duplicate), then the run's real terminal status. A running row past its
// deadline is stale and never blocks a fresh run. Scheduled/batched scans do
// not write here; their proof stamps live on market_scan_runs.
export const scanRunState = sqliteTable("scan_run_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universe: text("universe", { enum: ["sp100", "sp500"] }).notNull(),
  trigger: text("trigger", { enum: ["manual"] }).notNull().default("manual"),
  status: text("status", { enum: ["running", "ok", "partial", "degraded", "failed"] }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  heartbeatAt: integer("heartbeat_at", { mode: "timestamp_ms" }).notNull(),
  deadlineAt: integer("deadline_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  marketScanRunId: integer("market_scan_run_id"),
  note: text("note").notNull().default(""),
}, (table) => [
  index("scan_run_state_status_idx").on(table.status, table.startedAt),
]);

export const scanBatchRuns = sqliteTable("scan_batch_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  universe: text("universe", { enum: ["sp100", "sp500"] }).notNull(),
  runId: integer("run_id").notNull().references(() => marketScanRuns.id, { onDelete: "cascade" }),
  symbolListJson: text("symbol_list_json").notNull(),
  processedCount: integer("processed_count").notNull().default(0),
  stage: text("stage", { enum: ["open", "finalizing", "maintenance", "brief", "done"] }).notNull().default("open"),
  // Session cycle key, e.g. "2026-10-16-0930": the scheduled discovery
  // session (09:30 / 11:30 / 13:30 / 15:30 ET) this batch belongs to.
  // Nullable only for rows created before session keys existed.
  cycleKey: text("cycle_key"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("scan_batch_runs_universe_stage_idx").on(table.universe, table.stage),
  uniqueIndex("scan_batch_runs_run_id_unique").on(table.runId),
]);

export const scanBatchSymbolResults = sqliteTable("scan_batch_symbol_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchRunId: integer("batch_run_id").notNull().references(() => scanBatchRuns.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  gateJson: text("gate_json").notNull(),
  issuanceJson: text("issuance_json").notNull(),
  rankScore: real("rank_score").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("scan_batch_symbol_results_batch_symbol_unique").on(table.batchRunId, table.symbol),
  index("scan_batch_symbol_results_batch_completed_idx").on(table.batchRunId, table.completedAt),
]);

export const blsMonthlyCache = sqliteTable("bls_monthly_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheMonth: text("cache_month").notNull().unique(),
  payloadJson: text("payload_json").notNull(),
  retrievedAt: integer("retrieved_at", { mode: "timestamp_ms" }).notNull(),
});

// Batch 4b — daily server-side cache for the Cboe VIX/SKEW history CSVs
// (same shape as blsMonthlyCache: one payload row per cache day).
export const cboeDailyCache = sqliteTable("cboe_daily_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheDay: text("cache_day").notNull().unique(),
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

export const marketScanSymbolDiagnostics = sqliteTable("market_scan_symbol_diagnostics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => marketScanRuns.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  stage: text("stage", { enum: ["ticker_resolution", "provider_request", "http_response", "normalization", "chart_eligibility", "scoring", "issuance", "persistence"] }).notNull(),
  outcome: text("outcome", { enum: ["fetched", "data_valid", "eligible", "scored", "emitted", "suppressed", "excluded", "failed"] }).notNull(),
  reasonCode: text("reason_code").notNull(),
  reason: text("reason").notNull(),
  providerStatus: integer("provider_status"),
  resolvedSymbol: text("resolved_symbol"),
  sourceUrl: text("source_url"),
  providerEventAt: text("provider_event_at"),
  attemptedAt: integer("attempted_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("market_scan_symbol_diagnostics_run_symbol_unique").on(table.runId, table.symbol),
  index("market_scan_symbol_diagnostics_run_outcome_idx").on(table.runId, table.outcome),
]);

// Batch 2 discovery-funnel instrumentation (measurement only). Append-only
// roll-up of the per-symbol diagnostics a scan already persisted: one row per
// (run, stage, reason_code) with count > 0, plus one 'survivors' row per
// stage. Written once at scan-run completion; never updated, and nothing in
// the decision path reads this table.
export const discoveryFunnelCounts = sqliteTable("discovery_funnel_counts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull(),
  runKind: text("run_kind").notNull(),
  stage: text("stage").notNull(),
  gate: text("gate"),
  reasonCode: text("reason_code").notNull(),
  count: integer("count").notNull(),
  computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("discovery_funnel_counts_run_idx").on(table.runId),
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
  status: text("status", { enum: ["candidate", "issued", "expired"] }).notNull().default("candidate"),
  issuedSignalId: integer("issued_signal_id").references((): AnySQLiteColumn => trackedSignals.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("market_scan_signals_symbol_unique").on(table.symbol),
  index("market_scan_signals_status_idx").on(table.status),
]);

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

export const schedulerInvocationReceipts = sqliteTable("scheduler_invocation_receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobKey: text("job_key", { enum: ["discovery_scan", "signal_postmortem", "market_data_refresh"] }).notNull(),
  jobName: text("job_name").notNull(),
  runId: text("run_id").notNull().unique(),
  status: text("status", { enum: ["running", "succeeded", "failed"] }).notNull(),
  invokedAt: integer("invoked_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("scheduler_invocation_receipts_job_invoked_idx").on(table.jobKey, table.invokedAt),
]);

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

export const marketRefreshRotation = sqliteTable("market_refresh_rotation", {
  lane: text("lane").primaryKey(),
  cursor: integer("cursor").notNull().default(0),
  universeHash: text("universe_hash").notNull(),
  lastBatchJson: text("last_batch_json").notNull().default("[]"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

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

export const measurementRuns = sqliteTable("measurement_runs", {
  id: text("id").primaryKey(),
  terminal: text("terminal").notNull(),
  cohortKey: text("cohort_key").notNull(),
  evaluatorVersion: text("evaluator_version").notNull(),
  sourceCommit: text("source_commit").notNull(),
  status: text("status", { enum: ["running", "partial", "complete", "failed"] }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  cutoffAt: text("cutoff_at").notNull(),
  cursor: integer("cursor").notNull().default(0),
  totalInScope: integer("total_in_scope").notNull(),
  retrieved: integer("retrieved").notNull().default(0),
  eligibleDue: integer("eligible_due").notNull().default(0),
  evaluated: integer("evaluated").notNull().default(0),
  pending: integer("pending").notNull().default(0),
  ambiguous: integer("ambiguous").notNull().default(0),
  unverified: integer("unverified").notNull().default(0),
  excluded: integer("excluded").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  revisionsInserted: integer("revisions_inserted").notNull().default(0),
  membershipJson: text("membership_json").notNull(),
  failedIdsJson: text("failed_ids_json").notNull().default("[]"),
  definitionsJson: text("definitions_json").notNull(),
  leaseToken: text("lease_token"),
  leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
  leaseVersion: integer("lease_version").notNull().default(0),
  batchCommitJournalId: text("batch_commit_journal_id"),
}, (table) => [index("measurement_runs_status_started_idx").on(table.status, table.startedAt)]);

export const measurementRunItems = sqliteTable("measurement_run_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull().references(() => measurementRuns.id, { onDelete: "cascade" }),
  signalId: integer("signal_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  symbol: text("symbol"),
  retrieved: integer("retrieved", { mode: "boolean" }).notNull().default(false),
  eligibleDue: integer("eligible_due", { mode: "boolean" }).notNull().default(false),
  tradeState: text("trade_state", { enum: ["open", "resolved", "unknown"] }).notNull().default("unknown"),
  gradingState: text("grading_state", { enum: ["queued", "evaluated", "not_due", "excluded", "retry_pending"] }).notNull().default("queued"),
  evaluationVerdict: text("evaluation_verdict", { enum: ["HIT", "MISS", "AMBIGUOUS", "UNVERIFIED", "TIME_EXIT", "OPEN", "PENDING_ENTRY", "UNKNOWN"] }),
  reasonCode: text("reason_code").notNull().default("awaiting_batch"),
  reason: text("reason").notNull().default("Awaiting a bounded measurement batch."),
  attempts: integer("attempts").notNull().default(0),
  revisionsInserted: integer("revisions_inserted").notNull().default(0),
  evidenceIdentityBefore: text("evidence_identity_before"),
  evidenceIdentityAfter: text("evidence_identity_after"),
  lastBatchId: text("last_batch_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("measurement_run_items_run_signal_unique").on(table.runId, table.signalId),
  uniqueIndex("measurement_run_items_run_ordinal_unique").on(table.runId, table.ordinal),
  index("measurement_run_items_run_state_idx").on(table.runId, table.gradingState),
]);

export const measurementRunBatches = sqliteTable("measurement_run_batches", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => measurementRuns.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["continue", "replay_last"] }).notNull(),
  beforeCursor: integer("before_cursor").notNull(),
  afterCursor: integer("after_cursor").notNull(),
  requestedIdsJson: text("requested_ids_json").notNull(),
  revisionsBefore: integer("revisions_before").notNull(),
  revisionsAfter: integer("revisions_after").notNull(),
  duplicateEvaluations: integer("duplicate_evaluations").notNull().default(0),
  historyRowsRewritten: integer("history_rows_rewritten").notNull().default(0),
  revisionIdentityJson: text("revision_identity_json").notNull().default("{}"),
  historyHashBefore: text("history_hash_before").notNull().default(""),
  historyHashAfter: text("history_hash_after").notNull().default(""),
  cursorCommit: text("cursor_commit", { enum: ["committed", "stale_rejected", "interrupted"] }).notNull().default("committed"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  note: text("note").notNull(),
}, (table) => [index("measurement_run_batches_run_started_idx").on(table.runId, table.startedAt)]);

// A journal row is written before the cursor CAS. If the worker exits after the
// cursor commits but before the presentation/audit row is copied into
// measurement_run_batches, the next read deterministically materializes it.
export const measurementBatchCommitJournal = sqliteTable("measurement_batch_commit_journal", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => measurementRuns.id, { onDelete: "cascade" }),
  leaseToken: text("lease_token").notNull(),
  leaseVersion: integer("lease_version").notNull(),
  mode: text("mode", { enum: ["continue", "replay_last"] }).notNull(),
  beforeCursor: integer("before_cursor").notNull(),
  afterCursor: integer("after_cursor").notNull(),
  requestedIdsJson: text("requested_ids_json").notNull(),
  revisionsBefore: integer("revisions_before").notNull(),
  revisionsAfter: integer("revisions_after").notNull(),
  duplicateEvaluations: integer("duplicate_evaluations").notNull().default(0),
  historyRowsRewritten: integer("history_rows_rewritten").notNull().default(0),
  revisionIdentityJson: text("revision_identity_json").notNull().default("{}"),
  historyHashBefore: text("history_hash_before").notNull().default(""),
  historyHashAfter: text("history_hash_after").notNull().default(""),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }).notNull(),
  note: text("note").notNull(),
  materializedAt: integer("materialized_at", { mode: "timestamp_ms" }),
}, (table) => [index("measurement_batch_journal_run_cursor_idx").on(table.runId, table.afterCursor)]);

export const discoveryLaneRuns = sqliteTable("discovery_lane_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  laneVersion: text("lane_version").notNull(),
  status: text("status", { enum: ["running", "ok", "partial", "failed"] }).notNull(),
  universeBroadCount: integer("universe_broad_count").notNull(),
  universeSmallcapCount: integer("universe_smallcap_count").notNull(),
  screenedCount: integer("screened_count").notNull(),
  t2Count: integer("t2_count").notNull(),
  t3Count: integer("t3_count").notNull(),
  unverifiedCount: integer("unverified_count").notNull().default(0),
  excludedCount: integer("excluded_count").notNull(),
  yahooRequests: integer("yahoo_requests").notNull(),
  v8Verifications: integer("v8_verifications").notNull().default(0),
  alphaVantageCalls: integer("alpha_vantage_calls").notNull().default(0),
  note: text("note").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

export const discoveryLaneLiquidity = sqliteTable("discovery_lane_liquidity", {
  symbol: text("symbol").primaryKey(),
  avgDollarVolume20d: real("avg_dollar_volume_20d"),
  avgVolume20d: real("avg_volume_20d"),
  bars: integer("bars").notNull().default(0),
  computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
});

export const discoveryLaneRows = sqliteTable("discovery_lane_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull().references(() => discoveryLaneRuns.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  instrumentName: text("instrument_name").notNull(),
  sector: text("sector").notNull().default("Unclassified"),
  segment: text("segment", { enum: ["broad", "smallcap"] }).notNull(),
  tier: text("tier", { enum: ["t2", "t3", "unverified", "excluded"] }).notNull(),
  trackingMode: text("tracking_mode", { enum: ["full", "lightweight"] }).notNull(),
  categoriesJson: text("categories_json").notNull().default("[]"),
  price: real("price"),
  dollarVolume20d: real("dollar_volume_20d"),
  prevCloseReturnPct: real("prev_close_return_pct"),
  intradayReturnPct: real("intraday_return_pct"),
  relVolume: real("rel_volume"),
  returnZ: real("return_z"),
  exchange: text("exchange"),
  instrumentType: text("instrument_type"),
  dataSource: text("data_source").notNull().default("Yahoo Finance (keyless)"),
  observedAt: integer("observed_at", { mode: "timestamp_ms" }),
  reason: text("reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex("discovery_lane_rows_run_symbol_unique").on(table.runId, table.symbol),
  index("discovery_lane_rows_run_tier_idx").on(table.runId, table.tier),
]);

export const equityAlertOutbox = sqliteTable("equity_alert_outbox", {
  dedupKey: text("dedup_key").primaryKey(),
  symbol: text("symbol").notNull(),
  kind: text("kind").notNull(),
  stage: text("stage").notNull().default("watch_alert"),
  state: text("state", { enum: ["queued", "delivered", "failed"] }).notNull().default("queued"),
  channel: text("channel"),
  enqueuedAt: integer("enqueued_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  error: text("error"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// Terminal-first delivery (design 24 §2.1/§2.3): the equity notification
// store. One row per event, keyed by the same dedupKey vocabulary as
// equity_alert_outbox. Field rules are binding:
// - expiresAt is ALWAYS null for equity (§6.6: no honest expiry source yet);
//   the UI renders "no expiry recorded" and never computes one.
// - readAt is set ONLY by ackNotification from the terminal UI — no job,
//   digest, or delivery writer may set it.
// - chatSentAt is set ONLY by markNotificationsChatSent after a digest send
//   returns; it never touches readAt.
export const equityNotifications = sqliteTable("equity_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dedupKey: text("dedup_key").notNull().unique(),
  symbol: text("symbol").notNull(),
  kind: text("kind").notNull(),
  stage: text("stage", { enum: ["watch_alert", "confirmed_paper_entry"] }).notNull().default("watch_alert"),
  notificationClass: text("notification_class", { enum: ["opportunity", "lifecycle"] }).notNull(),
  eventType: text("event_type", { enum: ["QUALIFIED", "BLOCKED", "SHORTLIST", "THEORY_HIT", "MILESTONE_TOUCH", "SETUP_PENDING", "ENTRY_CONFIRMED", "SETTLED", "INVALIDATED", "EXPIRED", "VOID"] }).notNull(),
  title: text("title").notNull(),
  reasonLinesJson: text("reason_lines_json").notNull().default("[]"),
  blockerReason: text("blocker_reason"),
  disclosure: text("disclosure"),
  eventAt: integer("event_at", { mode: "timestamp_ms" }).notNull(),
  storedAt: integer("stored_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  readAt: integer("read_at", { mode: "timestamp_ms" }),
  chatSentAt: integer("chat_sent_at", { mode: "timestamp_ms" }),
  sourceRef: text("source_ref"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("equity_notifications_stored_idx").on(table.storedAt),
  index("equity_notifications_read_idx").on(table.readAt),
  index("equity_notifications_symbol_idx").on(table.symbol),
]);

// EQ-2 shadow assessments (migration 0050, additive). One paired record per
// candidate evaluated by the board/candidate scan evaluation path, written
// alongside the production factor score from the SAME in-memory factor
// scores. Production code NEVER reads this table; the write is fail-isolated
// in the scan path. The store starts empty at wiring time — no backfill, and
// no existing production table or row is touched. See the EQ-2 block in
// server/src/actions.ts for the registered definition and the
// definition-fidelity resolutions.
export const eq2ShadowAssessments = sqliteTable("eq2_shadow_assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  direction: text("direction", { enum: ["long", "short", "mixed"] }).notNull(),
  runId: integer("run_id"),
  batchRunId: integer("batch_run_id"),
  evaluationPath: text("evaluation_path").notNull(),
  factorsJson: text("factors_json").notNull(),
  s20: integer("s20").notNull(),
  s50: integer("s50").notNull(),
  s200: integer("s200").notNull(),
  rsiScore: integer("rsi_score").notNull(),
  macdScore: integer("macd_score").notNull(),
  volumeScore: integer("volume_score").notNull(),
  trendScore: integer("trend_score").notNull(),
  totalWeight: real("total_weight").notNull(),
  productionWeightedSum: real("production_weighted_sum").notNull(),
  productionRawScore: integer("production_raw_score").notNull(),
  redundancyAdjustment: integer("redundancy_adjustment").notNull(),
  productionSignalScore: integer("production_signal_score").notNull(),
  tValue: integer("t_value").notNull(),
  aValue: integer("a_value").notNull(),
  cValue: real("c_value").notNull(),
  tripleContribution: real("triple_contribution").notNull(),
  shadowRawScore: real("shadow_raw_score").notNull(),
  shadowTotal: integer("shadow_total").notNull(),
  productionDisposition: text("production_disposition", { enum: ["long", "short", "mixed"] }).notNull(),
  shadowDisposition: text("shadow_disposition", { enum: ["long", "short", "mixed"] }).notNull(),
  divergent: integer("divergent", { mode: "boolean" }).notNull(),
  divergenceReason: text("divergence_reason").notNull(),
  scanGateDirection: text("scan_gate_direction"),
  scanIssuanceAllowed: integer("scan_issuance_allowed", { mode: "boolean" }),
  evaluatorVersion: text("evaluator_version").notNull(),
  strategyVersion: text("strategy_version").notNull(),
  parameterHash: text("parameter_hash").notNull(),
  sourceAsOf: text("source_as_of"),
  sessionDate: text("session_date"),
  evaluatedAt: integer("evaluated_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("eq2_shadow_assessments_created_idx").on(table.createdAt),
  index("eq2_shadow_assessments_run_idx").on(table.runId),
  index("eq2_shadow_assessments_symbol_idx").on(table.symbol),
]);

// Bounded equity paper restart — automated issuance state (migration 0052).
// Singleton row (id = 1) owned by the daily postmortem lane's post-reconcile
// issuance step: the durable fail-stop flag (set when reconcile fails or a
// setup-creation write fails; cleared only by a later pass whose reconcile
// completes successfully) and the issuance lease that serializes the
// capacity-check + setup-insert guard across concurrent lane runs. The
// cohort counts themselves are always derived from tracked_signals; this row
// never stores them.
export const equityPaperIssuanceState = sqliteTable("equity_paper_issuance_state", {
  id: integer("id").primaryKey(),
  halted: integer("halted", { mode: "boolean" }).notNull().default(false),
  haltReason: text("halt_reason"),
  haltedAt: integer("halted_at", { mode: "timestamp_ms" }),
  leaseToken: text("lease_token"),
  leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

// Bounded equity paper restart — per-pass issuance report (migration 0052).
// One append-only row per daily postmortem pass that reached the issuance
// step (including reconcile-failed passes, recorded with reconcile_ok = 0):
// setups created, setups skipped for cohort capacity, setups skipped as
// duplicates, issuance declines, and the halt state for that pass. This is
// the stored record the restart's first natural chain is reported from.
export const equityPaperIssuancePasses = sqliteTable("equity_paper_issuance_passes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  capturedDay: text("captured_day").notNull(),
  batchRunId: integer("batch_run_id"),
  batchId: integer("batch_id"),
  reconcileOk: integer("reconcile_ok", { mode: "boolean" }).notNull(),
  halted: integer("halted", { mode: "boolean" }).notNull(),
  haltReason: text("halt_reason"),
  haltCleared: integer("halt_cleared", { mode: "boolean" }).notNull().default(false),
  createdJson: text("created_json").notNull().default("[]"),
  skippedCapacityJson: text("skipped_capacity_json").notNull().default("[]"),
  skippedDuplicatesJson: text("skipped_duplicates_json").notNull().default("[]"),
  declinedJson: text("declined_json").notNull().default("[]"),
  cohortFilled: integer("cohort_filled").notNull().default(0),
  cohortPending: integer("cohort_pending").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (table) => [
  index("equity_paper_issuance_passes_day_idx").on(table.capturedDay),
]);
