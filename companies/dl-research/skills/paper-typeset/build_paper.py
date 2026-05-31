"""Build arXiv-style HTML / PDF / LaTeX from the Markdown draft.

Usage:
    python3 scripts/build_paper.py

Outputs:
    paper/dist/main.html   - browser preview (arXiv-like styling)
    paper/dist/main.pdf    - PDF rendered via headless Chrome
    paper/dist/main.tex    - arXiv-flavoured LaTeX source (single-file)
    paper/dist/figures/*   - figures copied next to the HTML

The script is dependency-light: stdlib + `markdown` (already installed).
PDF rendering uses `/Applications/Google Chrome.app` in headless mode.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import markdown as md

ROOT = Path(__file__).resolve().parents[1]
_DRAFT_NAME = os.environ.get("PAPER_DRAFT", "full_draft_v1.md")
DRAFT = ROOT / "paper" / "sections" / _DRAFT_NAME
FIG_SRC = ROOT / "results" / "figures"
DIST = ROOT / "paper" / "dist"
DIST_FIG = DIST / "figures"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# ---------------------------------------------------------------------------
# Figure registry: where each figure is inserted in the body and its caption.
# ---------------------------------------------------------------------------

FIGURES: list[dict] = [
    {
        "id": "fig-bars",
        "label": "Figure 1",
        "file": "plv_barplot.png",
        "caption": (
            "Mean inter-electrode PLV by region (ATL, motor) and complexity "
            "condition (high, low). Bars show subject-level means; error bars "
            "denote SEM across patients (ATL N=2, motor N=4)."
        ),
        "anchor_after": "## 3. Results",
    },
    {
        "id": "fig-topo-atl",
        "label": "Figure 2A",
        "file": "plv_topography_atl.png",
        "caption": (
            "Per-electrode PLV difference (high − low) at ATL grids. "
            "Sub-03 (left) and sub-09 (right). Colour scale: ±0.05."
        ),
        "anchor_after": "### 3.2 ATL: insufficient data for group inference",
    },
    {
        "id": "fig-topo-motor",
        "label": "Figure 2B",
        "file": "plv_topography_motor.png",
        "caption": (
            "Per-electrode PLV difference (high − low) at motor grids "
            "(sub-01, sub-05, sub-07, sub-09). Negative values indicate "
            "higher PLV during low-complexity segments."
        ),
        "anchor_after": "### 3.1 Motor cortex: syntactic complexity modulates PLV (exploratory)",
    },
    {
        "id": "fig-task-rest",
        "label": "Figure 3",
        "file": "plv_resting_vs_task.png",
        "caption": (
            "Task vs. resting-state PLV. Podcast ECoG (task, N=6 subject-region "
            "observations) vs. Miller Library resting state (N=36 runs). "
            "Permutation test on mean difference: p=0.0002."
        ),
        "anchor_after": "### 3.4 Task versus resting-state control",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_draft() -> str:
    return DRAFT.read_text(encoding="utf-8")


def _inject_figures_md(body: str) -> str:
    """Insert Markdown image+caption blocks after each anchor."""
    out = body
    for fig in FIGURES:
        anchor = fig["anchor_after"]
        block = (
            f"\n\n<figure id=\"{fig['id']}\" class=\"paper-figure\">"
            f"<img src=\"figures/{fig['file']}\" alt=\"{fig['label']}\" />"
            f"<figcaption><strong>{fig['label']}.</strong> {fig['caption']}</figcaption>"
            f"</figure>\n"
        )
        idx = out.find(anchor)
        if idx == -1:
            continue
        # Insert right after the anchor heading line.
        eol = out.find("\n", idx)
        if eol == -1:
            eol = len(out)
        out = out[: eol + 1] + block + out[eol + 1 :]
    return out


def _split_title_and_body(text: str) -> tuple[str, str, str]:
    """Return (title, abstract_html, rest_md_with_section_numbers)."""
    lines = text.splitlines()
    title = lines[0].lstrip("# ").strip()
    rest = "\n".join(lines[1:]).lstrip()
    # Abstract is between '## Abstract' and the first '---' that follows.
    abs_match = re.search(r"## Abstract\s*\n+(.*?)(?=\n---)", rest, re.DOTALL)
    if not abs_match:
        return title, "", rest
    abstract_md = abs_match.group(1).strip()
    # Strip the trailing "**Keywords:** ..." line — handled separately by the template.
    abstract_md = re.sub(r"\n*\*\*Keywords:\*\*.*$", "", abstract_md, flags=re.DOTALL).strip()
    body_md = rest[abs_match.end():]
    body_md = re.sub(r"^(?:\s*---\s*\n)+", "", body_md, flags=re.MULTILINE)
    # `extra` is enough; `smarty` would mangle apostrophes for LaTeX path.
    abstract_html = md.markdown(abstract_md, extensions=["extra"])
    return title, abstract_html, body_md


# ---------------------------------------------------------------------------
# HTML build
# ---------------------------------------------------------------------------


CSS = r"""
:root {
  --ink: #1a1a1a;
  --muted: #555;
  --rule: #c9c9c9;
  --accent: #8a1010;
  --bg: #fdfcf8;
  --maxw: 760px;
}

