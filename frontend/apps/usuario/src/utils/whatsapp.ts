/** Business contacts are stored with their international country code. */
export function whatsappLink(phone: string): string | null {
  const digits = phone.trim().replace(/\D/g, "").replace(/^00/, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? `https://wa.me/${digits}` : null;
}
