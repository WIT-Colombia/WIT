import { prisma } from '../../config/prisma.js';
import type { PreferredLocationInput } from './location.schemas.js';

const locationSelect = { preferredLocationCity: true, preferredLocationRegion: true, preferredLocationCountry: true, preferredLocationName: true, preferredLocationLatitude: true, preferredLocationLongitude: true, preferredLocationMode: true, preferredLocationResolution: true, preferredLocationUpdatedAt: true } as const;

function serialize(user: any) {
  if (!user.preferredLocationCity || !user.preferredLocationName || !user.preferredLocationMode) return null;
  return { city: user.preferredLocationCity, region: user.preferredLocationRegion, country: user.preferredLocationCountry ?? 'Colombia', name: user.preferredLocationName, latitude: user.preferredLocationLatitude == null ? null : Number(user.preferredLocationLatitude), longitude: user.preferredLocationLongitude == null ? null : Number(user.preferredLocationLongitude), mode: user.preferredLocationMode, resolution: user.preferredLocationResolution ?? 'PENDING', updatedAt: user.preferredLocationUpdatedAt?.toISOString() ?? null };
}

export async function getPreferredLocation(userId: string) { return serialize(await prisma.user.findUnique({ where: { id: userId }, select: locationSelect })); }

export async function savePreferredLocation(userId: string, input: PreferredLocationInput) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: locationSelect });
  if (input.clientUpdatedAt && current?.preferredLocationUpdatedAt && current.preferredLocationUpdatedAt.getTime() > input.clientUpdatedAt) return serialize(current);
  const updated = await prisma.user.update({ where: { id: userId }, data: { preferredLocationCity: input.city, preferredLocationRegion: input.region ?? null, preferredLocationCountry: input.country, preferredLocationName: input.name, preferredLocationLatitude: input.latitude ?? null, preferredLocationLongitude: input.longitude ?? null, preferredLocationMode: input.mode, preferredLocationResolution: input.resolution, preferredLocationUpdatedAt: new Date() }, select: locationSelect });
  return serialize(updated);
}
