#!/usr/bin/env node
/**
 * 同步线上 DynamoDB -> 本地 LocalStack（全量一次性）
 * - 线上：Scan 分页 + 轻量限速
 * - 本地：BatchWriteItem（25/批）+ UnprocessedItems 重试（指数退避）
 *
 * 运行前请确保在 LocalStack 先创建好与线上一致的表结构（主键/GSI）。
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("node:fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  DynamoDBClient,
  paginateScan,
  BatchWriteItemCommand,
} = require("@aws-sdk/client-dynamodb"); // eslint-disable-line @typescript-eslint/no-require-imports

// ------- 参数解析 -------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const eqIndex = token.indexOf("=");
    const key =
      eqIndex > -1 ? token.slice(2, eqIndex) : token.slice(2);
    let value =
      eqIndex > -1
        ? token.slice(eqIndex + 1)
        : argv[i + 1] && !argv[i + 1].startsWith("--")
          ? argv[++i]
          : "true";
    out[key] = value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

function readConfig() {
  const get = (...keys) => {
    for (const key of keys) {
      if (args[key] !== undefined) return args[key];
      const upper = key.toUpperCase();
      if (process.env[upper]) return process.env[upper];
      const normalized = upper.replace(/-/g, "_");
      if (process.env[normalized]) return process.env[normalized];
    }
    return undefined;
  };

  const tableName = get("table", "table-name", "TABLE_NAME");
  if (!tableName) {
    console.error("ERROR: 请通过 --table 或环境变量 TABLE_NAME 指定表名。");
    process.exit(1);
  }

  const resumeFileRaw = get("resume-file", "resume", "RESUME_FILE");
  const resumeFile =
    resumeFileRaw === "off"
      ? null
      : path.resolve(
          process.cwd(),
          resumeFileRaw && resumeFileRaw.length ? resumeFileRaw : ".ddb-sync-resume.json",
        );

  return {
    tableName,
    srcRegion: get("src-region", "src", "SRC_REGION") || "us-east-1",
    dstRegion: get("dst-region", "DST_REGION") || "us-east-1",
    dstEndpoint:
      get("localstack-endpoint", "endpoint", "LOCALSTACK_ENDPOINT") ||
      "http://localhost:4566",
    pageLimit: parseInt(get("page-limit", "PAGE_LIMIT") || "1000", 10),
    rateSleepMs: parseInt(get("rate-sleep", "RATE_SLEEP_MS") || "200", 10),
    projection: get("projection", "PROJECTION") || "",
    maxRetries: parseInt(get("max-retries", "MAX_RETRIES") || "8", 10),
    dstAccessKey: get("dst-access-key", "DST_ACCESS_KEY") || "test",
    dstSecretKey: get("dst-secret-key", "DST_SECRET_KEY") || "test",
    resumeFile,
  };
}

const CONFIG = readConfig();

// ------- 线上与本地客户端 -------
const srcDdb = new DynamoDBClient({
  region: CONFIG.srcRegion,
  // 使用你的默认凭证/配置（如本机已登录 aws configure 或者环境变量里已设置）
});

const dstDdbRaw = new DynamoDBClient({
  region: CONFIG.dstRegion,
  endpoint: CONFIG.dstEndpoint,
  credentials: {
    accessKeyId: CONFIG.dstAccessKey,
    secretAccessKey: CONFIG.dstSecretKey,
  },
});

// 用 Raw client 调 BatchWrite（我们自己做 25/批封装）；读用 paginateScan（raw）解包
const dstDdb = dstDdbRaw;

// ------- 工具函数 -------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 将数组切分为固定大小的块 */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * 批量写入（最多 25 条/批），对 UnprocessedItems 做指数退避重试
 */
async function batchWriteAll(tableName, items, { maxRetries = 8 } = {}) {
  if (!items.length) return 0;
  let written = 0;

  for (const group of chunk(items, 25)) {
    let requestItems = {
      [tableName]: group.map((Item) => ({ PutRequest: { Item } })),
    };

    let attempt = 0;
    while (true) {
      const res = await dstDdb.send(
        new BatchWriteItemCommand({ RequestItems: requestItems })
      );

      const unprocessed = res.UnprocessedItems?.[tableName] || [];
      written += requestItems[tableName].length - unprocessed.length;

      if (!unprocessed.length) break; // 本批处理完

      attempt += 1;
      if (attempt > maxRetries) {
        throw new Error(
          `BatchWrite 未处理条目过多，已达最大重试次数。剩余: ${unprocessed.length}`
        );
      }

      // 指数退避（带抖动）
      const backoff = Math.min(1000 * 2 ** attempt, 15000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoff + jitter);

      requestItems = { [tableName]: unprocessed };
    }
  }

  return written;
}

function loadResumeState(filePath) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`[resume] 读取 ${filePath} 失败：${err.message}`);
    return null;
  }
}

function saveResumeState(filePath, data) {
  if (!filePath) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn(`[resume] 写入 ${filePath} 失败：${err.message}`);
  }
}

function clearResumeState(filePath) {
  if (!filePath) return;
  if (!fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`[resume] 删除 ${filePath} 失败：${err.message}`);
  }
}

// ------- 主流程 -------
async function main() {
  const resumeState = loadResumeState(CONFIG.resumeFile);
  const startKey = resumeState?.exclusiveStartKey;

  console.log(
    `[start] table=${CONFIG.tableName} srcRegion=${CONFIG.srcRegion} localstack=${CONFIG.dstEndpoint} resume=${
      startKey ? "enabled" : "none"
    }`
  );

  const scanInput = {
    TableName: CONFIG.tableName,
    Limit: CONFIG.pageLimit,
    // 为了观测 RCU，也可以加 ReturnConsumedCapacity: "TOTAL"（注意线上费用）
    ProjectionExpression: CONFIG.projection || undefined,
    ExclusiveStartKey: startKey,
  };

  const paginator = paginateScan({ client: srcDdb }, scanInput);

  let totalRead = 0;
  let totalWritten = 0;
  let pageNo = 0;

  for await (const page of paginator) {
    pageNo += 1;

    const rawItems = page.Items || [];
    totalRead += rawItems.length;

    // 直接使用 Scan 返回的 AttributeValue 结构写入，避免多一次编解码
    const written = await batchWriteAll(CONFIG.tableName, rawItems, {
      maxRetries: CONFIG.maxRetries,
    });
    totalWritten += written;

    if (CONFIG.resumeFile) {
      if (page.LastEvaluatedKey) {
        saveResumeState(CONFIG.resumeFile, {
          exclusiveStartKey: page.LastEvaluatedKey,
          updatedAt: new Date().toISOString(),
        });
      } else {
        clearResumeState(CONFIG.resumeFile);
      }
    }

    console.log(
      `[page ${pageNo}] read=${rawItems.length} written=${written} totalRead=${totalRead} totalWritten=${totalWritten}`
    );

    // 简单限速，降低对线上 RCU 冲击
    if (CONFIG.rateSleepMs > 0) await sleep(CONFIG.rateSleepMs);
  }

  console.log(`[done] totalRead=${totalRead} totalWritten=${totalWritten} ✅`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
