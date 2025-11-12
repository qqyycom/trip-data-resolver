import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let documentClient: DynamoDBDocumentClient | null = null;

function createDocumentClient() {
  const endpoint = process.env.AWS_DYNAMODB_ENDPOINT;
  const region = process.env.AWS_REGION ?? (endpoint ? "local" : undefined);
  if (!region) {
    throw new Error("AWS_REGION 未配置，无法初始化 DynamoDB 客户端");
  }

  const hasExplicitCredentials = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
  );
  const credentials = hasExplicitCredentials
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      }
    : endpoint
      ? {
          // DynamoDB Local/LocalStack 需要任意值才能通过签名校验
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "LOCAL_DUMMY_KEY",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "LOCAL_DUMMY_SECRET",
        }
      : undefined;

  const baseClient = new DynamoDBClient({
    region,
    endpoint,
    credentials,
  });

  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}

export function getDocumentClient(): DynamoDBDocumentClient {
  if (!documentClient) {
    documentClient = createDocumentClient();
  }

  return documentClient;
}
