import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { updateSpotStatus } from '../lib/spotsRepo';
import { authorizeAdmin } from '../lib/adminAuth';
import { sendEmail } from '../lib/email';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
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
    if (!spotId) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ message: 'Missing id' }) };
    }
    const updated = await updateSpotStatus(spotId, 'approved');
    if (!updated) {
      return { statusCode: 404, headers: cors, body: JSON.stringify({ message: 'Not found' }) };
    }
    // Notify author if contactEmail present
    const author = (updated as any)?.contactEmail as string | undefined;
    if (author) {
      const subject = 'PumpFoilMap — Votre soumission a été approuvée';
      const text = `Bonjour,\n\nVotre soumission (ID: ${updated.spotId}${updated?.name ? `, Nom: ${updated.name}` : ''}) a été approuvée.\nMerci pour votre contribution !`;
      sendEmail({ to: author, subject, text }).catch((e: any) => {
        console.error('[approveSpot] author email failed', { name: e?.name, message: e?.message });
      });
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ spotId: updated.spotId, status: updated.status }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
