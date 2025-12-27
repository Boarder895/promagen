Assistant Memory policy (how we use ChatGPT memory)

Purpose:
Memory is used only for stable working preferences and process rules (e.g., “one full file”, “PowerShell only”, “ask for missing files”). It is not a source of truth for Promagen behaviour.

Authority:

- Canonical truth is the repo: docs/authority/\*\* and the code + tests.
- Assistant memory must never override repo authority docs or failing tests.
- Vercel Pro optimisation playbook (spend caps + WAF rules + observability): `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Monetisation boundary SSOT (what is free vs paid):
  `C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

  Hard rule: anything not written in `paid_tier.md` is free (standard Promagen).
  Any change to paid behaviour requires a docs update to `paid_tier.md` in the same PR.

Limits:

- Memory does not store your repo or file contents.
- In a new chat, the assistant may not have access to previous uploads; upload/paste the current file(s) when requesting edits.

Operational rule (anti-drift):

- If the assistant is asked to update a file but the current exact file contents (or required dependencies) are not provided in the chat, the assistant must stop and request the file(s) rather than guessing.
- When returning a “full file replacement”, it must be the COMPLETE file content (no omissions or shortening).
- No lines may be deleted or “simplified away” unless the user explicitly approves the change as REMOVE/REPLACE with line ranges.

How to use memory:

- “Remember: <rule>” to store a stable preference/process.
- “Forget: <rule>” to remove it.
- UI consistency rules (design language invariants: card-only containers, spacing/radius tokens, border/shadow discipline)

UI Consistency (anti-ugly drift): Card-only design language (global)

Purpose:
Promagen must feel calm and premium. Random container styles make pages feel “cheap” and users leave.

Hard rules (non-negotiable):

1. One box language only

   - Every visible container is a rounded “card” (panel).
   - Every row/list item inside a container is a smaller rounded “card”.
   - No ad-hoc panels, stripes, hard-edged boxes, or one-off wrappers.
   - If you think you need a new container style, you actually need a new _card variant_ (defined once, reused everywhere).

2. Spacing > decoration
   - Premium is created by consistent padding, consistent gaps, and consistent corner radius — not by extra visual tricks.
   - Use a single spacing scale (repeat the same p/x/y/gap values across pages).
   - Use a single radius scale (e.g., outer cards = “large”, inner cards = “medium”, pills/chips = “full”). Do not invent new radii.

Card shell discipline (what every card should look like):

- Shape: rounded rectangle (no sharp corners).
- Fill: muted charcoal/navy (dark dashboard base).
- Add a tiny “event taxonomy” section (authoritative) listing allowed `eventType` values and their relative weights, so nobody invents new names later and breaks aggregation.
- Make the Cron aggregation idempotent + backfillable by design (upsert + protected “run now” trigger), so bugs can be fixed without waiting a day for the next scheduled run.
- Border: 1px hairline, low-contrast (faint outline only; never loud).
- Depth: subtle separation only (light shadow OR gentle inner glow — never heavy, never multiple competing effects).
- Padding: consistent per card type (outer vs inner), never “whatever looks right this time”.

Forbidden patterns (fast way to spot drift):

- Mixing square and rounded containers on the same page.
- Thick borders, bright outlines, or high-contrast dividers.
- Random padding/margins between similar components.
- More than 2–3 visual “depth levels” (page → card → inner card; keep it simple).
- Any “special case” wrapper that isn’t a card.

Review gate (30-second check before shipping UI):

- Squint test: if you can see more than one box style, you broke the rule.
- Consistency test: same border weight, same radius family, same spacing rhythm across the page.
- Nesting test: sections are cards; rows are cards; nothing free-roams.

- “p” means: generate the best possible prompt for the next step (constraints + required inputs + definition of done + output format).
  From now on, when you send me a prompt, I’ll do three things in this order:

1. Answer your request normally.
2. Give two concrete improvements/extensions (like we’ve been doing).
3. Then I’ll add a “Prompt Optimiser” section where I:
   o Analyse your prompt (what it’s asking, what’s ambiguous, what constraints matter, what inputs are missing/assumed)
   o Rewrite it into a tighter, “gold standard” prompt that’s more likely to get the exact result you want first time
   Two upgrades to make this even more bulletproof:
   • Add a “Change List” discipline every time (REMOVE / REPLACE / ADD only, exactly as you wrote). That prevents accidental rewrites and missing detail.
   • Add “Truth Anchors with file paths” (e.g. gateway/providers.ts prod TTL must remain 30m) so I can’t drift into “implied” behaviour or invent constraints.
   Docs-first gate (no code until docs are read + doc-delta captured)

