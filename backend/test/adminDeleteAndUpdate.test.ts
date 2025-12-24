// In-memory repo tests for deleting and updating spots
process.env.USE_INMEMORY = 'true';
process.env.ADMIN_TOKEN = 'dev';
// Isolate the in-memory file to avoid cross-test interference when Jest runs files in parallel
// Use a per-suite temp file so create/update/list operate on the same isolated store
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('node:os');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');
process.env.INMEMORY_FILE = path.join(os.tmpdir(), `pfm-inmemory-admin-delete-update-${process.pid}.json`);

import { handler as submitHandler } from '../src/handlers/submitSpot';
import { handler as adminUpdate } from '../src/handlers/adminUpdateSpot';
import { handler as adminDelete } from '../src/handlers/adminDeleteSpot';
import { handler as listSpots } from '../src/handlers/adminListSpots';
import { createHash } from 'node:crypto';

function md5(s: string) { return createHash('md5').update(s).digest('hex'); }

describe('Admin update and delete', () => {
  it('updates fields and deletes a spot', async () => {
  const submitPayload = { type: 'association', name: 'DelMe', lat: 1.1, lng: 2.2, submittedBy: 'qa' };
    const sub = await submitHandler({ body: JSON.stringify(submitPayload) } as any);
  expect(sub.statusCode).toBe(202);
    const { spotId } = JSON.parse(sub.body as string);

    // Update name and description
    const upd = await adminUpdate({
      pathParameters: { id: spotId },
      headers: { authorization: `Bearer ${md5('dev')}` },
      body: JSON.stringify({ name: 'Updated', description: 'ok' })
    } as any);
    expect(upd.statusCode).toBe(200);
    const upBody = JSON.parse(upd.body as string);
    expect(upBody.name).toBe('Updated');

    // List all and ensure present
  const lst = await listSpots({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(lst.statusCode).toBe(200);
    const listBody = JSON.parse(lst.body as string);
    const ids: string[] = listBody.items.map((s: any) => s.spotId);
    expect(ids).toContain(spotId);

    // Delete it
  const del = await adminDelete({ pathParameters: { id: spotId }, headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect([200,204]).toContain(del.statusCode);

    // List should no longer contain it
  const lst2 = await listSpots({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    const body2 = JSON.parse(lst2.body as string);
    const ids2: string[] = body2.items.map((s: any) => s.spotId);
    expect(ids2).not.toContain(spotId);
  });
});
