#!/usr/bin/env node
/**
 * 删除本地 DynamoDB 中 mileage 低于阈值的行程数据
 * 默认连接 LocalStack(http://localhost:4566)，支持 CLI 参数与环境变量覆盖。
 *
 * 示例：
 * node src/script/delete-low-mileage.js \
 *   --table device.trip_history \
 *   --threshold 100 \
 *   --endpoint http://localhost:4566 \
 *   --partition-key id \
 *   --dry-run
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  DynamoDBClient,
  paginateScan,
  BatchWriteItemCommand,
} = require("@aws-sdk/client-dynamodb");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const eqIndex = token.indexOf("=");
    const key = token.slice(2, eqIndex > -1 ? eqIndex : undefined);
    const nextValue =
      argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[key] = eqIndex > -1 ? token.slice(eqIndex + 1) : nextValue;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

function readConfig() {
  const get = (...candidates) => {
    for (const key of candidates) {
      if (args[key] !== undefined) return args[key];
      const upper = key.toUpperCase().replace(/-/g, "_");
      if (process.env[upper] !== undefined) return process.env[upper];
    }
    return undefined;
  };

  const tableName = get("table", "TABLE_NAME");
  if (!tableName) {
    console.error("ERROR: 请通过 --table 或 TABLE_NAME 指定表名");
    process.exit(1);
  }

  const threshold = Number(get("threshold", "THRESHOLD") ?? "100");
  if (!Number.isFinite(threshold) || threshold < 0) {
    console.error("ERROR: threshold 必须为非负数字");
    process.exit(1);
  }

  const partitionKey = get("partition-key", "PARTITION_KEY") ?? "id";
  const sortKey = get("sort-key", "SORT_KEY");

  return {
    tableName,
    threshold,
    partitionKey,
    sortKey,
    region: get("region", "REGION") ?? "us-east-1",
    endpoint: get("endpoint", "ENDPOINT", "LOCALSTACK_ENDPOINT") ?? "http://localhost:4566",
    accessKeyId: get("access-key-id", "ACCESS_KEY_ID") ?? "test",
    secretAccessKey: get("secret-access-key", "SECRET_ACCESS_KEY") ?? "test",
    pageLimit: Number(get("page-limit", "PAGE_LIMIT") ?? "100"),
    maxRetries: Number(get("max-retries", "MAX_RETRIES") ?? "8"),
    rateSleepMs: Number(get("rate-sleep", "RATE_SLEEP_MS") ?? "0"),
    dryRun: ["1", "true", "yes"].includes(
      String(get("dry-run", "DRY_RUN") ?? "false").toLowerCase()
    ),
  };
}

const CONFIG = readConfig();

const dynamo = new DynamoDBClient({
  region: CONFIG.region,
  endpoint: CONFIG.endpoint,
  credentials: {
    accessKeyId: CONFIG.accessKeyId,
    secretAccessKey: CONFIG.secretAccessKey,
  },
});

function attrValueToPrimitive(av) {
  if (!av) return undefined;
  if (av.S !== undefined) return av.S;
  if (av.N !== undefined) return Number(av.N);
  if (av.BOOL !== undefined) return av.BOOL;
  if (av.NULL) return null;
  return JSON.stringify(av);
}

function extractKeyFromItem(item) {
  const key = {};
  const partitionAttr = item[CONFIG.partitionKey];
  if (!partitionAttr) {
    throw new Error(
      `扫描结果缺少分区键 ${CONFIG.partitionKey}，请确认 PartitionKey 配置`
    );
  }
  key[CONFIG.partitionKey] = partitionAttr;

  if (CONFIG.sortKey) {
    const sortAttr = item[CONFIG.sortKey];
    if (!sortAttr) {
      throw new Error(
        `扫描结果缺少排序键 ${CONFIG.sortKey}，请确认 SortKey 配置`
      );
    }
    key[CONFIG.sortKey] = sortAttr;
  }

  return key;
}

async function batchDelete(keys) {
  if (!keys.length) return 0;

  let deleted = 0;

  for (let i = 0; i < keys.length; i += 25) {
    let requestItems = {
      [CONFIG.tableName]: keys
        .slice(i, i + 25)
        .map((Key) => ({ DeleteRequest: { Key } })),
    };

    let attempt = 0;

    while (requestItems[CONFIG.tableName].length > 0) {
      const res = await dynamo.send(
        new BatchWriteItemCommand({ RequestItems: requestItems })
      );

      const unprocessed = res.UnprocessedItems?.[CONFIG.tableName] ?? [];
      deleted += requestItems[CONFIG.tableName].length - unprocessed.length;

      if (!unprocessed.length) {
        break;
      }

      attempt += 1;
      if (attempt > CONFIG.maxRetries) {
        throw new Error(
          `BatchWrite 重试次数耗尽，剩余 ${unprocessed.length} 条未删除`
        );
      }

      const backoff = Math.min(1000 * 2 ** attempt, 15000);
      const jitter = Math.floor(Math.random() * 200);
      await sleep(backoff + jitter);
      requestItems = { [CONFIG.tableName]: unprocessed };
    }
  }

  return deleted;
}

async function main() {
  console.log(
    `[start] table=${CONFIG.tableName} threshold=${CONFIG.threshold} dryRun=${CONFIG.dryRun}`
  );

  const projectionFields = [CONFIG.partitionKey];
  if (CONFIG.sortKey) {
    projectionFields.push(CONFIG.sortKey);
  }
  projectionFields.push("mileage");

  const paginator = paginateScan(
    { client: dynamo },
    {
      TableName: CONFIG.tableName,
      Limit: CONFIG.pageLimit,
      ProjectionExpression: projectionFields.join(", "),
      FilterExpression:
        "attribute_exists(mileage) AND mileage < :threshold",
      ExpressionAttributeValues: {
        ":threshold": { N: CONFIG.threshold.toString() },
      },
    }
  );

  let totalExamined = 0;
  let totalDeleted = 0;
  let pageIndex = 0;

  for await (const page of paginator) {
    pageIndex += 1;
    const items = page.Items ?? [];
    totalExamined += items.length;

    if (!items.length) {
      continue;
    }

    const deleteTargets = items.map((item) => ({
      key: extractKeyFromItem(item),
      mileage: attrValueToPrimitive(item.mileage),
    }));

    if (CONFIG.dryRun) {
      deleteTargets.forEach((target) => {
        console.log(
          `[dry-run] would delete ${JSON.stringify(target.key)} mileage=${target.mileage}`
        );
      });
      continue;
    }

    const deleted = await batchDelete(deleteTargets.map((t) => t.key));
    totalDeleted += deleted;

    console.log(
      `[page ${pageIndex}] candidates=${deleteTargets.length} deleted=${deleted} totalDeleted=${totalDeleted}`
    );

    if (CONFIG.rateSleepMs > 0) {
      await sleep(CONFIG.rateSleepMs);
    }
  }

  console.log(
    `[done] examined=${totalExamined} deleted=${totalDeleted} dryRun=${CONFIG.dryRun} ✅`
  );
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exit(1);
});