- Line-specific edit map (REQUIRED when updating an existing document):
  - ADD: “Insert after line X” (or “Insert between lines X and Y”)
  - REPLACE: “Replace lines X–Y with:” + paste the full replacement block
  - REMOVE: “Delete lines X–Y” (and state why, in one sentence)
- When you ask “does anything need updating in the docs?” or “tell me which lines need deleting or amending”:
  - I must answer with the exact line range(s) to REMOVE/REPLACE (not just the heading name).

Purpose:
Stop drift. If the docs are the authority, then code must never be produced “in front of” the docs.

Hard rule:
Before any new code or new files can be written, the assistant must read the current authority docs set, decide whether any doc needs updating, and (if needed) provide a paste-ready doc update plan first.

Authority docs set (must be read before code output):

- C:\Users\Proma\Desktop\Promagen Files\GA4 & GTM Configuration in Next.js (Vercel).md
- C:\Users\Proma\Desktop\Promagen Files\Best_Working_Practice.md
- C:\Users\Proma\Desktop\Promagen Files\Best_Working_Practice.docx
- C:\Users\Proma\Desktop\Promagen Files\Ribbon \_Homepage.md
- C:\Users\Proma\Desktop\Promagen Files\promagen-api-brain-v2.md
- C:\Users\Proma\Desktop\Promagen Files\code-standard.md
- C:\Users\Proma\Desktop\Promagen Files\API_Documentation_Twelvedata.md
- C:\Users\Proma\Desktop\Promagen Files\Fly.v2.md

No-duplication rule (prevents doc bloat):

- Not all docs need updating for every change.
- The assistant must update only the single “best-fit” document for the topic to avoid duplication.
- If another doc needs awareness, add a single-line pointer (“Authority for this rule lives in: <doc>”), not a second full copy.

Required “Doc Delta” preface (must appear before any code/files are produced):

- Docs read: Yes (list the authority docs read)
- Doc updates required: Yes/No
- If Yes:
  - Target doc: <full path>
  - Reason: <what changed / what is drifting>
  - Exact insertion point: <heading name or line range>
  - Paste-ready text: <full block to insert>
- Only after the Doc Delta is captured may code or new files be produced.

Definition of “needs a doc update” (detailed, not vague):
A doc update is required whenever a change affects any of:

- Behavioural contracts (API shapes, modes, flags, caching, budgets, trace)
- SSOT sources/paths, ordering rules, formatting rules (e.g., AUD / GBP label constraints)
- Analytics/tracking behaviour (events, GTM/GA4 wiring, consent/PII rules)
- Analytics-derived UI metrics (e.g., Promagen Users flags, Online Now presence): ship the full pipeline (capture → store → aggregate/presence → loader → render) **in the same feature delivery**, with a freshness guard (blank/“—” when stale/unavailable). Deduplicate by sessionId, heartbeat only when page is visible, weight submit/success higher than click/open, and optionally exclude obvious bots.
- Deployment/runtime policy (Vercel/Fly env vars, secrets, headers, cache behaviour)
- Provider integrations (rate limits, symbol formats, call limits, quotas, budget guard logic)
- Testing invariants (new lock-in tests, renamed exports, type shape expectations)

Prompt Optimiser
Prompt analysis (what makes answers go wrong):
• Prompts fail when they contain goals (“calm UI, no extra cost”) without an authority model (“who is allowed to say no, where is enforced, what are the invariants”).
• Prompts also fail when they ask for an “update” but don’t explicitly forbid deletion/re-ordering, or don’t require a word-count floor + changelog (you fixed this nicely).
Reworded “best version” prompt (copy/paste template you can reuse):
TASK: Answer my request, then optimise my prompt for next time.
RULES:

1. Do the task first.
2. Then give exactly TWO improvements/extensions.
3. Then include a section titled “Prompt Optimiser” where you:
   o State the implied assumptions you detected
   - Implementation map (routes + files + delivery approach): see `docs/authority/vercel-pro-promagen-playbook.md` §5.5.
     o List missing inputs you would normally need (but do NOT ask questions unless truly blocking)
     o Rewrite my prompt into the most precise version possible, preserving my intent and constraints
     CONSTRAINTS (always apply unless I override):
     • British English
     • No summarising unless I explicitly ask
     • No re-ordering or deleting content unless I explicitly mark REMOVE/REPLACE
     • If documents are involved: word count must be >= current doc word count and include a changelog
     • If code is involved: full files only, ready to cut-and-paste
     MY PROMPT:
     <PASTE MY PROMPT HERE>
     INPUTS (if relevant):
     • Current doc / file(s): <paste>
     • Allowed changes (REMOVE/REPLACE/ADD): <paste>
     • Truth anchors (must not contradict): <paste>
     OUTPUT FORMAT:
     • Main answer
     • Two improvements
     • Prompt Optimiser:
     o Analysis
     o Rewritten prompt (final)
