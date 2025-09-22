"use client";

import { useState, useCallback, useMemo } from "react";
import FileUpload from "@/components/FileUpload";
import MapboxMap from "@/components/MapboxMap";
import ControlPanel from "@/components/ControlPanel";
import { GPSDataPoint, TrajectoryPoint, TrajectoryStats } from "@/types";
import {
  convertGPSToTrajectory,
  simplifyTrajectory,
  calculateStats,
  trajectoryToCoordinates,
} from "@/lib/simplification";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const [gpsData, setGpsData] = useState<GPSDataPoint[]>([]);
  const [fileSize, setFileSize] = useState<number>(0);
  const [tolerance, setTolerance] = useState(0.0001);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showSimplified, setShowSimplified] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDataLoaded = useCallback((data: GPSDataPoint[], size: number) => {
    setGpsData(data);
    setFileSize(size);
  }, []);

  const { originalTrajectory, simplifiedTrajectory, stats } = useMemo(() => {
    if (gpsData.length === 0) {
      return {
        originalTrajectory: [],
        simplifiedTrajectory: [],
        stats: null,
      };
    }

    setIsProcessing(true);

    try {
      const original = convertGPSToTrajectory(gpsData);
      const simplified = simplifyTrajectory(original, tolerance, true);
      const calculatedStats = calculateStats(original, simplified, fileSize);

      return {
        originalTrajectory: original,
        simplifiedTrajectory: simplified,
        stats: calculatedStats,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [gpsData, tolerance, fileSize]);

  const originalCoordinates = useMemo(
    () => trajectoryToCoordinates(originalTrajectory),
    [originalTrajectory]
  );

  const simplifiedCoordinates = useMemo(
    () => trajectoryToCoordinates(simplifiedTrajectory),
    [simplifiedTrajectory]
  );

  const hasData = gpsData.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Ramer-Douglas-Peucker 轨迹抽稀可视化工具
            </h1>
            <p className="text-muted-foreground">
              基于 Ramer-Douglas-Peucker 算法的 GPS
              轨迹抽稀工具，支持实时参数调整和可视化对比
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!hasData ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
            <div className="lg:col-span-1 space-y-4">
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

              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-3">重新上传</h3>
                  <Button
                    onClick={() => {
                      setGpsData([]);
                      setFileSize(0);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    选择新文件
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardContent className="p-0 h-full">
                  <MapboxMap
                    gpsData={gpsData}
                    originalTrajectory={originalCoordinates}
                    simplifiedTrajectory={simplifiedCoordinates}
                    showOriginal={showOriginal}
                    showSimplified={showSimplified}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-card mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>使用 Next.js 15 + Mapbox GL JS + simplify-js 构建</p>
            <p>
              支持的数据格式:
              A,DDMMYY,HHMMSS,DDMM.MMMM,N/S,DDMM.MMMM,E/W,速度,加速度X,Y,Z;
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
