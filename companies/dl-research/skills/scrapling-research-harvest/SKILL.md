---
name: scrapling-research-harvest
description: |
  Reliability-oriented web evidence harvesting workflow using Scrapling-inspired
  techniques (adaptive parsing, anti-bot aware fetch, proxy/session fallback)
  for higher data collection success rates.
metadata:
  classification: research-core
  sources:
    - kind: github-repo
      repo: D4Vinci/Scrapling
      url: https://github.com/D4Vinci/Scrapling
      usage: referenced
---

# scrapling-research-harvest

Use this skill when web collection repeatedly fails, pages are dynamic, or citation extraction quality is low.

## Reliability ladder (stop at first successful tier)

1. **Tier 1: Static fetch + parse**
   - Use normal web fetch for canonical pages (paper, docs, repo README).
   - Extract title, author, date, key claim, and source URL.

2. **Tier 2: Browser-mimic request**
   - Retry with browser-like headers/fingerprint behavior.
   - Wait for network idle before parsing dynamic content.

3. **Tier 3: Sessionized dynamic fetch**
   - Use stateful session for JS-rendered pages.
   - Preserve cookies and retry after short jittered delays.

4. **Tier 4: Rotating route/proxy fallback**
   - Rotate route when anti-bot pages or repeated 403/429 appears.
   - Keep per-domain retry budget and stop before abuse.

## Extraction quality rules

- Capture **primary source first** (paper/repo/dataset card), then secondary commentary.
- Store extraction with:
  - URL
  - access timestamp
  - retrieval tier used
  - confidence (`high`/`medium`/`low`)
  - extraction caveat (if any)
- Require 2-source confirmation for critical factual claims.

## Adaptive selector policy

- Save both semantic anchor and structural selector (title text + CSS/XPath-like locator).
- If selector fails, fall back to text-anchor relocation instead of hard-failing.
- Prefer stable targets: heading text, DOI/arXiv id patterns, metadata tags.

## Failure handling contract

When collection is partially blocked, return:

1. successful sources
2. blocked domains + failure type (`403`, `challenge`, `dynamic-timeout`, etc.)
3. retry recommendation (when/how to retry)
4. confidence score for each extracted claim

