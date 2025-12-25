import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import axios from 'axios';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handler as captchaGenerate } from '../src/handlers/captchaGenerate';
import { handler as captchaVerify } from '../src/handlers/captchaVerify';

jest.setTimeout(60_000);

const PORT = 4012;
const BASE = `http://127.0.0.1:${PORT}`;

function toApiGwEvent(req: IncomingMessage, body?: any): APIGatewayProxyEventV2 {
  const url = new URL(req.url || '/', BASE);
  const qs: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (qs[k] = v));
  const path = url.pathname;
  return {
    version: '2.0',
    routeKey: `${req.method} ${path}`,
    rawPath: path,
    rawQueryString: url.searchParams.toString(),
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)])
    ),
    requestContext: {} as any,
    isBase64Encoded: false,
    queryStringParameters: Object.keys(qs).length ? qs : undefined,
    body: body ? JSON.stringify(body) : undefined
  } as APIGatewayProxyEventV2;
}

async function readJsonBody(req: IncomingMessage): Promise<any | undefined> {
  return await new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req
      .on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
      .on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve(undefined);
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(undefined);
        }
      });
  });
}

describe('E2E Captcha (Express wrapper)', () => {
  let server: http.Server;

  beforeAll(async () => {
    process.env.CAPTCHA_PRIVATE_KEY = 'e2e-secret';
    server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const method = req.method || 'GET';
      const urlObj = new URL(req.url || '/', BASE);
      res.setHeader('content-type', 'application/json');

      if (method === 'GET' && urlObj.pathname === '/captcha') {
        const out = (await captchaGenerate()) as APIGatewayProxyResultV2 | string;
        const normalized = typeof out === 'string' ? { statusCode: 200, headers: {}, body: out } : out;
        if (normalized.headers) { for (const [k, v] of Object.entries(normalized.headers)) res.setHeader(k, String(v)); }
        res.statusCode = normalized.statusCode || 200;
        res.end(normalized.body);
        return;
      }

      if (method === 'POST' && urlObj.pathname === '/captcha/verify') {
        const json = await readJsonBody(req);
        const event = toApiGwEvent(req, json);
        const out = (await captchaVerify(event as any)) as APIGatewayProxyResultV2 | string;
        const normalized = typeof out === 'string' ? { statusCode: 200, headers: {}, body: out } : out;
        if (normalized.headers) { for (const [k, v] of Object.entries(normalized.headers)) res.setHeader(k, String(v)); }
        res.statusCode = normalized.statusCode || 200;
        res.end(normalized.body);
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not found' }));
    });

    await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /captcha then POST /captcha/verify validates answer', async () => {
    const genRes = await axios.get(`${BASE}/captcha`, { validateStatus: () => true });
    expect(genRes.status).toBe(200);
    const { data, secret } = genRes.data as { data: string; secret: string };
    expect(data).toContain('<svg');
    expect(typeof secret).toBe('string');

    // Ideally the client would read the SVG and human would answer; in test we decrypt the secret
    const expectedText = (await (await import('../src/lib/crypto'))).decrypt(secret);

    const verRes = await axios.post(`${BASE}/captcha/verify`, { secret, answer: expectedText }, { validateStatus: () => true });
    expect(verRes.status).toBe(200);
    expect(verRes.data.ok).toBe(true);

    const badRes = await axios.post(`${BASE}/captcha/verify`, { secret, answer: 'nope' }, { validateStatus: () => true });
    expect(badRes.status).toBe(200);
    expect(badRes.data.ok).toBe(false);
  });
});
