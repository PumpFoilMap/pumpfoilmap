import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { deleteSpot } from '../lib/spotsRepo';
import { authorizeAdmin } from '../lib/adminAuth';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const auth = authorizeAdmin(event);
    if ('code' in auth) {
      return { statusCode: auth.code, headers: cors, body: JSON.stringify({ message: auth.code === 400 ? 'Missing md5' : 'Unauthorized' }) };
    }
    const spotId = event.pathParameters?.id;
    if (!spotId) return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'Missing id' }) };
    const ok = await deleteSpot(spotId);
    if (!ok) return { statusCode: 404, headers: cors, body: JSON.stringify({ message: 'Not found' }) };
    return { statusCode: 204, headers: cors, body: '' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
