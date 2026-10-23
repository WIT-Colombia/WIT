import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

if (!env.databaseUrl) throw new Error('DATABASE_URL es obligatorio.');

// Pass decoded connection fields to the MariaDB driver. Passing the raw URL
// leaves percent-encoded credentials untouched and can make the pool fail to
// acquire any connection (P2039) even when MySQL accepts the same credentials.
const databaseUrl = new URL(env.databaseUrl);
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.replace(/^\//, '')),
  connectionLimit: 10,
});
export const prisma = new PrismaClient({ adapter });
