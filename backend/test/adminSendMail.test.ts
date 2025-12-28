import { handler } from '../src/handlers/adminSendMail';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';

function makeEvent(body?: any, auth?: string): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /admin/send-mail',
    rawPath: '/admin/send-mail',
    rawQueryString: '',
    headers: auth ? { authorization: auth } as any : {} as any,
    requestContext: {} as any,
    isBase64Encoded: false,
    body: body ? JSON.stringify(body) : undefined
  } as APIGatewayProxyEventV2;
}

describe('adminSendMail handler', () => {
  beforeAll(() => {
    process.env.ADMIN_TOKEN = 'dev';
    process.env.ADMIN_MAIL = 'dev@example.com';
  });

  it('rejects when unauthorized', async () => {
    const res = await handler(makeEvent({ subject: 's', message: 'm' }));
    expect(res.statusCode).toBe(400);
  });

  it('succeeds with md5 auth and valid ADMIN_MAIL', async () => {
    const md5 = createHash('md5').update(String(process.env.ADMIN_TOKEN)).digest('hex');
    jest.doMock('@aws-sdk/client-ses', () => {
      return {
        SESClient: jest.fn().mockImplementation(() => ({
          send: jest.fn().mockResolvedValue({ MessageId: 'mid-001' })
        })),
        SendEmailCommand: jest.fn().mockImplementation((x:any) => x)
      };
    }, { virtual: true });
    const res = await handler(makeEvent({ subject: 'Hello', message: 'World' }, `Bearer ${md5}`));
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(String(res.body));
    expect(data.ok).toBe(true);
    expect(data.messageId).toBeDefined();
  });

  it('reports error when ADMIN_MAIL missing', async () => {
    const old = process.env.ADMIN_MAIL;
    delete process.env.ADMIN_MAIL;
    const md5 = createHash('md5').update(String(process.env.ADMIN_TOKEN)).digest('hex');
    const res = await handler(makeEvent({ subject: 's', message: 'm' }, `Bearer ${md5}`));
    expect(res.statusCode).toBe(500);
    process.env.ADMIN_MAIL = old;
  });
});
