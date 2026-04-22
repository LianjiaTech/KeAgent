#!/usr/bin/env bash
# Usage: ./scripts/release.sh [patch|minor|major|<version>]
# Examples:
#   ./scripts/release.sh patch        # 0.3.0 → 0.3.1
#   ./scripts/release.sh minor        # 0.3.0 → 0.4.0
#   ./scripts/release.sh major        # 0.3.0 → 1.0.0
#   ./scripts/release.sh 0.4.0-beta.1 # explicit version
set -euo pipefail

BUMP="${1:-patch}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_JSON="$ROOT/package.json"

# ── Read current version ──────────────────────────────────────────────────────
CURRENT=$(node -p "require('$PACKAGE_JSON').version")
echo "Current version: $CURRENT"

# ── Compute next version ──────────────────────────────────────────────────────
case "$BUMP" in
  patch|minor|major)
    NEXT=$(node -e "
      const [major, minor, patch] = '$CURRENT'.split('-')[0].split('.').map(Number);
      if ('$BUMP' === 'major') console.log((major+1) + '.0.0');
      else if ('$BUMP' === 'minor') console.log(major + '.' + (minor+1) + '.0');
      else console.log(major + '.' + minor + '.' + (patch+1));
    ")
    ;;
  *)
    # Treat as explicit version string
    NEXT="$BUMP"
    ;;
esac

echo "Next version:    $NEXT"
read -r -p "Confirm release v$NEXT? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ── Bump version in package.json ──────────────────────────────────────────────
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('$PACKAGE_JSON', 'utf8'));
  pkg.version = '$NEXT';
  fs.writeFileSync('$PACKAGE_JSON', JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated package.json → $NEXT"

# ── Commit + tag + push ───────────────────────────────────────────────────────
cd "$ROOT"
git add package.json
git commit -m "chore: release v$NEXT"
git tag "v$NEXT"
git push origin HEAD
git push origin "v$NEXT"

echo ""
echo "✅ Released v$NEXT — GitHub Actions will now build and publish the release."
echo "   Track progress: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
