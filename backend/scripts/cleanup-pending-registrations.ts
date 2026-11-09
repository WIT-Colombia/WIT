import { prisma } from '../src/config/prisma.js';

/**
 * Safe maintenance command. Dry-run by default.
 * Usage: npm exec -- tsx scripts/cleanup-pending-registrations.ts [--apply]
 * Schedule only after deployment approval; never runs automatically on import.
 */
const apply = process.argv.includes('--apply');
const unknown = process.argv.slice(2).filter((arg) => arg !== '--apply');
if (unknown.length) throw new Error('Argumentos no reconocidos.');
try {
  const now = new Date();
  const where = { expiresAt: { lte: now } };
  const expired = await prisma.pendingEmailRegistration.count({ where });
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', expired, asOf: now.toISOString() }));
  } else {
    const deleted = await prisma.pendingEmailRegistration.deleteMany({ where });
    console.log(JSON.stringify({ mode: 'apply', deleted: deleted.count, asOf: now.toISOString() }));
  }
} finally {
  await prisma.$disconnect();
}
