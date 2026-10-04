import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialAccount, initialBusinesses, initialItems, initialNotifications, initialPreferences } from "../data/business.mock";
import type { BusinessAccount, BusinessDetails, BusinessNotification, CatalogItem, Preferences } from "../types/business";

interface BusinessStore {
  business: BusinessDetails;
  businesses: BusinessDetails[];
  account: BusinessAccount;
  items: CatalogItem[];
  notifications: BusinessNotification[];
  preferences: Preferences;
  setBusiness: (value: BusinessDetails) => void;
  setBusinesses: (value: BusinessDetails[]) => void;
  setAccount: (value: BusinessAccount) => void;
  setItems: (value: CatalogItem[]) => void;
  setNotifications: (value: BusinessNotification[]) => void;
  setPreferences: (value: Preferences) => void;
}

const StoreContext = createContext<BusinessStore | null>(null);

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`wit-negocios-demo:${key}`);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function useStoredState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => stored(key, fallback));
  useEffect(() => {
    try { localStorage.setItem(`wit-negocios-demo:${key}`, JSON.stringify(value)); } catch { /* La demo sigue funcionando sin almacenamiento. */ }
  }, [key, value]);
  return [value, setValue];
}

export function BusinessStoreProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useStoredState("business", initialBusinesses[0]);
  const [businesses, setBusinesses] = useStoredState("businesses", initialBusinesses);
  useEffect(() => {
    const oldDemo = ["Café del Barrio", "Casa Verde", "Taller Nómada"];
    const canonicalNames = initialBusinesses.map(item => item.name);
    const isOldDemo = businesses.length === 3 && businesses.every(item => oldDemo.includes(item.name));
    const isWitUsersDemo = businesses.length === 3 && businesses.every((item, index) => item.name === canonicalNames[index]);
    if (isOldDemo || (isWitUsersDemo && JSON.stringify(businesses) !== JSON.stringify(initialBusinesses))) setBusinesses(initialBusinesses);
  }, [businesses]);
  useEffect(() => {
    if (!businesses.some(item => item.name === business.name)) setBusiness(businesses[0] ?? initialBusinesses[0]);
  }, [business, businesses]);
  useEffect(() => {
    const normalized = businesses.map(item => item.status === "Información incompleta" ? { ...item, status: "Pendiente" as const } : item);
    if (normalized.some((item, index) => item.status !== businesses[index].status)) setBusinesses(normalized);
    const selected = normalized.find(item => item.name === business.name);
    if (selected && selected.status !== business.status) setBusiness(selected);
  }, [business, businesses]);
  const [account, setAccount] = useStoredState("account", initialAccount);
  const [items, setItems] = useStoredState("items", initialItems);
  const [notifications, setNotifications] = useStoredState("notifications", initialNotifications);
  const [preferences, setPreferences] = useStoredState("preferences", initialPreferences);
  return <StoreContext.Provider value={{ business, businesses, account, items, notifications, preferences, setBusiness, setBusinesses, setAccount, setItems, setNotifications, setPreferences }}>{children}</StoreContext.Provider>;
}

export function useBusinessStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("BusinessStoreProvider no está disponible");
  return store;
}
