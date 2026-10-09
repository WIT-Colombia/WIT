import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV debe ser development, test o production.');
}
const portValue = process.env.PORT ?? '3000';
const port = Number(portValue);
if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 1 y 65535.');
}
const host = process.env.HOST?.trim() ?? '127.0.0.1';
if (!host) throw new Error('HOST no puede estar vacío.');

export const env = Object.freeze({ nodeEnv, port, host });