@page {
  size: Letter;
  margin: 0.9in 0.95in 1.05in 0.95in;
  @bottom-center {
    content: counter(page);
    font-family: "Source Serif 4", "STIX Two Text", "Latin Modern Roman", Georgia, serif;
    font-size: 9.5pt;
    color: #555;
  }
}

* { box-sizing: border-box; }

html, body { background: var(--bg); }

body {
  margin: 0 auto;
  padding: 48px 28px 80px;
  max-width: var(--maxw);
  color: var(--ink);
  font-family: "Source Serif 4", "STIX Two Text", "Latin Modern Roman", Georgia, "Times New Roman", serif;
  font-size: 10.8pt;
  line-height: 1.55;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  hyphens: auto;
}

header.paper-header {
  text-align: center;
  margin-bottom: 28px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--rule);
}

header.paper-header .arxiv-stamp {
  display: inline-block;
  font-family: "Source Code Pro", "JetBrains Mono", monospace;
  font-size: 8pt;
  letter-spacing: 0.04em;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 2px 8px;
  border-radius: 2px;
  margin-bottom: 12px;
}

header.paper-header h1 {
  font-family: "Source Serif 4", "Latin Modern Roman", Georgia, serif;
  font-weight: 600;
  font-size: 18.5pt;
  line-height: 1.25;
  margin: 0 0 14px;
}

header.paper-header .authors {
  font-size: 11pt;
  margin-bottom: 4px;
}

header.paper-header .affil {
  font-size: 9.5pt;
  color: var(--muted);
  font-style: italic;
}

section.abstract {
  margin: 18px auto 28px;
  font-size: 10.2pt;
}

section.abstract h2 {
  font-size: 10.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  margin: 0 0 8px;
  color: var(--ink);
}

section.abstract .abstract-body {
  text-align: justify;
  text-indent: 0;
  padding: 0 6px;
}

section.abstract .keywords {
  margin-top: 10px;
  font-size: 9.5pt;
  color: var(--muted);
}

main.body {
  text-align: justify;
}

main.body h2 {
  font-family: "Source Serif 4", "Latin Modern Roman", Georgia, serif;
  font-size: 13pt;
  margin: 24px 0 10px;
  font-weight: 700;
}

main.body h3 {
  font-size: 11.4pt;
  margin: 18px 0 6px;
  font-weight: 600;
}

main.body h4 {
  font-size: 10.8pt;
  margin: 14px 0 4px;
  font-style: italic;
  font-weight: 600;
}

main.body p {
  margin: 6px 0 10px;
}

main.body ul, main.body ol {
  margin: 6px 0 10px 22px;
  padding: 0;
}

main.body li {
  margin-bottom: 3px;
}

main.body table {
  border-collapse: collapse;
  margin: 12px auto;
  font-size: 9.6pt;
  width: 100%;
}

