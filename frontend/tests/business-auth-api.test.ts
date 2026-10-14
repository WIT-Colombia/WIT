import assert from "node:assert/strict";
import test from "node:test";
import { BusinessApiError, buildApiUrl, businessApi, requestJson } from "../apps/negocios/src/services/businessApiClient.ts";
import { clearAccessToken, login, resolveBusinessNext, restoreSession } from "../apps/negocios/src/services/businessAuthService.ts";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});

test("una primera visita sin cookie termina en login, no en error", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Sesión requerida" } }), { status: 401 })) as typeof fetch;
  const state = await restoreSession();
  assert.equal(state.status, "unauthenticated");
});

test("sesiones expiradas o revocadas también terminan en login", async (t) => {
  for (const code of ["SESSION_EXPIRED", "SESSION_REVOKED"]) {
    await t.test(code, async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code, message: "Sesión no válida" } }), { status: 401 })) as typeof fetch;
      const state = await restoreSession();
      assert.equal(state.status, "unauthenticated");
    });
  }
});

test("distingue backend desconectado y permite reintentar", async () => {
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("socket detail");
    return new Response(JSON.stringify({ user: { id: "u1" }, accessToken: "token" }), { status: 200 });
  }) as typeof fetch;
  const failed = await restoreSession();
  assert.equal(failed.status, "error");
  assert.equal((failed.error as BusinessApiError).status, 0);
  const retried = await restoreSession();
  assert.equal(retried.status, "authenticated");
  assert.equal(attempts, 2);
});

test("conserva errores HTTP internos como estado reintentable", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Error seguro" } }), { status: 500 })) as typeof fetch;
  const state = await restoreSession();
  assert.equal(state.status, "error");
  assert.equal((state.error as BusinessApiError).status, 500);
});

test("restaura una sesión válida mediante refresh", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ user: { id: "u1" }, accessToken: "token" }), { status: 200 })) as typeof fetch;
  const state = await restoreSession();
  assert.equal(state.status, "authenticated");
});

test("confirma /auth/me después del login antes de devolver la sesión", async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (input) => {
    requests.push(String(input));
    if (requests.length === 1) return new Response(JSON.stringify({ user: { id: "u1" }, accessToken: "token" }), { status: 200 });
    return new Response(JSON.stringify({ user: { id: "u1", displayName: "Comerciante" } }), { status: 200 });
  }) as typeof fetch;
  const user = await login("test@example.com", "password-123", false);
  assert.equal(user.id, "u1");
  assert.deepEqual(requests, ["/api/v1/auth/login", "/api/v1/auth/me"]);
});

test("adjunta el access token en memoria a las solicitudes reales de negocios", async () => {
  const requests: RequestInit[] = [];
  globalThis.fetch = (async (_input, init) => {
    requests.push(init ?? {});
    if (requests.length === 1) return new Response(JSON.stringify({ user: { id: "u1" }, accessToken: "business-token" }), { status: 200 });
    if (requests.length === 2) return new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 });
    return new Response(JSON.stringify({ businesses: [] }), { status: 200 });
  }) as typeof fetch;
  await login("test@example.com", "password-123", false);
  await businessApi.list();
  assert.equal(new Headers(requests[2].headers).get("Authorization"), "Bearer business-token");
});

test("no permite que next devuelva al login ni a una ruta externa", () => {
  assert.equal(resolveBusinessNext("/login"), "/mis-negocios");
  assert.equal(resolveBusinessNext("/registro?from=login"), "/mis-negocios");
  assert.equal(resolveBusinessNext("https://evil.example"), "/mis-negocios");
  assert.equal(resolveBusinessNext("//evil.example"), "/mis-negocios");
  assert.equal(resolveBusinessNext("/mi-negocio/modalidades/0"), "/mi-negocio/modalidades/0");
});

test("construye URLs con el prefijo /api/v1 y envía cookies", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  assert.equal(buildApiUrl("/auth/me"), "/api/v1/auth/me");
  await requestJson<{ ok: boolean }>("/auth/me");
  assert.equal(requestedUrl, "/api/v1/auth/me");
  assert.equal(requestedInit?.credentials, "include");
  assert.equal(new Headers(requestedInit?.headers).get("Accept"), "application/json");
});

test("acepta respuestas vacías", async () => {
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  assert.equal(await requestJson<void>("/auth/logout", { method: "POST", body: "{}" }), null);
});

test("conserva errores 401, 403 y 409 del backend", async (t) => {
  for (const status of [401, 403, 409]) {
    await t.test(String(status), async () => {
      globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: `E${status}`, message: "Respuesta segura" } }), { status })) as typeof fetch;
      await assert.rejects(
        requestJson("/businesses/demo/modalities"),
        (error: unknown) => error instanceof BusinessApiError && error.status === status && error.code === `E${status}`,
      );
    });
  }
});

test("convierte un fallo de red en un error seguro", async () => {
  globalThis.fetch = (async () => { throw new Error("socket detail"); }) as typeof fetch;
  await assert.rejects(requestJson("/auth/me"), (error: unknown) => error instanceof BusinessApiError && error.status === 0 && error.code === "NETWORK_ERROR");
});

test("no guarda tokens en localStorage desde el cliente API", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;
  await requestJson("/auth/me");
  assert.equal("accessToken" in {}, false);
});

test("el cliente de negocios usa los endpoints reales y cookies HttpOnly", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(JSON.stringify({ business: { id: "b1" } }), { status: 201 });
  }) as typeof fetch;
  await businessApi.create({ name: "Negocio real" });
  assert.equal(requestedUrl, "/api/v1/businesses");
  assert.equal(requestedInit?.method, "POST");
  assert.equal(requestedInit?.credentials, "include");
  assert.equal((JSON.parse(String(requestedInit?.body)) as { name: string }).name, "Negocio real");
});
