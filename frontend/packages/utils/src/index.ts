export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Accept only routes inside the current application, never a URL to another host. */
export function safeAppReturn(value: string | null | undefined, fallback: string, blocked: string[] = []): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://application.invalid');
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://application.invalid' || /[\\\u0000-\u0020]/.test(decodedPath) || decodedPath.startsWith('//')) return fallback;
    const path = decodedPath.replace(/\/+$/, '').toLowerCase() || '/';
    if (blocked.some(item => path === item || path.startsWith(`${item}/`))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
