/** Business contacts are stored with their international country code. */
export function whatsappLink(phone: string, message?: string): string | null {
  const digits = phone.trim().replace(/\D/g, "").replace(/^00/, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
}
