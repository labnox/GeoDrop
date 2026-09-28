import type { Message, Coordinates } from '../types';
import { createBeaconChimeBlob } from './audio';

// Default reference coordinates: Dam Square, Amsterdam (52.3731, 4.8926)
export const DEFAULT_DEMO_COORDINATES: Coordinates = {
  lat: 52.3731,
  lng: 4.8926,
};

export const PRESET_CITIES: Record<string, { name: string; coords: Coordinates }> = {
  amsterdam: { name: 'Amsterdam (De Dam)', coords: { lat: 52.3731, lng: 4.8926 } },
  rotterdam: { name: 'Rotterdam (Centraal)', coords: { lat: 51.9244, lng: 4.4777 } },
  utrecht: { name: 'Utrecht (Domplein)', coords: { lat: 52.0907, lng: 5.1214 } },
  denhaag: { name: 'Den Haag (Binnenhof)', coords: { lat: 52.0799, lng: 4.3134 } },
};

/**
 * Creates curated sample landmarks offset by a few meters from the given center.
 * This guarantees blind/visually impaired testers immediately have active cues.
 */
export const createSampleLandmarks = async (
  center: Coordinates,
  userId: string
): Promise<Message[]> => {
  const chimeBus = await createBeaconChimeBlob('bus');
  const chimeCrossing = await createBeaconChimeBlob('crossing');

  // ~1 meter in latitude is approx 0.000009 degrees
  const offsetMeters = (dLatM: number, dLngM: number): Coordinates => {
    const latOffset = dLatM / 111111;
    const lngOffset = dLngM / (111111 * Math.cos((center.lat * Math.PI) / 180));
    return {
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset,
    };
  };

  return [
    {
      id: 'sample_landmark_1',
      authorId: 'system_beacon',
      name: 'Bushalte Lijn 21 (Geluidsbaken)',
      type: 'audio',
      audioUrl: chimeBus,
      location: offsetMeters(14, 8), // ~16 meter afstand - binnen ontdekafstand!
      visibility: 'public',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'sample_landmark_2',
      authorId: 'system_beacon',
      name: 'Akoestische Voetgangersoversteek',
      type: 'audio',
      audioUrl: chimeCrossing,
      location: offsetMeters(-18, 15), // ~23 meter afstand - binnen ontdekafstand!
      visibility: 'public',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'sample_landmark_3',
      authorId: userId,
      name: 'Hoofdingang & Gidstegels',
      type: 'text',
      text: 'Gidstegels leiden rechtstreeks naar de automatische schuifdeur. De aanmeldzuil bevindt zich direct rechts.',
      location: offsetMeters(8, -10), // ~13 meter afstand
      visibility: 'public',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'sample_landmark_4',
      authorId: userId,
      name: 'Mijn Voordeur & Opstapje',
      type: 'text',
      text: 'Twee treden omhoog naar het portiek. Het sleutelgat zit op 1 meter hoogte aan de linkerzijde.',
      location: offsetMeters(-28, -25), // ~38 meter afstand
      visibility: 'personal',
      timestamp: new Date().toISOString(),
    },
  ];
};
