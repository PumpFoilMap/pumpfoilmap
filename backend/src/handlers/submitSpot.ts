import { randomUUID } from 'crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { SpotCreateSchema } from '../lib/models';
import { createSpot } from '../lib/spotsRepo';
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
    const body = event.body ? JSON.parse(event.body) : {};
    const parsed = SpotCreateSchema.safeParse(body);
    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ message: 'Invalid payload', errors: parsed.error.issues })
      };
    }

    const now = new Date().toISOString();
    const spot = {
      spotId: randomUUID(),
      createdAt: now,
      status: 'pending' as const,
      ...parsed.data
    };

    await createSpot(spot as any);

    // Async notifications via SES (best-effort, do not fail submission on email errors)
    const adminMail = (process.env.ADMIN_MAIL || '').trim();
    if (adminMail) {
      const adminSubject = 'PumpFoilMap — Nouveau spot soumis';
      const adminText = `Un nouveau spot a été soumis:\n
Nom: ${spot.name}\nType: ${spot.type}\nCoordonnées: lat ${spot.lat}, lng ${spot.lng}\nSoumis par: ${spot.submittedBy}\nSpot ID: ${spot.spotId}`;
      // Fire and forget
      sendEmail({ to: adminMail, subject: adminSubject, text: adminText }).catch((e: any) => {
        console.error('[submitSpot] admin email failed', { name: e?.name, message: e?.message });
      });
      // Notify author if contactEmail provided
      const author = (spot as any).contactEmail as string | undefined;
      if (author) {
        const userSubject = 'PumpFoilMap — Votre soumission a été reçue';
        const userText = `Bonjour ${spot.submittedBy},\n\nVotre soumission du spot "${spot.name}" a été reçue et sera modérée sous peu.\n\nIdentifiant: ${spot.spotId}\nMerci !`;
        sendEmail({ to: author, subject: userSubject, text: userText }).catch((e: any) => {
          console.error('[submitSpot] author email failed', { name: e?.name, message: e?.message });
        });
      }
    }

    // Return minimal info to submitter plus moderation status
    return {
      statusCode: 202,
      headers: cors,
      body: JSON.stringify({
        spotId: spot.spotId,
        status: spot.status,
        createdAt: spot.createdAt
      })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
