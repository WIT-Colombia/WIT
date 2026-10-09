export function validateEmail(value: string): string {
  const email = value.trim();
  if (!email) return "Escribe tu correo electrónico.";
  if (!email.includes("@")) return "Incluye el signo @ en tu correo electrónico.";
  const [local, domain, ...extra] = email.split("@");
  if (!local) return "Escribe la parte inicial de tu correo electrónico.";
  if (extra.length || !domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return "Escribe un dominio completo, por ejemplo correo.com.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Escribe un correo electrónico válido.";
  return "";
}
