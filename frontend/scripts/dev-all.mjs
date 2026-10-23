import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const backend = path.resolve(root, "../backend");
const npmCli = process.env.npm_execpath;
const baseEnv = { ...process.env, FORCE_COLOR: "1" };
const services = [
  { name: "Backend", cwd: backend, args: ["run", "dev"], env: { PORT: "3000", HOST: "127.0.0.1" }, port: 3000 },
  { name: "Usuario", cwd: root, args: ["run", "dev", "--workspace=@wit/usuario"], env: { VITE_USUARIO_PORT: "5174", VITE_USUARIO_BACKEND_URL: "http://127.0.0.1:3000" }, port: 5174 },
  { name: "Business", cwd: root, args: ["run", "dev", "--workspace=@wit/negocios"], env: { VITE_NEGOCIOS_PORT: "5175", VITE_BUSINESS_BACKEND_URL: "http://127.0.0.1:3000" }, port: 5175 },
  { name: "Admin", cwd: root, args: ["run", "dev", "--workspace=@wit/admin"], env: { VITE_ADMIN_PORT: "5176", VITE_ADMIN_BACKEND_URL: "http://127.0.0.1:3000" }, port: 5176 },
];
function portFree(port) { return new Promise((resolve) => { const s = net.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true))).listen(port, "127.0.0.1"); }); }
const occupied = (await Promise.all(services.map(async (service) => ({ ...service, free: await portFree(service.port) })))).filter((service) => !service.free);
if (occupied.length) { console.error(`No se puede iniciar dev:all; puertos ocupados: ${occupied.map((service) => `${service.name}=${service.port}`).join(", ")}`); process.exit(1); }
const children = services.map((service) => { console.log(`[${service.name}] iniciando en ${service.port}`); const command = npmCli ? process.execPath : "npm"; const args = npmCli ? [npmCli, ...service.args] : service.args; const child = spawn(command, args, { cwd: service.cwd, env: { ...baseEnv, ...service.env }, stdio: "inherit" }); child.on("error", (error) => { console.error(`[${service.name}] ${error.message}`); }); return child; });
const stop = () => { for (const child of children) if (!child.killed) child.kill("SIGTERM"); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
await new Promise((resolve) => children.forEach((child) => child.once("exit", resolve)));
stop();
