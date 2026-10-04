const userBusinessIds: Record<string, string> = {
  "La Arepería de Majo": "arepa-majo",
  "Droguería San Jorge": "drogueria-central",
  "Casa del Tornillo": "casa-tornillo",
};

export function getUserPreviewUrl(name: string) {
  const id = userBusinessIds[name];
  const base = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname}:5174`
    : "";
  return id ? `${base}/business/${id}` : `${base}/home`;
}
