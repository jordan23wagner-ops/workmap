import { useState } from "react";
import { Zap, Loader2, RefreshCw, ArrowDown, Wrench, Clock, ChevronDown } from "lucide-react";

// ---------- config ----------
const QUESTIONS = [
  { id: "email", label: "Email platform", options: ["Gmail", "Outlook"] },
  { id: "dm", label: "Messaging / DM", options: ["Slack", "Microsoft Teams", "Google Chat"] },
  { id: "meetings", label: "Meetings", options: ["Zoom", "Microsoft Teams", "Google Meet"] },
  {
    id: "pm",
    label: "Project management",
    options: ["Asana", "Jira", "Monday.com", "Azure DevOps", "Microsoft Project", "Trello", "ClickUp", "None"],
  },
  { id: "suite", label: "Office suite", options: ["Google Workspace", "Microsoft 365"] },
  { id: "crm", label: "CRM", options: ["None", "Salesforce", "HubSpot", "Zoho"] },
  {
    id: "role",
    label: "Role type",
    options: ["Project / Program Mgmt", "Operations", "Sales", "Customer Success", "Support", "Engineering", "Marketing", "Finance", "Other"],
  },
  {
    id: "access",
    label: "Automation access",
    options: ["Zapier / Make allowed", "Power Automate only", "Apps Script only", "IT-locked (native features only)", "Not sure"],
  },
];

const EFFORT_COLORS = {
  low: { bg: "#DCEDE4", fg: "#1E6B47", label: "Quick win" },
  medium: { bg: "#FBEBD3", fg: "#8A5A12", label: "Medium lift" },
  high: { bg: "#F6DBD3", fg: "#93361B", label: "Bigger build" },
};

const MOCK_PLAN = {
  _demo: true,
  summary:
    "Demo mode — the live AI endpoint isn't available outside claude.ai, so this is a sample map for an RCM Ops profile. The real app generates this from your inputs.",
  phases: [
    { name: "Quick wins", steps: [
      { title: "Salesforce report subscriptions", detail: "Subscribe to at-risk Boost Record reports; delivered to Gmail on your cadence.", tools: ["Salesforce", "Gmail"], effort: "low", timeSaved: "~1 hr/wk" },
      { title: "Gmail filters for report intake", detail: "Auto-label scheduled report emails into a Reports label.", tools: ["Gmail"], effort: "low", timeSaved: "~30 min/wk" },
    ]},
    { name: "Task flow", steps: [
      { title: "Asana rules for intake triage", detail: "Rules auto-assign, set due dates, and route new tasks by custom field.", tools: ["Asana"], effort: "medium", timeSaved: "~1 hr/wk" },
      { title: "Slack scheduled status prompts", detail: "Recurring workflow posts status-request prompts each week.", tools: ["Slack"], effort: "low", timeSaved: "~45 min/wk" },
    ]},
    { name: "Bigger builds", steps: [
      { title: "Apps Script notes-to-Asana", detail: "Script parses Gemini meeting notes in Drive, creates Asana tasks via API.", tools: ["Apps Script", "Google Workspace", "Asana"], effort: "high", timeSaved: "~2 hrs/wk" },
      { title: "Apps Script month-end assembler", detail: "Pulls Salesforce exports into Sheets and refreshes the linked Slides deck.", tools: ["Apps Script", "Google Sheets", "Salesforce"], effort: "high", timeSaved: "~3 hrs/wk" },
    ]},
  ],
};

