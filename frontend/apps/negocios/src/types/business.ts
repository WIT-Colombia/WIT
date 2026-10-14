export type CatalogKind = "product" | "service";
export type BusinessRole = "Propietario" | "Colaborador";

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  category: string;
  description: string;
  price: string;
  image: string;
  images?: string[];
  priceNegotiable?: boolean;
  active: boolean;
  interest: number;
}

export interface BusinessDetails {
  id?: string;
  publicId?: string;
  businessAccountId?: string;
  source?: "real" | "demo";
  role: BusinessRole;
  permissions?: string[];
  ownerNickname?: string;
  name: string;
  coverImage?: string;
  images?: string[];
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  isOpen?: boolean;
  category: string;
  secondaryCategories?: string[];
  description: string;
  city: string;
  address: string;
  additionalAddressInfo?: string;
  latitude?: number;
  longitude?: number;
  locationVisibility?: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  hours: string;
  status: "Verificado" | "Pendiente" | "Requiere confirmación" | "Información incompleta" | "Eliminado";
  deletedAt?: string;
  recoveryUntil?: string;
  isNew?: boolean;
  catalog?: CatalogItem[];
  collaborators?: BusinessCollaborator[];
}

export interface BusinessCollaborator {
  id: string;
  nickname?: string;
  name: string;
  email?: string;
  role: "Colaborador";
  active: boolean;
  invitationMethod?: "nickname" | "email";
}

export interface BusinessAccount {
  name: string;
  nickname: string;
  email: string;
  phone: string;
}

export interface BusinessNotification {
  id: string;
  title: string;
  description: string;
  date: string;
  createdAt?: string;
  type: "review" | "interest" | "profile" | "wit" | "admin" | "offer" | "security" | "collaboration";
  read: boolean;
  recipientNickname?: string;
  recipientEmail?: string;
  businessName?: string;
  businessId?: string;
  invitationId?: string;
}

export interface Preferences {
  emailUpdates: boolean;
  reviewAlerts: boolean;
  interestAlerts: boolean;
  profileVisible: boolean;
  visibilityUntil?: string | null;
  visibilityByBusiness?: Record<string, { profileVisible: boolean; visibilityUntil?: string | null }>;
}
