import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getDocumentClient } from "./dynamodb";
import { TripRecord, TripStatus } from "@/types";
import { decodeCursor, encodeCursor } from "./cursor";

const ALLOWED_STATUSES: TripStatus[] = [
  "FINISH",
  "FINISHED",
  "PART_FINISHED",
  "PART_FINISH",
];
const DEFAULT_PAGE_SIZE = 10;

function getTableName(): string {
  const tableName = process.env.TRIPS_TABLE_NAME || process.env.TRIP_TABLE_NAME;
  if (!tableName) {
    throw new Error("TRIPS_TABLE_NAME 未配置，无法查询设备行程数据");
  }

  return tableName;
}

function normalizeStatus(status?: TripStatus): TripStatus {
  if (!status) return "";
  return (typeof status === "string" ? status : "").toUpperCase() as TripStatus;
}

function isActiveTrip(record: TripRecord): boolean {
  const status = normalizeStatus(record.status);
  const deleted = record.deleted as unknown;

  const notDeleted =
    deleted === undefined ||
    deleted === null ||
    deleted === false ||
    deleted === "false" ||
    deleted === 0;

  return notDeleted && ALLOWED_STATUSES.includes(status);
}

export interface QueryTripsParams {
  deviceId: string;
  pageSize?: number;
  cursor?: string;
}

export interface QueryTripsResult {
  trips: TripRecord[];
  nextCursor?: string;
}

export async function queryTripsByDevice({
  deviceId,
  pageSize = DEFAULT_PAGE_SIZE,
  cursor,
}: QueryTripsParams): Promise<QueryTripsResult> {
  const TableName = getTableName();
  const client = getDocumentClient();
  const indexName =
    process.env.TRIPS_DEVICE_INDEX_NAME || "gsi.device_id-start_time";

  const command = new QueryCommand({
    TableName,
    IndexName: indexName,
    KeyConditionExpression: "#device = :deviceId",
    ExpressionAttributeNames: {
      "#device": "device_id",
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":deviceId": deviceId,
      ":deletedFalse": false,
      ":statusFinish": "FINISH",
      ":statusPartFinish": "PART_FINISH",
    },
    FilterExpression:
      "(attribute_not_exists(deleted) OR deleted = :deletedFalse) AND (#status = :statusFinish OR #status = :statusPartFinish)",
    Limit: pageSize,
    ExclusiveStartKey: decodeCursor(cursor),
    ScanIndexForward: false,
  });

  const response = await client.send(command);

  const items =
    (response.Items as TripRecord[] | undefined)?.filter(isActiveTrip) ?? [];
  const nextCursor = response.LastEvaluatedKey
    ? encodeCursor(response.LastEvaluatedKey)
    : undefined;

  return { trips: items, nextCursor };
}

export async function getTripById(
  deviceId: string,
  tripId: string
): Promise<TripRecord | null> {
  const TableName = getTableName();
  const client = getDocumentClient();

  const response = await client.send(
    new GetCommand({
      TableName,
      Key: {
        id: tripId,
      },
    })
  );

  const trip = response.Item as TripRecord | undefined;

  if (!trip || normalizeStatus(trip.status) === "") {
    return null;
  }

  if (trip.device_id !== deviceId) {
    return null;
  }

  return isActiveTrip(trip) ? trip : null;
}
