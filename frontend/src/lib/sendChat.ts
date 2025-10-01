export async function sendChat(messages: {role:"system"|"user"|"assistant", content:string}[]) {
  const r = await fetch("http://localhost:4000/api/ai/openai/chat", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, messages })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data.text as string;
}


