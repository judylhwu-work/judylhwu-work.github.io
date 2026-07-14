#!/usr/bin/env bash
#
# Encrypts the NDA-protected case studies with StaticCrypt.
#
# Plaintext source lives in  private/projects/<slug>/index.html  (git-ignored).
# Encrypted output is written to  projects/<slug>/index.html     (published).
#
# The password is read from private/.password (git-ignored) or $STATICRYPT_PASSWORD,
# so it is NEVER committed. The salt in .staticrypt.json is shared across all pages
# so one "Keep me unlocked" tick unlocks every case study.
#
# This runs automatically via .githooks/pre-commit — you normally never call it by hand.

set -euo pipefail
cd "$(dirname "$0")/.."

SLUGS=(nova smart-huddles definitions nova-to-claude)
TEMPLATE="scripts/staticrypt-template.html"

# resolve the password without committing it
PASSWORD="${STATICRYPT_PASSWORD:-}"
if [ -z "$PASSWORD" ] && [ -f private/.password ]; then
  PASSWORD="$(tr -d '\n\r' < private/.password)"
fi
if [ -z "$PASSWORD" ]; then
  echo "encrypt.sh: no password (set STATICRYPT_PASSWORD or create private/.password)" >&2
  exit 1
fi

for slug in "${SLUGS[@]}"; do
  SRC="private/projects/$slug/index.html"
  OUT="projects/$slug/index.html"

  if [ ! -f "$SRC" ]; then
    echo "encrypt.sh: skip $slug (no source at $SRC)" >&2
    continue
  fi

  # only re-encrypt when the source OR the shared template is newer than the
  # published output (StaticCrypt uses a random IV, so re-encrypting unchanged
  # pages would needlessly churn the diff)
  if [ -f "$OUT" ] && [ ! "$SRC" -nt "$OUT" ] && [ ! "$TEMPLATE" -nt "$OUT" ]; then
    echo "unchanged: $slug"
    continue
  fi

  npx staticrypt "$SRC" \
    --password "$PASSWORD" \
    --config .staticrypt.json \
    --template "$TEMPLATE" \
    --directory "projects/$slug" \
    --remember 30 \
    --template-title "Protected · Judy Wu" \
    --template-instructions "" \
    --template-button "View case study" \
    --template-placeholder "Password" \
    --template-remember "Keep me unlocked on this device" \
    --template-error "Incorrect password. Try again." \
    --short
  echo "encrypted: $slug"
done
