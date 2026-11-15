import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from "./userDataService";

describe("XAMUKO Usuarios: notificaciones aisladas por cuenta", () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("mantiene separados los estados de lectura de dos personas en el mismo dispositivo", () => {
    expect(getNotifications("usuario-a")[0]?.read).toBe(false);
    expect(getNotifications("usuario-b")[0]?.read).toBe(false);
    markNotificationRead("welcome", "usuario-a");
    expect(getNotifications("usuario-a")[0]?.read).toBe(true);
    expect(getNotifications("usuario-b")[0]?.read).toBe(false);
    expect(storage.has("wit-notifications:usuario-a")).toBe(true);
    expect(storage.has("wit-notifications:usuario-b")).toBe(true);
    expect(storage.has("wit-notifications")).toBe(false);
  });

  it("no muestra ni altera mensajes locales cuando no hay sesión", () => {
    expect(getNotifications()).toEqual([]);
    expect(markNotificationRead("welcome")).toEqual([]);
    expect(markAllNotificationsRead()).toEqual([]);
    expect(deleteNotification("welcome")).toEqual([]);
    expect(storage.size).toBe(0);
  });

  it("no recrea un aviso eliminado ni lo elimina de otra cuenta", () => {
    getNotifications("usuario-a");
    getNotifications("usuario-b");
    expect(deleteNotification("welcome", "usuario-a")).toEqual([]);
    expect(getNotifications("usuario-a")).toEqual([]);
    expect(getNotifications("usuario-b")).toHaveLength(1);
    markAllNotificationsRead("usuario-b");
    expect(getNotifications("usuario-b")[0]?.read).toBe(true);
  });

  it("nunca migra automáticamente notificaciones antiguas de una clave compartida", () => {
    storage.set("wit-notifications", JSON.stringify([{ id: "private", title: "Dato privado", body: "Solo cuenta anterior", date: "Hoy", read: false }]));
    const fresh = getNotifications("usuario-b");
    expect(fresh.some(item => item.id === "private")).toBe(false);
  });
});
