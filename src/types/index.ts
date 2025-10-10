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