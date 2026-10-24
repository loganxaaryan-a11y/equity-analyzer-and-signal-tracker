import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoHoldoutInput, assertResearchCommandAllowed, runSyntheticControls, runValidation, type Dataset, type Registry } from "./harness";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const fileHash = async (path: string) => createHash("sha256").update(await readFile(path)).digest("hex");
const loadJson = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T;

async function assertOriginalFreeze(): Promise<void> {
  const freeze = await loadJson<{ specSha256: string; trialRegistrySha256: string; datasetManifestSha256: string; trainValidationDatasetSha256: string; outcomesViewedBeforeCurrentFreeze: boolean }>(resolve(root, "research/config/PHASE2A-FREEZE.json"));
  const checks = [
    ["original spec", freeze.specSha256, await fileHash(resolve(root, "PHASE2A-RESEARCH-SPEC.md"))],
    ["original trial registry", freeze.trialRegistrySha256, await fileHash(resolve(root, "research/config/trial-registry.json"))],
    ["dataset manifest", freeze.datasetManifestSha256, await fileHash(resolve(root, "research/data/dataset-manifest.json"))],
    ["train/validation dataset", freeze.trainValidationDatasetSha256, await fileHash(resolve(root, "research/data/train-validation-bars.json"))],
  ] as const;
  if (freeze.outcomesViewedBeforeCurrentFreeze) throw new Error("Original freeze says corrected-dataset outcomes were viewed before its hash was frozen.");
  for (const [name, expected, actual] of checks) if (expected !== actual) throw new Error(`${name} hash changed after freeze: expected ${expected}, received ${actual}`);
}

async function assertRepairFreeze(registry: Registry): Promise<void> {
  const freeze = await loadJson<{ registrySha256: string; engineSha256: string; inputSha256: string; originalCandidateReportSha256: string }>(resolve(root, "research/config/PHASE2A1-FREEZE.json"));
  const checks = [
    ["repair registry", freeze.registrySha256, await fileHash(resolve(root, "research/config/phase2a1-trial-registry.json"))],
    ["repair engine", freeze.engineSha256, await fileHash(resolve(root, "research/src/harness.ts"))],
    ["train/validation input", freeze.inputSha256, await fileHash(resolve(root, "research/data/train-validation-bars.json"))],
    ["original candidate report", freeze.originalCandidateReportSha256, await fileHash(resolve(root, "research/output/candidate-report.json"))],
  ] as const;
  for (const [name, expected, actual] of checks) if (expected !== actual) throw new Error(`${name} hash changed after Phase 2A.1 freeze: expected ${expected}, received ${actual}`);
  if (registry.engineSha256 !== freeze.engineSha256) throw new Error(`Executable engine hash is not bound to the registry: registry ${registry.engineSha256 ?? "missing"}, engine ${freeze.engineSha256}`);
}

async function assertClosurePreconditions(): Promise<void> {
  const freeze = await loadJson<{ registrySha256: string; inputSha256: string; originalCandidateReportSha256: string }>(resolve(root, "research/config/PHASE2A1-FREEZE.json"));
  const checks = [["frozen Phase 2A.1 registry", freeze.registrySha256, await fileHash(resolve(root, "research/config/phase2a1-trial-registry.json"))], ["frozen train/validation input", freeze.inputSha256, await fileHash(resolve(root, "research/data/train-validation-bars.json"))], ["preserved original candidate report", freeze.originalCandidateReportSha256, await fileHash(resolve(root, "research/output/candidate-report.json"))]] as const;
  for (const [name, expected, actual] of checks) if (expected !== actual) throw new Error(`${name} changed before closure: expected ${expected}, received ${actual}`);
}

