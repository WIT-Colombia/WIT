import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialAccount, initialBusinesses, initialItems, initialNotifications, initialPreferences } from "../data/business.mock";
import type { BusinessAccount, BusinessDetails, BusinessNotification, CatalogItem, Preferences } from "../types/business";
import { DAY_IN_MS } from "./visibilityPolicy";

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
    const isOldDemo = businesses.length === 3 && businesses.every(item => oldDemo.includes(item.name));
    if (isOldDemo) setBusinesses(initialBusinesses);
  }, [businesses]);
  useEffect(() => {
    if (!businesses.some(item => item.name === business.name)) setBusiness(businesses[0] ?? initialBusinesses[0]);
  }, [business, businesses]);
  useEffect(() => {
    const normalized = businesses.map(item => ({ ...item, ownerNickname: item.ownerNickname ?? initialAccount.nickname, role: (item.ownerNickname ?? initialAccount.nickname) === initialAccount.nickname ? "Propietario" as const : (item.role === "Colaborador" ? "Colaborador" as const : "Propietario" as const), ...(item.status === "Información incompleta" ? { status: "Pendiente" as const } : {}) }));
    if (normalized.some((item, index) => item.status !== businesses[index].status || item.role !== businesses[index].role || item.ownerNickname !== businesses[index].ownerNickname)) setBusinesses(normalized);
    const selected = normalized.find(item => item.name === business.name);
    if (selected && selected.status !== business.status) setBusiness(selected);
  }, [business, businesses]);
  const [account, setAccount] = useStoredState("account", initialAccount);
  useEffect(() => {
    if (!account.nickname) setAccount({ ...account, nickname: `@${account.name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}` });
  }, [account]);
  const [items, setItems] = useStoredState("items", initialItems);
  const [notifications, setNotifications] = useStoredState("notifications", initialNotifications);
  useEffect(() => {
    const pendingInvitation = notifications.find(item => item.type === "collaboration" && !item.read && item.businessName === "Café Central");
    if (!pendingInvitation?.invitationId) return;
    const targetName = "Droguería San Jorge";
    const target = businesses.find(item => item.name === targetName) ?? initialBusinesses.find(item => item.name === targetName);
    if (!target) return;
    const collaborator = { id: pendingInvitation.invitationId, nickname: account.nickname, name: account.name, email: account.email.toLowerCase(), role: "Colaborador" as const, active: false, invitationMethod: "email" as const };
    const nextBusinesses = businesses.some(item => item.name === targetName) ? businesses.map(item => {
      if (item.name === "Café Central") return { ...item, collaborators: (item.collaborators ?? []).filter(entry => entry.id !== pendingInvitation.invitationId) };
      if (item.name === targetName) return { ...item, ownerNickname: item.ownerNickname ?? "@carlos.garcia", role: "Colaborador" as const, collaborators: [...(item.collaborators ?? []).filter(entry => entry.id !== pendingInvitation.invitationId), collaborator] };
      return item;
    }) : [...businesses.map(item => item.name === "Café Central" ? { ...item, ownerNickname: account.nickname, role: "Propietario" as const, collaborators: (item.collaborators ?? []).filter(entry => entry.id !== pendingInvitation.invitationId) } : { ...item, collaborators: (item.collaborators ?? []).filter(entry => entry.id !== pendingInvitation.invitationId) }), { ...target, ownerNickname: "@carlos.garcia", role: "Colaborador" as const, collaborators: [...(target.collaborators ?? []), collaborator] }];
    const nextNotifications = notifications.map(item => item.id === pendingInvitation.id ? { ...item, title: `Invitación para administrar ${targetName}`, description: `Te invitaron a administrar ${targetName}. Acepta la invitación para comenzar a gestionarlo.`, businessName: targetName, businessId: targetName } : item);
    setBusinesses(nextBusinesses);
    setNotifications(nextNotifications);
  }, [account, businesses, notifications]);
  const [preferences, setPreferences] = useStoredState("preferences", initialPreferences);
  useEffect(() => {
    const now = Date.now();
    const reminders = businesses.filter(item => item.role === "Propietario").map(item => {
      const untilValue = preferences.visibilityByBusiness?.[item.name]?.visibilityUntil ?? preferences.visibilityUntil;
      if (!untilValue) return null;
      const daysLeft = Math.ceil((new Date(untilValue).getTime() - now) / DAY_IN_MS);
      return daysLeft > 0 && daysLeft <= 39 && !notifications.some(note => note.id === `visibility-reminder-${item.name}`) ? item : null;
    }).filter((item): item is BusinessDetails => Boolean(item));
    if (!reminders.length) return;
    const additions = reminders.map(item => ({ id: `visibility-reminder-${item.name}`, title: "Mantén visible tu negocio", description: `A tu negocio ${item.name} le quedan pocos días de visibilidad. Renueva ahora para que las personas sigan encontrándolo en WIT.`, date: "Ahora", createdAt: new Date().toISOString(), type: "admin" as const, read: false, businessName: item.name, businessId: item.name }));
    setNotifications([...notifications, ...additions]);
  }, [businesses, preferences, notifications]);
  useEffect(() => {
    const demoVisibilityKey = "wit-negocios-demo:near-visibility-date-v3";
    try {
      if (!localStorage.getItem(demoVisibilityKey) && preferences.profileVisible) {
        const nearDate = new Date(Date.now() + 7 * DAY_IN_MS).toISOString();
        setPreferences({ ...preferences, visibilityUntil: nearDate, visibilityByBusiness: { ...(preferences.visibilityByBusiness ?? {}), [business.name]: { profileVisible: true, visibilityUntil: nearDate } } });
        localStorage.setItem(demoVisibilityKey, "true");
      }
    } catch { /* La demostración continúa con la fecha guardada. */ }
  }, []);
  return <StoreContext.Provider value={{ business, businesses, account, items, notifications, preferences, setBusiness, setBusinesses, setAccount, setItems, setNotifications, setPreferences }}>{children}</StoreContext.Provider>;
}

export function useBusinessStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("BusinessStoreProvider no está disponible");
  return store;
}
