import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claimPendingZoneAlertAttempt,
  readPendingZoneAlert,
  savePendingZoneAlert,
  clearPendingZoneAlert,
} from './zoneAlertService';

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});
afterEach(() => {
  clearPendingZoneAlert();
  window.sessionStorage.clear();
});

describe('Intento automático de avisos de apertura', () => {
  it('no repite el intento automáticamente en la misma sesión y municipio', () => {
    expect(claimPendingZoneAlertAttempt('usuario-1', '50001')).toBe(true);
    expect(claimPendingZoneAlertAttempt('usuario-1', '50001')).toBe(false);
    expect(claimPendingZoneAlertAttempt('usuario-1', '76001')).toBe(true);
    expect(claimPendingZoneAlertAttempt('usuario-2', '50001')).toBe(true);
  });

  it('una nueva pulsación explícita restablece el intento para hacer pruebas', () => {
    expect(claimPendingZoneAlertAttempt('usuario-1', '50001')).toBe(true);
    expect(claimPendingZoneAlertAttempt('usuario-1', '50001')).toBe(false);
    savePendingZoneAlert('50001', 'Villavicencio');
    expect(readPendingZoneAlert()).toMatchObject({ code: '50001', city: 'Villavicencio' });
    expect(claimPendingZoneAlertAttempt('usuario-1', '50001')).toBe(true);
    expect(claimPendingZoneAlertAttempt('usuario-1', '50001')).toBe(false);
  });
});
