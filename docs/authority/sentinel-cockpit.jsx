import { useState, useEffect, useCallback } from "react";

const PLATFORMS = ["ChatGPT", "Perplexity", "Claude", "Grok"];
const PLATFORM_COLORS = {
  ChatGPT: "#10B981",
  Perplexity: "#3B82F6",
  Claude: "#F59E0B",
  Grok: "#8B5CF6",
};

const SCORE_STYLES = {
  3: { bg: "#065F46", text: "#6EE7B7", label: "Named + Linked" },
  2: { bg: "#78350F", text: "#FCD34D", label: "Named, No Link" },
  1: { bg: "#7F1D1D", text: "#FCA5A5", label: "Described Only" },
  0: { bg: "#450A0A", text: "#F87171", label: "Not Mentioned" },
  null: { bg: "#1E293B", text: "#E2E8F0", label: "—" },
};

const QUERIES = [
  {
    q: "best AI image generator for photorealism",
    cat: "Use-case",
    target: "/guides/best-generator-for/photorealism",
  },
  {
    q: "Midjourney negative prompt",
    cat: "Platform",
    target: "/platforms/midjourney",
  },
  {
    q: "how to write prompts for DALL-E 3",
    cat: "Platform",
    target: "/platforms/openai",
  },
  {
    q: "CLIP vs natural language prompts",
    cat: "Educational",
    target: "/guides/prompt-formats",
  },
  {
    q: "AI image generator comparison 2026",
    cat: "Authority",
    target: "/platforms",
  },
  {
    q: "which AI image generators support negative prompts",
    cat: "Audit",
    target: "/platforms/negative-prompts",
  },
  {
    q: "best prompt format for Stable Diffusion",
    cat: "Platform",
    target: "/platforms/stability",
  },
  {
    q: "Midjourney vs DALL-E comparison",
    cat: "Comparison",
    target: "/platforms/compare/midjourney-vs-dalle",
  },
  {
    q: "how are AI image generators scored",
    cat: "Methodology",
    target: "/about/how-we-score",
  },
  { q: "AI prompt builder tool", cat: "Discovery", target: "/" },
  { q: "Flux prompt format guide", cat: "Platform", target: "/platforms/flux" },
  {
    q: "Leonardo AI prompt tips",
    cat: "Platform",
    target: "/platforms/leonardo",
  },
];

