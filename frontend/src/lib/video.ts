// No "use client" here ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â safe for server or client imports.

export function youtubeIdFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id || null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch" && u.searchParams.get("v")) {
        return u.searchParams.get("v");
      }
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "shorts" && parts[1]) return parts[1];
      // already an /embed/<id> form?
      const m = u.pathname.match(/embed\/([^/]+)/);
      if (m) return m[1];
    }
    // last fallback
    const m = url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function youtubeEmbed(url: string): string | null {
  const id = youtubeIdFromUrl(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function youtubeThumb(url: string): string | null {
  const id = youtubeIdFromUrl(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}




