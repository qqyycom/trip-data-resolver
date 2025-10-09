import simplify from 'simplify-js'
import { GPSDataPoint, TrajectoryPoint, TrajectoryStats } from '@/types'

export function convertGPSToTrajectory(gpsData: GPSDataPoint[]): TrajectoryPoint[] {
  return gpsData.map(point => ({
    x: point.longitude,
    y: point.latitude
  }))
}

/**
 * 按时间间隔抽稀轨迹数据
 * @param gpsData 原始 GPS 数据点数组
 * @param intervalSeconds 时间间隔（秒）
 * @returns 抽稀后的 GPS 数据点数组
 */
export function filterByTimeInterval(
  gpsData: GPSDataPoint[],
  intervalSeconds: number
): GPSDataPoint[] {
  if (gpsData.length === 0 || intervalSeconds <= 0) return gpsData

  const result: GPSDataPoint[] = [gpsData[0]] // 始终保留第一个点
  let lastTimestamp = gpsData[0].timestamp.getTime()

  for (let i = 1; i < gpsData.length; i++) {
    const currentTimestamp = gpsData[i].timestamp.getTime()
    const timeDiff = (currentTimestamp - lastTimestamp) / 1000 // 转换为秒

    if (timeDiff >= intervalSeconds) {
      result.push(gpsData[i])
      lastTimestamp = currentTimestamp
    }
  }

  // 如果最后一个点没有被包含，也加上
  if (result[result.length - 1] !== gpsData[gpsData.length - 1]) {
    result.push(gpsData[gpsData.length - 1])
  }

  return result
}

export function simplifyTrajectory(
  trajectory: TrajectoryPoint[],
  tolerance: number = 0.0001,
  highQuality: boolean = true
): TrajectoryPoint[] {
  if (trajectory.length <= 2) return trajectory

  return simplify(trajectory, tolerance, highQuality)
}

export function calculateStats(
  originalTrajectory: TrajectoryPoint[],
  finalTrajectory: TrajectoryPoint[],
  fileSize: number = 0,
  timeFilteredCount?: number,
  rdpSimplifiedCount?: number
): TrajectoryStats {
  const originalCount = originalTrajectory.length
  const finalCount = finalTrajectory.length
  const compressionRatio = originalCount > 0 ? (1 - finalCount / originalCount) * 100 : 0

  return {
    originalCount,
    timeFilteredCount,
    rdpSimplifiedCount,
    finalCount,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    fileSize
  }
}

export function trajectoryToCoordinates(trajectory: TrajectoryPoint[]): [number, number][] {
  return trajectory.map(point => [point.x, point.y])
}