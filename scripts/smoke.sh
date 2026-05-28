#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

python3 scripts/data/preprocess_replay.py --validate mvp/data/replay/demo_replay.json
find mvp/server -maxdepth 4 -name '*.js' -exec node --check {} \;
find mvp/src -maxdepth 4 -name '*.js' -exec sh -c 'node --input-type=module --check < "$1"' sh {} \;
