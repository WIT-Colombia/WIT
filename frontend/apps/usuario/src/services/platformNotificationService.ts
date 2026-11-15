import { requestWithSession } from './authService';

export type PlatformNotice = {
  id: string; title: string; message: string; sourceType: string; sourceId: string;
  createdAt: string; readAt: string | null;
};

export function listPlatformNotices() {
  return requestWithSession<{ notifications: PlatformNotice[]; unread: number }>('/api/v1/notifications');
}
export function readPlatformNotice(id: string) {
  return requestWithSession<{ ok: boolean }>('/api/v1/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST', body: '{}' });
}
export function readAllPlatformNotices() {
  return requestWithSession<{ ok: boolean }>('/api/v1/notifications/read-all', { method: 'POST', body: '{}' });
}
export function dismissPlatformNotice(id: string) {
  return requestWithSession<{ ok: boolean }>('/api/v1/notifications/' + encodeURIComponent(id), { method: 'DELETE' });
}
