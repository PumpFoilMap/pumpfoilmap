import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
// @ts-ignore - JS module without types
import svgCaptcha from 'svg-captcha';
import { encrypt } from '../lib/crypto';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

export const handler = async (): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const { data, text } = svgCaptcha.create({ noise: 2, color: true, width: 160, height: 60 });
    const secret = encrypt(text);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ data, secret }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal error' }) };
  }
};
