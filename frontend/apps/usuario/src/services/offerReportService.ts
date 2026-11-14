import { requestWithSession } from "./authService";

export type OfferReportReason = "UNAVAILABLE" | "WRONG_INFORMATION" | "WRONG_IMAGE" | "OTHER";
export type OfferReportReceipt = { id: string; status: "PENDING"; createdAt: string };

export function submitOfferReport(offerId: string, reason: OfferReportReason, description: string) {
  return requestWithSession<{ report: OfferReportReceipt }>(
    `/api/v1/public/offers/${encodeURIComponent(offerId)}/reports`,
    { method: "POST", body: JSON.stringify({ reason, description }) },
  );
}
