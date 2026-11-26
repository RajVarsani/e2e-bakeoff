#!/usr/bin/env bash
# usage: ./go.sh  (env ONLY=S1,S2 to filter). Needs ANTHROPIC_API_KEY.
cd "$(dirname "$0")"
shopt -s nullglob
export PORT_OFFSET=${PORT_OFFSET:-400}
if [ -z "$CHROME_PATH" ]; then
  for c in "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing" "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome; do CHROME_PATH=$c; done
  export CHROME_PATH
fi
exec npx tsx run.ts
