// Lightweight SES email sender. Uses runtime require to avoid compile-time dependency in tests.
type SesClientLike = { send: (cmd: any) => Promise<any> };

export async function sendEmail(params: { to: string; subject: string; text: string; source?: string; html?: string }): Promise<{ ok: boolean; messageId?: string }> {
  const { to, subject, text, source, html } = params;
  if (!to || !subject || !text) throw new Error('Missing required email fields');
  const sesMod = require('@aws-sdk/client-ses');
  const SESClient: new (...args: any[]) => SesClientLike = sesMod.SESClient;
  const SendEmailCommand: new (input: any) => any = sesMod.SendEmailCommand;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-3';
  const client = new SESClient({ region });
  const input = {
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: html ? { Html: { Data: html }, Text: { Data: text } } : { Text: { Data: text } }
    },
    Source: source || to
  };
  const cmd = new SendEmailCommand(input);
  const resp = await client.send(cmd);
  return { ok: true, messageId: resp?.MessageId };
}
