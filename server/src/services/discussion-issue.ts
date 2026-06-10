/**
 * Helpers for identifying chat-style "discussion" issues that should be
 * shielded from automated continuation/recovery.
 *
 * Two patterns are recognised as chat-style:
 *
 *  1. The canonical Research Chat thread:
 *     title === "Research hypothesis discussion (PI ↔ Operator)" AND
 *     body contains the long-lived chat surface marker.
 *  2. Any issue whose title starts with `[Discuss]` or `[Discuss-…]`
 *     (e.g. `[Discuss-Paper] DLR-49 v1 draft …`). These are operator-driven
 *     long-running review threads where the assignee replies on operator
 *     comments only and does not delegate or self-recover.
 */

export const RESEARCH_DISCUSSION_ISSUE_TITLE = "Research hypothesis discussion (PI ↔ Operator)";
export const RESEARCH_DISCUSSION_DESCRIPTION_MARKER =
  "This is a long-lived chat surface between the operator and PI.";
export const RESEARCH_DISCUSSION_NO_WAKE_MARKER = "<!--research-chat-no-wake-->";

const DISCUSS_TITLE_PREFIX_RE = /^\s*\[Discuss[A-Za-z0-9_\-]*\]/i;

export function isChatStyleDiscussionIssue(input: {
  title?: string | null;
  description?: string | null;
}): boolean {
  if (isCanonicalResearchDiscussionIssue(input)) return true;
  return typeof input.title === "string" && DISCUSS_TITLE_PREFIX_RE.test(input.title);
}

export function isCanonicalResearchDiscussionIssue(input: {
  title?: string | null;
  description?: string | null;
}): boolean {
  return (
    input.title === RESEARCH_DISCUSSION_ISSUE_TITLE &&
    typeof input.description === "string" &&
    input.description.includes(RESEARCH_DISCUSSION_DESCRIPTION_MARKER)
  );
}

export function isChatStyleNoWakeComment(
  issue: { title?: string | null; description?: string | null },
  body: string | null | undefined,
): boolean {
  return (
    typeof body === "string" &&
    body.includes(RESEARCH_DISCUSSION_NO_WAKE_MARKER) &&
    isChatStyleDiscussionIssue(issue)
  );
}
