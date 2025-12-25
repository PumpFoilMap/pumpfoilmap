type FetchSpotsParams = { bbox?: string; limit?: number };
import { md5 } from './md5';

function getBaseUrl() {
  // Expo native/web: EXPO_PUBLIC_API_BASE_URL
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined;
  return envUrl || 'http://localhost:3000';
}

export async function fetchSpots(params: FetchSpotsParams = {}) {
  const base = getBaseUrl();
  const qs = new URLSearchParams();
  if (params.bbox) qs.set('bbox', params.bbox);
  if (params.limit) qs.set('limit', String(params.limit));
  const url = `${base}/spots${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { items: any[]; count: number };
}

export type SubmitSpotInput =
  | {
      type: 'ponton';
      name: string;
      lat: number;
      lng: number;
      submittedBy: string;
    // Height in centimeters (cm)
    heightCm: number;
  // Length in meters (m)
  lengthM: number;
      access: 'autorise' | 'tolere';
      address: string;
      description?: string;
      imageUrl?: string;
      contactEmail?: string;
    }
  | {
      type: 'association';
      name: string;
      lat: number;
      lng: number;
      submittedBy: string;
      url?: string;
      website?: string;
      description?: string;
      imageUrl?: string;
      contactEmail?: string;
    };

export async function submitSpot(input: SubmitSpotInput) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/spots/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Submit failed (${res.status}): ${txt}`);
  }
  return (await res.json()) as { spotId: string; status: string; createdAt: string };
}

export async function checkAdminPassword(password: string): Promise<boolean> {
  const base = getBaseUrl();
  const hash = md5(password);
  const res = await fetch(`${base}/admin/check-md5`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ md5: hash })
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.match;
}

export async function getCaptcha(): Promise<{ data: string; secret: string }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/captcha`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { data: string; secret: string };
}

export async function verifyCaptcha(secret: string, answer: string): Promise<boolean> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/captcha/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, answer })
  });
  if (!res.ok) return false;
  const out = await res.json();
  return !!out.ok;
}
