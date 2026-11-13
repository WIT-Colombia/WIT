import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { getPreferredLocation, savePreferredLocation } from "../services/authService";
import { clearSelectedLocation, getLocationSelection, resolveCoordinatesForLocality, resolveLocalityFromCoordinates, restorePreferredLocation, saveAutomaticLocation, saveSelectedLocation, subscribeToLocation, type Coordinates, type LocationSelection } from "../services/locationService";
import type { Locality } from "../data/locations";

type LocationContextValue = {
  selection: LocationSelection | null;
  setManualLocation: (locality: Locality) => Promise<void>;
  setAutomaticLocation: (coordinates: Coordinates) => Promise<void>;
  requestAutomaticLocation: () => Promise<Coordinates>;
  isRequesting: boolean;
  isReady: boolean;
  devicePermission: "checking" | "granted" | "prompt" | "denied" | "unavailable";
};

const LocationContext = createContext<LocationContextValue | null>(null);
let pendingRequest: Promise<Coordinates> | null = null;
const localityResolutionKeys = new Set<string>();

export function LocationProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [selection, setSelection] = useState<LocationSelection | null>(() => getLocationSelection());
  const [serverReady, setServerReady] = useState(false);
  const lastSynced = useRef("");
  const localRevision = useRef(0);
  const autoRefreshStarted = useRef(false);
  const [devicePermission, setDevicePermission] = useState<LocationContextValue["devicePermission"]>("checking");
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => subscribeToLocation(() => setSelection(getLocationSelection())), []);
  // A granted browser permission may be reused; a new permission prompt is
  // offered through a user-initiated button instead of interrupting navigation.
  useEffect(() => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setDevicePermission("unavailable");
      return;
    }
    if (!navigator.permissions?.query) {
      setDevicePermission("prompt");
      return;
    }
    let active = true;
    let permission: PermissionStatus | null = null;
    void navigator.permissions.query({ name: "geolocation" }).then((result) => {
      if (!active) return;
      permission = result;
      setDevicePermission(result.state);
      result.onchange = () => { if (active) setDevicePermission(result.state); };
    }).catch(() => { if (active) setDevicePermission("prompt"); });
    return () => { active = false; if (permission) permission.onchange = null; };
  }, []);

  // Restore the account's last location before attempting a new GPS reading.
  // Never overwrite a choice made while the server preference was loading.
  useEffect(() => {
    setServerReady(false);
    if (status !== "authenticated" || !user?.id) { lastSynced.current = ""; return; }
    let active = true;
    const initialRevision = localRevision.current;
    const owner = localStorage.getItem("wit-selected-location-owner");
    void getPreferredLocation().then((remote) => {
      if (!active) return;
      if (localRevision.current === initialRevision) {
        if (remote) restorePreferredLocation(remote);
        else if (owner && owner !== user.id) clearSelectedLocation();
      }
      localStorage.setItem("wit-selected-location-owner", user.id);
      setServerReady(true);
    }).catch(() => {
      // An unavailable preference API must not overwrite a stored value.
      if (active) setServerReady(false);
    });
    return () => { active = false; };
  }, [status, user?.id]);

  // Save an explicit selection after remote preferences are loaded. Only
  // authenticated accounts are synchronized; guests keep local state.
  useEffect(() => {
    if (status !== "authenticated" || !serverReady || !selection) return;
    const locality = selection.locality;
    const coordinates = selection.coordinates ?? null;
    const payload = { city: locality?.name ?? "Ubicación actual", region: locality?.context ?? null, country: "Colombia", name: locality ? `${locality.name}, ${locality.context}` : "Ubicación actual", latitude: coordinates?.lat ?? null, longitude: coordinates?.lng ?? null, mode: selection.mode === "automatic" ? "GPS" as const : "MANUAL" as const, resolution: selection.mode === "automatic" ? (selection.cityResolution === "resolved" ? "RESOLVED" as const : selection.cityResolution === "unavailable" ? "UNAVAILABLE" as const : "PENDING" as const) : "RESOLVED" as const, clientUpdatedAt: Date.now() };
    const key = JSON.stringify({ ...payload, clientUpdatedAt: undefined });
    if (lastSynced.current === key) return;
    lastSynced.current = key;
    void savePreferredLocation(payload).catch(() => { if (lastSynced.current === key) lastSynced.current = ""; });
  }, [selection, status, serverReady]);

  // Device coordinates are the first choice. On a first visit the browser
  // may show its native permission prompt; denial leaves manual selection open.
  // Returning users keep their last manual city. Granted GPS sessions refresh.
  useEffect(() => {
    const canUseDevice = devicePermission === "granted" || (devicePermission === "prompt" && !selection);
    if (!canUseDevice || autoRefreshStarted.current || status === "loading"
      || (status === "authenticated" && !serverReady) || selection?.mode === "manual") return;
    autoRefreshStarted.current = true;
    void requestAutomaticLocation().catch(() => { /* Keep last selection; manual choice remains available. */ });
  }, [devicePermission, selection?.mode, status, serverReady]);

  useEffect(() => {
    if (selection?.mode !== "automatic" || selection.cityResolution !== "pending") return;
    const coordinates = selection.coordinates;
    const resolutionKey = `${coordinates.lat}:${coordinates.lng}`;
    if (localityResolutionKeys.has(resolutionKey)) return;
    localityResolutionKeys.add(resolutionKey);
    void resolveLocalityFromCoordinates(coordinates).then((locality) => {
      const current = getLocationSelection();
      if (locality && current?.mode === "automatic"
        && current.coordinates.lat === coordinates.lat && current.coordinates.lng === coordinates.lng) {
        saveAutomaticLocation(coordinates, locality, "resolved");
      } else if (current?.mode === "automatic"
        && current.coordinates.lat === coordinates.lat && current.coordinates.lng === coordinates.lng) {
        saveAutomaticLocation(coordinates, current.locality, "unavailable");
      }
    });
  }, [selection]);

  async function requestAutomaticLocation(): Promise<Coordinates> {
    if (pendingRequest) return pendingRequest;
    if (!navigator.geolocation || !window.isSecureContext) throw new Error("GEOLOCATION_UNAVAILABLE");

    const revisionAtRequest = localRevision.current;
    setIsRequesting(true);
    pendingRequest = new Promise<Coordinates>((resolve, reject) => {
      try {
        // Keep this call directly inside the user action flow so browsers can
        // show their native permission prompt instead of treating it as a
        // background request.
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          reject,
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      } catch (error) {
        reject(error);
      }
    }).then(async (coordinates) => {
      // A manual choice made while GPS was pending takes precedence.
      if (localRevision.current !== revisionAtRequest) return coordinates;
      localRevision.current += 1;
      localityResolutionKeys.add(`${coordinates.lat}:${coordinates.lng}`);
      saveAutomaticLocation(coordinates);
      // Resolve the municipality once so GPS and manual selection share the
      // same city-level catalog fallback without inventing coordinates.
      const locality = await resolveLocalityFromCoordinates(coordinates);
      const current = getLocationSelection();
      if (locality && current?.mode === "automatic"
        && current.coordinates.lat === coordinates.lat && current.coordinates.lng === coordinates.lng) {
        saveAutomaticLocation(coordinates, locality, "resolved");
      } else if (current?.mode === "automatic"
        && current.coordinates.lat === coordinates.lat && current.coordinates.lng === coordinates.lng) {
        saveAutomaticLocation(coordinates, current.locality, "unavailable");
      }
      return coordinates;
    }).finally(() => {
      pendingRequest = null;
      setIsRequesting(false);
    });
    return pendingRequest;
  }

  async function setManualLocation(locality: Locality): Promise<void> {
    // Confirm the city immediately, without depending on Maps/geocoding.
    // Coordinates only enrich the choice later; a slow old lookup must not
    // restore an earlier city after another explicit selection.
    const revision = ++localRevision.current;
    saveSelectedLocation(locality);
    const coordinates = await resolveCoordinatesForLocality(locality);
    if (revision !== localRevision.current || !coordinates) return;
    const current = getLocationSelection();
    if (current?.mode === "manual" && current.locality.id === locality.id) {
      saveSelectedLocation(locality, coordinates);
    }
  }

  function setAutomaticLocation(coordinates: Coordinates): Promise<void> {
    localRevision.current += 1;
    saveAutomaticLocation(coordinates);
    const resolutionKey = `${coordinates.lat}:${coordinates.lng}`;
    if (localityResolutionKeys.has(resolutionKey)) return Promise.resolve();
    localityResolutionKeys.add(resolutionKey);
    return resolveLocalityFromCoordinates(coordinates).then((locality) => {
      const current = getLocationSelection();
      if (locality && current?.mode === "automatic"
        && current.coordinates.lat === coordinates.lat && current.coordinates.lng === coordinates.lng) {
        saveAutomaticLocation(coordinates, locality, "resolved");
      } else if (current?.mode === "automatic"
        && current.coordinates.lat === coordinates.lat && current.coordinates.lng === coordinates.lng) {
        saveAutomaticLocation(coordinates, current.locality, "unavailable");
      }
    });
  }

  const value = useMemo(() => ({ selection, setManualLocation, setAutomaticLocation, requestAutomaticLocation, isRequesting, devicePermission, isReady: status !== "loading" && (status !== "authenticated" || serverReady) }), [selection, isRequesting, devicePermission, status, serverReady]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocationContext debe usarse dentro de LocationProvider");
  return value;
}
