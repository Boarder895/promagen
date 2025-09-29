import { remark } from "remark";
import remarkHtml from "remark-html";
import { loadMarkdownBySlug } from "@/lib/docs";

export const dynamic = "force-dynamic";

/** Add coloured chips based on leading markers inside list items. */
function decorateStatuses(html: string) {
  // Done: âœ… or [x] / [X]
  html = html.replace(
    /(<li>)\s*(?:âœ…|\[(?:x|X)\])\s*/g,
    `$1<span class="bp-badge bp-badge--done">Done</span> `
  );
  // In progress: ðŸŸ¡
  html = html.replace(
    /(<li>)\s*ðŸŸ¡\s*/g,
    `$1<span class="bp-badge bp-badge--wip">In&nbsp;progress</span> `
  );
  // Planned: ðŸŸª
  html = html.replace(
    /(<li>)\s*ðŸŸª\s*/g,
    `$1<span class="bp-badge bp-badge--plan">Planned</span> `
  );
  // To-do: [ ]
  html = html.replace(
    /(<li>)\s*\[\s\]\s*/g,
    `$1<span class="bp-badge bp-badge--todo">To-do</span> `
  );
  return html;
}

type Edition = { title: string; items: string[] };

/** Extract editions from a `## Changelog` section with `### <edition>` + bullets. */
function extractChangelog(md: string): Edition[] {
  const lines = md.split(/\r?\n/);

  let inChangelog = false;
  let current: Edition | null = null;
  const editions: Edition[] = [];

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("## ")) {
      // Enter/leave changelog block
      inChangelog = /^##\s*Changelog/i.test(line);
      if (!inChangelog) current = null;
      continue;
    }

    if (!inChangelog) continue;

    // Start a new edition
    if (line.startsWith("### ")) {
      if (current) editions.push(current);
      const title = line.replace(/^###\s*/, "").trim();
      current = { title, items: [] };
      continue;
    }

    // Collect bullet items for the current edition
    if (current && line.startsWith("- ")) {
      current.items.push(line.slice(2).trim());
    }
  }
  if (inChangelog && current) editions.push(current);

  return editions;
}

/** Ensure the history column always shows an edition for "today" (YYYY-MM-DD). */
function ensureTodayEdition(editions: Edition[]): Edition[] {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  if (editions.length === 0 || editions[0].title !== today) {
    // Prepend a new, empty edition for today; you can add bullets in Markdown later.
    return [{ title: today, items: [] }, ...editions];
  }
  return editions;
}

export default async function BuildPlanWithHistory() {
  // 1) Load your single source of truth
  const md = loadMarkdownBySlug("build-plan");

  // 2) Render main narrative (left)
  const processed = await remark().use(remarkHtml).process(md);
  let htmlStr = String(processed);
  htmlStr = decorateStatuses(htmlStr);

  // 3) Build history (right), auto-creating a "today" edition if needed
  const editions = ensureTodayEdition(extractChangelog(md));

  return (
    <main className="p-6">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .bp-grid {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 24px;
          }
          @media (max-width: 1100px) {
            .bp-grid { grid-template-columns: 1fr; }
            .bp-history { position: static; top: auto; }
          }
          .bp-badge {
            display:inline-flex; gap:.4rem; align-items:center;
            padding:.18rem .48rem; border-radius:999px;
            font-size:.72rem; line-height:1rem; border:1px solid currentColor;
            vertical-align:middle; white-space:nowrap;
          }
          .bp-badge--done { color:#0b7a30; background:#0b7a3010; border-color:#0b7a3030; }
          .bp-badge--wip  { color:#a35d00; background:#a35d0010; border-color:#a35d0030; }
          .bp-badge--plan { color:#6941c6; background:#6941c610; border-color:#6941c630; }
          .bp-badge--todo { color:#475467; background:#47546710; border-color:#47546730; }

          .markdown-body h1 { margin-bottom:.6rem; }
          .markdown-body h2 { margin-top:1.6rem; }
          .markdown-body li  { margin:.2rem 0; }

          .bp-history { position: sticky; top: 16px; height: max-content; }
          .bp-card { border:1px solid #e5e7eb; border-radius:16px; padding:12px; }
          .bp-edition { margin-bottom:12px; }
          .bp-edition h4 { margin:6px 0; font-size:.95rem; font-weight:600; }
          .bp-edition ul { margin:0; padding-left:18px; }
          .bp-edition li { margin:3px 0; font-size:.88rem; line-height:1.25rem; }
          .bp-empty { color:#6b7280; font-size:.85rem; }
        `,
        }}
      />

      <div className="bp-grid">
        {/* LEFT: your plan exactly as written */}
        <article className="markdown-body" dangerouslySetInnerHTML={{ __html: htmlStr }} />

        {/* RIGHT: auto history column */}
        <aside className="bp-history">
          <div className="bp-card">
            <h3 className="text-lg font-semibold">Build history</h3>
            {editions.map((ed, i) => (
              <div key={i} className="bp-edition">
                <h4>{ed.title}</h4>
                {ed.items.length === 0 ? (
                  <div className="bp-empty">
                    No entries yet. Add bullets under <code>## Changelog</code> â†’ <code>### {ed.title}</code> in <code>docs/build-plan.md</code>.
                  </div>
                ) : (
                  <ul>
                    {ed.items.map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

