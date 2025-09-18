'use client'

import { useState, useCallback, useMemo } from 'react'
import FileUpload from '@/components/FileUpload'
import MapboxMap from '@/components/MapboxMap'
import ControlPanel from '@/components/ControlPanel'
import { GPSDataPoint, TrajectoryPoint, TrajectoryStats } from '@/types'
import {
  convertGPSToTrajectory,
  simplifyTrajectory,
  calculateStats,
  trajectoryToCoordinates
} from '@/lib/simplification'

export default function Home() {
  const [gpsData, setGpsData] = useState<GPSDataPoint[]>([])
  const [fileSize, setFileSize] = useState<number>(0)
  const [tolerance, setTolerance] = useState(0.0001)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showSimplified, setShowSimplified] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDataLoaded = useCallback((data: GPSDataPoint[], size: number) => {
    setGpsData(data)
    setFileSize(size)
  }, [])

  const { originalTrajectory, simplifiedTrajectory, stats } = useMemo(() => {
    if (gpsData.length === 0) {
      return {
        originalTrajectory: [],
        simplifiedTrajectory: [],
        stats: null
      }
    }

    setIsProcessing(true)

    try {
      const original = convertGPSToTrajectory(gpsData)
      const simplified = simplifyTrajectory(original, tolerance, true)
      const calculatedStats = calculateStats(original, simplified, fileSize)

      return {
        originalTrajectory: original,
        simplifiedTrajectory: simplified,
        stats: calculatedStats
      }
    } finally {
      setIsProcessing(false)
    }
  }, [gpsData, tolerance, fileSize])

  const originalCoordinates = useMemo(() =>
    trajectoryToCoordinates(originalTrajectory),
    [originalTrajectory]
  )

  const simplifiedCoordinates = useMemo(() =>
    trajectoryToCoordinates(simplifiedTrajectory),
    [simplifiedTrajectory]
  )

  const hasData = gpsData.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Ramer-Douglas-Peucker 轨迹抽稀可视化工具
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            基于 Ramer-Douglas-Peucker 算法的 GPS 轨迹抽稀工具，支持实时参数调整和可视化对比
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!hasData ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
            <div className="lg:col-span-1">
              <ControlPanel
                tolerance={tolerance}
                onToleranceChange={setTolerance}
                showOriginal={showOriginal}
                onShowOriginalChange={setShowOriginal}
                showSimplified={showSimplified}
                onShowSimplifiedChange={setShowSimplified}
                stats={stats}
                isProcessing={isProcessing}
              />

              <div className="mt-4 bg-white p-4 rounded-lg shadow-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">重新上传</h3>
                <button
                  onClick={() => {
                    setGpsData([])
                    setFileSize(0)
                  }}
                  className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  选择新文件
                </button>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-lg shadow-lg overflow-hidden">
              <MapboxMap
                gpsData={gpsData}
                originalTrajectory={originalCoordinates}
                simplifiedTrajectory={simplifiedCoordinates}
                showOriginal={showOriginal}
                showSimplified={showSimplified}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>使用 Next.js 15 + Mapbox GL JS + simplify-js 构建</p>
            <p className="mt-1">
              支持的数据格式: A,DDMMYY,HHMMSS,DDMM.MMMM,N/S,DDMM.MMMM,E/W,速度,加速度X,Y,Z;
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}