import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteNotification, getNotifications, markAllNotificationsRead, markNotificationRead,
} from './userDataService';

describe('Notificaciones locales de Usuarios: aislamiento por identidad', () => {
  beforeEach(() => localStorage.clear());

  it('no devuelve notificaciones de ninguna cuenta al cerrar sesión', () => {
    expect(getNotifications()).toEqual([]);
    expect(getNotifications(null)).toEqual([]);
    expect(localStorage.getItem('wit-notifications')).toBeNull();
  });

  it('mantiene de forma independiente la bienvenida y los estados de lectura', () => {
    expect(getNotifications('usuario-a')).toHaveLength(1);
    expect(getNotifications('usuario-b')).toHaveLength(1);
    expect(getNotifications('usuario-a')[0].read).toBe(false);

    markNotificationRead('welcome', 'usuario-a');
    expect(getNotifications('usuario-a')[0].read).toBe(true);
    expect(getNotifications('usuario-b')[0].read).toBe(false);

    markAllNotificationsRead('usuario-b');
    expect(getNotifications('usuario-b')[0].read).toBe(true);
    expect(getNotifications('usuario-a')).toHaveLength(1);
  });

  it('eliminar un aviso solo afecta al usuario autenticado', () => {
    getNotifications('usuario-a');
    getNotifications('usuario-b');
    expect(deleteNotification('welcome', 'usuario-a')).toEqual([]);
    expect(getNotifications('usuario-a')).toEqual([]);
    expect(getNotifications('usuario-b')).toHaveLength(1);
  });

  it('no incorpora mensajes de la clave histórica global compartida', () => {
    localStorage.setItem('wit-notifications', JSON.stringify([
      { id: 'privado', title: 'Aviso de otro usuario', body: 'Reservado', date: 'Hoy', read: false },
    ]));
    const notifications = getNotifications('usuario-c');
    expect(notifications.some(item => item.id === 'privado')).toBe(false);
    expect(notifications[0].id).toBe('welcome');
  });
});