function markdown(result: ReturnType<typeof runValidation>, controls: ReturnType<typeof runSyntheticControls>, manifest: { holdout: { rows: number; aggregateSha256: string }; universeStatus: string }): string {
  const pooled = result.candidateReports.filter((row) => row.fold === "pooled_validation");
  return [
    "# Phase 2A.1 corrected validation report", "", `Generated: ${result.generatedAt}`, `Market cohort: \`${result.cohort}\``, "Synthetic controls: `phase2a1-synthetic-controls-v1` (separate file and cohort)", "",
    "## Decision", "", "The original no-promotion decisions remain unchanged. This correction repairs measurement and reproducibility defects; it does not open the holdout, add a strategy, or claim that no edge exists.", "",
    "## Corrected pooled candidates", "", "Returns are decimal event returns. Gross is compared with gross; central modeled-net is compared with central modeled-net.", "",
    "| Trial | Accepted | Mean gross | Mean central net | Gross − SMA | Central net − SMA net | Scheduled-grid blocks |",
    "|---|---:|---:|---:|---:|---:|---|",
    ...pooled.map((row) => `| ${row.trialId} | ${row.counts.acceptedMaturedIssued} | ${row.metrics.meanGross ?? "—"} | ${row.metrics.meanCentralNet ?? "—"} | ${row.metrics.grossMinusSma200 ?? "—"} | ${row.metrics.centralNetMinusSma200 ?? "—"} | ${row.uncertainty.absoluteCentralNet.availableFullBlocks} × ${row.uncertainty.absoluteCentralNet.blockLength}; tail ${row.uncertainty.absoluteCentralNet.tailDatesExcluded} |`),
    "", "## Synthetic instrument controls", "", `- Positive control: ${controls.positive.events} events; mean modeled net ${controls.positive.meanCentralNet}; lower 90% ${controls.positive.lower90 ?? "unavailable"}; qualified **${controls.positive.qualified ? "yes" : "no"}**.`, `- Negative control: ${controls.negative.qualifications}/${controls.negative.seeds.length} fixed seeds falsely qualified.`, `- ${controls.qualificationRule}`, `- ${controls.separation}`, "",
    "## Holdout lock", "", `- Engine guard: rejects every bar on or after each market's registered holdout boundary before feature or label construction.`, `- Locked rows (manifest only): ${manifest.holdout.rows}`, `- Locked aggregate SHA-256: \`${manifest.holdout.aggregateSha256}\``, `- Opened: **no**; performance: absent.`, "",
    "## Limits", "", `- ${manifest.universeStatus}`, ...result.limitations.map((item) => `- ${item}`), "",
  ].join("\n");
}

