#!/bin/sh
# Records the narrated demo. Needs Java (Firestore emulator), ffmpeg, macOS `say`, and OPENROUTER_* in .env.local for the Ask bar.
# Usage: DEMO_OUT=/some/dir PW_CHROMIUM=/path/to/chrome sh scripts/record-demo.sh
set -e
export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
DEMO_OUT=${DEMO_OUT:-$PWD/demo-out}; export DEMO_OUT
npx -y firebase-tools emulators:exec --only firestore --project repready-7dacd --config ../firebase.json '
  export SESSION_SECRET=demo-only FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 NEXT_PUBLIC_PAYMENT_LINK=
  npx next dev -p 3140 > "$DEMO_OUT.server.log" 2>&1 &
  SERVER=$!
  until curl -s -o /dev/null http://localhost:3140/signin; do sleep 1; done
  npx tsx --env-file=.env.local scripts/record-demo.mts
  STATUS=$?
  kill $SERVER 2>/dev/null
  exit $STATUS
'
