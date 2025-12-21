import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const IS_OFFLINE = process.env.IS_OFFLINE === 'true';
const IS_AWS = !!process.env.AWS_EXECUTION_ENV;
const REGION = process.env.AWS_REGION || 'eu-west-3';

//const DEBUG = process.env.PFM_DEBUG === '1' || IS_OFFLINE;
const DEBUG= true;

export const TABLE_SPOTS = process.env.TABLE_SPOTS as string;

// In AWS (prod), ignore any local endpoint override; only honor endpoint in local/offline
const endpointEnv = process.env.DYNAMODB_ENDPOINT;
const ENDPOINT = (!IS_AWS && endpointEnv) ? endpointEnv : (IS_OFFLINE ? 'http://localhost:8000' : undefined);

if (DEBUG) {
  // Log minimal client configuration once
  console.log('[ddb] configure client', {
    region: REGION,
    endpoint: ENDPOINT || null,
    table: TABLE_SPOTS
  });
}

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT
});

export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

let tableEnsured: Promise<void> | null = null;

export async function ensureSpotsTable(): Promise<void> {
  if (process.env.JEST_WORKER_ID) return; // skip in unit tests to avoid ESM issues
  if (!TABLE_SPOTS) return;
  // Ne crée la table automatiquement qu'en local/offline
  if (!ENDPOINT && !IS_OFFLINE) return;
  if (tableEnsured) return tableEnsured;
  tableEnsured = (async () => {
    try {
      const mod = await import('@aws-sdk/client-dynamodb');
      const { DescribeTableCommand, CreateTableCommand, waitUntilTableExists } = mod as any;
      if (DEBUG) console.log('[ddb] ensure table describe', { table: TABLE_SPOTS });
      try {
        await (client as any).send(new DescribeTableCommand({ TableName: TABLE_SPOTS }));
        if (DEBUG) console.log('[ddb] table exists', { table: TABLE_SPOTS });
        return;
      } catch (e: any) {
        if (e?.name !== 'ResourceNotFoundException') throw e;
      }
      if (DEBUG) console.log('[ddb] create table', { table: TABLE_SPOTS });
      await (client as any).send(new CreateTableCommand({
        TableName: TABLE_SPOTS,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'spotId', AttributeType: 'S' }
        ],
        KeySchema: [
          { AttributeName: 'spotId', KeyType: 'HASH' }
        ]
      }));
      await waitUntilTableExists({ client: client as any, maxWaitTime: 30 }, { TableName: TABLE_SPOTS });
      if (DEBUG) console.log('[ddb] table ready', { table: TABLE_SPOTS });
    } catch (err) {
      console.error('[ddb] ensure table failed', err);
      throw err;
    }
  })();
  return tableEnsured;
}

export { client };
