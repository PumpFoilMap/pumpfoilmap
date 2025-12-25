import { handler as gen } from '../src/handlers/captchaGenerate';
import { handler as verify } from '../src/handlers/captchaVerify';
import { decrypt } from '../src/lib/crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('Captcha handlers', () => {
  beforeAll(() => {
    process.env.CAPTCHA_PRIVATE_KEY = 'unit-test-secret-key';
  });

  it('generates captcha and verifies correct answer', async () => {
    const res = await gen();
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(String(res.body));
    expect(typeof payload.data).toBe('string');
    expect(payload.data).toContain('<svg');
    expect(typeof payload.secret).toBe('string');

    const expectedText = decrypt(payload.secret);

    const reqOk: APIGatewayProxyEventV2 = {
      version: '2.0',
      routeKey: 'POST /captcha/verify',
      rawPath: '/captcha/verify',
      rawQueryString: '',
      requestContext: {} as any,
      isBase64Encoded: false,
      headers: {},
      body: JSON.stringify({ secret: payload.secret, answer: expectedText })
    };
    const verOk = await verify(reqOk as any);
    expect(verOk.statusCode).toBe(200);
    const verOkBody = JSON.parse(String(verOk.body));
    expect(verOkBody.ok).toBe(true);

    const reqBad: APIGatewayProxyEventV2 = { ...reqOk, body: JSON.stringify({ secret: payload.secret, answer: 'wrong' }) };
    const verBad = await verify(reqBad as any);
    expect(verBad.statusCode).toBe(200);
    const verBadBody = JSON.parse(String(verBad.body));
    expect(verBadBody.ok).toBe(false);
  });
});
