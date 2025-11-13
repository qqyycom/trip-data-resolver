export interface GPSDataPoint {
  valid: string;
  date: string;
  time: string;
  latitude: number;
  longitude: number;
  speed: number;
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  timestamp: Date;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  speed?: number;
  direction?: number;
  loctime?: number;
  timestamp?: number;
}

export interface TrajectoryStats {
  originalCount: number;
  timeFilteredCount?: number; // 时间间隔抽稀后的点数
  rdpSimplifiedCount?: number; // RDP抽稀后的点数
  mapMatchedCount?: number; // 地图匹配后的点数
  finalCount: number; // 最终点数（所有抽稀后）
  compressionRatio: number;
  fileSize: number; // 原始文件大小（字节）
}

export type TripStatus = "FINISH" | "PART_FINISHED" | string;

export interface TripPoint {
  lat: number;
  lng: number;
  speed?: number;
  direction?: number;
  loctime?: number;
  // 某些数据集可能附带点级时间戳
  timestamp?: number;
}

export interface TripRecord {
  id: string;
  device_id: string;
  start_time: number;
  end_time: number;
  average_speed?: number;
  mileage?: number;
  max_speed?: number;
  status: TripStatus;
  deleted?: boolean;
  points: TripPoint[];
  simplified_points?: TripPoint[];
  created_at?: number;
  modified_at?: number;
  last_position?: Record<string, unknown>;
  [key: string]: unknown;
}
