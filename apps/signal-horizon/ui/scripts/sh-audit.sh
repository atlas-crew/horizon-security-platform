#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Signal Horizon Component Library Audit
# Scans the codebase for raw patterns that should use SH components.
# Outputs a manifest for agent-driven migration.
# ──────────────────────────────────────────────────────────────────────────────

SRC_DIR="${1:-src}"
OUTPUT="${2:-sh-audit-report.md}"

CYN='\033[0;36m'
YEL='\033[0;33m'
GRN='\033[0;32m'
RST='\033[0m'

# Temp files
DETAIL=$(mktemp)
SUMMARY=$(mktemp)
FILELIST=$(mktemp)

echo -e "${CYN}Signal Horizon Component Audit${RST}"
echo -e "${CYN}Scanning: ${SRC_DIR}${RST}"
echo ""

total=0

scan() {
  local comp="$1" pattern="$2" desc="$3"
  
  local matches
  matches=$(grep -rn --include="*.tsx" --include="*.ts" \
    -E "$pattern" "$SRC_DIR" 2>/dev/null \
    | grep -v "src/ui/" \
    | grep -v "__tests__/" \
    | grep -v "node_modules/" \
    | grep -v "\.test\." \
    | grep -v "\.spec\." \
    || true)

  if [[ -z "$matches" ]]; then
    echo -e "${GRN}✓ ${comp}${RST} — clean"
    return
  fi

  local count
  count=$(echo "$matches" | wc -l | tr -d ' ')
  total=$((total + count))

  echo -e "${YEL}⚠ ${comp}${RST} — ${count} hits — ${desc}"
  echo "${comp}|${count}|${desc}" >> "$SUMMARY"

  # Collect files for manifest
  echo "$matches" | cut -d: -f1 >> "$FILELIST"

  # Detail section
  {
    echo "### ${comp}"
    echo "${desc}"
    echo ""
    echo "| File | Line | Match |"
    echo "|------|------|-------|"
    echo "$matches" | head -30 | while IFS=: read -r file line content; do
      trimmed=$(echo "$content" | sed 's/^[[:space:]]*//' | cut -c1-80)
      relfile="${file#$SRC_DIR/}"
      echo "| \`${relfile}\` | ${line} | \`${trimmed}\` |"
    done
    echo ""
  } >> "$DETAIL"
}

# ─── Primitives ───────────────────────────────────────────────────────────────
scan "Box" '<div[[:space:]]+style=\{' "Raw styled div → use <Box> primitive"
scan "Text" '<(p|span|h[1-6])[[:space:]]+style=\{' "Raw styled text elements → use <Text> primitive"
scan "Stack (inline)" "display: 'flex'" "Inline flex style → use <Stack> primitive"
scan "Stack (col+gap)" 'className=.*flex.*flex-col.*gap-' "Tailwind flex-col + gap → use <Stack direction=column>"
scan "Stack (row+align+gap)" 'className=.*flex.*items-center.*gap-' "Tailwind flex + items-center + gap → use <Stack direction=row align=center>"
scan "Stack (row+justify+gap)" 'className=.*flex.*justify-between.*gap-' "Tailwind flex + justify-between + gap → use <Stack direction=row justify=space-between>"

# ─── Components ───────────────────────────────────────────────────────────────
scan "Button" '<button[[:space:]]' "Raw <button> → use <Button>"
scan "Alert" 'role=.alert' "Raw alert divs → use <Alert>"
scan "Modal" 'fixed inset-0' "Raw modal/overlay patterns → use <Modal>"
scan "Tabs" 'role=.tab' "Raw tab implementations → use <Tabs>"
scan "StatusBadge" 'rounded-full.*text-xs' "Inline badge patterns → use <StatusBadge>"
scan "Input" '<input[[:space:]]' "Raw <input> → use <Input>"
scan "Select" '<select[[:space:]]' "Raw <select> → use <Select>"
scan "Spinner" 'animate-spin' "Raw spinner → use <Spinner>"
scan "SectionHeader" '<h[12][[:space:]]' "Raw h1/h2 → use <SectionHeader>"
scan "ProgressBar" 'bg-.*h-[0-9].*rounded' "Raw progress bars → use <ProgressBar>"

# ─── Tokens ───────────────────────────────────────────────────────────────────
scan "colors (hardcoded)" '#0057B7\|#0A1A3A\|#529EEC\|#00B140\|#EF3340' "Hardcoded brand colors → use colors token"
scan "fontFamily (hardcoded)" "font-family.*Rubik" "Hardcoded Rubik → use fontFamily token"

# ─── Build manifest ──────────────────────────────────────────────────────────
echo ""
MANIFEST=$(sort "$FILELIST" | uniq -c | sort -rn)

# ─── Write report ────────────────────────────────────────────────────────────
{
  echo "# Signal Horizon Component Audit"
  echo "_Generated: $(date '+%Y-%m-%d %H:%M')_"
  echo ""
  echo "## Summary"
  echo ""
  echo "**Total findings: ${total}**"
  echo ""
  echo "### Findings by Component"
  echo ""
  echo "| Component | Hits | Action |"
  echo "|-----------|------|--------|"
  sort -t'|' -k2 -rn "$SUMMARY" | while IFS='|' read -r comp count desc; do
    echo "| ${comp} | ${count} | ${desc} |"
  done
  echo ""
  echo "### Files by Hit Count (Work Order)"
  echo ""
  echo "Priority files to migrate first (most raw patterns):"
  echo ""
  echo "| Hits | File |"
  echo "|------|------|"
  echo "$MANIFEST" | head -40 | while read -r count file; do
    relfile="${file#$SRC_DIR/}"
    echo "| ${count} | \`${relfile}\` |"
  done
  echo ""
  echo "---"
  echo ""
  echo "## Detailed Findings"
  echo ""
  cat "$DETAIL"
} > "$OUTPUT"

rm -f "$DETAIL" "$SUMMARY" "$FILELIST"

echo -e "${CYN}════════════════════════════════════════${RST}"
echo -e "${CYN}Total findings: ${total}${RST}"
echo -e "${CYN}Report: ${OUTPUT}${RST}"
echo -e "${CYN}════════════════════════════════════════${RST}"
