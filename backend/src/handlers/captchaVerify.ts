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
    } catch {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, message: 'Invalid secret' }) };
    }
    const ok = expected.trim().toLowerCase() === answer.toLowerCase();
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, message: 'Internal error' }) };
  }
};
