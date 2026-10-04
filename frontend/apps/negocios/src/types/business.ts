export type CatalogKind = "product" | "service";

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  category: string;
  description: string;
  price: string;
  image: string;
  active: boolean;
  interest: number;
}

export interface BusinessDetails {
  name: string;
  coverImage?: string;
  images?: string[];
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  isOpen?: boolean;
  category: string;
  description: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  hours: string;
  status: "Verificado" | "Pendiente" | "Requiere confirmación" | "Información incompleta" | "Eliminado";
  deletedAt?: string;
  isNew?: boolean;
  catalog?: CatalogItem[];
}

export interface BusinessAccount {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface BusinessNotification {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "review" | "interest" | "profile" | "wit";
  read: boolean;
}

export interface Preferences {
  emailUpdates: boolean;
  reviewAlerts: boolean;
  interestAlerts: boolean;
  profileVisible: boolean;
}