// ---------- app ----------
export default function App() {
  const [answers, setAnswers] = useState(Object.fromEntries(QUESTIONS.map((q) => [q.id, ""])));
  const [tasks, setTasks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);

  const ready = QUESTIONS.every((q) => answers[q.id]) && tasks.trim().length > 20;

  function loadSample() {
    setAnswers({
      email: "Gmail", dm: "Slack", meetings: "Zoom", pm: "Asana",
      suite: "Google Workspace", crm: "Salesforce", role: "Operations",
      access: "Apps Script only",
    });
    setTasks(
      "I manage ~600 client accounts in RCM client success ops. Weekly: pull Salesforce reports on at-risk Boost Records, monitor churn status, update risk tracking. I check Power BI BOOST dashboards daily for AR and churn metrics. Month-end close means pulling Salesforce and Power BI data into decks for leadership. I manage two Asana boards, manually copy action items from Gemini meeting notes into Asana, and chase teammates on Slack for status. Otter transcripts need to become tasks and talk tracks."
    );
  }

  async function generate() {
    setLoading(true);
    setError("");
    setPlan(null);
    const stack = QUESTIONS.map((q) => `${q.label}: ${answers[q.id]}`).join("\n");
    const prompt = `You are a workflow automation consultant. A user has this tool stack:

${stack}

They describe their recurring work as:
"""${tasks.trim()}"""

Design a personalized automation workflow. HARD CONSTRAINTS — apply to EVERY step including later phases:
1. Use ONLY tools from their stack above OR tools they explicitly name in their work description (those count as part of their stack). Never introduce a tool from neither source (no Notion, no Airtable, no new subscriptions).
2. Respect their automation access level strictly: "IT-locked" = native features only (rules, filters, templates, dashboards — NO Power Automate, NO Zapier, NO scripts). "Power Automate only" = no Zapier/Make/Apps Script. "Apps Script only" = no Zapier/Make/Power Automate. "Not sure" = native features only, and note in the summary they should ask IT what's approved.
3. If an answer is "None", do not recommend adopting a tool in that category.
Be specific — name exact features (e.g. "Gmail filters + labels", "Asana rules", "Slack Workflow Builder"), not vague advice.

Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "summary": "2-3 sentence overview of the automation strategy",
  "phases": [
    {
      "name": "short phase name",
      "steps": [
        {
          "title": "short action title",
          "detail": "1-2 sentences: exactly what to set up and how it connects",
          "tools": ["Tool A", "Tool B"],
          "effort": "low|medium|high",
          "timeSaved": "e.g. ~2 hrs/wk"
        }
      ]
    }
  ]
}
Use exactly 3 phases with exactly 2 steps each. Keep "detail" under 25 words and "summary" under 40 words — the whole response must be compact. Order phases from quickest wins to bigger builds.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = (data.content || [])
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .replace(/```json|```/g, "")
        .trim();
      // Extract outermost JSON object — survives preamble/trailing text
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) throw new Error("no-json");
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (!Array.isArray(parsed.phases) || parsed.phases.length === 0) throw new Error("bad-shape");
      setPlan(parsed);
    } catch (e) {
      if (e.message === "bad-shape") {
        setError("The map came back malformed. Hit generate again — it usually resolves on retry.");
      } else {
        // Outside claude.ai the keyless proxy doesn't exist — show the demo map instead
        setPlan(MOCK_PLAN);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <style>{css}</style>

      {/* header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoRow}>
            <div style={styles.logoMark}>
              <Zap size={16} strokeWidth={2.5} color="#F5F7FA" />
            </div>
            <span style={styles.logoType}>WORKMAP</span>
            <span style={styles.logoRev}>REV 0.1</span>
          </div>
          <h1 style={styles.h1}>Blueprint your job's automation.</h1>
          <p style={styles.sub}>
            Pick your stack, describe your week, and get a process map built from the tools you already have — no new
            subscriptions.
          </p>
        </div>
      </header>

      <main style={styles.main}>
        {/* stack selection */}
        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTag}>01 — TOOL STACK</span>
            <button className="sample" onClick={loadSample}>
              Load test profile: RCM Ops
            </button>
          </div>
          <div className="grid">
            {QUESTIONS.map((q) => (
              <div key={q.id} style={styles.field}>
                <label style={styles.label}>{q.label}</label>
                <div style={styles.selectWrap}>
                  <select
                    className="sel"
                    value={answers[q.id]}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {q.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={styles.chev} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* work description */}
        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTag}>02 — YOUR WEEK</span>
            <span style={styles.panelHint}>{tasks.trim().length < 21 ? "The more detail, the better the map." : "✓"}</span>
          </div>
          <textarea
            className="ta"
            rows={4}
            placeholder="Describe your recurring tasks — and name any tools the dropdowns missed (BI dashboards, AI notetakers, etc). e.g. Every Monday I pull status from 6 project boards into a deck for leadership, check Power BI, chase people on Slack, and copy meeting action items into Jira…"
            value={tasks}
            onChange={(e) => setTasks(e.target.value)}
          />
        </section>

        {/* generate */}
        <button className="cta" disabled={!ready || loading} onClick={generate}>
          {loading ? (
            <>
              <Loader2 size={16} className="spin" /> Drafting your blueprint…
            </>
          ) : plan ? (
            <>
              <RefreshCw size={16} /> Regenerate map
            </>
          ) : (
            <>Generate my workflow map</>
          )}
        </button>
        {!ready && !plan && (
          <p style={styles.gateNote}>Fill every dropdown and add a few sentences about your week to unlock.</p>
        )}
        {error && <p style={styles.error}>{error}</p>}

        {/* process map */}
        {plan && (
          <section style={{ ...styles.panel, ...styles.mapPanel }}>
            <div style={styles.panelHead}>
              <span style={styles.panelTag}>03 — PROCESS MAP</span>
              {plan._demo && (
                <span style={{ ...styles.effort, background: "#FBEBD3", color: "#8A5A12" }}>DEMO MODE</span>
              )}
            </div>
            <p style={styles.summary}>{plan.summary}</p>

            <div style={styles.map}>
              {plan.phases?.map((phase, pi) => (
                <div key={pi}>
                  <div style={styles.phaseRow}>
                    <div style={styles.phaseNum}>{String(pi + 1).padStart(2, "0")}</div>
                    <div style={styles.phaseName}>{phase.name}</div>
                    <div style={styles.phaseRule} />
                  </div>

                  <div style={styles.stepCol}>
                    {phase.steps?.map((s, si) => {
                      const eff = EFFORT_COLORS[s.effort] || EFFORT_COLORS.medium;
                      return (
                        <div key={si} className="step">
                          <div style={styles.stepHead}>
                            <span style={styles.stepTitle}>{s.title}</span>
                            <span style={{ ...styles.effort, background: eff.bg, color: eff.fg }}>{eff.label}</span>
                          </div>
                          <p style={styles.stepDetail}>{s.detail}</p>
                          <div style={styles.metaRow}>
                            <span style={styles.metaItem}>
                              <Wrench size={12} /> {(s.tools || []).join(" · ")}
                            </span>
                            {s.timeSaved && (
                              <span style={{ ...styles.metaItem, color: "#1E6B47" }}>
                                <Clock size={12} /> {s.timeSaved}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pi < plan.phases.length - 1 && (
                    <div style={styles.connector}>
                      <ArrowDown size={16} color="#8DA3B8" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer style={styles.footer}>WORKMAP · drafted with your native tools · nothing installed, nothing connected</footer>
    </div>
  );
}

// ---------- styles ----------
const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(#E8EDF3, #E8EDF3) padding-box, repeating-linear-gradient(0deg, transparent, transparent 23px, #D8E0E9 23px, #D8E0E9 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, #D8E0E9 23px, #D8E0E9 24px), #E8EDF3",
    backgroundBlendMode: "normal",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#1B2A41",
  },
  header: { borderBottom: "1px solid #C7D2DE", background: "rgba(232,237,243,0.85)", backdropFilter: "blur(4px)" },
  headerInner: { maxWidth: 880, margin: "0 auto", padding: "40px 24px 32px" },
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: "#1B2A41",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoType: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, letterSpacing: "0.18em", fontSize: 13 },
  logoRev: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: "#6B7F94",
    border: "1px solid #C7D2DE",
    borderRadius: 3,
    padding: "2px 6px",
    letterSpacing: "0.1em",
  },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, margin: 0, letterSpacing: "-0.02em" },
  sub: { color: "#4A6076", maxWidth: 560, marginTop: 10, lineHeight: 1.55, fontSize: 15 },
  main: { maxWidth: 880, margin: "0 auto", padding: "28px 24px 64px" },
  panel: {
    background: "#F7F9FB",
    border: "1px solid #C7D2DE",
    borderRadius: 10,
    padding: "20px 22px",
    marginBottom: 20,
    boxShadow: "0 1px 2px rgba(27,42,65,0.05)",
  },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  panelTag: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    color: "#4A6076",
    fontWeight: 600,
  },
  panelHint: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8DA3B8" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#33475C" },
  selectWrap: { position: "relative" },
  chev: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#6B7F94", pointerEvents: "none" },
  gateNote: { fontSize: 13, color: "#6B7F94", textAlign: "center", marginTop: 10 },
  error: { fontSize: 13, color: "#93361B", textAlign: "center", marginTop: 12 },
  mapPanel: { marginTop: 28 },
  summary: { color: "#33475C", lineHeight: 1.6, fontSize: 15, marginBottom: 24, maxWidth: 640 },
  map: { display: "flex", flexDirection: "column" },
  phaseRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  phaseNum: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    fontWeight: 600,
    color: "#F5F7FA",
    background: "#1B2A41",
    borderRadius: 5,
    padding: "3px 8px",
  },
  phaseName: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 17 },
  phaseRule: { flex: 1, borderTop: "1px dashed #A9BACB" },
  stepCol: { display: "flex", flexDirection: "column", gap: 10, paddingLeft: 8, borderLeft: "2px solid #C7D2DE", marginLeft: 14 },
  stepHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  stepTitle: { fontWeight: 600, fontSize: 14.5 },
  effort: { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" },
  stepDetail: { fontSize: 13.5, color: "#4A6076", lineHeight: 1.55, margin: "6px 0 8px" },
  metaRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  metaItem: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "#6B7F94",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
  },
  connector: { display: "flex", justifyContent: "center", padding: "14px 0" },
  footer: {
    textAlign: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10.5,
    letterSpacing: "0.12em",
    color: "#8DA3B8",
    padding: "0 24px 40px",
  },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap');
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.sel {
  width: 100%; appearance: none; -webkit-appearance: none;
  padding: 10px 32px 10px 12px; font-size: 14px; font-family: 'Inter', sans-serif;
  color: #1B2A41; background: #FFFFFF; border: 1px solid #C7D2DE; border-radius: 7px; cursor: pointer;
}
.sel:focus { outline: 2px solid #1B2A41; outline-offset: 1px; }
.ta {
  width: 100%; box-sizing: border-box; resize: vertical;
  padding: 12px 14px; font-size: 14px; font-family: 'Inter', sans-serif; line-height: 1.55;
  color: #1B2A41; background: #FFFFFF; border: 1px solid #C7D2DE; border-radius: 7px;
}
.ta:focus { outline: 2px solid #1B2A41; outline-offset: 1px; }
.cta {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px; font-size: 15px; font-weight: 600; font-family: 'Space Grotesk', sans-serif;
  color: #F5F7FA; background: #1B2A41; border: none; border-radius: 9px; cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.sample {
  font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.06em;
  color: #4A6076; background: #FFFFFF; border: 1px dashed #A9BACB; border-radius: 6px;
  padding: 5px 10px; cursor: pointer;
}
.sample:hover { border-color: #1B2A41; color: #1B2A41; }
.cta:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(27,42,65,0.25); }
.cta:disabled { background: #A9BACB; cursor: not-allowed; }
.step {
  background: #FFFFFF; border: 1px solid #D5DEE7; border-radius: 8px; padding: 14px 16px;
  transition: border-color 0.15s ease;
}
.step:hover { border-color: #1B2A41; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .cta, .step { transition: none; } .spin { animation: none; } }
`;
