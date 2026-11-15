export function displayInternalCode(code?: string | null) {
  if (!code) return "";
  const match = code.match(/^([PS])-(\d+)$/);
  return match ? `${match[1]}-${match[2].padStart(match[1] === "P" ? 4 : 3, "0")}` : code;
}
