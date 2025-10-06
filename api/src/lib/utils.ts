// BACKEND · Utils (named exports only)

export const extractTaskShortIds = (text: string): number[] => {
  const ids = new Set<number>();
  const patterns = [/#task-(\d+)/gi, /task:(\d+)/gi];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) ids.add(Number(m[1]));
  }
  return [...ids];
};
