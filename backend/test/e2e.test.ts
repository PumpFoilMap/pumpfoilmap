import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import axios from 'axios';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handler as getSpots } from '../src/handlers/getSpots';
import { handler as postSpot } from '../src/handlers/postSpot';
// adminSendMail endpoint removed
// import { createHash } from 'node:crypto';

jest.setTimeout(60_000);

const PORT = 4011;
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

describe('E2E (Express wrapper)', () => {
  let server: http.Server;

  beforeAll(async () => {
    process.env.USE_INMEMORY = 'true';
    server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const method = req.method || 'GET';
      const urlObj = new URL(req.url || '/', BASE);
      res.setHeader('content-type', 'application/json');

      if (method === 'GET' && urlObj.pathname === '/spots') {
        const event = toApiGwEvent(req);
        const out = (await getSpots(event as any)) as APIGatewayProxyResultV2 | string;
        const normalized =
          typeof out === 'string'
            ? { statusCode: 200, headers: {}, body: out }
            : out;
        if (normalized.headers) {
          for (const [k, v] of Object.entries(normalized.headers)) res.setHeader(k, String(v));
        }
        res.statusCode = normalized.statusCode || 200;
        res.end(normalized.body);
        return;
      }

      if (method === 'POST' && urlObj.pathname === '/spots') {
        const json = await readJsonBody(req);
        const event = toApiGwEvent(req, json);
        const out = (await postSpot(event as any)) as APIGatewayProxyResultV2 | string;
        const normalized =
          typeof out === 'string'
            ? { statusCode: 200, headers: {}, body: out }
            : out;
        if (normalized.headers) {
          for (const [k, v] of Object.entries(normalized.headers)) res.setHeader(k, String(v));
        }
        res.statusCode = normalized.statusCode || 200;
        res.end(normalized.body);
        return;
      }

      // /admin/send-mail endpoint removed

      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'Not found' }));
    });

    await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', () => resolve()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('POST /spots then GET /spots returns the created item', async () => {
    const payload = {
      name: 'E2E Spot',
      lat: 48.9,
      lng: 2.4,
      description: 'created by e2e'
    };

    const postRes = await axios.post(`${BASE}/spots`, payload, { validateStatus: () => true });
    expect(postRes.status).toBe(201);
    const created = postRes.data;
    expect(created.spotId).toBeDefined();
    expect(created.name).toBe('E2E Spot');

    const getRes = await axios.get(`${BASE}/spots`, { validateStatus: () => true });
    expect(getRes.status).toBe(200);
    const { items } = getRes.data as { items: any[] };
    expect(items.find((s) => s.spotId === created.spotId)).toBeTruthy();
  });

  // Removed adminSendMail E2E route and test
});
