"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import MapboxMap from "@/components/MapboxMap";
import ControlPanel from "@/components/ControlPanel";
import { GPSDataPoint, TrajectoryPoint } from "@/types";
import {
  convertGPSToTrajectory,
  filterByTimeInterval,
  simplifyTrajectory,
  calculateStats,
  trajectoryToCoordinates,
} from "@/lib/simplification";
import { mapMatchTrajectory } from "@/lib/mapMatching";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Home() {
  const [gpsData, setGpsData] = useState<GPSDataPoint[]>([]);
  const [fileSize, setFileSize] = useState<number>(0);

  // 时间间隔抽稀控制
  const [enableTimeFilter, setEnableTimeFilter] = useState(false);
  const [timeInterval, setTimeInterval] = useState(5);
  const [showTimeFiltered, setShowTimeFiltered] = useState(true);
  const [showTimeFilteredPoints, setShowTimeFilteredPoints] = useState(true);

  // RDP 抽稀控制
  const [enableRDP, setEnableRDP] = useState(true);
  const [tolerance, setTolerance] = useState(0.0001);
  const [showSimplifiedPoints, setShowSimplifiedPoints] = useState(true);

  // 地图匹配控制
  const [enableMapMatching, setEnableMapMatching] = useState(false);
  const [showMapMatched, setShowMapMatched] = useState(true);
  const [showMapMatchedPoints, setShowMapMatchedPoints] = useState(true);
  const [mapMatchedTrajectory, setMapMatchedTrajectory] = useState<TrajectoryPoint[]>([]);
  const [mapMatchingProgress, setMapMatchingProgress] = useState<{ current: number; total: number } | null>(null);

  // 轨迹显示控制
  const [showOriginal, setShowOriginal] = useState(true);
  const [showSimplified, setShowSimplified] = useState(true);

  const [isProcessing, setIsProcessing] = useState(false);

  const handleDataLoaded = useCallback((data: GPSDataPoint[], size: number) => {
    setGpsData(data);
    setFileSize(size);
  }, []);

  // 串联抽稀处理逻辑：原始数据 -> 时间间隔抽稀 -> RDP 抽稀
  const {
    originalTrajectory,
    timeFilteredTrajectory,
    rdpTrajectory,
    stats: baseStats
  } = useMemo(() => {
    if (gpsData.length === 0) {
      return {
        originalTrajectory: [],
        timeFilteredTrajectory: [],
        rdpTrajectory: [],
        stats: null,
      };
    }

    setIsProcessing(true);

    try {
      // 1. 原始轨迹
      const original = convertGPSToTrajectory(gpsData);

      // 2. 时间间隔抽稀（如果启用）
      let timeFilteredData = gpsData;
      let timeFilteredTraj: TrajectoryPoint[] = original;

      if (enableTimeFilter) {
        timeFilteredData = filterByTimeInterval(gpsData, timeInterval);
        timeFilteredTraj = convertGPSToTrajectory(timeFilteredData);
      }

      // 3. RDP 抽稀（如果启用，基于时间抽稀后的数据）
      let rdpTraj = timeFilteredTraj;

      if (enableRDP) {
        rdpTraj = simplifyTrajectory(timeFilteredTraj, tolerance, true);
      }

      // 4. 计算统计信息 (不包括地图匹配)
      const calculatedStats = calculateStats(
        original,
        rdpTraj,
        fileSize,
        enableTimeFilter ? timeFilteredTraj.length : undefined,
        enableRDP ? rdpTraj.length : undefined
      );

      return {
        originalTrajectory: original,
        timeFilteredTrajectory: timeFilteredTraj,
        rdpTrajectory: rdpTraj,
        stats: calculatedStats,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [gpsData, enableTimeFilter, timeInterval, enableRDP, tolerance, fileSize]);

  // 地图匹配处理（异步）
  useEffect(() => {
    if (!enableMapMatching || rdpTrajectory.length === 0) {
      setMapMatchedTrajectory([]);
      setMapMatchingProgress(null);
      return;
    }

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('Mapbox access token is required for map matching');
      setMapMatchedTrajectory([]);
      return;
    }

    let cancelled = false;
    setIsProcessing(true);

    mapMatchTrajectory(
      rdpTrajectory,
      accessToken,
      'mapbox/driving',
      (current, total) => {
        if (!cancelled) {
          setMapMatchingProgress({ current, total });
        }
      }
    )
      .then((matched) => {
        if (!cancelled) {
          setMapMatchedTrajectory(matched.trajectory);
          setMapMatchingProgress(null);
        }
      })
      .catch((error) => {
        console.error('Map matching failed:', error);
        if (!cancelled) {
          setMapMatchedTrajectory(rdpTrajectory); // 回退到RDP结果
          setMapMatchingProgress(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsProcessing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rdpTrajectory, enableMapMatching]);

  // 最终统计信息（包括地图匹配）
  const stats = useMemo(() => {
    if (!baseStats) return null;

    const finalTraj = enableMapMatching && mapMatchedTrajectory.length > 0
      ? mapMatchedTrajectory
      : rdpTrajectory;

    return calculateStats(
      originalTrajectory,
      finalTraj,
      fileSize,
      enableTimeFilter ? timeFilteredTrajectory.length : undefined,
      enableRDP ? rdpTrajectory.length : undefined,
      enableMapMatching && mapMatchedTrajectory.length > 0 ? mapMatchedTrajectory.length : undefined
    );
  }, [
    baseStats,
    originalTrajectory,
    rdpTrajectory,
    mapMatchedTrajectory,
    enableMapMatching,
    enableTimeFilter,
    timeFilteredTrajectory,
    enableRDP,
    fileSize
  ]);

  const originalCoordinates = useMemo(
    () => trajectoryToCoordinates(originalTrajectory),
    [originalTrajectory]
  );

  const timeFilteredCoordinates = useMemo(
    () => trajectoryToCoordinates(timeFilteredTrajectory),
    [timeFilteredTrajectory]
  );

  const rdpCoordinates = useMemo(
    () => trajectoryToCoordinates(rdpTrajectory),
    [rdpTrajectory]
  );

  const mapMatchedCoordinates = useMemo(
    () => trajectoryToCoordinates(mapMatchedTrajectory),
    [mapMatchedTrajectory]
  );

  const hasData = gpsData.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
              GPS 轨迹抽稀工具
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              支持时间间隔抽稀、RDP 算法抽稀和地图匹配的 GPS 轨迹可视化工具
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
        {!hasData ? (
          <div className="flex items-center justify-center min-h-[50vh] sm:min-h-[60vh]">
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 sm:gap-6 min-h-[calc(100vh-280px)] sm:min-h-[calc(100vh-300px)]">
            <div className="order-2 lg:order-1 lg:col-span-1 space-y-4">
              <ControlPanel
                enableTimeFilter={enableTimeFilter}
                onEnableTimeFilterChange={setEnableTimeFilter}
                timeInterval={timeInterval}
                onTimeIntervalChange={setTimeInterval}
                showTimeFiltered={showTimeFiltered}
                onShowTimeFilteredChange={setShowTimeFiltered}
                showTimeFilteredPoints={showTimeFilteredPoints}
                onShowTimeFilteredPointsChange={setShowTimeFilteredPoints}
                enableRDP={enableRDP}
                onEnableRDPChange={setEnableRDP}
                tolerance={tolerance}
                onToleranceChange={setTolerance}
                showSimplifiedPoints={showSimplifiedPoints}
                onShowSimplifiedPointsChange={setShowSimplifiedPoints}
                enableMapMatching={enableMapMatching}
                onEnableMapMatchingChange={setEnableMapMatching}
                showMapMatched={showMapMatched}
                onShowMapMatchedChange={setShowMapMatched}
                showMapMatchedPoints={showMapMatchedPoints}
                onShowMapMatchedPointsChange={setShowMapMatchedPoints}
                showOriginal={showOriginal}
                onShowOriginalChange={setShowOriginal}
                showSimplified={showSimplified}
                onShowSimplifiedChange={setShowSimplified}
                stats={stats}
                isProcessing={isProcessing}
                mapMatchingProgress={mapMatchingProgress}
              />

              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium mb-3">重新上传</h3>
                  <Button
                    onClick={() => {
                      setGpsData([]);
                      setFileSize(0);
                      setMapMatchedTrajectory([]);
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

            <div className="order-1 lg:order-2 lg:col-span-3 h-[60vh] lg:h-auto lg:min-h-0">
              <Card className="h-full">
                <CardContent className="p-0 h-full">
                  <MapboxMap
                    gpsData={gpsData}
                    originalTrajectory={originalCoordinates}
                    timeFilteredTrajectory={timeFilteredCoordinates}
                    simplifiedTrajectory={rdpCoordinates}
                    mapMatchedTrajectory={mapMatchedCoordinates}
                    showOriginal={showOriginal}
                    showTimeFiltered={showTimeFiltered && enableTimeFilter}
                    showSimplified={showSimplified && enableRDP}
                    showMapMatched={showMapMatched && enableMapMatching}
                    showTimeFilteredPoints={showTimeFilteredPoints}
                    showSimplifiedPoints={showSimplifiedPoints}
                    showMapMatchedPoints={showMapMatchedPoints}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="text-center text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2">
            <p>使用 Next.js 15 + Mapbox GL JS + simplify-js 构建</p>
            <p className="text-xs sm:text-sm">
              数据格式: A,DDMMYY,HHMMSS,DDMM.MMMM,N/S,DDMM.MMMM,E/W,速度,加速度
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
