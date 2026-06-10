import { describe, expect, it } from "vitest";
import {
  isCanonicalResearchDiscussionIssue,
  isChatStyleDiscussionIssue,
  isChatStyleNoWakeComment,
  RESEARCH_DISCUSSION_DESCRIPTION_MARKER,
} from "./discussion-issue.js";

describe("discussion-issue helpers", () => {
  it("treats the canonical Research Chat thread as chat-style", () => {
    const issue = {
      title: "Research hypothesis discussion (PI ↔ Operator)",
      description: `prologue ${RESEARCH_DISCUSSION_DESCRIPTION_MARKER} epilogue`,
    };
    expect(isCanonicalResearchDiscussionIssue(issue)).toBe(true);
    expect(isChatStyleDiscussionIssue(issue)).toBe(true);
  });

  it("does NOT treat the canonical title without marker as chat-style", () => {
    const issue = {
      title: "Research hypothesis discussion (PI ↔ Operator)",
      description: "no marker here",
    };
    expect(isCanonicalResearchDiscussionIssue(issue)).toBe(false);
    expect(isChatStyleDiscussionIssue(issue)).toBe(false);
  });

  it("treats [Discuss-Paper] prefix as chat-style regardless of body", () => {
    const issue = {
      title: "[Discuss-Paper] DLR-49 v1 draft — PI ↔ Operator review",
      description: "anything goes here",
    };
    expect(isChatStyleDiscussionIssue(issue)).toBe(true);
    expect(isCanonicalResearchDiscussionIssue(issue)).toBe(false);
  });

  it("treats [Discussion] and [Discuss-X] generic prefixes as chat-style", () => {
    expect(isChatStyleDiscussionIssue({ title: "[Discussion] roadmap thoughts" })).toBe(true);
    expect(isChatStyleDiscussionIssue({ title: "[Discuss-Roadmap] Q3 plan" })).toBe(true);
    expect(isChatStyleDiscussionIssue({ title: "[Discuss_Hypothesis] alpha" })).toBe(true);
  });

  it("does not treat unrelated titles as chat-style", () => {
    expect(isChatStyleDiscussionIssue({ title: "[Write] Draft introduction" })).toBe(false);
    expect(isChatStyleDiscussionIssue({ title: "Discuss the paper" })).toBe(false);
    expect(isChatStyleDiscussionIssue({ title: "" })).toBe(false);
    expect(isChatStyleDiscussionIssue({ title: null })).toBe(false);
  });

  it("recognises the no-wake marker only on chat-style issues", () => {
    const chatIssue = { title: "[Discuss-Paper] something" };
    const otherIssue = { title: "[Write] something" };
    const body = "thanks <!--research-chat-no-wake-->";
    expect(isChatStyleNoWakeComment(chatIssue, body)).toBe(true);
    expect(isChatStyleNoWakeComment(otherIssue, body)).toBe(false);
    expect(isChatStyleNoWakeComment(chatIssue, "no marker")).toBe(false);
  });
});
