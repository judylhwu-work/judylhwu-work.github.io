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

  # Decide freshness by DECRYPTING the published page and comparing it to the
  # source, not by comparing mtimes. mtimes were wrong: apply-meta.py rewrites
  # $OUT after encryption, which made $OUT newer than $SRC and silently skipped
  # a needed re-encrypt — leaving stale plaintext published. StaticCrypt uses a
  # random IV, so we still skip when the content genuinely matches, to avoid
  # churning the diff.
  if [ -f "$OUT" ] \
     && [ ! "$TEMPLATE" -nt "$OUT" ] \
     && [ ! "scripts/encrypt.sh" -nt "$OUT" ] \
     && [ ! "scripts/page-meta.json" -nt "$OUT" ] \
     && STATICRYPT_PASSWORD="$PASSWORD" node scripts/verify-gates.js --quiet "$slug" >/dev/null 2>&1; then
    echo "unchanged: $slug"
    continue
  fi

  npx staticrypt "$SRC" \
    --password "$PASSWORD" \
    --config .staticrypt.json \
    --template "$TEMPLATE" \
    --directory "projects/$slug" \
    --remember 30 \
    --template-title "Judy Wu" \
    --template-instructions "" \
    --template-button "View case study" \
    --template-placeholder "Password" \
    --template-error "Incorrect password. Try again." \
    --short
  # The shell comes from one shared template, so it cannot carry a per-page title
  # or meta. StaticCrypt writes a placeholder title above; apply-meta.py replaces
  # it and injects the rest from scripts/page-meta.json — the single source.
  python3 scripts/apply-meta.py "$OUT"
  echo "encrypted: $slug"
done
