import { TrajectoryPoint } from "@/types";
import {
  MapMatchedSegments,
  MapMatchingResult,
  MapMatchingSegment,
} from "@/lib/mapMatching";
import { gcj02ToWgs84, wgs84ToGcj02 } from "@/lib/geo";

interface AMapRoadPoint {
  x: number;
  y: number;
  sp: number;
  ag: number;
  tm: number;
}

interface AMapRoadResponse {
  errcode: number;
  errmsg?: string;
  data?: {
    points?: AMapRoadPoint[];
  };
}

function toTrajectory(points: [number, number][]): TrajectoryPoint[] {
  return points.map(([x, y]) => ({ x, y }));
}

function calculateBearing(
  current: [number, number],
  next: [number, number]
): number {
  const [lng1, lat1] = current.map((value) => (value * Math.PI) / 180) as [
    number,
    number
  ];
  const [lng2, lat2] = next.map((value) => (value * Math.PI) / 180) as [
    number,
    number
  ];
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  const theta = Math.atan2(y, x);
  const bearing = (theta * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function resolveSpeed(point?: TrajectoryPoint): number {
  const value = point?.speed;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Number(value.toFixed(2));
  }
  return 0; // 高德允许 0 表示静止
}

function resolveDirection(point?: TrajectoryPoint, fallback?: number): number {
  const value = point?.direction;
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = ((value % 360) + 360) % 360;
    return Number(normalized.toFixed(2));
  }
  return typeof fallback === "number" ? Number(fallback.toFixed(2)) : 0;
}

function normalizeTimestampMs(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) {
    return Math.trunc(value);
  }
  if (abs >= 1_000_000_000) {
    return Math.trunc(value * 1000);
  }
  if (abs >= 1_000_000) {
    return Math.trunc(value * 1000);
  }
  return Math.trunc(value);
}

function resolveTimestampSeconds(
  point: TrajectoryPoint | undefined,
  index: number,
  baseTimeMs: number
): { absoluteSeconds: number; deltaSeconds: number } {
  const raw = normalizeTimestampMs(point?.loctime ?? point?.timestamp);
  const currentMs =
    raw !== undefined ? raw : baseTimeMs + index * 1000;
  const baseSeconds = Math.trunc(baseTimeMs / 1000);
  const deltaSeconds = Math.max(
    0,
    Math.trunc((currentMs - baseTimeMs) / 1000)
  );

  if (index === 0) {
    return { absoluteSeconds: baseSeconds, deltaSeconds: 0 };
  }

  return { absoluteSeconds: baseSeconds, deltaSeconds };
}

export async function mapMatchTrajectoryAmap(
  trajectory: TrajectoryPoint[],
  apiKey: string,
  radius?: number,
  onProgress?: (current: number, total: number) => void
): Promise<MapMatchingResult> {
  if (trajectory.length === 0) {
    return {
      trajectory: [],
      segments: { matched: [], raw: [], ordered: [] },
    };
  }

  const gcjPath = trajectory.map((point) => wgs84ToGcj02([point.x, point.y]));

  const firstTimestampPoint = trajectory.find(
    (point) =>
      typeof (point.loctime ?? point.timestamp) === "number" &&
      Number.isFinite(point.loctime ?? point.timestamp)
  );

  const baseTimestampMs =
    normalizeTimestampMs(
      firstTimestampPoint?.loctime ?? firstTimestampPoint?.timestamp
    ) ?? Date.now();

  onProgress?.(0, 1);

  const points: AMapRoadPoint[] = gcjPath.map(([lng, lat], index) => {
    const roundedLng = Number(lng.toFixed(6));
    const roundedLat = Number(lat.toFixed(6));
    const prev =
      index > 0 ? gcjPath[index - 1] : ([lng, lat] as [number, number]);
    const next =
      index < gcjPath.length - 1
        ? gcjPath[index + 1]
        : ([lng, lat] as [number, number]);
    const bearing = calculateBearing(prev, next);

    const sourcePoint = trajectory[index];

    const resolvedTime = resolveTimestampSeconds(
      sourcePoint,
      index,
      baseTimestampMs
    );

    return {
      x: roundedLng,
      y: roundedLat,
      sp: resolveSpeed(sourcePoint),
      ag: resolveDirection(sourcePoint, bearing),
      tm:
        index === 0
          ? resolvedTime.absoluteSeconds
          : resolvedTime.deltaSeconds,
    };
  });

  const url = `https://restapi.amap.com/v4/grasproad/driving?key=${apiKey}`;

  let matchedPathGcj = gcjPath;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(points),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AMap grasproad error:", text);
      throw new Error(`AMap grasproad failed: ${response.status}`);
    }

    const data: AMapRoadResponse = await response.json();

    if (data.errcode !== 0 || !data.data?.points?.length) {
      console.warn("AMap grasproad returned empty result:", data.errmsg);
    } else {
      matchedPathGcj = data.data.points.map((point, index) => {
        const fallback = gcjPath[index] ?? gcjPath[gcjPath.length - 1];
        const lng = typeof point.x === "number" ? point.x : fallback[0];
        const lat = typeof point.y === "number" ? point.y : fallback[1];
        return [lng, lat] as [number, number];
      });
    }
  } catch (error) {
    console.error("AMap grasproad request failed", error);
  }

  onProgress?.(1, 1);

  const matchedPathWgs = matchedPathGcj.map((point) => gcj02ToWgs84(point));

  const matchedSegment: MapMatchingSegment = {
    type: "matched",
    coordinates: matchedPathWgs,
  };

  const segments: MapMatchedSegments = {
    matched: [matchedPathWgs],
    raw: [],
    ordered: [matchedSegment],
  };

  console.log(segments);

  return {
    trajectory: toTrajectory(matchedPathWgs),
    segments,
  };
}
