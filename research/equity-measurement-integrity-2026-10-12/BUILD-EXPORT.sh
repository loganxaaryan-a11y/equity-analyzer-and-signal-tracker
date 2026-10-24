#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$ROOT/research/package"
NAME="equity-measurement-integrity-closeout-2026-10-12"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$OUT" "$STAGE/$NAME"

python3 - "$ROOT" "$STAGE/$NAME" <<'PY'
import pathlib, shutil, sys
root = pathlib.Path(sys.argv[1]).resolve()
dst = pathlib.Path(sys.argv[2]).resolve()
excluded_dirs = {
    '.git', '.harness', '.space-build', '.bun-cache', '.cache',
    'node_modules', 'audits', 'dist', '__pycache__', '.pytest_cache', '.turbo'
}
excluded_names = {
    'app.db', 'MANIFEST.tsv',
    'equity-measurement-integrity-closeout-2026-10-12.zip',
    'equity-measurement-integrity-closeout-2026-10-12.zip.sha256',
    'equity-measurement-integrity-closeout-2026-10-12.zip.length'
}
for path in sorted(root.rglob('*')):
    rel = path.relative_to(root)
    if any(part in excluded_dirs for part in rel.parts):
        continue
    if rel.parts[:2] == ('research', 'package'):
        continue
    if path.name in excluded_names or path.suffix == '.zip':
        continue
    target = dst / rel
    if path.is_dir():
        target.mkdir(parents=True, exist_ok=True)
    elif path.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
PY

python3 - "$STAGE/$NAME" <<'PY'
import csv, hashlib, pathlib, sys
root = pathlib.Path(sys.argv[1])
rows = []
for path in sorted(p for p in root.rglob('*') if p.is_file() and p.name != 'MANIFEST.tsv'):
    data = path.read_bytes()
    rows.append((path.relative_to(root).as_posix(), len(data), hashlib.sha256(data).hexdigest()))
with open(root / 'MANIFEST.tsv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f, delimiter='\t', lineterminator='\n')
    writer.writerow(['path', 'bytes', 'sha256'])
    writer.writerows(rows)
print(f'manifest_files={len(rows)}')
PY

rm -f "$OUT/$NAME.zip"
python3 - "$STAGE" "$NAME" "$OUT/$NAME.zip" <<'PY'
import pathlib, sys, zipfile
stage = pathlib.Path(sys.argv[1])
name = sys.argv[2]
out = pathlib.Path(sys.argv[3])
root = stage / name
fixed = (2026, 10, 12, 0, 0, 0)
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path in sorted(p for p in root.rglob('*') if p.is_file()):
        arc = f'{name}/{path.relative_to(root).as_posix()}'
        info = zipfile.ZipInfo(arc, fixed)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o100755 if path.name == 'BUILD-EXPORT.sh' else 0o100644) << 16
        z.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
PY

cp "$STAGE/$NAME/MANIFEST.tsv" "$OUT/$NAME.MANIFEST.tsv"
sha256sum "$OUT/$NAME.zip" | tee "$OUT/$NAME.zip.sha256"
wc -c < "$OUT/$NAME.zip" | tr -d ' ' | tee "$OUT/$NAME.zip.length"
