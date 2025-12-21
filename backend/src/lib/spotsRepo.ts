import type { Spot } from './models';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Only allow in-memory store when NOT running on AWS Lambda (production)
const IS_AWS = !!process.env.AWS_EXECUTION_ENV;
const IS_OFFLINE = process.env.IS_OFFLINE === 'true';
const FORCE_INMEMORY = process.env.USE_INMEMORY === 'true';
const USE_INMEMORY = !IS_AWS && (FORCE_INMEMORY || IS_OFFLINE);
const DEBUG = true; // process.env.PFM_DEBUG === '1' || IS_OFFLINE;
if (DEBUG) {
  console.log('[repo] mode', {
    USE_INMEMORY,
    FORCE_INMEMORY,
    IS_AWS,
    IS_OFFLINE: process.env.IS_OFFLINE,
    DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT || null
  });
  if (FORCE_INMEMORY && IS_AWS) {
    console.warn('[repo] USE_INMEMORY=true ignoré en environnement AWS (prod) — utilisation de DynamoDB');
  }
  if (USE_INMEMORY && process.env.DYNAMODB_ENDPOINT) {
    console.warn('[repo] USE_INMEMORY=true alors que DYNAMODB_ENDPOINT est défini — la DB locale ne sera pas utilisée.');
  }
}

let memory: Spot[] | null = null;
const INMEMORY_FILE = process.env.INMEMORY_FILE || path.join(os.tmpdir(), 'pfm-inmemory-spots.json');

function loadSeeds(): Spot[] {
  const seedsPath = path.join(process.cwd(), 'seeds', 'spots.json');
  try {
    const raw = fs.readFileSync(seedsPath, 'utf-8');
    const data = JSON.parse(raw);
    const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.points) ? data.points : [];
    const nowIso = new Date().toISOString();
  const spots: Spot[] = items.map((s: any): Spot => {
      const type: 'ponton' | 'association' = s.type === 'association' ? 'association' : 'ponton';
      const common = {
        name: s.name ?? s.title ?? 'Spot',
        lat: Number(s.lat),
        lng: Number(s.lng ?? s.lon),
        description: s.description || undefined,
        submittedBy: s.submittedBy ?? 'seed',
        imageUrl: s.imageUrl || undefined,
        contactEmail: s.contactEmail || undefined
      };
      const specifics =
        type === 'ponton'
          ? {
              type: 'ponton' as const,
              heightCm: Number(s.heightCm ?? 100),
              lengthM: Number(s.lengthM ?? 1),
              access: (s.access ?? 'autorise') as 'autorise' | 'tolere',
              address: String(s.address ?? '')
            }
          : {
              type: 'association' as const,
              url: s.url || s.website || undefined,
              website: undefined
            };
      const spot: Spot = {
        spotId: s.spotId || randomUUID(),
        createdAt: s.createdAt || nowIso,
        status: (s.status as Spot['status']) || 'approved',
        ...(common as any),
        ...(specifics as any)
      };
      return spot;
    });
    return spots;
  } catch {
    return [];
  }
}

