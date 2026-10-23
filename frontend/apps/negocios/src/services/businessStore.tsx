import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { initialAccount, initialBusinesses, initialItems, initialNotifications, initialPreferences } from "../data/business.mock";
import type { BusinessAccount, BusinessDetails, BusinessNotification, CatalogItem, Preferences } from "../types/business";
import { DAY_IN_MS } from "./visibilityPolicy";
import { useBusinessAuth } from "./businessAuthContext";
import { businessApi } from "./businessApiClient";
import { toBusinessDetails } from "./realBusinessAdapter";

interface BusinessStore {
  business: BusinessDetails;
  businesses: BusinessDetails[];
  businessesReady: boolean;
  account: BusinessAccount;
  items: CatalogItem[];
  notifications: BusinessNotification[];
  persistentNotificationCount: number;
  preferences: Preferences;
  setBusiness: (value: BusinessDetails) => void;
  setBusinesses: (value: BusinessDetails[]) => void;
  setAccount: (value: BusinessAccount) => void;
  setItems: (value: CatalogItem[]) => void;
  setNotifications: (value: BusinessNotification[]) => void;
  setPreferences: (value: Preferences) => void;
}

const StoreContext = createContext<BusinessStore | null>(null);

const emptyBusiness: BusinessDetails = {
  role: "Propietario",
  name: "",
  category: "",
  description: "",
  city: "",
  address: "",
  phone: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  facebookUrl: "",
  xUrl: "",
  tiktokUrl: "",
  hours: "",
  status: "Pendiente",
  catalog: [],
  images: [],
  collaborators: [],
};

