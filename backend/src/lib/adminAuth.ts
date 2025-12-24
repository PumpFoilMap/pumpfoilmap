import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';

function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

export function isAdminMd5Valid(inputMd5: string | undefined): boolean {
  if (!inputMd5) return false;
  const admin = process.env.ADMIN_TOKEN || '';
  if (!admin) return false;
  const expected = md5(admin);
  return inputMd5.toLowerCase() === expected.toLowerCase();
}

export function getHeaderMd5(event: APIGatewayProxyEventV2): string | undefined {
  const auth = (event.headers?.authorization || (event.headers as any)?.Authorization) as string | undefined;
  if (!auth) return undefined;
  const prefix = 'bearer ';
  const v = auth.toLowerCase().startsWith(prefix) ? auth.slice(prefix.length) : (auth.startsWith('Bearer ') ? auth.slice(7) : undefined);
  return v?.trim();
}

/**
 * Centralized admin authorization: extracts MD5 from Authorization header
 * and validates it against ADMIN_TOKEN. Returns either the md5 or an error code.
 */
export function authorizeAdmin(event: APIGatewayProxyEventV2): { md5: string } | { code: 400 | 401 } {
  const md5Value = getHeaderMd5(event);
  if (!md5Value) return { code: 400 };
  if (!isAdminMd5Valid(md5Value)) return { code: 401 };
  return { md5: md5Value };
}
