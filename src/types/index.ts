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
  simplifiedCount: number;
  compressionRatio: number;
  fileSize: number; // 原始文件大小（字节）
}