// frontend/src/lib/os.ts
export function isMac(): boolean {
  if (typeof navigator === "undefined") {return false;}
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function pasteShortcut(): string {
  return isMac() ? "Cmd+V" : "Ctrl+V";
}




