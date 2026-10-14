import assert from "node:assert/strict";
import test from "node:test";
import { businessApi, type RealModality } from "../apps/negocios/src/services/businessApiClient.ts";

const originalFetch = globalThis.fetch;
const modality: RealModality = { id: "m1", businessId: "b1", type: "PHYSICAL", status: "CONFIGURING", contact: null, hours: [] };

test.afterEach(() => { globalThis.fetch = originalFetch; });

test("conecta el listado y la creación de modalidades con la API real", async () => {
  const requests: Array<{ url: string; method?: string; body?: string }> = [];
  globalThis.fetch = (async (input, init) => { requests.push({ url: String(input), method: init?.method, body: String(init?.body ?? "") }); return new Response(JSON.stringify({ modalities: [modality], modality }), { status: 200 }); }) as typeof fetch;
  await businessApi.listModalities("b1");
  await businessApi.createModality("b1", "PHYSICAL");
  assert.equal(requests[0].url, "/api/v1/businesses/b1/modalities");
  assert.equal(requests[1].method, "POST");
  assert.deepEqual(JSON.parse(requests[1].body ?? "{}"), { type: "PHYSICAL" });
});

test("permite crear cada modalidad de forma independiente", async () => {
  const requestedTypes: string[] = [];
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { type?: string };
    requestedTypes.push(body.type ?? "");
    return new Response(JSON.stringify({ modality: { ...modality, type: body.type } }), { status: 201 });
  }) as typeof fetch;
  await businessApi.createModality("b1", "VIRTUAL");
  await businessApi.createModality("b1", "DELIVERY");
  assert.deepEqual(requestedTypes, ["VIRTUAL", "DELIVERY"]);
});

test("envía contacto, horarios y transiciones sin almacenar tokens", async () => {
  const requests: Array<{ url: string; method?: string; body?: string }> = [];
  globalThis.fetch = (async (input, init) => { requests.push({ url: String(input), method: init?.method, body: String(init?.body ?? "") }); return new Response(JSON.stringify({ modality }), { status: 200 }); }) as typeof fetch;
  await businessApi.updateModalityContact("b1", "m1", { email: "contacto@ejemplo.com" });
  await businessApi.updateModalityHours("b1", "m1", [{ dayOfWeek: 1, isClosed: false, opensAt: "08:00", closesAt: "18:00", timezone: "America/Bogota" }]);
  await businessApi.activateModality("b1", "m1");
  await businessApi.pauseModality("b1", "m1");
  await businessApi.reactivateModality("b1", "m1");
  await businessApi.retireModality("b1", "m1");
  assert.deepEqual(requests.map(item => item.url), [
    "/api/v1/businesses/b1/modalities/m1/contact",
    "/api/v1/businesses/b1/modalities/m1/hours",
    "/api/v1/businesses/b1/modalities/m1/activate",
    "/api/v1/businesses/b1/modalities/m1/pause",
    "/api/v1/businesses/b1/modalities/m1/reactivate",
    "/api/v1/businesses/b1/modalities/m1/retire",
  ]);
  assert.equal(requests[2].method, "POST");
});

test("conserva los rechazos del backend para bloqueos de activación", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "MODALITY_NOT_READY", message: "La modalidad aún no puede activarse.", fields: { modality: "La cobertura se habilitará en la Fase 2." } } }), { status: 422 })) as typeof fetch;
  await assert.rejects(businessApi.activateModality("b1", "m1"), (error: unknown) => error instanceof Error && "status" in error && (error as { status: number }).status === 422);
});