const isSameBusiness = (left: BusinessDetails, right: BusinessDetails) => {
  if (left.id && right.id) return left.id === right.id;
  return left === right;
};

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
  const location = useLocation();
  const isPreview = location.pathname === "/preview" || location.pathname.startsWith("/preview/");
  const [business, setBusiness] = useState<BusinessDetails>(() => isPreview ? stored("business", initialBusinesses[0]) : emptyBusiness);
  const [businesses, setBusinesses] = useState<BusinessDetails[]>(() => isPreview ? stored("businesses", initialBusinesses) : []);
  const [businessesReady, setBusinessesReady] = useState(isPreview);
  const auth = useBusinessAuth();
  const wasPreview = useRef(isPreview);
  useEffect(() => {
    if (!isPreview && wasPreview.current) setBusinesses([]);
    wasPreview.current = isPreview;
  }, [isPreview]);
  useEffect(() => {
    if (isPreview) {
      setBusinessesReady(true);
      return;
    }
    if (auth.state.status !== "authenticated") {
      setBusinessesReady(auth.state.status === "unauthenticated");
      return;
    }
    let active = true;
    setBusinessesReady(false);
    businessApi.list().then(({ businesses: values }) => {
      if (!active) return;
      const next = values.map(toBusinessDetails);
      setBusinesses(next);
      const storedId = localStorage.getItem("wit-negocios-selected-business-id");
      const preferred = next.find(item => item.id === business.id) ?? next.find(item => item.id === storedId) ?? next.find(item => item.publicationStatus === 'PUBLISHED' && item.visibilityStatus === 'VISIBLE') ?? next[0];
      if (preferred) setBusiness(preferred);
    }).catch(() => {
      // La página de negocios muestra el error detallado; aquí solo evitamos
      // bloquear la restauración de la URL si la API no está disponible.
    }).finally(() => {
      if (active) setBusinessesReady(true);
    });
    return () => { active = false; };
  }, [auth.state.status, isPreview, business.id]);
  useEffect(() => {
    if (business.id) localStorage.setItem("wit-negocios-selected-business-id", business.id);
  }, [business.id]);
  useEffect(() => {
    if (businesses.length === 0 && !isPreview) return;
    try { localStorage.setItem("wit-negocios-demo:businesses", JSON.stringify(businesses)); } catch { /* La aplicación sigue funcionando sin almacenamiento local. */ }
  }, [businesses, isPreview]);
  useEffect(() => {
    const oldDemo = ["Café del Barrio", "Casa Verde", "Taller Nómada"];
    const isOldDemo = businesses.length === 3 && businesses.every(item => oldDemo.includes(item.name));
    if (isPreview && isOldDemo) setBusinesses(initialBusinesses);
  }, [businesses]);
  useEffect(() => {
    if (!businesses.some(item => isSameBusiness(item, business))) setBusiness(businesses[0] ?? (isPreview ? initialBusinesses[0] : emptyBusiness));
  }, [business, businesses, isPreview]);
  useEffect(() => {
    if (!isPreview) return;
    const normalized = businesses.map(item => ({ ...item, ownerNickname: item.ownerNickname ?? initialAccount.nickname, role: (item.ownerNickname ?? initialAccount.nickname) === initialAccount.nickname ? "Propietario" as const : (item.role === "Colaborador" ? "Colaborador" as const : "Propietario" as const), ...(item.status === "Información incompleta" ? { status: "Pendiente" as const } : {}) }));
    if (normalized.some((item, index) => item.status !== businesses[index].status || item.role !== businesses[index].role || item.ownerNickname !== businesses[index].ownerNickname)) setBusinesses(normalized);
    const selected = normalized.find(item => isSameBusiness(item, business));
    if (selected && selected.status !== business.status) setBusiness(selected);
  }, [business, businesses]);
  const [account, setAccount] = useStoredState("account", initialAccount);
  useEffect(() => {
    if (isPreview || auth.state.status !== "authenticated") return;
    const current = auth.state.user;
    const next: BusinessAccount = { ...account, name: current.displayName, nickname: current.nickname ?? "", email: current.emailNormalized ?? "", phone: "" };
    if (account.name !== next.name || account.nickname !== next.nickname || account.email !== next.email || account.phone !== next.phone) setAccount(next);
  }, [account, auth.state, isPreview]);
  useEffect(() => {
    if (!isPreview || account.nickname) return;
    setAccount({ ...account, nickname: `@${account.name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}` });
  }, [account, isPreview]);
  const [items, setItems] = useState<CatalogItem[]>(() => isPreview ? stored("items", initialItems) : []);
  const [notifications, setNotifications] = useState<BusinessNotification[]>(() => isPreview ? stored("notifications", initialNotifications) : []);
  const [persistentNotificationCount, setPersistentNotificationCount] = useState(0);
  useEffect(() => {
    if (isPreview || auth.state.status !== "authenticated") { setPersistentNotificationCount(0); return; }
    let active = true;
    const refresh = () => { void businessApi.listBusinessNotifications().then(({ notifications: rows }) => { if (active) setPersistentNotificationCount(rows.filter(item => !item.readAt).length); }).catch(() => undefined); };
    const onUpdated = (event: Event) => { const count = (event as CustomEvent<number>).detail; if (typeof count === "number") setPersistentNotificationCount(count); else refresh(); };
    const refreshIfVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    const intervalId = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("xamuko-notifications-updated", onUpdated);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("xamuko-notifications-updated", onUpdated);
    };
  }, [auth.state, isPreview]);
  useEffect(() => {
    if (!isPreview) return;
    try { localStorage.setItem("wit-negocios-demo:items", JSON.stringify(items)); } catch { /* La vista previa continúa funcionando sin almacenamiento local. */ }
  }, [isPreview, items]);
  useEffect(() => {
    if (!isPreview) return;
    try { localStorage.setItem("wit-negocios-demo:notifications", JSON.stringify(notifications)); } catch { /* La vista previa continúa funcionando sin almacenamiento local. */ }
  }, [isPreview, notifications]);
  useEffect(() => {
    const pendingInvitation = notifications.find(item => item.type === "collaboration" && !item.read && item.businessName === "Café Central");
    if (!pendingInvitation?.invitationId) return;
    const targetName = "Droguería San Jorge";
    const target = businesses.find(item => item.name === targetName) ?? (isPreview ? initialBusinesses.find(item => item.name === targetName) : undefined);
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
  }, [account, businesses, notifications, isPreview]);
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
    const additions = reminders.map(item => ({ id: `visibility-reminder-${item.name}`, title: "Mantén visible tu negocio", description: `A tu negocio ${item.name} le quedan pocos días de visibilidad. Renueva ahora para que las personas sigan encontrándolo en XAMUKO.`, date: "Ahora", createdAt: new Date().toISOString(), type: "admin" as const, read: false, businessName: item.name, businessId: item.name }));
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
  return <StoreContext.Provider value={{ business, businesses, businessesReady, account, items, notifications, persistentNotificationCount, preferences, setBusiness, setBusinesses, setAccount, setItems, setNotifications, setPreferences }}>{children}</StoreContext.Provider>;
}

export function useBusinessStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("BusinessStoreProvider no está disponible");
  return store;
}
