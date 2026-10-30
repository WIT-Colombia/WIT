export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export { API_BASE_URL, buildApiUrl } from './api';
