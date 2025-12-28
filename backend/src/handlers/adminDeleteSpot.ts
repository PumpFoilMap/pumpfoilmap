import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
import { deleteSpot, getSpotById } from '../lib/spotsRepo';
import { authorizeAdmin } from '../lib/adminAuth';
import { sendEmail } from '../lib/email';

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
      const existing = await getSpotById(spotId);
      const ok = await deleteSpot(spotId);
    if (!ok) return { statusCode: 404, headers: cors, body: JSON.stringify({ message: 'Not found' }) };
      // Notify author if contactEmail present
      const author = (existing as any)?.contactEmail as string | undefined;
      if (author) {
        const subject = 'PumpFoilMap — Votre soumission a été supprimée';
        const text = `Bonjour,

  Votre soumission (ID: ${spotId}${existing?.name ? `, Nom: ${existing.name}` : ''}) a été supprimée par un administrateur.
  Si vous pensez qu'il s'agit d'une erreur, vous pouvez nous contacter.`;
        sendEmail({ to: author, subject, text }).catch((e: any) => {
          console.error('[adminDeleteSpot] author email failed', { name: e?.name, message: e?.message });
        });
      }
    return { statusCode: 204, headers: cors, body: '' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
