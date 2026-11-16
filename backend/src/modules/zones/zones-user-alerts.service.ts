import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { colombiaCatalog } from './colombia-catalog.js';
import { zoneState } from './zones.service.js';

function municipality(code: string) {
  if (!/^\d{5}$/.test(code)) {
    throw new AppError(400, 'ZONE_INVALID_CODE', 'Selecciona una ciudad válida.');
  }
  const city = colombiaCatalog.municipalities.find(item => item.id === code);
  if (!city) throw new AppError(400, 'ZONE_INVALID_CODE', 'Selecciona una ciudad válida.');
  return city;
}

export async function getRegisteredZoneAlert(userId: string, code: string) {
  const city = municipality(code);
  const record = await prisma.zoneLaunchUserAlert.findUnique({ where: { userId_code: { userId, code } } });
  return { subscribed: Boolean(record), notified: Boolean(record?.notifiedAt), city: city.name };
}

export async function subscribeRegisteredZoneAlert(userId: string, code: string) {
  const city = municipality(code);
  const records = await prisma.zoneLaunch.findMany({
    select: { scope: true, code: true, state: true, opensAt: true },
  });
  if (zoneState('MUNICIPALITY', code, records).state === 'OPEN') {
    throw new AppError(409, 'ZONE_ALREADY_OPEN', 'Esta ciudad ya está habilitada.');
  }
  await prisma.zoneLaunchUserAlert.upsert({
    where: { userId_code: { userId, code } },
    create: { userId, code },
    update: {},
  });
  return { subscribed: true, city: city.name };
}

export async function unsubscribeRegisteredZoneAlert(userId: string, code: string) {
  municipality(code);
  await prisma.zoneLaunchUserAlert.deleteMany({ where: { userId, code, notifiedAt: null } });
  return { subscribed: false };
}

/** Dispara una única notificación persistente por cuenta y apertura, incluso si hay varias instancias del servidor. */
export async function dispatchRegisteredZoneLaunchAlerts() {
  const now = new Date();
  const [records, alerts] = await Promise.all([
    prisma.zoneLaunch.findMany({ select: { scope: true, code: true, state: true, opensAt: true } }),
    prisma.zoneLaunchUserAlert.findMany({
      where: { notifiedAt: null, user: { status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);
  let sent = 0;
  for (const alert of alerts) {
    if (zoneState('MUNICIPALITY', alert.code, records, now).state !== 'OPEN') continue;
    const city = municipality(alert.code);
    try {
      const delivered = await prisma.$transaction(async tx => {
        const claimed = await tx.zoneLaunchUserAlert.updateMany({
          where: { id: alert.id, notifiedAt: null },
          data: { notifiedAt: now },
        });
        if (!claimed.count) return false;
        await tx.platformNotification.create({
          data: {
            userId: alert.userId,
            sourceType: 'ZONE_LAUNCH',
            sourceId: alert.id,
            title: '¡XAMUKO llegó a ' + city.name + '!',
            message: 'Ya puedes explorar los negocios físicos disponibles en ' + city.name + '.',
          },
        });
        return true;
      });
      if (delivered) sent++;
    } catch (error) {
      console.error('No se pudo registrar el aviso de apertura del usuario', { code: alert.code, id: alert.id });
    }
  }
  return { sent };
}
