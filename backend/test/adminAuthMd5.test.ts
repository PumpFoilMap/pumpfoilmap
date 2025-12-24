process.env.USE_INMEMORY = 'true';
process.env.ADMIN_TOKEN = 'dev';

import { handler as listSpots } from '../src/handlers/adminListSpots';
import { createHash } from 'node:crypto';

function md5(s: string) { return createHash('md5').update(s).digest('hex'); }

describe('Admin md5 protection', () => {
  it('returns 400 when md5 is missing', async () => {
    const res = await listSpots({} as any);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body as string);
    expect(body.message).toBe('Missing md5');
  });

  it('returns 401 when md5 is wrong', async () => {
    const res = await listSpots({ headers: { authorization: `Bearer ${md5('not-dev')}` } } as any);
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body as string);
    expect(body.message).toBe('Unauthorized');
  });

  it('returns 200 when md5 is correct', async () => {
    const res = await listSpots({ headers: { authorization: `Bearer ${md5('dev')}` } } as any);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body as string);
    expect(Array.isArray(body.items)).toBe(true);
  });
});
