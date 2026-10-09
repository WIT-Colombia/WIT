import type { BusinessRole } from "../types/business";

export const BUSINESS_ROLES: BusinessRole[] = ["Propietario", "Colaborador"];
export const OWNER_ONLY_ACTIONS = ["transferOwnership", "changeOwner", "deletePermanently"] as const;
export function canManageBusiness(role: BusinessRole, action: string): boolean {
  return role === "Propietario" || !OWNER_ONLY_ACTIONS.includes(action as typeof OWNER_ONLY_ACTIONS[number]);
}
