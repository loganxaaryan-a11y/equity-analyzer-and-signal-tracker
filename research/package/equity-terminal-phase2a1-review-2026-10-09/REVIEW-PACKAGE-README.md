# Equity terminal Track B / Phase 2A.1 review package

Start with `PHASE2A1-AUDIT.md` and `research/output/PHASE2A1-CORRECTED-REPORT.md`.

Reproduce from the artifact root after replacing these files in the project:

```bash
bun run research:phase2a1
bun test
bun run typecheck
bun research/src/command.ts open-holdout  # expected to fail closed
```

Evidence summary:

- Original Phase 2A outputs and freeze remain present and hash checked.
- Corrected outputs use `research/output/phase2a1-*` filenames.
- 73 native Bun tests passed; full output is included.
- Positive synthetic control passed; 0/12 fixed-seed negative controls falsely qualified.
- Original no-promotion decision remains; the real holdout was not opened.
- No migrations were added for Track B. Existing migrations are included so the review has the fresh full source context, including retained Track A migration 0030.
