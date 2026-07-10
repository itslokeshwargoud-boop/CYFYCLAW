#!/usr/bin/env bash
# Quick health/endpoint smoke test against a running backend.
set -euo pipefail
BASE="${1:-http://localhost:8000}"
echo "GET $BASE/health"
curl -fsS "$BASE/health" | python3 -m json.tool
echo "GET $BASE/api/templates (count)"
curl -fsS "$BASE/api/templates" | python3 -c "import sys,json;print(len(json.load(sys.stdin)),'templates')"
echo "GET $BASE/api/detections (count)"
curl -fsS "$BASE/api/detections" | python3 -c "import sys,json;print(len(json.load(sys.stdin)),'detections')"
echo "OK"
