#!/usr/bin/env bash
# Usage: PORT_OFFSET=300 lanes/maestro/run.sh [flow.yaml ...]   (stack must already be running)
set -uo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.maestro/bin:$PATH"
O=${PORT_OFFSET:-0}
ADMIN_URL=http://admin.localhost:$((5101+O)) PORTAL_URL=http://portal.localhost:$((5102+O))
API_URL=http://127.0.0.1:$((5100+O)) CRM_API_URL=http://127.0.0.1:$((5103+O))
flows=("$@"); [ ${#flows[@]} -eq 0 ] && flows=(flows/*.yaml)
D=${REPORT_DIR:-results}; mkdir -p "$D"
maestro test --headless --format junit --output "$D/junit.xml" --debug-output "$D/debug" \
  -e ADMIN_URL=$ADMIN_URL -e PORTAL_URL=$PORTAL_URL -e API_URL=$API_URL -e CRM_API_URL=$CRM_API_URL "${flows[@]}"
