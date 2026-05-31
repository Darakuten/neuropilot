# NeuroPilot Demo Video Playbook

This playbook is for recording a clean, PI-facing workflow demo that shows:

1. hypothesis generation
2. research experiment execution
3. publication artifact generation

Target length: **60-90 seconds**.

## Demo objective

Show NeuroPilot as an end-to-end research operating system (not just a chatbot UI).

## Safety first

- Use a dedicated demo workspace/company.
- Keep strict budget caps enabled.
- Require explicit approval gates before launching expensive runs.
- Prefer replaying previously completed runs/artifacts for public demos.

## Shot list (recommended)

### 00:00-00:08 Hook

- Open on dashboard overview.
- Narration: "This is NeuroPilot, an AI-native operating system for neuroengineering and neuroscience research."

### 00:08-00:22 Hypothesis generation

- Open/create a research issue.
- Show hypothesis statement + measurable success criteria.
- Narration: "A vague direction is converted into a falsifiable research hypothesis."

### 00:22-00:45 Experiment execution

- Show assignment to Experimenter/Engineer path.
- Show run state, logs, and generated experiment artifacts.
- Narration: "Experiments run with tracked configuration, evidence, and execution history."

### 00:45-01:05 Audit gate

- Show Critic/claim review step.
- Highlight evidence-linked claims and citation checks.
- Narration: "Before any conclusion, claims are audited against evidence."

### 01:05-01:20 Paper output

- Show generated paper-ready assets (PDF/slides/poster or draft outputs).
- Narration: "Validated outputs feed directly into publication artifacts."

### 01:20-01:30 Close

- Return to dashboard or architecture visual.
- Narration: "NeuroPilot compresses hypothesis-to-paper cycles with governance and traceability built in."

## Voiceover script (short version)

"NeuroPilot turns neuro-AI research operations into a governed execution pipeline.  
First, hypotheses are structured with measurable criteria.  
Second, experiments run through tracked multi-agent workflows with reproducible artifacts.  
Third, claim and citation audits validate scientific integrity before paper outputs are generated.  
From idea to publication, NeuroPilot provides one control plane for PI-level oversight."

## Generated assets (in repository)

The README embeds a schematic workflow animation generated from synthetic UI frames (no live agent runs):

- `doc/visualizations/neuropilot-demo.gif` — inline autoplay in README
- `doc/visualizations/neuropilot-demo.mp4` — full-quality download
- `doc/visualizations/neuropilot-demo.html` — source animation (deterministic `window.__seek(ms)` API)

Regenerate after editing the HTML:

```bash
node doc/visualizations/render-demo.mjs
```

This captures ~500 frames at 20fps (25 seconds), encodes MP4 + palette-optimized GIF, and removes temporary frame files automatically.

## Note on demo fidelity

The bundled demo is **schematic**, not a screen recording of a live NeuroPilot instance.
It is designed for public sharing without token cost or accidental agent execution.
For live PI presentations, follow the safety rules above and use a dedicated demo workspace with strict budget caps.