main.body table th,
main.body table td {
  padding: 4px 8px;
  text-align: left;
}

main.body table thead th {
  border-top: 1.2px solid var(--ink);
  border-bottom: 0.6px solid var(--ink);
  font-weight: 600;
}

main.body table tbody tr:last-child td {
  border-bottom: 1.2px solid var(--ink);
}

main.body table tbody td {
  border-bottom: 0.4px solid #d8d4c8;
}

main.body figure.paper-figure {
  margin: 18px auto;
  text-align: center;
}

main.body figure.paper-figure img {
  max-width: 100%;
  height: auto;
  border: 0.5px solid var(--rule);
  background: white;
  padding: 4px;
}

main.body figure.paper-figure figcaption {
  font-size: 9.4pt;
  color: var(--muted);
  margin-top: 6px;
  text-align: justify;
  padding: 0 6px;
}

main.body code {
  font-family: "Source Code Pro", "JetBrains Mono", monospace;
  font-size: 9.4pt;
  background: rgba(138, 16, 16, 0.06);
  padding: 1px 4px;
  border-radius: 2px;
}

main.body hr {
  border: 0;
  border-top: 0.4px solid var(--rule);
  margin: 22px 0;
}

main.body blockquote {
  border-left: 2px solid var(--accent);
  padding: 4px 12px;
  color: var(--muted);
  font-style: italic;
  margin: 10px 0;
}

section.references {
  margin-top: 28px;
}

section.references h2 {
  font-size: 13pt;
  border-bottom: 0.6px solid var(--ink);
  padding-bottom: 4px;
}

section.references ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

section.references li {
  font-size: 9.6pt;
  padding-left: 22px;
  text-indent: -22px;
  margin-bottom: 6px;
  text-align: left;
}

footer.colophon {
  margin-top: 40px;
  padding-top: 14px;
  border-top: 0.4px solid var(--rule);
  font-size: 8.6pt;
  color: var(--muted);
  text-align: center;
}

@media screen {
  body {
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    margin-top: 28px;
    margin-bottom: 28px;
    background: white;
  }
}
"""


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>
<header class="paper-header">
  <div class="arxiv-stamp">arXiv preprint &middot; not peer reviewed</div>
  <h1>{title}</h1>
  <div class="authors">DL Research (Multi-Agent Pipeline) &middot; PI / Engineer / Experimenter / Critic / Writer</div>
  <div class="affil">Paperclip Control Plane &middot; Theme DLR-49 &middot; {date}</div>
</header>

<section class="abstract">
  <h2>Abstract</h2>
  <div class="abstract-body">{abstract}</div>
  <div class="keywords"><strong>Keywords:</strong> travelling waves, ECoG, phase-locking value, syntactic complexity, motor cortex, anterior temporal lobe</div>
</section>

<main class="body">
{body}
</main>

<footer class="colophon">
  Generated by <code>scripts/build_paper.py</code> from
  <code>paper/sections/full_draft_v1.md</code>. Pipeline: Podcast ECoG (ds005574) &middot;
  MNE 1.8.0 &middot; seed 42. Source artefacts under
  <code>results/</code>. Audit: <code>results/PAPER_CLAIM_AUDIT.md</code>.
</footer>
</body>
</html>
"""


def build_html(title: str, abstract_html: str, body_md: str) -> str:
    body_html = md.markdown(
        body_md,
        extensions=["extra", "tables", "smarty", "sane_lists"],
    )
    # Re-promote any `**Keywords:** ...` lines that lived inside the abstract
    body_html = re.sub(
        r"<p><strong>Keywords:</strong>.*?</p>",
        "",
        body_html,
        flags=re.DOTALL,
    )
    # Wrap the references section so we can style it specially.
    body_html = re.sub(
        r"<h2>References</h2>",
        "</main>\n<section class=\"references\">\n<h2>References</h2>",
        body_html,
        count=1,
    )
    if "<section class=\"references\">" in body_html:
        body_html += "\n</section>"
    from datetime import date
    return HTML_TEMPLATE.format(
        title=title,
        abstract=abstract_html,
        body=body_html,
        css=CSS,
        date=date.today().isoformat(),
    )


