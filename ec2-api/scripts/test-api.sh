#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The operator/deployment checks cluster Available before running this script.
# No AWS CLI privileges or secret reads are needed for this HTTP-only suite.
exec node scripts/test-api.js
