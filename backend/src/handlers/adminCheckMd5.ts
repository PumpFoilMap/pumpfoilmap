import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const admin = process.env.ADMIN_TOKEN || '';
    const adminHash = admin ? md5(admin) : '';

    const body = event.body ? JSON.parse(event.body) : undefined;
    const qp = event.queryStringParameters || {};
    const inputMd5: string | undefined = (body && typeof body.md5 === 'string' && body.md5)
      || (typeof qp.md5 === 'string' && qp.md5)
      || undefined;

    console.info("Received md5:", inputMd5);
    console.info("Password:", admin);
    console.info("Password Hash:", adminHash);

    if (!inputMd5) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'Missing md5' }) };
    }
    if (!adminHash) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ match: false, message: 'Admin token not set' }) };
    }

    const match = inputMd5.toLowerCase() === adminHash.toLowerCase();
    return { statusCode: 200, headers: cors, body: JSON.stringify({ match }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