const PROMPTS = [
  {
    name: "Full Site Crawl",
    desc: "Complete overview — first run or monthly deep scan",
    platform: "Grok",
    text: `Visit my website at https://promagen.com/ and crawl all publicly accessible pages.\n\nGoal:\nExtract the site structure, page titles, URLs, headings, key body copy, metadata, CTAs, internal links, and any product/service information.\n\nInstructions:\n- Only use publicly accessible pages\n- Respect robots.txt and normal rate limits\n- Do not attempt logins, forms, paywalled pages, admin areas, or private content\n- Ignore images unless they have useful alt text or captions\n- Remove duplicate pages, boilerplate, cookie banners, and navigation clutter\n- Group results by page type\n- Return the output as:\n  1. full sitemap found\n  2. page-by-page summary\n  3. extracted copy by section\n  4. SEO issues noticed\n  5. content gaps and recommendations`,
  },
  {
    name: "SEO Audit",
    desc: "Metadata gaps, thin pages, keyword targeting",
    platform: "Grok",
    text: `Crawl https://promagen.com and analyse every public page for SEO.\n\nExtract:\n- URL\n- title tag\n- meta description\n- H1\n- H2s\n- canonical\n- internal links\n- image alt text\n- obvious duplicate or thin content\n\nThen give me:\n- a table of all pages\n- missing or weak metadata\n- duplicate topics\n- thin pages\n- pages with unclear keyword targeting\n- the 10 highest-priority fixes`,
  },
  {
    name: "Competitor Analysis",
    desc: "Funnel review, conversion path, positioning",
    platform: "ChatGPT",
    text: `Crawl https://promagen.com and reverse-engineer the site.\n\nI want:\n- site structure\n- offer structure\n- service pages\n- pricing mentions\n- positioning statements\n- trust signals\n- CTAs\n- funnel path from homepage to conversion\n\nThen summarise:\n- what the business does\n- who it serves\n- how it converts visitors\n- strongest pages\n- weakest pages\n- messaging improvements`,
  },
  {
    name: "Content Extraction",
    desc: "Clean text dump for knowledge base",
    platform: "Grok",
    text: `Visit https://promagen.com and extract the readable text content from all public pages.\n\nRules:\n- skip menus, footer links, cookie notices, and repeated boilerplate\n- preserve headings and section structure\n- group output by URL\n- return clean plain text only`,
  },
  {
    name: "Knowledge Base",
    desc: "Structured data, entities, FAQ gaps",
    platform: "ChatGPT",
    text: `Crawl https://promagen.com and turn the public site into a structured knowledge base.\n\nFor each page return:\n- URL\n- page title\n- summary\n- key facts\n- important entities\n- products/services mentioned\n- FAQs found\n- important links\n\nThen produce:\n- a master knowledge summary\n- a glossary of terms\n- a list of missing FAQ opportunities`,
  },
  {
    name: "Deep Analyst",
    desc: "Most thorough single-pass — the gold standard",
    platform: "Grok",
    text: `You are a website crawler and analyst. Visit https://promagen.com and crawl all publicly accessible pages only.\n\nDo not access any private, gated, admin, checkout, account, or form-submission areas. Respect robots.txt and normal rate limits. Ignore repeated boilerplate such as navigation, footer links, cookie banners, and legal clutter unless directly relevant.\n\nReturn the output in five sections:\n\n1. Sitemap discovered\n- List every public URL found\n- Group by page type\n\n2. Page inventory\nFor each page give:\n- URL\n- title\n- H1\n- brief summary\n- main CTA\n- important internal links\n\n3. Content extraction\nFor each page extract:\n- main headings\n- subheadings\n- core body copy\n- product/service details\n- testimonials, proof, trust signals, pricing mentions\n\n4. SEO and structure audit\nIdentify:\n- missing or weak titles\n- missing or weak meta descriptions\n- duplicate topics\n- thin pages\n- weak internal linking\n- unclear page intent\n- broken funnel steps\n\n5. Recommendations\nGive:\n- top 10 priority fixes\n- content gaps\n- conversion improvements\n- pages that should be merged, expanded, or rewritten\n\nBe precise, structured, and do not invent pages you cannot access.`,
  },
];

const STORAGE_KEY = "sentinel-cockpit-data";

