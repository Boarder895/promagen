import { Router } from "express";
import { prompts } from "../data/prompts";
import { getCounts, incLike, incRemix } from "../store/counters";

const router = Router();

function findPrompt(id: string) {
  return prompts.find((p) => p.id === id);
}

function withCounts(p: any) {
  const c = getCounts(p.id);
  return { ...p, likes: c.likes, uses: c.uses, remixes: c.remixes };
}

// ---------- READ ----------

router.get("/", (req, res) => {
  const q = String(req.query.q ?? "").toLowerCase().trim();
  const tag = String(req.query.tag ?? "").trim().toLowerCase();
  const sort = String(req.query.sort ?? "trending");
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

  let list = prompts.slice();

  if (q) {
    list = list.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.body.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.provider.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q)
    );
  }

  if (tag) list = list.filter((p) => p.tags.map((t) => t.toLowerCase()).includes(tag));

  // Overlay live counts
  let enriched = list.map(withCounts);

  if (sort === "likes") enriched.sort((a, b) => b.likes - a.likes);
  else if (sort === "uses") enriched.sort((a, b) => b.uses - a.uses);
  else if (sort === "createdAt")
    enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  else enriched.sort((a, b) => (b.likes * 2 + b.uses) - (a.likes * 2 + a.uses)); // trending

  const total = enriched.length;
  const items = enriched.slice(offset, offset + limit);

  res.json({ items, total, limit, offset });
});

router.get("/:id", (req, res) => {
  const p = findPrompt(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json(withCounts(p));
});

// ---------- WRITE (persisted) ----------

router.post("/:id/like", async (req, res) => {
  const p = findPrompt(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const c = await incLike(p.id);
  res.json({ id: p.id, likes: c.likes });
});

router.post("/:id/remix", async (req, res) => {
  const p = findPrompt(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const c = await incRemix(p.id);
  res.json({ id: p.id, uses: c.uses, remixes: c.remixes });
});

export default router;



