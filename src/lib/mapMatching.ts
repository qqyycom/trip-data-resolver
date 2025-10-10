import { TrajectoryPoint } from "@/types";

const MAPBOX_API_BASE = "https://api.mapbox.com/matching/v5";
const MAX_COORDINATES_PER_REQUEST = 100;
const CHUNK_OVERLAP = 5; // 重叠点数，确保轨迹连续性

interface MapMatchingResponse {
  code: string;
  matchings: Array<{
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
    confidence: number;
    distance: number;
    duration: number;
  }>;
  tracepoints: Array<{
    location: [number, number];
    matchings_index: number;
    waypoint_index: number;
  } | null>;
}

/**
 * 将坐标数组分块，每块最多 100 个点，带重叠以保证连续性
 */
export function chunkCoordinates(
  coordinates: [number, number][],
  maxSize: number = MAX_COORDINATES_PER_REQUEST,
  overlap: number = CHUNK_OVERLAP
): [number, number][][] {
  if (coordinates.length <= maxSize) {
    return [coordinates];
  }

  const chunks: [number, number][][] = [];
  let startIndex = 0;

  while (startIndex < coordinates.length) {
    const endIndex = Math.min(startIndex + maxSize, coordinates.length);
    const chunk = coordinates.slice(startIndex, endIndex);
    chunks.push(chunk);

    // 如果还有更多数据，移动到下一个块（考虑重叠）
    if (endIndex < coordinates.length) {
      startIndex = endIndex - overlap;
    } else {
      break;
    }
  }

  return chunks;
}

/**
 * 调用 Mapbox Map Matching API
 */
async function callMapMatchingAPI(
  coordinates: [number, number][],
  accessToken: string,
  profile: string = "mapbox/driving"
): Promise<[number, number][]> {
  // 将坐标转换为 Mapbox 格式 "lng,lat;lng,lat;..."
  const coordinatesStr = coordinates
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(";");

  const url = `${MAPBOX_API_BASE}/${profile}/${coordinatesStr}?access_token=${accessToken}&geometries=geojson&overview=full`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Map Matching API error:", errorText);
      throw new Error(`Map Matching API failed: ${response.status}`);
    }

    const data: MapMatchingResponse = await response.json();

    if (data.code !== "Ok" || !data.matchings || data.matchings.length === 0) {
      console.warn(
        "Map Matching returned no results, using original coordinates"
      );
      return coordinates;
    }

    // 返回第一个匹配结果的几何坐标
    console.log(data);
    return (
      data.matchings
        // .filter((m) => m.confidence > 0)
        .map((m) => m.geometry.coordinates)
        .flat()
    );
  } catch (error) {
    console.error("Map Matching request failed:", error);
    // 如果 API 调用失败，返回原始坐标
    return coordinates;
  }
}

/**
 * 对轨迹进行分批地图匹配处理
 */
export async function batchMapMatching(
  coordinates: [number, number][],
  accessToken: string,
  profile: string = "mapbox/driving",
  onProgress?: (current: number, total: number) => void
): Promise<[number, number][]> {
  if (coordinates.length === 0) {
    return [];
  }

  // 将坐标分块
  const chunks = chunkCoordinates(coordinates);

  if (chunks.length === 1) {
    // 只有一块，直接调用
    onProgress?.(1, 1);
    return await callMapMatchingAPI(chunks[0], accessToken, profile);
  }

  // 多块，逐个处理并合并结果
  const results: [number, number][] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);

    const matchedCoords = await callMapMatchingAPI(
      chunks[i],
      accessToken,
      profile
    );

    if (i === 0) {
      // 第一块，添加所有坐标
      results.push(...matchedCoords);
    } else {
      // 后续块，跳过重叠部分的前几个点以避免重复
      const skipCount = Math.min(CHUNK_OVERLAP, matchedCoords.length);
      results.push(...matchedCoords.slice(skipCount));
    }

    // 添加延迟以避免超过速率限制（300 请求/分钟 = 200ms/请求）
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return results;
}

/**
 * 将轨迹点转换为地图匹配后的轨迹
 */
export async function mapMatchTrajectory(
  trajectory: TrajectoryPoint[],
  accessToken: string,
  profile: string = "mapbox/driving",
  onProgress?: (current: number, total: number) => void
): Promise<TrajectoryPoint[]> {
  if (trajectory.length === 0) {
    return [];
  }

  // 转换为坐标数组
  const coordinates: [number, number][] = trajectory.map((point) => [
    point.x,
    point.y,
  ]);

  // 调用分批地图匹配
  const matchedCoordinates = await batchMapMatching(
    coordinates,
    accessToken,
    profile,
    onProgress
  );

  // 转换回轨迹点
  return matchedCoordinates.map(([x, y]) => ({ x, y }));
}
