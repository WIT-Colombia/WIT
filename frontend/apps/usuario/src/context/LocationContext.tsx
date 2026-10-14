import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocationSelection, resolveLocalityFromCoordinates, saveAutomaticLocation, saveSelectedLocation, subscribeToLocation, type Coordinates, type LocationSelection } from "../services/locationService";
import type { Locality } from "../data/locations";

type LocationContextValue = {
  selection: LocationSelection | null;
  setManualLocation: (locality: Locality) => void;
  setAutomaticLocation: (coordinates: Coordinates) => Promise<void>;
  requestAutomaticLocation: () => Promise<Coordinates>;
  isRequesting: boolean;
};

const LocationContext = createContext<LocationContextValue | null>(null);
let pendingRequest: Promise<Coordinates> | null = null;
const localityResolutionKeys = new Set<string>();

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<LocationSelection | null>(() => getLocationSelection());
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => subscribeToLocation(() => setSelection(getLocationSelection())), []);
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
    if (selection?.mode === "automatic" && selection.cityResolution === "resolved") return selection.coordinates;
    if (pendingRequest) return pendingRequest;
    if (!navigator.geolocation) throw new Error("GEOLOCATION_UNAVAILABLE");

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

  function setManualLocation(locality: Locality): void {
    saveSelectedLocation(locality);
  }

  function setAutomaticLocation(coordinates: Coordinates): Promise<void> {
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

  const value = useMemo(() => ({ selection, setManualLocation, setAutomaticLocation, requestAutomaticLocation, isRequesting }), [selection, isRequesting]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocationContext debe usarse dentro de LocationProvider");
  return value;
}