# ---------------------------------------------------------------------------
# LaTeX build
# ---------------------------------------------------------------------------


LATEX_TEMPLATE = r"""\documentclass[11pt,letterpaper]{article}
% Single-file arXiv-style preamble (no external .sty required).
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[margin=1in]{geometry}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{array}
\usepackage{caption}
\usepackage{microtype}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{etoolbox}
\usepackage{authblk}
\usepackage{abstract}

\titleformat{\section}{\large\bfseries}{\thesection}{0.6em}{}
\titleformat{\subsection}{\normalsize\bfseries}{\thesubsection}{0.6em}{}
\titleformat{\subsubsection}{\normalsize\itshape}{\thesubsubsection}{0.6em}{}

\setlength{\parskip}{4pt}
\setlength{\parindent}{0pt}

\renewcommand{\abstractnamefont}{\normalfont\bfseries}
\renewcommand{\abstracttextfont}{\normalfont\small}

\title{__TITLE__}
\author{DL Research (Multi-Agent Pipeline)\\
\small PI \textperiodcentered{} Engineer \textperiodcentered{} Experimenter \textperiodcentered{} Critic \textperiodcentered{} Writer}
\date{Paperclip Theme DLR-49 \textperiodcentered{} __DATE__}

\begin{document}
\maketitle

\begin{abstract}
__ABSTRACT__

\medskip
\noindent\textbf{Keywords:} travelling waves, ECoG, phase-locking value, syntactic complexity, motor cortex, anterior temporal lobe.
\end{abstract}

__BODY__

\end{document}
"""


