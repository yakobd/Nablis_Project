// Lets the apps translate the few user-facing strings produced by this
// package (presence labels…). Without a translator the English text is used.
type Translator = (key: string, vars?: Record<string, string | number>) => string | undefined;
let translator: Translator | null = null;

export function setSharedTranslator(fn: Translator | null) {
  translator = fn;
}

export function tx(key: string, fallback: string, vars?: Record<string, string | number>): string {
  const out = translator?.(key, vars);
  if (out) return out;
  return vars ? fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? '')) : fallback;
}
