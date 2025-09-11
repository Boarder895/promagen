import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const r = Router();
const html = (s: TemplateStringsArray, ...v: any[]) => s.map((x,i)=>x+(v[i]??"")).join("");

r.get("/", (_req, res) => {
  res.type("html").send(html`
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Promagen • Image Playground</title>
<style>
  :root { color-scheme: light dark; --bg:#0b0b0b; --fg:#eaeaea; --muted:#9aa0a6; --card:#111; --accent:#6aa9ff; --danger:#ff6a6a; }
  body{font:14px/1.35 system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:var(--bg);color:var(--fg)}
  header{padding:16px 20px;border-bottom:1px solid #222;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  h1{font-size:16px;margin:0 8px 0 0}
  .pill{background:#191919;border:1px solid #222;border-radius:999px;padding:6px 10px}
  main{display:grid;grid-template-columns:360px 1fr;gap:16px;padding:16px}
  @media (max-width:900px){ main{grid-template-columns:1fr} }
  form{display:grid;gap:10px;background:var(--card);border:1px solid #222;border-radius:12px;padding:12px}
  label{display:grid;gap:6px}
  input,select,textarea{background:#0f0f10;border:1px solid #2a2a2a;border-radius:8px;color:var(--fg);padding:8px}
  textarea{min-height:100px;resize:vertical}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  button{cursor:pointer;border:1px solid #2a2a2a;background:#151515;color:var(--fg);padding:10px 12px;border-radius:10px}
  button.primary{background:var(--accent);border-color:#478fff;color:#07162b;font-weight:600}
  button[disabled]{opacity:.6;cursor:wait}
  .actions{display:flex;gap:8px;align-items:center}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
  .card{background:var(--card);border:1px solid #222;border-radius:12px;overflow:hidden}
  .thumb{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#0f0f0f}
  .muted{color:var(--muted);font-size:12px}
  .error{color:var(--danger);font-weight:600}
  .bar{display:flex;justify-content:space-between;gap:8px;padding:8px}
  .right{display:flex;gap:8px}
  .small{padding:6px 8px;font-size:12px}
</style>
</head>
<body>
<header>
  <h1>Promagen</h1>
  <span class="pill muted">Image Playground</span>
  <span id="stats" class="pill muted">loading…</span>
</header>

<main>
  <section>
    <form id="genForm">
      <label>
        Provider
        <select id="provider"><option value="">(loading…)</option></select>
      </label>
      <div class="row">
        <label>
          Model (optional)
          <input id="model" placeholder="leave blank" />
        </label>
        <label>
          Size
          <input id="size" value="1024x1024" />
        </label>
      </div>
      <label>
        Prompt
        <textarea id="prompt" placeholder="mushroom village, glowing caps, cinematic, highly detailed"></textarea>
      </label>
      <div class="actions">
        <button id="go" class="primary" type="submit">Generate</button>
        <button id="clear" type="button">Clear gallery</button>
        <span id="msg" class="muted"></span>
      </div>
    </form>
  </section>

  <section>
    <div class="grid" id="grid"></div>
  </section>
</main>

<script>
const $ = (s) => document.querySelector(s);
const providerSel = $("#provider"), grid = $("#grid"), msg = $("#msg"), statsBadge = $("#stats"), go = $("#go");

async function j(url, opts){
  const r = await fetch(url, opts);
  const t = await r.text();
  if (!r.ok) throw new Error(t || (r.status + " " + r.statusText));
  try { return JSON.parse(t); } catch { return t; }
}
function showError(e){ console.error(e); msg.textContent = e.message || String(e); msg.classList.add("error"); }
function clearMsg(){ msg.textContent = ""; msg.classList.remove("error"); }

async function loadProviders(){
  try {
    const { providers } = await j("/api/ai/providers");
    if (!providers?.length) throw new Error("No providers available");
    providerSel.innerHTML = providers.map(p => \`<option value="\${p.id}">\${p.id}</option>\`).join("");
    const pref = localStorage.getItem("pmg.provider");
    if (pref && providers.find(p => p.id === pref)) providerSel.value = pref;
  } catch {
    providerSel.innerHTML = '<option value="echo">echo</option>'; // fallback that always works
  }
}
async function loadStats(){ try { const r = await j("/api/ai/images/stats"); statsBadge.textContent = \`\${r.count} images • keep \${r.maxCount} • \${r.maxAgeHours}h\`; } catch { statsBadge.textContent = "stats unavailable"; } }
async function loadImages(){
  try {
    const { images } = await j("/api/ai/images");
    grid.innerHTML = images.map(i => \`
      <article class="card">
        <a href="\${i.url}" target="_blank" rel="noreferrer">
          <img class="thumb" src="\${i.url}" alt="\${i.file}" loading="lazy" />
        </a>
        <div class="bar">
          <span class="muted" title="\${i.file}">\${i.file.slice(0,22)}…</span>
          <div class="right"><a class="small" href="\${i.url}" download>download</a></div>
        </div>
      </article>\`).join("");
  } catch (e){ showError(e); }
}
async function generate(e){
  e.preventDefault();
  clearMsg(); go.disabled = true;
  try{
    const provider = (providerSel.value || "echo").trim();
    const model = ($("#model").value || "").trim() || undefined;
    const size = ($("#size").value || "").trim() || undefined;
    const prompt = ($("#prompt").value || "").trim();
    if (!prompt) throw new Error("Prompt is required.");

    const data = await j("/api/ai/image", {
      method:"POST",
      headers:{ "content-type":"application/json" },
      body: JSON.stringify({ provider, model, prompt, size })
    });

    msg.textContent = "saved: " + (data.file || "");
    await loadStats(); await loadImages();
    if (data.localUrl) window.open(data.localUrl, "_blank");
  }catch(err){ showError(err); }
  finally { go.disabled = false; }
}
async function clearGallery(){
  clearMsg(); if(!confirm("Delete all images?")) return; go.disabled = true;
  try{ await j("/api/ai/images/clear", { method:"POST" }); await loadStats(); await loadImages(); msg.textContent = "cleared."; }
  catch(err){ showError(err); }
  finally{ go.disabled = false; }
}
document.getElementById("genForm").addEventListener("submit", generate);
document.getElementById("clear").addEventListener("click", clearGallery);
Promise.all([loadProviders(), loadStats(), loadImages()]);
</script>
</body>
</html>
  `);
});

r.get("/favicon.ico", (_req, res) => {
  const p = path.join(process.cwd(), "public", "favicon.ico");
  if (fs.existsSync(p)) res.sendFile(p); else res.status(204).end();
});

export default r;

