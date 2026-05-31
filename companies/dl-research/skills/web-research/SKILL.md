---
name: web-research
description: |
  Conduct grounded web research for research-hypothesis discussion, prior-art
  surveys, and fact-checking. Uses the Cursor CLI's built-in web tool plus
  arXiv/bioRxiv/HuggingFace as primary sources. Always cite, always
  separate observation from interpretation, and prefer primary sources.
metadata:
  classification: research-core
---

# web-research

Use whenever you need information **outside the vault** to (a) check
whether an idea is novel, (b) back a claim with a citation, (c) survey a
sub-field, or (d) cross-validate a number with original sources.

## Tooling

You operate inside Cursor CLI. Available channels:

1. **Built-in `web` tool** (`web_search`, `web_fetch`) — your default;
   no extra credentials needed. Use for general queries, blog posts,
   docs, and news.
2. **arXiv API** — `https://export.arxiv.org/api/query?search_query=...`
   for academic preprints. Always preferred over web search when the
   target is an academic paper.
3. **bioRxiv API** — `https://api.biorxiv.org/details/biorxiv/<DOI>` for
   biology preprints.
4. **HuggingFace** — `https://huggingface.co/api/models?search=...` for
   models; `https://huggingface.co/api/datasets?search=...` for datasets.
5. **GitHub API** (only with `GH_TOKEN`) — `https://api.github.com/search/repositories?q=...` for code, releases, issues.

## Query strategy

1. **Start broad, then narrow.** First query: 3–5 keywords + one
   constraint. Second query: refine with a year, author, or model name
   from the first results.
2. **Diversify sources.** Pull from at least two different domains
   (arxiv + an explainer; HF + a paper) before concluding.
3. **Date-bound.** Add `since: YYYY` or `after:` filters when the field
   moves fast (e.g. LLM, SSM, video diffusion).
4. **Cite every fact.** Write `(arxiv:2406.12345)` or
   `(huggingface.co/foo/bar)` inline. Never paraphrase a number without
   the source.
5. **Avoid SEO bait.** If the top hit is a content-farm summary, dig
   one click deeper to the primary paper or repo.

## Output schema for hypothesis discussion

When you return findings to PI for hypothesis discussion, structure as:

```markdown
### What I searched
- queries: ["...", "..."]
- sources hit: arxiv (N), web (N), hf (N), github (N)

### Established (well-cited)
- claim 1 (citation)
- claim 2 (citation)

### Contested / unclear
- ... (citation showing both sides)

### Gaps (no good source found)
- topic — why nothing turned up

### Three closest prior works
1. <title>, <authors>, <year>, <venue>, <one-sentence delta>
2. ...
3. ...

### Suggested next query if we go deeper
- "..."
```

## Pitfalls

- **arXiv abstract ≠ paper claims.** If a key argument hinges on
  details, fetch the full PDF (use the `pdf` skill).
- **Hallucinated citations are common in LLM outputs.** Cross-check any
  citation that came from another model's output by hitting the primary
  source.
- **Do NOT commit web-fetched HTML** into the repo. Persist as
  structured notes via `vault-reader` instead.
- **Respect rate limits.** arXiv asks for ≤1 req/3s. Space queries.

## Scrapling-inspired reliability upgrade

For hard-to-collect sources (dynamic sites, anti-bot pages, flaky extractors),
apply this escalation ladder to improve success rate:

1. static fetch -> parse
2. browser-like fetch (headers/fingerprint)
3. sessionized dynamic fetch with network-idle wait
4. route/proxy rotation with bounded retries

For each collected source, annotate:

- retrieval mode used (1-4)
- extraction confidence (`high`/`medium`/`low`)
- any caveat (challenge page, partial parse, dynamic timeout)

Do not present low-confidence extraction as confirmed fact. Seek a second
independent source before using it in hypothesis-critical decisions.
