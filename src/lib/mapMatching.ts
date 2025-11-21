import { TrajectoryPoint } from "@/types";

const MAPBOX_API_BASE = "https://api.mapbox.com/matching/v5";
const MAX_COORDINATES_PER_REQUEST = 100;
const CHUNK_OVERLAP = 3; // 重叠点数，确保轨迹连续性
const MAP_MATCH_DEFAULT_CONFIDENCE = 0.5;

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

export interface MapMatchingSegment {
  type: "matched" | "raw";
  coordinates: [number, number][];
}

export interface MapMatchedSegments {
  matched: [number, number][][];
  raw: [number, number][][];
  ordered: MapMatchingSegment[];
}

export interface MapMatchingResult {
  trajectory: TrajectoryPoint[];
  segments: MapMatchedSegments;
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

function coordinatesToString(coordinates: [number, number][]) {
  return coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
}

function coordinatesEqual(
  a: [number, number],
  b: [number, number],
  epsilon = 1e-9
): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
}

function dropLeadingDuplicates(
  coordinates: [number, number][],
  lastCoordinate: [number, number] | null
): [number, number][] {
  if (!lastCoordinate || coordinates.length === 0) {
    return coordinates.slice();
  }

  let startIndex = 0;
  while (
    startIndex < coordinates.length &&
    coordinatesEqual(coordinates[startIndex], lastCoordinate)
  ) {
    startIndex += 1;
  }

  return coordinates.slice(startIndex);
}

/**
 * 调用 Mapbox Map Matching API
 */
async function callMapMatchingAPI(
  coordinates: [number, number][],
  accessToken: string,
  profile: string,
  confidenceThreshold: number,
  radius?: number
): Promise<MapMatchingSegment[]> {
  const coordinatesStr = coordinatesToString(coordinates);
  const radiusParam =
    typeof radius === "number" && radius > 0
      ? `&radiuses=${coordinates.map(() => radius).join(";")}`
      : "";
  const url = `${MAPBOX_API_BASE}/${profile}/${coordinatesStr}?access_token=${accessToken}&geometries=geojson&overview=full${radiusParam}`;

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
      return [{ type: "raw", coordinates: coordinates.slice() }];
    }

    const segments: Array<
      | { type: "raw"; coords: [number, number][] }
      | { type: "match"; matchIndex: number; coords: [number, number][] }
    > = [];

    let currentSegment:
      | { type: "raw"; coords: [number, number][] }
      | { type: "match"; matchIndex: number; coords: [number, number][] }
      | null = null;

    for (let index = 0; index < coordinates.length; index += 1) {
      const tracepoint = data.tracepoints?.[index];
      const matchIndex = tracepoint?.matchings_index;
      const coordinate = coordinates[index];

      if (matchIndex === undefined || matchIndex === null) {
        if (currentSegment?.type === "raw") {
          currentSegment.coords.push(coordinate);
        } else {
          if (currentSegment) {
            segments.push(currentSegment);
          }
          currentSegment = { type: "raw", coords: [coordinate] };
        }
      } else if (
        currentSegment?.type === "match" &&
        currentSegment.matchIndex === matchIndex
      ) {
        currentSegment.coords.push(coordinate);
      } else {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = { type: "match", matchIndex, coords: [coordinate] };
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    const emittedMatchings = new Set<number>();
    const chunkSegments: MapMatchingSegment[] = [];
    let lastCoordinate: [number, number] | null = null;

    const pushSegment = (
      type: "matched" | "raw",
      segmentCoordinates: [number, number][]
    ) => {
      const normalized = dropLeadingDuplicates(
        segmentCoordinates,
        lastCoordinate
      );
      if (normalized.length === 0) {
        return;
      }

      chunkSegments.push({ type, coordinates: normalized });
      lastCoordinate = normalized[normalized.length - 1];
    };

    for (const segment of segments) {
      if (segment.type === "raw") {
        pushSegment("raw", segment.coords);
        continue;
      }

      const matching = data.matchings[segment.matchIndex];
      const confidence = matching?.confidence ?? 0;

      if (
        !matching ||
        confidence < confidenceThreshold ||
        emittedMatchings.has(segment.matchIndex)
      ) {
        pushSegment("raw", segment.coords);
        continue;
      }

      pushSegment("matched", matching.geometry.coordinates);
      emittedMatchings.add(segment.matchIndex);
    }

    return chunkSegments;
  } catch (error) {
    console.error("Map Matching request failed:", error);
    return [{ type: "raw", coordinates: coordinates.slice() }];
  }
}

