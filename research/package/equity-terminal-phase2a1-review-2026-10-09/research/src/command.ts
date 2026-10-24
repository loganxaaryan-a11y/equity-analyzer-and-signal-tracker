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

async function validate(): Promise<void> {
  await assertOriginalFreeze();
  const dataset = await loadJson<Dataset>(resolve(root, "research/data/train-validation-bars.json"));
  const registry = await loadJson<Registry>(resolve(root, "research/config/phase2a1-trial-registry.json"));
  await assertRepairFreeze(registry);
  const manifest = await loadJson<{ holdout: { rows: number; aggregateSha256: string }; universeStatus: string }>(resolve(root, "research/data/dataset-manifest.json"));
  const result = runValidation(dataset, registry); const controls = runSyntheticControls();
  if (!controls.positive.qualified) throw new Error("Synthetic positive control did not qualify; the evaluation instrument cannot proceed.");
  await mkdir(resolve(root, "research/output"), { recursive: true });
  await writeFile(resolve(root, "research/output/phase2a1-train-validation-observations.json"), `${JSON.stringify(result.observations, null, 2)}\n`);
  await writeFile(resolve(root, "research/output/phase2a1-corrected-report.json"), `${JSON.stringify({ generatedAt: result.generatedAt, cohort: result.cohort, datasetHash: result.datasetHash, registryHash: result.registryHash, candidateReports: result.candidateReports, baselineReports: result.baselineReports, selections: result.selections, holdout: result.holdout, limitations: result.limitations }, null, 2)}\n`);
  await writeFile(resolve(root, "research/output/phase2a1-synthetic-controls.json"), `${JSON.stringify(controls, null, 2)}\n`);
  await writeFile(resolve(root, "research/output/PHASE2A1-CORRECTED-REPORT.md"), markdown(result, controls, manifest));
  const original = await loadJson<{ candidateReports?: unknown; selections?: unknown }>(resolve(root, "research/output/candidate-report.json"));
  await writeFile(resolve(root, "research/output/phase2a1-original-vs-repaired.json"), `${JSON.stringify({ generatedAt: result.generatedAt, originalResultPreservedAt: "research/output/candidate-report.json", priorExposurePreserved: true, originalSelections: original.selections ?? null, repairedSelections: result.selections, comparisonScope: ["calendar-derived entries/exits/lookbacks", "exact scheduled endpoints", "like-with-like matched costs", "complete scheduled-date uncertainty blocks", "engine-level holdout rejection"], note: "The repair is separately versioned. Familiar market outcomes are not represented as newly unseen evidence." }, null, 2)}\n`);
  console.log(`Phase 2A.1 repair validation complete: ${result.observations.length} observations, ${result.selections.filter((row) => row.selected).length} selections.`);
  console.log(`Synthetic controls: positive=${controls.positive.qualified ? "PASS" : "FAIL"}, negative false qualifications=${controls.negative.qualifications}/${controls.negative.seeds.length}.`);
  console.log(`Holdout opened: ${result.holdout.opened}. Corrected outputs: research/output/phase2a1-*`);
}

async function guardInput(path: string): Promise<void> {
  const dataset = await loadJson<Dataset>(resolve(process.cwd(), path)); const registry = await loadJson<Registry>(resolve(root, "research/config/phase2a1-trial-registry.json")); assertNoHoldoutInput(dataset, registry); console.log("Input passed the engine-level holdout boundary guard.");
}

const rawCommand = process.argv.includes("--open-holdout") ? "--open-holdout" : process.argv[2] ?? "repair-validate";
if (rawCommand === "guard-input") await guardInput(process.argv[3] ?? "");
else { assertResearchCommandAllowed(rawCommand); await validate(); }
