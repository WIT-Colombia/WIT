import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocationSelection, saveAutomaticLocation, saveSelectedLocation, subscribeToLocation, type Coordinates, type LocationSelection } from "../services/locationService";
import type { Locality } from "../data/locations";

type LocationContextValue = {
  selection: LocationSelection | null;
  setManualLocation: (locality: Locality) => void;
  setAutomaticLocation: (coordinates: Coordinates) => void;
  requestAutomaticLocation: () => Promise<Coordinates>;
  isRequesting: boolean;
};

const LocationContext = createContext<LocationContextValue | null>(null);
let pendingRequest: Promise<Coordinates> | null = null;

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<LocationSelection | null>(() => getLocationSelection());
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => subscribeToLocation(() => setSelection(getLocationSelection())), []);

  async function requestAutomaticLocation(): Promise<Coordinates> {
    if (selection?.mode === "automatic") return selection.coordinates;
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
    }).then((coordinates) => {
      saveAutomaticLocation(coordinates);
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

  function setAutomaticLocation(coordinates: Coordinates): void {
    saveAutomaticLocation(coordinates);
  }

  const value = useMemo(() => ({ selection, setManualLocation, setAutomaticLocation, requestAutomaticLocation, isRequesting }), [selection, isRequesting]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocationContext debe usarse dentro de LocationProvider");
  return value;
}
