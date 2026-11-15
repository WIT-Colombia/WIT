import { prisma } from '../../config/prisma.js';
import type { AdminContext } from './admin-auth.service.js';

export async function getAdminSupportAttention(context: AdminContext) {
  const counts: Record<string,number> = {
    '/verifications': 0,
    '/user-needs': 0,
    '/business-reports': 0,
    '/offer-reports': 0,
    '/reports': 0,
    '/support': 0,
    '/suggestions': 0,
  };
  const jobs: Promise<void>[] = [];
  const count = (path: string, task: Promise<number>) => jobs.push(task.then(value => { counts[path] = value; }));
  if (context.permissions.includes('BUSINESSES_READ') && context.permissions.includes('CONTENT_MODERATE')) {
    count('/verifications', prisma.businessVerificationRequest.count({ where: { status: 'PENDING' } }));
  }
  if (context.permissions.includes('REPORTS_REVIEW') && context.permissions.includes('CONTENT_MODERATE')) {
    count('/user-needs', prisma.supportRequest.count({ where: { kind: 'NEED', status: { in: ['PENDING','UNDER_REVIEW'] } } }));
    count('/support', prisma.supportRequest.count({ where: { kind: 'SUPPORT', status: { in: ['PENDING','UNDER_REVIEW'] } } }));
    count('/suggestions', prisma.supportRequest.count({ where: { kind: 'SUGGESTION', status: { in: ['PENDING','UNDER_REVIEW'] } } }));
    count('/business-reports', prisma.businessReport.count({ where: { status: { in: ['PENDING','UNDER_REVIEW'] } } }));
    count('/offer-reports', prisma.offerReport.count({ where: { status: { in: ['PENDING','UNDER_REVIEW'] } } }));
    count('/reports', prisma.businessReviewReport.count({ where: { status: { in: ['PENDING','UNDER_REVIEW'] } } }));
  }
  await Promise.all(jobs);
  return {
    counts,
    total: Object.values(counts).reduce((sum,value)=>sum+value,0),
    generatedAt: new Date().toISOString(),
    definition: 'Acciones pendientes autorizadas: verificaciones documentales sin atender y casos abiertos de soporte. Los casos solo aparecen para administradores con permiso de moderación.',
  };
}
