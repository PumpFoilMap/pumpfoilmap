import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { decrypt } from '../lib/crypto';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const secret = String(body.secret ?? '');
    const answer = String(body.answer ?? '').trim();
    if (!secret || !answer) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, message: 'Missing secret or answer' }) };
    }
    let expected: string;
    try {
      expected = decrypt(secret);
    } catch (err: any) {
      // Log as much context as possible without exposing sensitive plain data
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(secret);
      let base64Bytes = 0;
      try { base64Bytes = Buffer.from(secret, 'base64').length; } catch {}
      console.error('[captchaVerify] decrypt failed', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        secretLength: secret.length,
        isBase64,
        base64Bytes,
        answerLength: answer.length
      });
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, message: 'Invalid secret' }) };
    }
    const ok = expected.trim().toLowerCase() === answer.toLowerCase();
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok }) };
  } catch (err) {
    // Unhandled exception: include structured details and a safe preview of the body
    const anyErr: any = err;
    console.error('[captchaVerify] handler error', {
      name: anyErr?.name,
      message: anyErr?.message,
      stack: anyErr?.stack,
      hasBody: !!event.body,
      bodyPreview: event.body ? String(event.body).slice(0, 200) : null
    });
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, message: 'Internal error' }) };
  }
};
