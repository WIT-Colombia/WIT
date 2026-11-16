import type { AdminUserStatusAction } from '../services/adminApiClient';
export function getUserManagementAction(
  user: { id: string; status: string; isAdmin: boolean }, permitted: boolean, currentId?: string,
): AdminUserStatusAction | null {
  if (!permitted || user.isAdmin || (currentId && user.id === currentId)) return null;
  if (user.status === 'ACTIVE') return 'SUSPEND';
  if (user.status === 'SUSPENDED') return 'RESTORE';
  return null;
}