def md_to_latex(body_md: str) -> str:
    """A pragmatic Markdown -> LaTeX converter for this draft."""
    text = body_md

    # Escape LaTeX special chars carefully (skip backslashes already used by us).
    def esc(s: str) -> str:
        repl = {
            "\\": r"\textbackslash{}",
            "&": r"\&",
            "%": r"\%",
            "$": r"\$",
            "#": r"\#",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "~": r"\textasciitilde{}",
            "^": r"\textasciicircum{}",
        }
        out = []
        for ch in s:
            out.append(repl.get(ch, ch))
        return "".join(out)

    # Pull tables out first (handle separately so we don't escape pipes).
    tables: list[str] = []

    def take_table(match: re.Match) -> str:
        block = match.group(0)
        lines = [ln for ln in block.strip().splitlines() if ln.strip().startswith("|")]
        if len(lines) < 2:
            return block
        header_cells = [c.strip() for c in lines[0].strip().strip("|").split("|")]
        rows = [
            [c.strip() for c in ln.strip().strip("|").split("|")] for ln in lines[2:]
        ]
        ncols = len(header_cells)
        spec = "l" + "c" * (ncols - 1)
        out = [r"\begin{table}[ht]", r"\centering", r"\small",
               r"\begin{tabular}{" + spec + "}", r"\toprule"]
        out.append(" & ".join(_inline_to_tex(c) for c in header_cells) + r" \\")
        out.append(r"\midrule")
        for row in rows:
            if len(row) < ncols:
                row = row + [""] * (ncols - len(row))
            out.append(" & ".join(_inline_to_tex(c) for c in row[:ncols]) + r" \\")
        out.append(r"\bottomrule")
        out.append(r"\end{tabular}")
        out.append(r"\end{table}")
        tables.append("\n".join(out))
        return f"\u0000TABLE{len(tables) - 1}\u0000"

    text = re.sub(
        r"(?:^\|.*\|\s*\n)(?:^\|[\s\-:|]+\|\s*\n)(?:^\|.*\|\s*\n?)+",
        take_table,
        text,
        flags=re.MULTILINE,
    )

    # Pull HTML <figure> blocks out.
    figs: list[str] = []

    def take_fig(match: re.Match) -> str:
        fid = match.group("id")
        src = match.group("src")
        cap = match.group("cap")
        # Strip leading "Figure N. " if present (we keep the label inline).
        cap_clean = re.sub(r"^<strong>.*?</strong>\s*", "", cap)
        label = re.search(r"<strong>(.*?)</strong>", cap)
        label_txt = label.group(1) if label else ""
        out = [
            r"\begin{figure}[ht]",
            r"\centering",
            r"\includegraphics[width=0.92\linewidth]{" + src + "}",
            r"\caption*{\textbf{" + _inline_to_tex(label_txt) + r"} " + _inline_to_tex(_html_to_text(cap_clean)) + "}",
            r"\label{" + fid + "}",
            r"\end{figure}",
        ]
        figs.append("\n".join(out))
        return f"\u0000FIG{len(figs) - 1}\u0000"

    text = re.sub(
        r"<figure id=\"(?P<id>[^\"]+)\"[^>]*>\s*<img src=\"(?P<src>[^\"]+)\"[^/]*/>\s*<figcaption>(?P<cap>.*?)</figcaption>\s*</figure>",
        take_fig,
        text,
        flags=re.DOTALL,
    )

    # Headings
    def heading_sub(match: re.Match) -> str:
        hashes, content = match.group(1), match.group(2).strip()
        # Strip leading section number "1.", "1.2", "1.2.3", with optional trailing dot.
        content = re.sub(r"^\d+(?:\.\d+)*\.?\s+", "", content)
        level = len(hashes)
        cmd = {1: "section", 2: "section", 3: "subsection", 4: "subsubsection"}.get(level, "paragraph")
        return f"\\{cmd}{{{_inline_to_tex(content)}}}"

    text = re.sub(r"^(#{1,4})\s+(.*)$", heading_sub, text, flags=re.MULTILINE)

    # Horizontal rules → spacing
    text = re.sub(r"^---\s*$", r"\\par\\medskip", text, flags=re.MULTILINE)

    # Lists (very simple: bullet only)
    def bullet_block(match: re.Match) -> str:
        block = match.group(0)
        items = re.findall(r"^- (.*)$", block, flags=re.MULTILINE)
        body = "\n".join(rf"  \item {_inline_to_tex(item)}" for item in items)
        return r"\begin{itemize}[leftmargin=1.4em,itemsep=2pt,topsep=2pt]" + "\n" + body + "\n" + r"\end{itemize}"

    text = re.sub(r"(?:^- .*\n?)+", bullet_block, text, flags=re.MULTILINE)

    # Paragraphs: convert blank-line separated chunks to LaTeX paragraphs,
    # leaving placeholder tokens intact.
    paragraphs = re.split(r"\n\s*\n", text)
    out_paragraphs = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if para.startswith("\\") or "\u0000" in para or para.startswith("\\begin"):
            out_paragraphs.append(para)
        else:
            out_paragraphs.append(_inline_to_tex(para))
    body_tex = "\n\n".join(out_paragraphs)

    # Re-insert tables and figures.
    for i, t in enumerate(tables):
        body_tex = body_tex.replace(f"\u0000TABLE{i}\u0000", "\n" + t + "\n")
    for i, f in enumerate(figs):
        body_tex = body_tex.replace(f"\u0000FIG{i}\u0000", "\n" + f + "\n")

    return body_tex


def _inline_to_tex(s: str) -> str:
    """Convert inline Markdown to LaTeX (bold, italic, code, links)."""
    if not s:
        return ""
    # Convert HTML entities first (basic ones).
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    # Code spans
    def code_sub(m: re.Match) -> str:
        return r"\texttt{" + _escape_minor(m.group(1)) + "}"
    s = re.sub(r"`([^`]+)`", code_sub, s)
    # Bold / italic
    s = re.sub(r"\*\*([^*]+)\*\*", lambda m: r"\textbf{" + _escape_minor(m.group(1)) + "}", s)
    s = re.sub(r"\*([^*]+)\*", lambda m: r"\textit{" + _escape_minor(m.group(1)) + "}", s)
    # Links [text](url)
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
               lambda m: r"\href{" + m.group(2) + "}{" + _escape_minor(m.group(1)) + "}", s)
    # Escape remaining specials (in chunks not already escaped above).
    return _escape_minor(s, already_partial=True)


