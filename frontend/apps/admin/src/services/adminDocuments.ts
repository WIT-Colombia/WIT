import { adminDocumentRequest, type AdminDocumentSection } from './adminApiClient';

export type DocumentSection = AdminDocumentSection;
export type AdminDocument = { id: string; section: DocumentSection; title: string; description: string | null; filename: string; mimeType: string; sizeBytes: number; createdAt: string; deletedAt: string | null; deletionReason: string | null; uploadedBy: { displayName: string } | null };
export type DocumentList = { documents: AdminDocument[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; summary: { active: number; deleted: number; sizeBytes: number } };
export function listDocuments(section: DocumentSection, q: string, page: number, trash: boolean) {
  return adminDocumentRequest<DocumentList>(`/documents?${new URLSearchParams({ section, q, page: String(page), trash: String(trash) })}`);
}
export function uploadDocument(section: DocumentSection, title: string, description: string, file: File) {
  const form = new FormData(); form.set('section', section); form.set('title', title.trim()); form.set('description', description.trim()); form.set('file', file);
  return adminDocumentRequest<{ document: AdminDocument }>('/documents', { method: 'POST', body: form });
}
export const trashDocument = (id: string, reason: string) => adminDocumentRequest(`/documents/${encodeURIComponent(id)}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
export const restoreDocument = (id: string) => adminDocumentRequest(`/documents/${encodeURIComponent(id)}/restore`, { method: 'POST', body: '{}' });
