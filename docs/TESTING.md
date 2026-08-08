# WORKMAP — Testing & Verification Log

This document records how v0.1.x was tested, what broke, what was fixed, and one genuinely useful discovery about automating claude.ai artifacts (spoiler: you can't — and why).

---

## 1. Parse-pipeline unit tests

The client parses Claude's JSON response. Five edge cases were tested by replicating the exact parse code in Node:

| Case | v1.0 result | Fix |
|---|---|---|
| Clean JSON | ✅ parses | — |
| Fenced json code block | ✅ fence-strip works | — |
| Preamble text + JSON ("Here is your plan: {...}") | ❌ hard fail | v1.1: extract outermost {...} substring before parsing |
| Truncated JSON (max_tokens hit) | ❌ hard fail | v1.1: shrink output contract (3×2 steps, word caps) to fit the 1,000-token budget; distinct retry-friendly error message |
| Response split across multiple content blocks | ✅ join handles it | — |

Token budget verification with a dense real-world input: ~486 input tokens, ~412 output tokens — comfortable inside the 1,000 cap after the compaction fix.

## 2. Constraint-drift findings (persona validation)

Representative model outputs for three personas were validated against stack and access-level constraints:

- **IT-locked M365 PM** — model honored constraints in phase 1, drifted into recommending **Power Automate** by phase 3. Classic pattern: models drift most in later phases.
- **Zapier-friendly startup CS** — snuck in **Notion** (never selected) as a "bigger build."
- **Fix (v1.1):** numbered HARD CONSTRAINTS block with explicit per-access-level forbidden lists and the phrase "apply to EVERY step including later phases."

## 3. The over-restriction bug (found via real user context)

Testing with a real RCM operations profile surfaced a design flaw the synthetic personas missed: the user's actual week involved **Power BI, Gemini, and Otter** — none selectable in any dropdown. The v1.1 constraint ("use ONLY tools explicitly listed in their stack") therefore *forbade* the model from automating around tools the user explicitly said they use daily.

**Fix (v1.2):** constraint 1 now treats tools named in the free-text work description as part of the stack. The textarea placeholder actively prompts users to name tools the dropdowns missed. Side benefit: the dropdown list never needs to be exhaustive.

## 4. Post-mortem: why claude.ai artifacts can't be browser-automated

An attempt to drive the artifact preview (fill dropdowns, click Generate) with the Claude in Chrome extension failed in instructive ways. Root cause: **Chrome out-of-process iframe (OOPIF) input isolation.** The artifact renders on a separate origin in a separate renderer process; extension-synthesized input events are delivered to the main frame and do not reliably route into the cross-origin iframe.

Evidence gathered:

- A JS click-listener on the top page proved the extension **auto-scales input coordinates ×1.3067** (screenshot space → viewport space). Manually pre-scaling coordinates double-scales them into dead space.
- Clicks on top-page elements (via accessibility refs) land perfectly; 5 consecutive correctly-aimed clicks on a button *inside* the artifact iframe had zero effect.
- Keystrokes intended for the iframe consistently landed in the main page's focused element (the chat input).
- Two isolated "successes" occurred only immediately after fresh page loads — routing flukes, never reproducible.
- The artifact has no standalone URL (code is injected via postMessage), so "open the iframe as a top-level tab" is not possible. The one same-origin iframe on the page is an empty shell.

**Practical rules derived:**

1. Artifact iframes are a hard wall for browser automation. Don't fight it.
2. The fix is architectural: deploy the app to a real host (Vercel) and automate the top-level page, where accessibility refs, form input, and clicks all work at full fidelity.
3. Ship a one-click test-fixture button in dev builds ("Load test profile"). It converts N fragile interactions into one reliable click and doubles as a demo tool.
4. Native select popups are OS-level widgets — unscriptable even on top-level pages in some paths. Custom dropdowns are on the roadmap partly for this reason.

## 5. End-to-end verification (Vercel deploy)

Run against the live Vercel preview via browser automation:

| # | Test | Result |
|---|---|---|
| 1 | Vite build + deploy | ✅ |
| 2 | Page render (fonts, grid background, layout) | ✅ |
| 3 | Fixture button → 8 dropdowns + week text in one click | ✅ |
| 4 | Gating (Generate locked until profile complete) | ✅ |
| 5 | Generate → loading state → API-fail fallback | ✅ graceful, no error flash |
| 6 | DEMO MODE badge (conditional on mock plan) | ✅ |
| 7 | Map render: 3 phases, 6 steps, effort badges, tool chips, time-saved, connectors, Regenerate state | ✅ |
| 8 | Automation accessibility on top-level page | ✅ full fidelity |

**Known untested path:** live Sonnet generation. The keyless API proxy exists only inside the claude.ai artifact sandbox; the deployed app renders the demo fallback by design. Closing this requires either a manual run in the artifact or the serverless endpoint on the roadmap.

## 6. Version history

- **v1.0** — initial prototype: 8 dropdowns, free-text week, Claude call, phased map renderer
- **v1.1** — truncation fix (compact output contract), robust JSON extraction, hard-constraint block, "None"/"Not sure" handling
- **v1.2** — free-text tools count as stack membership (over-restriction fix), placeholder nudge
- **v1.3** — "Load test profile" fixture button, demo-mode fallback + badge, Vite scaffold, Vercel deploy
