import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
// import { SpotSchema, type Spot } from '../lib/models';
import { updateSpotFields } from '../lib/spotsRepo';
import { authorizeAdmin } from '../lib/adminAuth';
import { sendEmail } from '../lib/email';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'PATCH,OPTIONS'
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
    const body = event.body ? JSON.parse(event.body) : {};
    // Partial validation: merge with current stored spot is done in repo; here we only whitelist fields
  const allowed = ['name','lat','lng','description','imageUrl','contactEmail','heightCm','lengthM','access','address','url','website','type','status','moderationNote'] as const;
    const patch: any = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    const updated = await updateSpotFields(spotId, patch);
    if (!updated) return { statusCode: 404, headers: cors, body: JSON.stringify({ message: 'Not found' }) };
    // Notify author if contactEmail present
    const author = (updated as any)?.contactEmail as string | undefined;
    if (author) {
      const subject = 'PumpFoilMap — Votre soumission a été mise à jour';
      const text = `Bonjour,

Votre soumission (ID: ${spotId}${updated?.name ? `, Nom: ${updated.name}` : ''}) a été mise à jour par un administrateur.
${patch.moderationNote ? `Note de modération: ${String(patch.moderationNote)}` : ''}`;
      try {
        sendEmail({ to: author, subject, text }).catch((e: any) => {
          console.error('[adminUpdateSpot] author email failed (async)', { name: e?.name, message: e?.message });
        });
      } catch (e: any) {
        console.error('[adminUpdateSpot] author email failed (sync)', { name: e?.name, message: e?.message });
      }
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify(updated) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
