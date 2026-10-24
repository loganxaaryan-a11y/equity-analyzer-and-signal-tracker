# Exact checkout reproduction

This archive is a complete source checkout for the 12 October 2026 equity measurement-integrity closeout. It excludes generated/runtime state (`node_modules`, `.space-build`, `.harness`, `app.db`, audit directories, Git metadata, and prior ZIP exports) and includes source, all ordered SQL migrations, tests, research configuration/data/outputs, lockfile, and the vendored Hatch SDK dependency.

## Verify the payload

From the archive root:

```bash
python3 - <<'PY'
import csv, hashlib, pathlib, sys
root = pathlib.Path('.')
failed = []
with open('MANIFEST.tsv', newline='', encoding='utf-8') as f:
    for row in csv.DictReader(f, delimiter='\t'):
        path = root / row['path']
        if not path.is_file():
            failed.append((row['path'], 'missing'))
            continue
        data = path.read_bytes()
        if len(data) != int(row['bytes']):
            failed.append((row['path'], f"length {len(data)} != {row['bytes']}"))
        actual = hashlib.sha256(data).hexdigest()
        if actual != row['sha256']:
            failed.append((row['path'], f"sha256 {actual} != {row['sha256']}"))
print(f"verified={sum(1 for _ in open('MANIFEST.tsv', encoding='utf-8')) - 1 - len(failed)} failed={len(failed)}")
for item in failed: print(*item, sep=': ')
sys.exit(1 if failed else 0)
PY
```

`MANIFEST.tsv` intentionally excludes itself; it covers every other archive payload.

## Install and verify

Requirements: Linux/macOS, Bun 1.4.x, Python 3 (manifest verification only). No external Hatch workspace path is required; the SDK tarball is in `vendor/space-sdk.tgz`.

```bash
bun install --frozen-lockfile
bun run test
bun x tsc --noEmit -p server/tsconfig.json
bun x tsc --noEmit -p client/tsconfig.json
bun x tsc --noEmit -p research/tsconfig.json
bun run research:validate
```

The managed artifact build/migration must be run through the Hatch web-artifact build interface. Do not substitute `bun run build` for that managed step.

## Exact export regeneration

From the source checkout root:

```bash
bash research/equity-measurement-integrity-2026-10-12/BUILD-EXPORT.sh
```

The script creates a deterministic, sorted ZIP with fixed timestamps, an in-archive per-file SHA-256/length manifest, and sidecar archive hash/length metadata under `research/package/`.
