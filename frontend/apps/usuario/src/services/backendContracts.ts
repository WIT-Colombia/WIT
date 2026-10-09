import type { Business, Product, Review, Service } from "../data/mockData";

/** Estados que cada consulta del backend podrá representar en la interfaz. */
export type ResourceStatus = "idle" | "loading" | "success" | "empty" | "error";

export type ResourceState<T> =
  | { status: "idle" | "loading"; data: T | null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "empty"; data: T; error: null }
  | { status: "error"; data: T | null; error: string };

export type BusinessSearchParams = {
  query?: string;
  category?: string;
  locationId?: string;
  radiusKm?: 1 | 3 | "city";
  openNow?: boolean;
};

export type UserSession = {
  id: string;
  name: string;
  email: string;
  provider: "email" | "google" | "facebook";
  avatarUrl?: string;
};

export type UserNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
};

/** Contrato único para sustituir los datos de muestra sin cambiar las pantallas. */
export interface UsuarioBackendClient {
  searchBusinesses(params: BusinessSearchParams): Promise<Business[]>;
  getBusiness(id: string): Promise<Business | null>;
  getProducts(businessId: string): Promise<Product[]>;
  getServices(businessId: string): Promise<Service[]>;
  getReviews(businessId: string): Promise<Review[]>;
  getSession(): Promise<UserSession | null>;
  updateSession(data: Partial<Pick<UserSession, "name" | "avatarUrl">>): Promise<UserSession>;
  toggleFavorite(businessId: string, saved: boolean): Promise<void>;
  toggleLike(entityId: string, entityType: "product" | "service", liked: boolean): Promise<void>;
  submitReview(businessId: string, rating: number, comment: string): Promise<Review>;
  getNotifications(): Promise<UserNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
}
