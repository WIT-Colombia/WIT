export function displayInternalCode(code?: string | null) {
  if (!code) return "";
  const match = code.match(/^([PS])-(\d+)$/);
  return match ? `${match[1]}-${match[2].slice(-3).padStart(3, "0")}` : code;
}
