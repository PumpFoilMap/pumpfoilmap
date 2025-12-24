// Activer le mode in-memory réel pour ce test d’intégration léger (avant imports)
process.env.USE_INMEMORY = 'true';
process.env.PFM_DEBUG = '';
process.env.ADMIN_TOKEN = 'dev';
// Nettoyage du fichier de store si présent (utilise os.tmpdir pour être aligné avec spotsRepo)
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const STORE = path.join(os.tmpdir(), 'pfm-inmemory-spots.json');
try { fs.unlinkSync(STORE); } catch {}

import { handler as submitHandler } from '../src/handlers/submitSpot';
import { handler as approveHandler } from '../src/handlers/approveSpot';
import { handler as rejectHandler } from '../src/handlers/rejectSpot';
import { handler as adminListPending } from '../src/handlers/adminListPending';
import { createHash } from 'node:crypto';

function md5(s: string) { return createHash('md5').update(s).digest('hex'); }

describe('Moderation flow', () => {
  it('submits then approves a spot', async () => {
    const submitPayload = {
      type: 'association',
      name: 'Assoc 1',
      lat: 1,
      lng: 2,
      submittedBy: 'alice'
    };
    const submitRes = await submitHandler({ body: JSON.stringify(submitPayload) } as any);
    expect(submitRes.statusCode).toBe(202);
    const submitBody = JSON.parse(submitRes.body as string);

    // Approve
  const approveRes = await approveHandler({ pathParameters: { id: submitBody.spotId }, headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.body as string);
    expect(approveBody.status).toBe('approved');

    // Reject (should flip to rejected)
  const rejectRes = await rejectHandler({ pathParameters: { id: submitBody.spotId }, headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(rejectRes.statusCode).toBe(200);
    const rejectBody = JSON.parse(rejectRes.body as string);
    expect(rejectBody.status).toBe('rejected');
  });

  it('lists pending after submit (in-memory) then disappears after approval', async () => {
    // Submit
    const payload = { type: 'association', name: 'Assoc 2', lat: 1, lng: 2, submittedBy: 'bob' };
    const sub = await submitHandler({ body: JSON.stringify(payload) } as any);
    expect([202,201]).toContain(sub.statusCode);
    const { spotId } = JSON.parse(sub.body as string);

    // Pending should include it
  const list = await adminListPending({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(list.statusCode).toBe(200);
    const data = JSON.parse(list.body as string);
    const ids = (data.items || []).map((x: any) => x.spotId);
    expect(ids).toContain(spotId);

    // Approve
  const appr = await approveHandler({ pathParameters: { id: spotId }, headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(appr.statusCode).toBe(200);

    // Now pending should not include it
  const list2 = await adminListPending({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(list2.statusCode).toBe(200);
    const data2 = JSON.parse(list2.body as string);
    const ids2 = (data2.items || []).map((x: any) => x.spotId);
    expect(ids2).not.toContain(spotId);
  });
});
