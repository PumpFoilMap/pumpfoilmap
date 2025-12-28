jest.doMock('@aws-sdk/client-ses', () => {
  return {
    SESClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ MessageId: 'mid-spot' })
    })),
    SendEmailCommand: jest.fn().mockImplementation((input: any) => input)
  };
}, { virtual: true });
import { handler } from '../src/handlers/submitSpot';

jest.mock('../src/lib/db', () => {
  return {
    __esModule: true,
    TABLE_SPOTS: 'test-table',
    ddb: { send: jest.fn() }
  };
});

const { ddb } = jest.requireMock('../src/lib/db');

describe('POST /spots/submit', () => {
  const ses = require('@aws-sdk/client-ses');
  beforeEach(() => {
    ses.SendEmailCommand.mockClear();
  });
  it('fails on invalid payload', async () => {
    const res = await handler({ body: JSON.stringify({}) } as any);
    expect(res.statusCode).toBe(400);
  });

  it('accepts valid ponton submission with contact email', async () => {
    process.env.ADMIN_MAIL = 'admin@example.com';
    ddb.send.mockResolvedValueOnce({});
    const payload = {
      type: 'ponton',
      name: 'New Ponton',
      lat: 42.1,
      lng: 5.2,
      submittedBy: 'alice',
        heightCm: 150,
      lengthM: 8,
      access: 'autorise',
      address: 'Quai Test',
      contactEmail: 'alice@example.com'
    } as const;
    const res = await handler({ body: JSON.stringify(payload) } as any);
    expect(res.statusCode).toBe(202);
    // admin + author emails should have been attempted
    const ses = require('@aws-sdk/client-ses');
    const calls = ses.SendEmailCommand.mock.calls.map((args: any[]) => args[0]);
    expect(calls.length).toBe(2);
    // verify sender and recipients
    const recipients = calls.map((c: any) => c?.Destination?.ToAddresses?.[0]);
    expect(recipients.sort()).toEqual(['admin@example.com', 'alice@example.com'].sort());
    calls.forEach((c: any) => {
      expect(c.Source).toBe('no-reply@pumpfoilmap.org');
    });
    const body = JSON.parse(res.body as string);
    expect(body.spotId).toBeDefined();
    expect(body.status).toBe('pending');
    expect(body.createdAt).toBeDefined();
    // ensure we did not echo sensitive fields unnecessarily
    expect(body.name).toBeUndefined();
  });

  it('accepts association without optional fields', async () => {
    process.env.ADMIN_MAIL = 'admin@example.com';
    ddb.send.mockResolvedValueOnce({});
    const payload = {
      type: 'association',
      name: 'Assoc',
      lat: 10,
      lng: 11,
      submittedBy: 'bob'
    } as const;
    const res = await handler({ body: JSON.stringify(payload) } as any);
    expect(res.statusCode).toBe(202);
    // only admin email (no contactEmail)
    const ses = require('@aws-sdk/client-ses');
    const calls = ses.SendEmailCommand.mock.calls.map((args: any[]) => args[0]);
    expect(calls.length).toBe(1);
    expect(calls[0].Destination.ToAddresses).toEqual(['admin@example.com']);
    expect(calls[0].Source).toBe('no-reply@pumpfoilmap.org');
  });
});