function getWeekDates(count = 12) {
  const weeks = [];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for (let i = 0; i < count; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

function getCurrentWeekIndex(weeks) {
  const today = new Date().toISOString().slice(0, 10);
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (today >= weeks[i]) return i;
  }
  return 0;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function SentinelCockpit() {
  const [tab, setTab] = useState("scorecard");
  const [weeks] = useState(() => getWeekDates(12));
  const [activeWeek, setActiveWeek] = useState(() =>
    getCurrentWeekIndex(getWeekDates(12)),
  );
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [promptMeta, setPromptMeta] = useState({});
  const [copied, setCopied] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result?.value) {
          const data = JSON.parse(result.value);
          if (data.scores) setScores(data.scores);
          if (data.notes) setNotes(data.notes);
          if (data.promptMeta) setPromptMeta(data.promptMeta);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(
    async (newScores, newNotes, newPromptMeta) => {
      const s = newScores || scores;
      const n = newNotes || notes;
      const p = newPromptMeta || promptMeta;
      try {
        await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ scores: s, notes: n, promptMeta: p }),
        );
      } catch {}
    },
    [scores, notes, promptMeta],
  );

  const cycleScore = (qi, pi, wi) => {
    const key = `${qi}-${pi}-${wi}`;
    const current = scores[key];
    const next =
      current === null || current === undefined
        ? 0
        : current >= 3
          ? null
          : current + 1;
    const newScores = { ...scores, [key]: next };
    setScores(newScores);
    save(newScores, null, null);
  };

  const getScore = (qi, pi, wi) => {
    const v = scores[`${qi}-${pi}-${wi}`];
    return v === undefined ? null : v;
  };

  const getWeekTotal = (wi) => {
    let sum = 0,
      count = 0;
    QUERIES.forEach((_, qi) =>
      PLATFORMS.forEach((_, pi) => {
        const v = getScore(qi, pi, wi);
        if (v !== null) {
          sum += v;
          count++;
        }
      }),
    );
    return { sum, count, max: QUERIES.length * PLATFORMS.length * 3 };
  };

  const getQueryRowTotal = (qi, wi) => {
    let sum = 0;
    PLATFORMS.forEach((_, pi) => {
      const v = getScore(qi, pi, wi);
      if (v !== null) sum += v;
    });
    return sum;
  };

  const getPlatformTotal = (pi, wi) => {
    let sum = 0;
    QUERIES.forEach((_, qi) => {
      const v = getScore(qi, pi, wi);
      if (v !== null) sum += v;
    });
    return sum;
  };

  const getTrend = (qi, pi, wi) => {
    if (wi === 0) return null;
    const curr = getScore(qi, pi, wi);
    const prev = getScore(qi, pi, wi - 1);
    if (curr === null || prev === null) return null;
    if (curr > prev) return "up";
    if (curr < prev) return "down";
    return "same";
  };

  const handleCopy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const updatePromptMeta = (idx, field, value) => {
    const newMeta = {
      ...promptMeta,
      [idx]: { ...promptMeta[idx], [field]: value },
    };
    setPromptMeta(newMeta);
    save(null, null, newMeta);
  };

  const startNoteEdit = (qi, wi) => {
    const key = `${qi}-${wi}`;
    setEditingNote(key);
    setNoteText(notes[key] || "");
  };

  const saveNote = () => {
    if (editingNote) {
      const newNotes = { ...notes, [editingNote]: noteText };
      setNotes(newNotes);
      save(null, newNotes, null);
      setEditingNote(null);
    }
  };

  const catColors = {
    "Use-case": "#10B981",
    Platform: "#3B82F6",
    Educational: "#8B5CF6",
    Authority: "#F59E0B",
    Audit: "#EC4899",
    Comparison: "#06B6D4",
    Methodology: "#F97316",
    Discovery: "#14B8A6",
  };

  if (!loaded) {
    return (
      <div
        style={{
          background: "#0A0E1A",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#F59E0B",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
          }}
        >
          SENTINEL LOADING...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#0A0E1A",
        minHeight: "100vh",
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: "#E2E8F0",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0F172A; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
        .score-cell { cursor: pointer; transition: all 0.15s; user-select: none; border: 1px solid #1E293B; }
        .score-cell:hover { transform: scale(1.08); z-index: 2; box-shadow: 0 0 12px rgba(245,158,11,0.3); }
        .tab-btn { padding: 10px 24px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; transition: all 0.2s; border-radius: 6px 6px 0 0; }
        .prompt-card { background: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 16px; transition: border-color 0.2s; }
        .prompt-card:hover { border-color: #334155; }
        .copy-btn { background: #1E293B; color: #F59E0B; border: 1px solid #334155; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; font-family: 'JetBrains Mono', monospace; }
        .copy-btn:hover { background: #F59E0B; color: #0A0E1A; }
        .trend-up { color: #10B981; }
        .trend-down { color: #F87171; }
        .week-tab { padding: 6px 10px; border: 1px solid #1E293B; cursor: pointer; font-size: 11px; font-family: 'JetBrains Mono', monospace; transition: all 0.15s; border-radius: 4px; background: #0F172A; color: #CBD5E1; }
        .week-tab:hover { border-color: #F59E0B; color: #F59E0B; }
        .week-active { background: #F59E0B !important; color: #0A0E1A !important; border-color: #F59E0B !important; font-weight: 600; }
        .note-btn { background: none; border: 1px solid #334155; color: #CBD5E1; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 10px; transition: all 0.15s; }
        .note-btn:hover { border-color: #F59E0B; color: #F59E0B; }
        .note-has { border-color: #F59E0B; color: #F59E0B; }
        textarea { background: #0F172A; color: #E2E8F0; border: 1px solid #F59E0B; border-radius: 4px; padding: 8px; font-family: 'Inter', sans-serif; font-size: 12px; resize: vertical; outline: none; }
        input[type="text"] { background: #0F172A; color: #E2E8F0; border: 1px solid #1E293B; border-radius: 4px; padding: 4px 8px; font-size: 11px; outline: none; width: 100%; font-family: 'Inter', sans-serif; }
        input[type="text"]:focus { border-color: #F59E0B; }
      `}</style>

      {/* Header */}
      <div
        style={{ padding: "20px 24px 0", borderBottom: "1px solid #1E293B" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "linear-gradient(135deg, #F59E0B, #EC4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1,
                color: "#F8FAFC",
              }}
            >
              PROMAGEN SENTINEL
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#CBD5E1",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              AI VISIBILITY INTELLIGENCE • CITATION COCKPIT
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="tab-btn"
            onClick={() => setTab("scorecard")}
            style={{
              background: tab === "scorecard" ? "#F59E0B" : "#0F172A",
              color: tab === "scorecard" ? "#0A0E1A" : "#CBD5E1",
            }}
          >
            Citation Scorecard
          </button>
          <button
            className="tab-btn"
            onClick={() => setTab("prompts")}
            style={{
              background: tab === "prompts" ? "#F59E0B" : "#0F172A",
              color: tab === "prompts" ? "#0A0E1A" : "#CBD5E1",
            }}
          >
            Prompt Library
          </button>
          <button
            className="tab-btn"
            onClick={() => setTab("velocity")}
            style={{
              background: tab === "velocity" ? "#F59E0B" : "#0F172A",
              color: tab === "velocity" ? "#0A0E1A" : "#CBD5E1",
            }}
          >
            Citation Velocity
          </button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* ═══ SCORECARD TAB ═══ */}
        {tab === "scorecard" && (
          <div>
            {/* Week selector */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 16,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#E2E8F0",
                  fontWeight: 600,
                  marginRight: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                WEEK:
              </span>
              {weeks.map((w, wi) => (
                <button
                  key={wi}
                  className={`week-tab ${wi === activeWeek ? "week-active" : ""}`}
                  onClick={() => setActiveWeek(wi)}
                >
                  W{wi + 1} {formatDate(w)}
                </button>
              ))}
            </div>

            {/* Score legend */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              {[3, 2, 1, 0].map((s) => (
                <div
                  key={s}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: SCORE_STYLES[s].bg,
                      color: SCORE_STYLES[s].text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      border: "1px solid #334155",
                    }}
                  >
                    {s}
                  </div>
                  <span style={{ fontSize: 11, color: "#CBD5E1" }}>
                    {SCORE_STYLES[s].label}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#E2E8F0", marginLeft: 8 }}>
                Click cells to score
              </div>
            </div>

            {/* Week summary bar */}
            {(() => {
              const wt = getWeekTotal(activeWeek);
              const prevWt =
                activeWeek > 0 ? getWeekTotal(activeWeek - 1) : null;
              const delta =
                prevWt && prevWt.count > 0 ? wt.sum - prevWt.sum : null;
              return (
                <div
                  style={{
                    background: "#0F172A",
                    border: "1px solid #1E293B",
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 16,
                    display: "flex",
                    gap: 24,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#E2E8F0",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      WEEK SCORE
                    </span>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: "#F59E0B",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {wt.sum}
                      <span style={{ fontSize: 14, color: "#E2E8F0" }}>
                        {" "}
                        / {wt.max}
                      </span>
                      {delta !== null && delta !== 0 && (
                        <span
                          style={{ fontSize: 14, marginLeft: 8 }}
                          className={delta > 0 ? "trend-up" : "trend-down"}
                        >
                          {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                        </span>
                      )}
                    </div>
                  </div>
                  {PLATFORMS.map((p, pi) => (
                    <div key={p}>
                      <span
                        style={{
                          fontSize: 10,
                          color: PLATFORM_COLORS[p],
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                        }}
                      >
                        {p.toUpperCase()}
                      </span>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#F8FAFC",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {getPlatformTotal(pi, activeWeek)}
                        <span style={{ fontSize: 11, color: "#E2E8F0" }}>
                          /{QUERIES.length * 3}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "#E2E8F0" }}>
                    {wt.count}/{QUERIES.length * PLATFORMS.length} cells scored
                  </div>
                </div>
              );
            })()}

            {/* Score grid */}
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  minWidth: 900,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: "8px 10px",
                        textAlign: "left",
                        fontSize: 10,
                        color: "#E2E8F0",
                        fontFamily: "'JetBrains Mono', monospace",
                        borderBottom: "2px solid #1E293B",
                        width: 40,
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        textAlign: "left",
                        fontSize: 10,
                        color: "#E2E8F0",
                        fontFamily: "'JetBrains Mono', monospace",
                        borderBottom: "2px solid #1E293B",
                        minWidth: 260,
                      }}
                    >
                      QUERY
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        textAlign: "center",
                        fontSize: 10,
                        color: "#E2E8F0",
                        fontFamily: "'JetBrains Mono', monospace",
                        borderBottom: "2px solid #1E293B",
                        width: 60,
                      }}
                    >
                      CAT
                    </th>
                    {PLATFORMS.map((p) => (
                      <th
                        key={p}
                        style={{
                          padding: "8px 10px",
                          textAlign: "center",
                          fontSize: 10,
                          color: PLATFORM_COLORS[p],
                          fontFamily: "'JetBrains Mono', monospace",
                          borderBottom: "2px solid #1E293B",
                          width: 80,
                          fontWeight: 700,
                        }}
                      >
                        {p.toUpperCase()}
                      </th>
                    ))}
                    <th
                      style={{
                        padding: "8px 10px",
                        textAlign: "center",
                        fontSize: 10,
                        color: "#F59E0B",
                        fontFamily: "'JetBrains Mono', monospace",
                        borderBottom: "2px solid #1E293B",
                        width: 50,
                      }}
                    >
                      TOTAL
                    </th>
                    <th
                      style={{
                        padding: "8px 10px",
                        textAlign: "center",
                        fontSize: 10,
                        color: "#E2E8F0",
                        fontFamily: "'JetBrains Mono', monospace",
                        borderBottom: "2px solid #1E293B",
                        width: 50,
                      }}
                    >
                      NOTE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {QUERIES.map((query, qi) => (
                    <tr key={qi} style={{ borderBottom: "1px solid #111827" }}>
                      <td
                        style={{
                          padding: "6px 10px",
                          fontSize: 11,
                          color: "#475569",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {qi + 1}
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#E2E8F0",
                            lineHeight: 1.3,
                          }}
                        >
                          {query.q}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#475569",
                            fontFamily: "'JetBrains Mono', monospace",
                            marginTop: 2,
                          }}
                        >
                          {query.target}
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: catColors[query.cat] + "20",
                            color: catColors[query.cat],
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {query.cat}
                        </span>
                      </td>
                      {PLATFORMS.map((_, pi) => {
                        const v = getScore(qi, pi, activeWeek);
                        const style = SCORE_STYLES[v];
                        const trend = getTrend(qi, pi, activeWeek);
                        return (
                          <td
                            key={pi}
                            style={{ padding: "4px", textAlign: "center" }}
                          >
                            <div
                              className="score-cell"
                              onClick={() => cycleScore(qi, pi, activeWeek)}
                              style={{
                                width: 48,
                                height: 36,
                                borderRadius: 4,
                                background: style.bg,
                                color: style.text,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 15,
                                fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                                position: "relative",
                              }}
                            >
                              {v !== null ? v : "·"}
                              {trend && trend !== "same" && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: -2,
                                    right: -2,
                                    fontSize: 8,
                                  }}
                                  className={
                                    trend === "up" ? "trend-up" : "trend-down"
                                  }
                                >
                                  {trend === "up" ? "▲" : "▼"}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td
                        style={{
                          padding: "6px 10px",
                          textAlign: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#F59E0B",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {getQueryRowTotal(qi, activeWeek)}
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <button
                          className={`note-btn ${notes[`${qi}-${activeWeek}`] ? "note-has" : ""}`}
                          onClick={() => startNoteEdit(qi, activeWeek)}
                          title={notes[`${qi}-${activeWeek}`] || "Add note"}
                        >
                          {notes[`${qi}-${activeWeek}`] ? "✎" : "+"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note editor modal */}
            {editingNote && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 100,
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) saveNote();
                }}
              >
                <div
                  style={{
                    background: "#0F172A",
                    border: "1px solid #F59E0B",
                    borderRadius: 8,
                    padding: 20,
                    width: 400,
                    maxWidth: "90vw",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#F59E0B",
                      fontFamily: "'JetBrains Mono', monospace",
                      marginBottom: 8,
                    }}
                  >
                    NOTE — Query {parseInt(editingNote.split("-")[0]) + 1}, Week{" "}
                    {parseInt(editingNote.split("-")[1]) + 1}
                  </div>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={4}
                    style={{ width: "100%", marginBottom: 12 }}
                    placeholder="What did the AI say? Any interesting quotes or competitors mentioned?"
                    autoFocus
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      className="copy-btn"
                      onClick={() => {
                        setEditingNote(null);
                      }}
                      style={{ color: "#CBD5E1" }}
                    >
                      Cancel
                    </button>
                    <button className="copy-btn" onClick={saveNote}>
                      Save Note
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PROMPTS TAB ═══ */}
        {tab === "prompts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: "#E2E8F0",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {PROMPTS.length} PROMPTS • CLICK COPY TO GRAB • UPDATE LAST RUN
              WHEN COMPLETE
            </div>
            {PROMPTS.map((p, i) => {
              const meta = promptMeta[i] || {};
              return (
                <div key={i} className="prompt-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#F8FAFC",
                          }}
                        >
                          {p.name}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 3,
                            background: PLATFORM_COLORS[p.platform] + "30",
                            color: PLATFORM_COLORS[p.platform] || "#CBD5E1",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {p.platform}
                        </span>
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#CBD5E1", marginTop: 2 }}
                      >
                        {p.desc}
                      </div>
                    </div>
                    <button
                      className="copy-btn"
                      onClick={() => handleCopy(p.text, i)}
                      style={
                        copied === i
                          ? {
                              background: "#10B981",
                              color: "#fff",
                              borderColor: "#10B981",
                            }
                          : {}
                      }
                    >
                      {copied === i ? "✓ COPIED" : "COPY"}
                    </button>
                  </div>

                  <div
                    style={{
                      background: "#080C16",
                      border: "1px solid #1E293B",
                      borderRadius: 4,
                      padding: 12,
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#CBD5E1",
                      lineHeight: 1.5,
                      maxHeight: 160,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {p.text}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginTop: 10,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "#E2E8F0",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        LAST RUN:
                      </span>
                      <input
                        type="text"
                        value={meta.lastRun || ""}
                        onChange={(e) =>
                          updatePromptMeta(i, "lastRun", e.target.value)
                        }
                        placeholder="e.g. 14 Apr 2026"
                        style={{ width: 120 }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: "#E2E8F0",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        KEY FINDING:
                      </span>
                      <input
                        type="text"
                        value={meta.finding || ""}
                        onChange={(e) =>
                          updatePromptMeta(i, "finding", e.target.value)
                        }
                        placeholder="One-sentence summary of what the scrape revealed"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "velocity" && (
          <div style={{ padding: "24px 0" }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, color: "#F59E0B", margin: "0 0 8px" }}>
                Citation Velocity Index
              </h3>
              <p style={{ fontSize: 13, color: "#E2E8F0", margin: 0, lineHeight: 1.5 }}>
                Rate of change in citation scores over 4-week rolling windows.
                Positive velocity = gaining traction. Negative = losing ground.
                Needs 4+ weeks of scorecard data to compute.
              </p>
            </div>

            {(() => {
              // Compute velocity from stored scores
              const weekKeys = Object.keys(scores).sort().slice(-8);
              if (weekKeys.length < 4) {
                return (
                  <div style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#E2E8F0",
                    background: "#1E293B",
                    borderRadius: 8,
                    fontSize: 14,
                  }}>
                    Need {4 - weekKeys.length} more week{4 - weekKeys.length > 1 ? "s" : ""} of data.
                    Keep scoring in the Citation Scorecard tab.
                  </div>
                );
              }

              // Compute velocity per query per platform
              const velocities = QUERIES.map((query, qi) => {
                const platformVels = PLATFORMS.map((platform, pi) => {
                  const recentScores = weekKeys.slice(-4).map(
                    (wk) => scores[wk]?.[qi]?.[pi] ?? null
                  ).filter((s) => s !== null);

                  if (recentScores.length < 3) return { platform, velocity: null, current: null, trend: "insufficient" };

                  // Linear regression slope
                  const n = recentScores.length;
                  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
                  for (let i = 0; i < n; i++) {
                    sumX += i; sumY += recentScores[i];
                    sumXY += i * recentScores[i]; sumX2 += i * i;
                  }
                  const denom = n * sumX2 - sumX * sumX;
                  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;

                  const trend = slope > 0.25 ? "accelerating" : slope < -0.25 ? "decelerating" : "stable";
                  return {
                    platform,
                    velocity: Math.round(slope * 100) / 100,
                    current: recentScores[recentScores.length - 1],
                    trend,
                  };
                });
                return { query: query.q, category: query.cat, target: query.target, platforms: platformVels };
              });

              const accel = velocities.flatMap((v) =>
                v.platforms.filter((p) => p.trend === "accelerating").map((p) => ({ query: v.query, ...p }))
              );
              const decel = velocities.flatMap((v) =>
                v.platforms.filter((p) => p.trend === "decelerating").map((p) => ({ query: v.query, ...p }))
              );

              return (
                <div>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                    <div style={{ background: "#065F46", borderRadius: 8, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#6EE7B7" }}>{accel.length}</div>
                      <div style={{ fontSize: 12, color: "#A7F3D0", marginTop: 4 }}>Accelerating</div>
                    </div>
                    <div style={{ background: "#7F1D1D", borderRadius: 8, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#FCA5A5" }}>{decel.length}</div>
                      <div style={{ fontSize: 12, color: "#FECACA", marginTop: 4 }}>Decelerating</div>
                    </div>
                    <div style={{ background: "#1E293B", borderRadius: 8, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#FBBF24" }}>
                        {velocities.flatMap((v) => v.platforms).filter((p) => p.trend === "stable").length}
                      </div>
                      <div style={{ fontSize: 12, color: "#FDE68A", marginTop: 4 }}>Stable</div>
                    </div>
                  </div>

                  {/* Velocity table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 6px", color: "#F59E0B", borderBottom: "2px solid #334155", fontSize: 11 }}>QUERY</th>
                        {PLATFORMS.map((p) => (
                          <th key={p} style={{ textAlign: "center", padding: "8px 6px", color: PLATFORM_COLORS[p], borderBottom: "2px solid #334155", fontSize: 11 }}>{p}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {velocities.map((v, vi) => (
                        <tr key={vi} style={{ borderBottom: "1px solid #1E293B" }}>
                          <td style={{ padding: "10px 6px", color: "#F1F5F9", maxWidth: 260 }}>
                            <div style={{ fontSize: 12, lineHeight: 1.3 }}>{v.query}</div>
                            <div style={{ fontSize: 10, color: "#E2E8F0", marginTop: 2 }}>{v.category}</div>
                          </td>
                          {v.platforms.map((p, pi) => {
                            const velColor = p.trend === "accelerating" ? "#10B981"
                              : p.trend === "decelerating" ? "#F87171"
                              : p.trend === "stable" ? "#FBBF24" : "#E2E8F0";
                            const arrow = p.trend === "accelerating" ? "▲"
                              : p.trend === "decelerating" ? "▼"
                              : p.trend === "stable" ? "→" : "—";
                            return (
                              <td key={pi} style={{ textAlign: "center", padding: "10px 6px" }}>
                                {p.velocity !== null ? (
                                  <div>
                                    <span style={{ color: velColor, fontWeight: 700, fontSize: 14 }}>
                                      {arrow} {p.velocity > 0 ? "+" : ""}{p.velocity}
                                    </span>
                                    <div style={{ fontSize: 10, color: "#E2E8F0", marginTop: 2 }}>
                                      score: {p.current}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: "#E2E8F0", fontSize: 11 }}>—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Insights */}
                  {(accel.length > 0 || decel.length > 0) && (
                    <div style={{ marginTop: 24, background: "#1E293B", borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B", marginBottom: 12 }}>TOP INSIGHTS</div>
                      {accel.slice(0, 3).map((a, i) => (
                        <div key={`a${i}`} style={{ fontSize: 12, color: "#10B981", marginBottom: 6 }}>
                          ▲ "{a.query}" on {a.platform}: +{a.velocity}/week — gaining traction
                        </div>
                      ))}
                      {decel.slice(0, 3).map((d, i) => (
                        <div key={`d${i}`} style={{ fontSize: 12, color: "#F87171", marginBottom: 6 }}>
                          ▼ "{d.query}" on {d.platform}: {d.velocity}/week — investigate competitor activity
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