/**
 * 对轨迹进行分批地图匹配处理
 */
export async function batchMapMatching(
  coordinates: [number, number][],
  accessToken: string,
  profile: string = "mapbox/driving",
  onProgress?: (current: number, total: number) => void,
  confidenceThreshold: number = MAP_MATCH_DEFAULT_CONFIDENCE,
  radius?: number
): Promise<MapMatchingSegment[]> {
  if (coordinates.length === 0) {
    return [];
  }

  const chunks = chunkCoordinates(coordinates);

  if (chunks.length === 1) {
    onProgress?.(1, 1);
    return await callMapMatchingAPI(
      chunks[0],
      accessToken,
      profile,
      confidenceThreshold,
      radius
    );
  }

  const aggregatedSegments: MapMatchingSegment[] = [];
  let lastCoordinate: [number, number] | null = null;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);

    const chunkSegments = await callMapMatchingAPI(
      chunks[i],
      accessToken,
      profile,
      confidenceThreshold,
      radius
    );

    for (const segment of chunkSegments) {
      const normalized = dropLeadingDuplicates(
        segment.coordinates,
        lastCoordinate
      );
      if (normalized.length === 0) {
        continue;
      }

      aggregatedSegments.push({ type: segment.type, coordinates: normalized });
      lastCoordinate = normalized[normalized.length - 1];
    }

    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return aggregatedSegments;
}

/**
 * 将轨迹点转换为地图匹配后的轨迹
 */
export async function mapMatchTrajectory(
  trajectory: TrajectoryPoint[],
  accessToken: string,
  profile: string = "mapbox/driving",
  onProgress?: (current: number, total: number) => void,
  confidenceThreshold: number = MAP_MATCH_DEFAULT_CONFIDENCE,
  radius?: number
): Promise<MapMatchingResult> {
  if (trajectory.length === 0) {
    return {
      trajectory: [],
      segments: { matched: [], raw: [], ordered: [] },
    };
  }

  const coordinates: [number, number][] = trajectory.map((point) => [
    point.x,
    point.y,
  ]);

  const segments = await batchMapMatching(
    coordinates,
    accessToken,
    profile,
    onProgress,
    confidenceThreshold,
    radius
  );

  if (segments.length === 0) {
    return {
      trajectory: coordinates.map(([x, y]) => ({ x, y })),
      segments: { matched: [], raw: [], ordered: [] },
    };
  }

  const matchedSegments: [number, number][][] = [];
  const rawSegments: [number, number][][] = [];
  const orderedSegments: MapMatchingSegment[] = [];
  const combined: [number, number][] = [];
  let lastCoordinate: [number, number] | null = null;

  for (const segment of segments) {
    let coords = segment.coordinates;
    if (lastCoordinate) {
      coords = dropLeadingDuplicates(coords, lastCoordinate);
    } else {
      coords = coords.slice();
    }

    if (coords.length === 0) {
      continue;
    }

    if (segment.type === "matched") {
      matchedSegments.push(coords);
    } else {
      rawSegments.push(coords);
    }

    orderedSegments.push({
      type: segment.type,
      coordinates: coords,
    });

    combined.push(...coords);
    lastCoordinate = coords[coords.length - 1];
  }

  return {
    trajectory: combined.map(([x, y]) => ({ x, y })),
    segments: {
      matched: matchedSegments,
      raw: rawSegments,
      ordered: orderedSegments,
    },
  };
}