def _escape_minor(s: str, already_partial: bool = False) -> str:
    # Escape only the most common LaTeX trouble characters that have not
    # already been handled by inline conversion. Backslashes are left alone.
    if already_partial:
        # If the text contains LaTeX commands we just inserted (\textbf, etc.),
        # only escape the dangerous chars that remain.
        # We still need to escape stray % and # outside command arguments.
        s = re.sub(r"(?<!\\)%", r"\\%", s)
        s = re.sub(r"(?<!\\)#", r"\\#", s)
        s = re.sub(r"(?<!\\)\$", r"\\$", s)
        s = re.sub(r"(?<!\\)~", r"\\textasciitilde{}", s)
        s = re.sub(r"(?<!\\)\^", r"\\textasciicircum{}", s)
        s = re.sub(r"(?<!\\)_", r"\\_", s)
        s = re.sub(r"(?<!\\)&", r"\\&", s)
        return s
    repl = {
        "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$",
        "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}",
        "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
    }
    out = []
    for ch in s:
        out.append(repl.get(ch, ch))
    return "".join(out)


def _html_to_text(s: str) -> str:
    import html as _html
    return _html.unescape(re.sub(r"<[^>]+>", "", s))


def build_latex(title: str, abstract_html: str, body_md: str) -> str:
    abstract_text = _html_to_text(abstract_html).strip()
    abstract_tex = _inline_to_tex(abstract_text)
    body_tex = md_to_latex(body_md)
    from datetime import date
    out = LATEX_TEMPLATE
    out = out.replace("__TITLE__", _inline_to_tex(title))
    out = out.replace("__DATE__", date.today().isoformat())
    out = out.replace("__ABSTRACT__", abstract_tex)
    out = out.replace("__BODY__", body_tex)
    return out


# ---------------------------------------------------------------------------
# PDF via headless Chrome
# ---------------------------------------------------------------------------


def render_pdf(html_path: Path, pdf_path: Path) -> bool:
    if not Path(CHROME).exists():
        print("[warn] Chrome not found at", CHROME, file=sys.stderr)
        return False
    cmd = [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        f"file://{html_path}",
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    except subprocess.CalledProcessError as exc:
        print("[error] chrome pdf failed:", exc.stderr.decode(errors="replace")[:400],
              file=sys.stderr)
        return False
    except subprocess.TimeoutExpired:
        print("[error] chrome pdf timeout", file=sys.stderr)
        return False
    return pdf_path.exists() and pdf_path.stat().st_size > 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    if not DRAFT.exists():
        print(f"[error] draft not found: {DRAFT}", file=sys.stderr)
        return 1
    DIST.mkdir(parents=True, exist_ok=True)
    DIST_FIG.mkdir(parents=True, exist_ok=True)

    for fig in FIGURES:
        src = FIG_SRC / fig["file"]
        if src.exists():
            shutil.copy2(src, DIST_FIG / fig["file"])
        else:
            print(f"[warn] missing figure: {src}", file=sys.stderr)

    raw = _read_draft()
    raw_with_figs = _inject_figures_md(raw)
    title, abstract_html, body_md = _split_title_and_body(raw_with_figs)

    html = build_html(title, abstract_html, body_md)
    html_path = DIST / "main.html"
    html_path.write_text(html, encoding="utf-8")

    tex = build_latex(title, abstract_html, body_md)
    (DIST / "main.tex").write_text(tex, encoding="utf-8")

    pdf_path = DIST / "main.pdf"
    pdf_ok = render_pdf(html_path, pdf_path)

    summary = {
        "title": title,
        "html": str(html_path),
        "pdf": str(pdf_path) if pdf_ok else None,
        "tex": str(DIST / "main.tex"),
        "figures": [str(DIST_FIG / f["file"]) for f in FIGURES],
    }
    (DIST / "build_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
