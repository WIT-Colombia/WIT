import { requestWithSession } from "./authService";

export type BusinessReportReason =
  | "IMPERSONATION"
  | "FALSE_INFORMATION"
  | "SUSPECTED_FRAUD"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";

export function reportBusiness(businessId: string, reason: BusinessReportReason, description: string) {
  return requestWithSession<{ report: { id: string; status: "PENDING"; createdAt: string } }>(
    `/api/v1/public/businesses/${encodeURIComponent(businessId)}/reports`,
    { method: "POST", body: JSON.stringify({ reason, description }) },
  );
}
