import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function getKey(secret?: string): Buffer {
  const s = (secret ?? process.env.CAPTCHA_PRIVATE_KEY ?? '').trim();
  if (!s) throw new Error('CAPTCHA_PRIVATE_KEY missing');
  // Derive 32-byte key from secret using SHA-256
  return createHash('sha256').update(s).digest();
}

export function encrypt(plain: string, secret?: string): string {
  const key = getKey(secret);
  const iv = randomBytes(12); // GCM recommended IV size
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64')
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decrypt(secretB64: string, secret?: string): string {
  const key = getKey(secret);
  let payload: { iv: string; tag: string; data: string };
  try {
    const json = Buffer.from(secretB64, 'base64').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    throw new Error('Invalid secret payload');
  }
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
