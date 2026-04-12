#!/usr/bin/env bash
#
# Prepares brand assets for the VitePress build:
#   1. Mirrors reference subdirectories (color, typography, guides, lockups,
#      reference, icons, banners) into site/public/brand/ so they're served
#      at /brand/<subdir>/<file>.
#   2. Copies the HTML infographics into site/public/infographics/.
#   3. Archives the full brand directory into a downloadable zip at
#      site/public/brand/edge-protection-brand-package.zip.
#
# Run from any cwd — resolves paths relative to this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$SITE_DIR/.." && pwd)"
BRAND_DIR="$REPO_DIR/brand"
PUBLIC_BRAND="$SITE_DIR/public/brand"
PUBLIC_INFO="$SITE_DIR/public/infographics"

if [ ! -d "$BRAND_DIR" ]; then
  echo "warning: $BRAND_DIR does not exist; skipping brand prep" >&2
  exit 0
fi

mkdir -p "$PUBLIC_BRAND" "$PUBLIC_INFO"

# 1. Mirror reference subdirectories so their relative asset paths keep working.
for sub in color typography guides lockups reference icons banners; do
  src="$BRAND_DIR/$sub"
  dst="$PUBLIC_BRAND/$sub"
  if [ -d "$src" ]; then
    rm -rf "$dst"
    cp -R "$src" "$dst"
  fi
done

# 2. Copy HTML infographics. Prefer the nested html/ layout; fall back to flat.
if compgen -G "$BRAND_DIR/infographics/html/*.html" > /dev/null; then
  cp "$BRAND_DIR"/infographics/html/*.html "$PUBLIC_INFO/"
fi
if compgen -G "$BRAND_DIR/infographics/*.html" > /dev/null; then
  cp "$BRAND_DIR"/infographics/*.html "$PUBLIC_INFO/"
fi

# 3. Build the downloadable brand package archive fresh from the current
#    brand/ contents. Exclude the output file itself and editor droppings.
ZIP_OUT="$PUBLIC_BRAND/edge-protection-brand-package.zip"
rm -f "$ZIP_OUT"
if command -v zip >/dev/null 2>&1; then
  ( cd "$REPO_DIR" && zip -rq "$ZIP_OUT" brand \
      -x 'brand/edge-protection-brand-package.zip' \
         '*/.DS_Store' \
         '.DS_Store' )
  printf 'built %s (%s)\n' "$(basename "$ZIP_OUT")" "$(du -h "$ZIP_OUT" | cut -f1)"
else
  echo "warning: zip command not found; skipping brand package archive" >&2
fi
