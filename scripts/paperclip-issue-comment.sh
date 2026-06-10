#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/paperclip-issue-comment.sh [--issue-id ID] [--body TEXT] [--dry-run]

Reads a multiline markdown body from stdin when stdin is piped. This preserves
newlines and safely JSON-encodes POST /api/issues/{issueId}/comments payloads.

Examples:
  scripts/paperclip-issue-comment.sh --issue-id "$PAPERCLIP_TASK_ID" <<'MD'
  ## Update

  - Verified the proposal card appears
  - Ready for operator review
  MD

  scripts/paperclip-issue-comment.sh --issue-id "$PAPERCLIP_TASK_ID" --dry-run <<'MD'
  ## Debug

  - Safe multiline payload preview
  MD
EOF
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

issue_id="${PAPERCLIP_TASK_ID:-}"
body_arg=""
dry_run=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue-id)
      issue_id="${2:-}"
      shift 2
      ;;
    --body)
      body_arg="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$issue_id" ]]; then
  printf 'Missing issue id. Pass --issue-id or set PAPERCLIP_TASK_ID.\n' >&2
  exit 1
fi

body=""
if [[ -n "$body_arg" ]]; then
  body="$body_arg"
elif [[ ! -t 0 ]]; then
  body="$(cat)"
fi

if [[ -z "$body" ]]; then
  printf 'Missing comment body. Pass --body or pipe stdin.\n' >&2
  exit 1
fi

require_command jq

payload="$(
  jq -nc \
    --arg body "$body" \
    '{body: $body}'
)"

if [[ "$dry_run" == "1" ]]; then
  printf '%s\n' "$payload"
  exit 0
fi

if [[ -z "${PAPERCLIP_API_URL:-}" || -z "${PAPERCLIP_API_KEY:-}" || -z "${PAPERCLIP_RUN_ID:-}" ]]; then
  printf 'Missing PAPERCLIP_API_URL, PAPERCLIP_API_KEY, or PAPERCLIP_RUN_ID.\n' >&2
  exit 1
fi

curl -sS -X POST \
  "$PAPERCLIP_API_URL/api/issues/$issue_id/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H 'Content-Type: application/json' \
  --data-binary "$payload"
