import React, { useState } from "react";

export default function ImagePlayground() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [status, setStatus] = useState("");
  const [img, setImg] = useState<string | null>(null);

  const generate = async () => {
    setStatus("Generating…");
    setImg(null);
    try {
      const r = await fetch("/api/ai/openai/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error?.message || j.error || "Failed");
      setImg(j.dataUrl as string);
      setStatus("Done.");
    } catch (e: any) {
      setStatus("Error: " + (e.message ?? "Unknown"));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Image Playground</h1>
      <p>Credits are disabled; this calls <code>/api/ai/openai/images</code> directly.</p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the image…"
        rows={6}
        style={{ width: "100%" }}
      />
      <div style={{ margin: "8px 0" }}>
        <label>Size:{" "}
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option>1024x1024</option>
            <option>768x768</option>
            <option>512x512</option>
          </select>
        </label>
      </div>
      <button onClick={generate}>Generate</button>
      <div style={{ marginTop: 8 }}>{status}</div>
      {img && <img src={img} alt="generated" style={{ maxWidth: "100%", marginTop: 12 }} />}
    </div>
  );
}
