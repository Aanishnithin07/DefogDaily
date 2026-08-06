# DefogDaily

Human memory intelligence and benchmark platform.

**Find out exactly where your mind is weak. Then fix it.** Free, forever, for everyone.

A cognitive assessment and training platform that measures eight domains trial by trial, tells you
*why* you scored what you scored, and builds a 28-day protocol to fix your weakest one. Everything
here is the sort of thing other apps put behind a subscription.

Runs entirely in your browser. No account, no server, no tracking.

## What it measures

| Domain | Paradigm | What it tells you |
| --- | --- | --- |
| Processing Speed | Odd/even choice reaction | Decision throughput and how steady it stays |
| Verbal Working Memory | Recognition with same-category decoys | Encoding strength, scored with d' |
| Interference Control | Stroop | The cost of overriding an automatic habit |
| Spatial Memory | Corsi-style pattern span | Visuospatial capacity under rising load |
| Fluid Working Memory | Adaptive spatial N-back | Continuous updating — the hardest WM operation |
| Response Inhibition | Go/No-Go | Impulsivity vs inattention, graded separately |
| Verbal Span | Digit span forward + backward | Storage vs manipulation, isolated |
| Cognitive Flexibility | Task switching | Switch cost — the tax on context switching |

## The diagnostic report

The 0-100 score says how you did. The report says *why*, from trial-level telemetry:

- **Reaction-time consistency (CV)** — flickering attention vs a genuinely low ceiling
- **Lapses** — moments you were briefly not on task at all
- **Vigilance decrement** — how fast you fade inside a single minute
- **Interference cost** — congruent vs incongruent Stroop trials
- **Switch cost** — switch-trial RT minus repeat-trial RT
- **Commission vs omission errors** — impulsivity and inattention have different fixes
- **d' (signal detection)** — real memory vs a feeling of familiarity
- **Manipulation cost** — forward span minus backward span

Each finding cites the number that triggered it, explains what it means in daily life, and
prescribes a specific fix plus the drill that trains it.

## The 28-day protocol

Generated from your own results, not a template. Targets your weakest domain, progresses through
establish → load → stress → consolidate, pairs every drill with a real-world transfer habit, and
re-scans you every seventh day so you can see whether it worked.



### Optional: cloud sync and the AI coach

Everything works without this. Copy `.env.local.example` to `.env.local` and add Firebase keys to
enable cross-device sync and the Gemini-written coach briefing. Without keys, the coach falls back
to a locally composed briefing built from the same report data, and the Firebase SDK is dropped
from the bundle entirely.

## Honest limits

DefogDaily is an educational tool, not a medical device, and it cannot diagnose anything.
Percentiles come from a model-based reference distribution calibrated to published effect sizes —
not a validated clinical sample. Training transfer beyond the trained task is narrow and contested
in the literature. If you are worried about your memory or concentration, speak to a doctor.