function readStore(): Spot[] {
  try {
    if (fs.existsSync(INMEMORY_FILE)) {
      const raw = fs.readFileSync(INMEMORY_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as Spot[];
    }
  } catch (e) {
    if (DEBUG) console.warn('[repo] readStore failed', e);
  }
  const seeds = loadSeeds();
  try {
    fs.writeFileSync(INMEMORY_FILE, JSON.stringify(seeds, null, 2));
  } catch (e) {
    if (DEBUG) console.warn('[repo] write seeds to store failed', e);
  }
  return seeds;
}

function writeStore(arr: Spot[]) {
  try {
    fs.writeFileSync(INMEMORY_FILE, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('[repo] writeStore failed', e);
  }
}

async function listFromMemory(limit: number): Promise<Spot[]> {
  // Recharger depuis le disque pour partager l'état entre processus offline
  memory = readStore();
  if (DEBUG) console.log('[repo] listFromMemory', { count: memory.length, limit, file: INMEMORY_FILE });
  return memory.slice(0, limit);
}

async function createInMemory(spot: Spot): Promise<void> {
  const arr = readStore();
  if (DEBUG) console.log('[repo] createInMemory', { spotId: spot.spotId, status: spot.status, file: INMEMORY_FILE });
  arr.unshift(spot);
  writeStore(arr);
  memory = arr;
}

async function updateStatusInMemory(spotId: string, status: Spot['status']): Promise<Spot | null> {
  const arr = readStore();
  const idx = arr.findIndex((s) => s.spotId === spotId);
  if (idx === -1) return null;
  const next = { ...arr[idx], status } as Spot;
  arr[idx] = next;
  writeStore(arr);
  memory = arr;
  if (DEBUG) console.log('[repo] updateStatusInMemory', { spotId, status, file: INMEMORY_FILE });
  return next;
}

export async function listSpots(limit: number): Promise<Spot[]> {
  if (USE_INMEMORY) return listFromMemory(limit);
  const [{ ddb, TABLE_SPOTS, ensureSpotsTable }, { ScanCommand }] = await Promise.all([
    import('./db'),
    import('@aws-sdk/lib-dynamodb')
  ]);
  if (typeof ensureSpotsTable === 'function') {
    await ensureSpotsTable();
  }
  const params = { TableName: TABLE_SPOTS, Limit: limit } as const;
  if (DEBUG) console.log('[repo] ddb Scan', params);
  const res = await ddb.send(new ScanCommand(params));
  if (DEBUG) console.log('[repo] ddb Scan result', { count: res.Items?.length || 0 });
  return (res.Items ?? []) as Spot[];
}

export async function createSpot(spot: Spot): Promise<void> {
  if (USE_INMEMORY) return createInMemory(spot);
  const [{ ddb, TABLE_SPOTS, ensureSpotsTable }, { PutCommand }] = await Promise.all([
    import('./db'),
    import('@aws-sdk/lib-dynamodb')
  ]);
  if (typeof ensureSpotsTable === 'function') {
    await ensureSpotsTable();
  }
  const params = {
    TableName: TABLE_SPOTS,
    Item: spot,
    ConditionExpression: 'attribute_not_exists(spotId)'
  } as const;
  if (DEBUG) console.log('[repo] ddb Put', { spotId: spot.spotId, status: (spot as any).status });
  await ddb.send(new PutCommand(params));
  if (DEBUG) console.log('[repo] ddb Put ok', { spotId: spot.spotId });
}

export async function updateSpotStatus(spotId: string, status: Spot['status']): Promise<Spot | null> {
  if (USE_INMEMORY) return updateStatusInMemory(spotId, status);
  const [{ ddb, TABLE_SPOTS, ensureSpotsTable }, { UpdateCommand }] = await Promise.all([
    import('./db'),
    import('@aws-sdk/lib-dynamodb')
  ]);
  if (typeof ensureSpotsTable === 'function') {
    await ensureSpotsTable();
  }
  const params = {
    TableName: TABLE_SPOTS,
    Key: { spotId },
    UpdateExpression: 'SET #s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': status },
    ReturnValues: 'ALL_NEW'
  } as const;
  if (DEBUG) console.log('[repo] ddb Update(status)', { spotId, status });
  const res = await ddb.send(new UpdateCommand(params));
  if (DEBUG) console.log('[repo] ddb Update(status) result', { hasAttributes: !!res.Attributes });
  return (res.Attributes as Spot) || null;
}

async function updateFieldsInMemory(spotId: string, patch: Partial<Spot>): Promise<Spot | null> {
  const arr = readStore();
  const idx = arr.findIndex((s) => s.spotId === spotId);
  if (idx === -1) return null;
  const next: Spot = { ...arr[idx], ...(patch as any) } as Spot;
  arr[idx] = next;
  writeStore(arr);
  memory = arr;
  if (DEBUG) console.log('[repo] updateFieldsInMemory', { spotId, patchKeys: Object.keys(patch), file: INMEMORY_FILE });
  return next;
}

export async function updateSpotFields(spotId: string, patch: Partial<Spot>): Promise<Spot | null> {
  if (USE_INMEMORY) return updateFieldsInMemory(spotId, patch);
  const [{ ddb, TABLE_SPOTS, ensureSpotsTable }, { UpdateCommand }] = await Promise.all([
    import('./db'),
    import('@aws-sdk/lib-dynamodb')
  ]);
  if (typeof ensureSpotsTable === 'function') {
    await ensureSpotsTable();
  }
  // Build dynamic update expression
  const keys = Object.keys(patch);
  if (!keys.length) return null;
  const exprNames: Record<string, string> = {};
  const exprValues: Record<string, unknown> = {};
  const sets: string[] = [];
  keys.forEach((k, i) => {
    const name = `#k${i}`; const val = `:v${i}`;
    exprNames[name] = k;
    exprValues[val] = (patch as any)[k];
    sets.push(`${name} = ${val}`);
  });
  const params = {
    TableName: TABLE_SPOTS,
    Key: { spotId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: 'ALL_NEW'
  } as const;
  if (DEBUG) console.log('[repo] ddb Update(fields)', { spotId, keys });
  const res = await ddb.send(new UpdateCommand(params));
  if (DEBUG) console.log('[repo] ddb Update(fields) result', { hasAttributes: !!res.Attributes });
  return (res.Attributes as Spot) || null;
}

async function deleteInMemory(spotId: string): Promise<boolean> {
  const arr = readStore();
  const idx = arr.findIndex((s) => s.spotId === spotId);
  if (idx === -1) return false;
  arr.splice(idx, 1);
  writeStore(arr);
  memory = arr;
  if (DEBUG) console.log('[repo] deleteInMemory', { spotId, file: INMEMORY_FILE });
  return true;
}

export async function deleteSpot(spotId: string): Promise<boolean> {
  if (USE_INMEMORY) return deleteInMemory(spotId);
  const [{ ddb, TABLE_SPOTS, ensureSpotsTable }, { DeleteCommand }] = await Promise.all([
    import('./db'),
    import('@aws-sdk/lib-dynamodb')
  ]);
  if (typeof ensureSpotsTable === 'function') {
    await ensureSpotsTable();
  }
  const params = { TableName: TABLE_SPOTS, Key: { spotId }, ReturnValues: 'ALL_OLD' } as const;
  if (DEBUG) console.log('[repo] ddb Delete', { spotId });
  const res = await ddb.send(new DeleteCommand(params));
  const existed = !!res.Attributes;
  if (DEBUG) console.log('[repo] ddb Delete result', { existed });
  return existed;
}
