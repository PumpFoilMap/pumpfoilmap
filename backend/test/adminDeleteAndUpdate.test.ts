// In-memory repo tests for deleting and updating spots
process.env.USE_INMEMORY = 'true';
process.env.ADMIN_TOKEN = 'dev';
// Isolate the in-memory file to avoid cross-test interference when Jest runs files in parallel
// Use a per-suite temp file so create/update/list operate on the same isolated store
const os = require('node:os');
const path = require('node:path');
process.env.INMEMORY_FILE = path.join(os.tmpdir(), `pfm-inmemory-admin-delete-update-${process.pid}.json`);

jest.doMock('@aws-sdk/client-ses', () => {
  return {
    SESClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ MessageId: 'mid-admin' })
    })),
    SendEmailCommand: jest.fn().mockImplementation((input: any) => input)
  };
}, { virtual: true });

import { handler as submitHandler } from '../src/handlers/submitSpot';
import { handler as adminUpdate } from '../src/handlers/adminUpdateSpot';
import { handler as adminDelete } from '../src/handlers/adminDeleteSpot';
import { handler as listSpots } from '../src/handlers/adminListSpots';
import { createHash } from 'node:crypto';

function md5(s: string) { return createHash('md5').update(s).digest('hex'); }

describe('Admin update and delete', () => {
  const ses = require('@aws-sdk/client-ses');
  beforeEach(() => {
    ses.SendEmailCommand.mockClear();
  });
  it('updates fields and deletes a spot', async () => {
    const submitPayload = { type: 'association', name: 'DelMe', lat: 1.1, lng: 2.2, submittedBy: 'qa', contactEmail: 'author@example.com' } as const;
    const sub = await submitHandler({ body: JSON.stringify(submitPayload) } as any);
  expect(sub.statusCode).toBe(202);
    const { spotId } = JSON.parse(sub.body as string);
    // Clear emails triggered by submission to focus on admin actions
    ses.SendEmailCommand.mockClear();

    // Update name and description
    const upd = await adminUpdate({
      pathParameters: { id: spotId },
      headers: { authorization: `Bearer ${md5('dev')}` },
      body: JSON.stringify({ name: 'Updated', description: 'ok' })
    } as any);
    expect(upd.statusCode).toBe(200);
  const upBody = JSON.parse(upd.body as string);
    expect(upBody.name).toBe('Updated');
  // One email to author for update
  let calls = ses.SendEmailCommand.mock.calls.map((args: any[]) => args[0]);
  expect(calls.length).toBe(1);
  expect(calls[0].Destination.ToAddresses).toEqual(['author@example.com']);
  expect(calls[0].Source).toBe('no-reply@pumpfoilmap.org');
  // Clear before delete action
  ses.SendEmailCommand.mockClear();

    // List all and ensure present
  const lst = await listSpots({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(lst.statusCode).toBe(200);
    const listBody = JSON.parse(lst.body as string);
    const ids: string[] = listBody.items.map((s: any) => s.spotId);
    expect(ids).toContain(spotId);

    // Delete it
  const del = await adminDelete({ pathParameters: { id: spotId }, headers: { authorization: `Bearer ${md5('dev')}` } } as any);
  expect([200,204]).toContain(del.statusCode);
  // One email to author for delete
  calls = ses.SendEmailCommand.mock.calls.map((args: any[]) => args[0]);
  expect(calls.length).toBe(1);
  expect(calls[0].Destination.ToAddresses).toEqual(['author@example.com']);
  expect(calls[0].Source).toBe('no-reply@pumpfoilmap.org');

    // List should no longer contain it
  const lst2 = await listSpots({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    const body2 = JSON.parse(lst2.body as string);
    const ids2: string[] = body2.items.map((s: any) => s.spotId);
    expect(ids2).not.toContain(spotId);
  });
});
