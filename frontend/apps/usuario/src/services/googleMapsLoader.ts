type GoogleMapOptions = {
  center: { lat: number; lng: number };
  zoom: number;
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
  Geocoder: new () => GoogleGeocoder;
};

export type GoogleGeocoder = {
  geocode: (request: { address: string }, callback: (results: GoogleGeocoderResult[] | null, status: string) => void) => void;
};

export type GoogleGeocoderResult = {
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

declare global {
  interface Window { google?: { maps?: GoogleMapsNamespace }; }
}

let loading: Promise<GoogleMapsNamespace> | null = null;

export function loadGoogleMaps(): Promise<GoogleMapsNamespace> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_JS_API_KEY?.trim();
  if (!apiKey) return Promise.reject(new Error("GOOGLE_MAPS_JS_KEY_MISSING"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loading) return loading;

  loading = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const existing = document.getElementById("xamuko-google-maps-script") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.id = "xamuko-google-maps-script";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.addEventListener("load", () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("GOOGLE_MAPS_SDK_INVALID")), { once: true });
    script.addEventListener("error", () => reject(new Error("GOOGLE_MAPS_SDK_FAILED")), { once: true });
    if (!existing) document.head.appendChild(script);
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
