import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../src/handlers/adminCheckMd5';

function makeEvent(body?: any, query?: Record<string,string>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /admin/check-md5',
    rawPath: '/admin/check-md5',
    rawQueryString: '',
    headers: {},
    requestContext: {} as any,
    isBase64Encoded: false,
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : undefined
  } as APIGatewayProxyEventV2;
}

describe('adminCheckMd5', () => {
  const old = process.env.ADMIN_TOKEN;
  beforeAll(() => { process.env.ADMIN_TOKEN = 'dev'; });
  afterAll(() => { process.env.ADMIN_TOKEN = old; });

  it('returns match=true when md5 is provided directly', async () => {
    // md5('dev') = 0cbe7d3c9b8fdf2be1c9c600
    const crypto = await import('node:crypto');
    const md5 = crypto.createHash('md5').update('dev').digest('hex');
    const res = await handler(makeEvent({ md5 }));
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(String(res.body));
    expect(json.match).toBe(true);
  });

  it('returns match=false when md5 differs', async () => {
    const crypto = await import('node:crypto');
    const md5 = crypto.createHash('md5').update('wrong').digest('hex');
    const res = await handler(makeEvent({ md5 }));
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(String(res.body));
    expect(json.match).toBe(false);
  });

  it('returns 400 when input is missing', async () => {
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(400);
    const json = JSON.parse(String(res.body));
    expect(json.message).toBe('Missing md5');
  });
});
