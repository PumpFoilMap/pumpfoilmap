import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { listSpots } from '../lib/spotsRepo';
import { authorizeAdmin } from '../lib/adminAuth';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const auth = authorizeAdmin(event);
    if ('code' in auth) {
      return { statusCode: auth.code, headers: cors, body: JSON.stringify({ message: auth.code === 400 ? 'Missing md5' : 'Unauthorized' }) };
    }
    const size = Math.min(Number(event.queryStringParameters?.size ?? 20), 100);
    const items = await listSpots(1000);
    const pending = items
      .filter((s: any) => s.status === 'pending')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, size);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ items: pending, count: pending.length }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
