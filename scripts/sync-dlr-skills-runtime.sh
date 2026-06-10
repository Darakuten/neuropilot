#!/usr/bin/env bash
set -euo pipefail

# One-way sync from canonical repo skills to runtime skills.
# - Canonical: companies/dl-research/skills/*
# - Runtime:   ~/.cursor/skills
# Existing hashed duplicates (name--*) are archived before linking.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANON_DIR="$REPO_ROOT/companies/dl-research/skills"
CURSOR_DIR="${HOME}/.cursor/skills"
BACKUP_DIR="${HOME}/.cursor/skills-backup-$(date +%Y%m%d-%H%M%S)"

if [[ ! -d "$CANON_DIR" ]]; then
  echo "Canonical skills directory not found: $CANON_DIR" >&2
  exit 1
fi

mkdir -p "$CURSOR_DIR"
mkdir -p "$BACKUP_DIR"

echo "Canonical: $CANON_DIR"
echo "Runtime:   $CURSOR_DIR"
echo "Backup:    $BACKUP_DIR"

archive_if_exists() {
  local path="$1"
  if [[ -e "$path" || -L "$path" ]]; then
    mv "$path" "$BACKUP_DIR/"
  fi
}

for skill_path in "$CANON_DIR"/*; do
  [[ -d "$skill_path" ]] || continue
  skill_name="$(basename "$skill_path")"

  # Archive hashed runtime duplicates (skill--hash)
  while IFS= read -r dup; do
    archive_if_exists "$dup"
  done < <(compgen -G "$CURSOR_DIR/${skill_name}--*" || true)

  # Archive direct folder/symlink with canonical name, then relink
  archive_if_exists "$CURSOR_DIR/$skill_name"
  ln -s "$skill_path" "$CURSOR_DIR/$skill_name"
done

echo "Done. Archived duplicates into: $BACKUP_DIR"
