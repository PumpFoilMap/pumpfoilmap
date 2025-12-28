import type { APIGatewayProxyStructuredResultV2, APIGatewayProxyEventV2 } from 'aws-lambda';
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
    const adminMail = (process.env.ADMIN_MAIL || '').trim();
    if (!adminMail) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'ADMIN_MAIL not configured' }) };
    }
    const body = (() => {
      try { return event.body ? JSON.parse(event.body) : {}; } catch { return {}; }
    })();
  const subject = (body?.subject || 'PumpFoilMap notification') as string;
  const message = (body?.message || 'Bonjour,\nUn événement administrateur a été déclenché.') as string;
    const result = await sendEmail({ to: adminMail, subject, text: message, source: adminMail });
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: result.ok, messageId: result.messageId }) };
  } catch (err: any) {
    console.error('[adminSendMail] error', { name: err?.name, message: err?.message, stack: err?.stack });
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
