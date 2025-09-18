import simplify from 'simplify-js'
import { GPSDataPoint, TrajectoryPoint, TrajectoryStats } from '@/types'

export function convertGPSToTrajectory(gpsData: GPSDataPoint[]): TrajectoryPoint[] {
  return gpsData.map(point => ({
    x: point.longitude,
    y: point.latitude
  }))
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
  simplifiedTrajectory: TrajectoryPoint[],
  fileSize: number = 0
): TrajectoryStats {
  const originalCount = originalTrajectory.length
  const simplifiedCount = simplifiedTrajectory.length
  const compressionRatio = originalCount > 0 ? (1 - simplifiedCount / originalCount) * 100 : 0

  return {
    originalCount,
    simplifiedCount,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    fileSize
  }
}

export function trajectoryToCoordinates(trajectory: TrajectoryPoint[]): [number, number][] {
  return trajectory.map(point => [point.x, point.y])
}