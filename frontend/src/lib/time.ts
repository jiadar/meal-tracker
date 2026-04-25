export function trimSeconds(t: string): string {
  return t.length > 5 ? t.slice(0, 5) : t;
}