async function validate(closure = false): Promise<void> {
  await assertOriginalFreeze();
  const dataset = await loadJson<Dataset>(resolve(root, "research/data/train-validation-bars.json"));
  const registry = await loadJson<Registry>(resolve(root, "research/config/phase2a1-trial-registry.json"));
  if (closure) await assertClosurePreconditions(); else await assertRepairFreeze(registry);
  const manifest = await loadJson<{ holdout: { rows: number; aggregateSha256: string }; universeStatus: string }>(resolve(root, "research/data/dataset-manifest.json"));
  const result = runValidation(dataset, registry); const controls = runSyntheticControls();
  if (!controls.positive.qualified) throw new Error("Synthetic positive control did not qualify; the evaluation instrument cannot proceed.");
  await mkdir(resolve(root, "research/output"), { recursive: true });
  const prefix = closure ? "phase2a1-closure-v2" : "phase2a1";
  await writeFile(resolve(root, `research/output/${prefix}-train-validation-observations.json`), `${JSON.stringify(result.observations, null, 2)}\n`);
  await writeFile(resolve(root, `research/output/${prefix}-corrected-report.json`), `${JSON.stringify({ version: closure ? "chronology-freshness-closure-v2" : "phase2a1", generatedAt: result.generatedAt, cohort: result.cohort, datasetHash: result.datasetHash, registryHash: result.registryHash, candidateReports: result.candidateReports, baselineReports: result.baselineReports, selections: result.selections, holdout: result.holdout, limitations: result.limitations }, null, 2)}\n`);
  await writeFile(resolve(root, `research/output/${prefix}-synthetic-controls.json`), `${JSON.stringify(controls, null, 2)}\n`);
  await writeFile(resolve(root, `research/output/${closure ? "PHASE2A1-CLOSURE-V2-REPORT.md" : "PHASE2A1-CORRECTED-REPORT.md"}`), markdown(result, controls, manifest));
  const original = await loadJson<{ candidateReports?: unknown; selections?: unknown }>(resolve(root, "research/output/candidate-report.json"));
  await writeFile(resolve(root, `research/output/${closure ? "phase2a1-closure-v2-change-account" : "phase2a1-original-vs-repaired"}.json`), `${JSON.stringify({ generatedAt: result.generatedAt, originalResultPreservedAt: "research/output/candidate-report.json", priorExposurePreserved: true, originalSelections: original.selections ?? null, repairedSelections: result.selections, comparisonScope: ["calendar-derived entries/exits/lookbacks", "exact scheduled endpoints", "like-with-like matched costs", "complete scheduled-date uncertainty blocks", "engine-level holdout rejection"], note: "The repair is separately versioned. Familiar market outcomes are not represented as newly unseen evidence." }, null, 2)}\n`);
  if (closure) {
    const engineSha256 = await fileHash(resolve(root, "research/src/harness.ts")); const calendarSha256 = await fileHash(resolve(root, "server/src/measurement.ts")); const registrySha256 = await fileHash(resolve(root, "research/config/phase2a1-trial-registry.json")); const inputSha256 = await fileHash(resolve(root, "research/data/train-validation-bars.json"));
    const readiness = { version: "longer-history-readiness-v1", performanceExecuted: false, currentInput: { bars: dataset.series.reduce((sum, item) => sum + item.bars.length, 0), series: dataset.series.length, adjustmentBasis: [...new Set(dataset.series.map((item) => item.adjustmentBasis))], sourceProvenance: [...new Set(dataset.series.map((item) => ({ source: item.source, sourceUrl: item.sourceUrl, retrievalTime: item.retrievalTime })))] }, calendar: { id: "XNYS embedded calendar", hash: calendarSha256, limitation: "Validated only for dates encoded by the current calendar implementation; a full requested-period acquisition must revalidate every session, holiday and early close before performance." }, exclusions: { missingAndRevisionPolicy: "Exclude a scheduled feature, entry or endpoint when the exact bar is missing; reject duplicate/revised ambiguity before freezing. Endpoint-only labels do not borrow adjacent bars.", corporateActions: "Current input is unadjusted raw OHLCV and excludes unresolved split-like discontinuities. Longer-history performance is blocked until one consistent adjustment basis and revision policy are frozen." }, repairedEngineCounts: result.candidateReports.map((row) => ({ trialId: row.trialId, fold: row.fold, horizon: row.horizon, matured: row.counts.matured, acceptedMaturedIssued: row.counts.acceptedMaturedIssued, pointEstimateRows: row.counts.pointEstimateRows, excludedTailRows: row.counts.excludedTailRows, completeBlocks: row.uncertainty.absoluteCentralNet.availableFullBlocks, intervalAvailable: row.uncertainty.absoluteCentralNet.lower90 != null })), gate: { readyForNewPerformance: false, reasons: ["The current equity validation grid has only 24 scheduled sessions.", "Thirty-session products have no mature eligible fold outcomes after repaired chronology and purge rules.", "The supplied longer-history plan has no frozen acquired dataset in this checkout.", "Calendar and corporate-action normalization for the full requested period are not yet frozen."] }, freezeCandidate: { inputSha256, calendarSha256, registrySha256, correctedEngineSha256: engineSha256, splits: registry.splits, frozenBeforePerformance: true, holdoutPreserved: result.holdout.ranges } };
    const timing = { version: "timing-protocol-review-v2", executed: false, outcomeStatistics: null, comparatorPools: { candidateDates: "All eligible issued candidate dates by fold and horizon after chronology repair.", comparatorDates: "All full-schedule dates with independently eligible exact baseline inputs in the same fold/horizon; candidate abstentions may enter only this pool.", otherCandidateDatesInComparatorPool: false }, seeds: [22026009, 22026010, 22026011, 22026012], matchingOrder: ["fold", "market", "horizon", "instrument class", "direction", "pre-decision volatility bucket", "nearest date without crossing the fold boundary"], unmatchedEvents: "Retain and report unmatched counts and reasons; do not reuse or invent a match.", reuse: "No comparator reuse within a seed until its eligible pool is exhausted; exhaustion is reported and unmatched, not relaxed.", dependence: "Build connected components over the union of candidate and comparator outcome windows. Candidate and comparator dates both contribute edges. Scheduled blocks are resampling units, never independent trading bets. Require at least 20 usable components; transitive overlap may make the design structurally infeasible.", structuralPreflightRequired: ["pool sizes", "matched count", "unmatched count by reason", "reuse/exhaustion count", "component size distribution", "usable component count"], reviewRequiredBeforeExecution: true };
    await writeFile(resolve(root, "research/output/phase2a1-longer-history-readiness.json"), `${JSON.stringify(readiness, null, 2)}\n`); await writeFile(resolve(root, "research/output/phase2a1-timing-protocol-review-v2.json"), `${JSON.stringify(timing, null, 2)}\n`); await writeFile(resolve(root, "research/config/PHASE2A1-CLOSURE-V2-FREEZE.json"), `${JSON.stringify(readiness.freezeCandidate, null, 2)}\n`);
  }
  console.log(`Phase 2A.1 ${closure ? "closure" : "repair"} validation complete: ${result.observations.length} observations, ${result.selections.filter((row) => row.selected).length} selections.`);
  console.log(`Synthetic controls: positive=${controls.positive.qualified ? "PASS" : "FAIL"}, negative false qualifications=${controls.negative.qualifications}/${controls.negative.seeds.length}.`);
  console.log(`Holdout opened: ${result.holdout.opened}. Corrected outputs: research/output/phase2a1-*`);
}

async function guardInput(path: string): Promise<void> {
  const dataset = await loadJson<Dataset>(resolve(process.cwd(), path)); const registry = await loadJson<Registry>(resolve(root, "research/config/phase2a1-trial-registry.json")); assertNoHoldoutInput(dataset, registry); console.log("Input passed the engine-level holdout boundary guard.");
}

const rawCommand = process.argv.includes("--open-holdout") ? "--open-holdout" : process.argv[2] ?? "repair-validate";
if (rawCommand === "guard-input") await guardInput(process.argv[3] ?? "");
else { assertResearchCommandAllowed(rawCommand); await validate(rawCommand === "closure-validate"); }
