import { randomUUID } from 'node:crypto';

export type GoogleDiagnosticStage = 'state' | 'code_exchange' | 'id_token_validation' | 'user_resolution' | 'session_creation';
export type GoogleDiagnosticCategory = 'state_invalid' | 'client_cancelled' | 'provider_rejected' | 'provider_unavailable' | 'provider_response_invalid' | 'token_invalid' | 'application_rejected' | 'database_failure' | 'session_failure' | 'unknown';

export type GoogleDiagnosticRecord = {
  diagnosticId: string;
  stage: GoogleDiagnosticStage;
  category: GoogleDiagnosticCategory;
};

export function createGoogleDiagnostic(stage: GoogleDiagnosticStage, category: GoogleDiagnosticCategory): GoogleDiagnosticRecord {
  return { diagnosticId: randomUUID(), stage, category };
}

export function logGoogleDiagnostic(record: GoogleDiagnosticRecord): void {
  console.error('Google OAuth diagnostic', record);
}
