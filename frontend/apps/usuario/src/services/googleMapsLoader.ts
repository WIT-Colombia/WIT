type GoogleMapOptions = {
  center: { lat: number; lng: number };
  zoom: number;
  mapTypeId?: string;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  gestureHandling?: string;
};

export type GoogleMapInstance = {
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (event: string, handler: (payload: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
  fitBounds?: (bounds: GoogleBounds) => void;
};

export type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  setPosition: (position: { lat: number; lng: number }) => void;
  addListener: (event: string, handler: () => void) => void;
};

export type GoogleBounds = { extend: (point: { lat: number; lng: number }) => void };

type GoogleMapsNamespace = {
  Map: new (element: HTMLElement, options: GoogleMapOptions) => GoogleMapInstance;
  Marker: new (options: { map: GoogleMapInstance; position: { lat: number; lng: number }; title: string }) => GoogleMarkerInstance;
  LatLngBounds: new () => GoogleBounds;
  Geocoder?: new () => GoogleGeocoder;
};

export type GoogleMapsApi = GoogleMapsNamespace;

export type GoogleGeocoder = {
  geocode: (request: { address?: string; location?: { lat: number; lng: number } }, callback: (results: GoogleGeocoderResult[] | null, status: string) => void) => void;
};

export type GoogleGeocoderResult = {
  geometry?: { location?: { lat: () => number; lng: () => number } };
  address_components?: Array<{ long_name: string; types: string[] }>;
};

declare global {
  interface Window { google?: { maps?: Partial<GoogleMapsNamespace> }; gm_authFailure?: () => void; }
}

let loading: Promise<GoogleMapsApi> | null = null;
let callbackSequence = 0;

function validateNamespace(namespace: Partial<GoogleMapsNamespace> | undefined): GoogleMapsApi {
  if (!namespace) throw new Error("GOOGLE_MAPS_SDK_INVALID");
  const missing = (["Map", "Marker"] as const).filter(name => typeof namespace[name] !== "function");
  if (missing.length) throw new Error(`GOOGLE_MAPS_SDK_INVALID_CONSTRUCTORS:${missing.join(",")}`);
  return namespace as GoogleMapsApi;
}

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_JS_API_KEY?.trim();
  if (!apiKey) return Promise.reject(new Error("GOOGLE_MAPS_JS_KEY_MISSING"));

  const current = window.google?.maps;
  if (current?.Map && current.Marker) return Promise.resolve(current as GoogleMapsApi);
  if (loading) return loading;

  loading = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existing = document.getElementById("xamuko-google-maps-script") as HTMLScriptElement | null;
    // Never attach a new attempt to an incomplete script left by a previous loader.
    existing?.remove();
    const script = document.createElement("script");
    const globalWindow = window as unknown as Window & Record<string, (() => void) | undefined>;
    const callbackName = `__xamukoGoogleMapsReady_${++callbackSequence}`;
    const previousAuthFailure = window.gm_authFailure;
    let settled = false;
    let timeout: number | undefined;
    const cleanup = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      script.removeEventListener("error", handleScriptError);
      if (globalWindow[callbackName] === handleReady) delete globalWindow[callbackName];
      if (window.gm_authFailure === authFailure) window.gm_authFailure = previousAuthFailure;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(error);
    };
    const authFailure = () => {
      previousAuthFailure?.();
      fail(new Error("GOOGLE_MAPS_AUTH_FAILURE"));
    };
    const handleReady = () => {
      if (settled) return;
      try {
        const maps = validateNamespace(window.google?.maps);
        settled = true;
        cleanup();
        if (import.meta.env.DEV) console.info("[XAMUKO] Google Maps SDK ready", { map: typeof maps.Map, marker: typeof maps.Marker, geocoder: typeof maps.Geocoder });
        resolve(maps);
      } catch (error) {
        fail(error instanceof Error ? error : new Error("GOOGLE_MAPS_SDK_INVALID"));
      }
    };
    const handleScriptError = () => fail(new Error("GOOGLE_MAPS_SDK_FAILED"));

    globalWindow[callbackName] = handleReady;
    window.gm_authFailure = authFailure;
    script.id = "xamuko-google-maps-script";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${encodeURIComponent(callbackName)}`;
    script.addEventListener("error", handleScriptError, { once: true });
    timeout = window.setTimeout(() => fail(new Error("GOOGLE_MAPS_SDK_TIMEOUT")), 15000);
    document.head.appendChild(script);
  }).catch(error => {
    loading = null;
    if (import.meta.env.DEV) console.error("[XAMUKO] Google Maps SDK load failed", error);
    throw error;
  });
  return loading;
}
