import assert from "node:assert/strict";
import test from "node:test";
import { getBusinessOpeningState } from "../src/services/businessPresentation";
import type { RealModality } from "../src/services/businessApiClient";

const modality = (overrides: Partial<RealModality> = {}): RealModality => ({
  id: "physical", businessId: "business-a", type: "PHYSICAL", status: "ACTIVE", contact: null,
  hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isClosed: dayOfWeek === 0, opensAt: dayOfWeek === 0 ? null : "08:00", closesAt: dayOfWeek === 0 ? null : "18:00", timezone: "America/Bogota" })),
  ...overrides,
});

test("uses the schedule timezone rather than the computer timezone", () => {
  assert.deepEqual(getBusinessOpeningState([modality()], new Date("2026-10-16T14:00:00Z")), { label: "Abierto ahora", isOpen: true });
  assert.equal(getBusinessOpeningState([modality()], new Date("2026-10-16T23:00:00Z")).isOpen, false);
});
test("handles another country timezone from the persisted schedule", () => {
  const business = modality();
  business.hours = business.hours.map(hour => ({ ...hour, timezone: "Asia/Tokyo" }));
  assert.equal(getBusinessOpeningState([business], new Date("2026-10-16T00:00:00Z")).isOpen, true);
  assert.equal(getBusinessOpeningState([business], new Date("2026-10-16T12:00:00Z")).isOpen, false);
});
test("closing time is exclusive and days without attention are closed", () => {
  assert.equal(getBusinessOpeningState([modality()], new Date("2026-10-16T23:00:00Z")).isOpen, false);
  assert.equal(getBusinessOpeningState([modality()], new Date("2026-10-18T15:00:00Z")).isOpen, false);
});
test("an overnight schedule continues from the previous day", () => {
  const business = modality();
  business.hours[5] = { ...business.hours[5], opensAt: "20:00", closesAt: "02:00" };
  assert.equal(getBusinessOpeningState([business], new Date("2026-10-17T06:00:00Z")).isOpen, true);
  assert.equal(getBusinessOpeningState([business], new Date("2026-10-17T07:00:00Z")).isOpen, false);
  assert.equal(getBusinessOpeningState([business], new Date("2026-10-17T02:00:00Z")).isOpen, true);
});
test("24 hour attention includes the last minute of the day", () => {
  const business = modality();
  business.hours[5] = { ...business.hours[5], opensAt: "00:00", closesAt: "23:59" };
  assert.equal(getBusinessOpeningState([business], new Date("2026-10-17T04:59:00Z")).isOpen, true);
});
test("only active modalities participate and physical attention takes priority", () => {
  const closedPhysical = modality();
  closedPhysical.hours[5] = { ...closedPhysical.hours[5], isClosed: true };
  const virtual = modality({ id: "virtual", type: "VIRTUAL" });
  assert.equal(getBusinessOpeningState([virtual, closedPhysical], new Date("2026-10-16T14:00:00Z")).isOpen, false);
  assert.equal(getBusinessOpeningState([modality({ status: "PAUSED" })]).isOpen, null);
});
test("does not invent a status when schedule or timezone is absent or invalid", () => {
  assert.equal(getBusinessOpeningState([]).isOpen, null);
  assert.equal(getBusinessOpeningState([modality({ hours: [] })]).isOpen, null);
  const business = modality();
  business.hours = business.hours.map(hour => ({ ...hour, timezone: "Invalid/Timezone" }));
  assert.equal(getBusinessOpeningState([business]).isOpen, null);
  business.hours = business.hours.map(hour => ({ ...hour, timezone: "" }));
  assert.equal(getBusinessOpeningState([business]).isOpen, null);
});
