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
    providerSel.innerHTML = providers.map(p => `<option value="${p.id}">${p.id}</option>`).join("");
    const pref = localStorage.getItem("pmg.provider");
    if (pref && providers.find(p => p.id === pref)) providerSel.value = pref;
  } catch {
    providerSel.innerHTML = '<option value="echo">echo</option>';
  }
}
async function loadStats(){
  try {
    const r = await j("/api/ai/images/stats");
    statsBadge.textContent = `${r.count} images • keep ${r.maxCount} • ${r.maxAgeHours}h`;
  } catch {
    statsBadge.textContent = "stats unavailable";
  }
}
async function loadImages(){
  try {
    const { images } = await j("/api/ai/images");
    grid.innerHTML = images.map(i => `
      <article class="card">
        <a href="${i.url}" target="_blank" rel="noreferrer">
          <img class="thumb" src="${i.url}" alt="${i.file}" loading="lazy" />
        </a>
        <div class="bar">
          <span class="muted" title="${i.file}">${i.file.slice(0,22)}…</span>
          <div class="right"><a class="small" href="${i.url}" download>download</a></div>
        </div>
      </article>`).join("");
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
    if (provider === "openai") localStorage.setItem("pmg.provider", "openai");
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

