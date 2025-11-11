// Clipboard helpers: use writeToClipboard for awaited UX, writeToClipboardFast for best-effort fire-and-forget.

export async function writeToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function writeToClipboardFast(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    // no-op fallback; some browsers block without user gesture
  }
}









