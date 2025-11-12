"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TripRecord } from "@/types";
import {
  simplifyTrajectory,
  calculateStats,
  trajectoryToCoordinates,
} from "@/lib/simplification";
import { formatDuration, formatSpeed, formatTimestamp } from "@/lib/utils";
import TripMap from "@/components/TripMap";
import TripMapAmap from "@/components/TripMapAmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mapMatchTrajectory, MapMatchingResult } from "@/lib/mapMatching";
import { mapMatchTrajectoryAmap } from "@/lib/mapMatchingAmap";
import { wgs84PathToGcj } from "@/lib/geo";

interface TripDetailClientProps {
  deviceId: string;
  trip: TripRecord;
}

const toleranceOptions = [
  { value: 0.00001, label: "0.00001° · ≈1 米" },
  { value: 0.00005, label: "0.00005° · ≈5 米" },
  { value: 0.0001, label: "0.0001° · ≈10 米" },
  { value: 0.0005, label: "0.0005° · ≈50 米" },
  { value: 0.001, label: "0.001° · ≈100 米" },
  { value: 0.005, label: "0.005° · ≈500 米" },
];

function projectToTrajectory(points: TripRecord["points"]) {
  return (points ?? [])
    .map((point) => {
      const lng = Number((point as { lng?: number | string }).lng)
      const lat = Number((point as { lat?: number | string }).lat)

      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null
      }

      return { x: lng, y: lat }
    })
    .filter((item): item is { x: number; y: number } => item !== null)
}

export default function TripDetailClient({ deviceId, trip }: TripDetailClientProps) {
  const [toleranceIndex, setToleranceIndex] = useState(2); // 0.0001°
  const [showOriginal, setShowOriginal] = useState(true);
  const [showSimplified, setShowSimplified] = useState(true);
  const [showSimplifiedPoints, setShowSimplifiedPoints] = useState(false);
  const [enableMapMatching, setEnableMapMatching] = useState(false);
  const [showMapMatched, setShowMapMatched] = useState(true);
  const [showMapMatchedPoints, setShowMapMatchedPoints] = useState(false);
  const [mapProvider, setMapProvider] = useState<"mapbox" | "amap">("mapbox");
  const [mapMatchingThreshold, setMapMatchingThreshold] = useState(50);
  const [effectiveMapMatchingThreshold, setEffectiveMapMatchingThreshold] = useState(50);
  const [mapMatchingRadius, setMapMatchingRadius] = useState(25);
  const [effectiveMapMatchingRadius, setEffectiveMapMatchingRadius] = useState(25);
  const [mapMatchedResult, setMapMatchedResult] = useState<MapMatchingResult | null>(null);
  const [mapMatchingProgress, setMapMatchingProgress] = useState<{ current: number; total: number } | null>(null);
  const [mapMatchingError, setMapMatchingError] = useState<string | null>(null);

  useEffect(() => {
    if (enableMapMatching) {
      setShowMapMatched(true);
    } else {
      setShowMapMatched(false);
      setShowMapMatchedPoints(false);
    }
  }, [enableMapMatching]);

  useEffect(() => {
    setMapMatchedResult(null);
    setMapMatchingError(null);
    setShowMapMatched(true);
    setShowMapMatchedPoints(false);
  }, [mapProvider]);

  const tolerance = toleranceOptions[toleranceIndex]?.value ?? toleranceOptions[2].value;

  const originalTrajectory = useMemo(() => projectToTrajectory(trip.points), [trip.points]);
  const simplifiedTrajectory = useMemo(
    () => simplifyTrajectory(originalTrajectory, tolerance, true),
    [originalTrajectory, tolerance]
  );

  const originalCoordinates = useMemo(
    () => trajectoryToCoordinates(originalTrajectory),
    [originalTrajectory]
  );
  const simplifiedCoordinates = useMemo(
    () => trajectoryToCoordinates(simplifiedTrajectory),
    [simplifiedTrajectory]
  );

  const originalCoordinatesGcj = useMemo(
    () => wgs84PathToGcj(originalCoordinates),
    [originalCoordinates]
  );
  const simplifiedCoordinatesGcj = useMemo(
    () => wgs84PathToGcj(simplifiedCoordinates),
    [simplifiedCoordinates]
  );

  const mapMatchedCoordinates = useMemo(() => {
    if (!mapMatchedResult) {
      return [];
    }
    return trajectoryToCoordinates(mapMatchedResult.trajectory);
  }, [mapMatchedResult]);

  const mapMatchedCoordinatesGcj = useMemo(
    () => wgs84PathToGcj(mapMatchedCoordinates),
    [mapMatchedCoordinates]
  );

  const stats = useMemo(
    () =>
      calculateStats(
        originalTrajectory,
        enableMapMatching && mapMatchedResult?.trajectory.length
          ? mapMatchedResult.trajectory
          : simplifiedTrajectory,
        0,
        undefined,
        simplifiedTrajectory.length,
        enableMapMatching && mapMatchedResult?.trajectory.length
          ? mapMatchedResult.trajectory.length
          : undefined
      ),
    [enableMapMatching, originalTrajectory, simplifiedTrajectory, mapMatchedResult]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setEffectiveMapMatchingThreshold(mapMatchingThreshold);
    }, 400);

    return () => clearTimeout(timer);
  }, [mapMatchingThreshold]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setEffectiveMapMatchingRadius(mapMatchingRadius);
    }, 400);

    return () => clearTimeout(timer);
  }, [mapMatchingRadius]);

  useEffect(() => {
    if (!enableMapMatching) {
      setMapMatchedResult(null);
      setMapMatchingProgress(null);
      setMapMatchingError(null);
      return;
    }

    if (simplifiedTrajectory.length === 0) {
      setMapMatchingError("当前无可匹配的轨迹点");
      setMapMatchedResult(null);
      return;
    }

    let cancelled = false;
    setMapMatchingProgress({ current: 0, total: 0 });
    setMapMatchingError(null);

    const runMatching = async () => {
      try {
        if (mapProvider === "mapbox") {
          const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          if (!accessToken) {
            throw new Error("未配置 Mapbox Token");
          }

          const result = await mapMatchTrajectory(
            simplifiedTrajectory,
            accessToken,
            "mapbox/driving",
            (current, total) => {
              if (!cancelled) {
                setMapMatchingProgress({ current, total });
              }
            },
            effectiveMapMatchingThreshold / 100,
            effectiveMapMatchingRadius > 0 ? effectiveMapMatchingRadius : undefined
          );

          if (!cancelled) {
            setMapMatchedResult(result);
            setMapMatchingProgress(null);
          }
        } else {
          const amapKey = process.env.NEXT_PUBLIC_AMAP_KEY;
          if (!amapKey) {
            throw new Error("未配置高德地图 Key");
          }

          const result = await mapMatchTrajectoryAmap(
            simplifiedTrajectory,
            amapKey,
            effectiveMapMatchingRadius > 0 ? effectiveMapMatchingRadius : undefined,
            (current, total) => {
              if (!cancelled) {
                setMapMatchingProgress({ current, total });
              }
            }
          );

          if (!cancelled) {
            setMapMatchedResult(result);
            setMapMatchingProgress(null);
          }
        }
      } catch (error) {
        console.error("地图匹配失败", error);
        if (!cancelled) {
          setMapMatchingError(
            mapProvider === "mapbox"
              ? "地图匹配失败，已回退为抽稀结果"
              : "高德轨迹纠偏失败，已回退为抽稀结果"
          );
          setMapMatchedResult(null);
          setMapMatchingProgress(null);
        }
      }
    };

    runMatching();

    return () => {
      cancelled = true;
    };
  }, [
    enableMapMatching,
    simplifiedTrajectory,
    effectiveMapMatchingThreshold,
    effectiveMapMatchingRadius,
    mapProvider,
  ]);

  return (
    <div className="min-h-screen bg-muted/10">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              设备 {deviceId} · 行程 {trip.id}
            </h1>
            <p className="text-sm text-muted-foreground">
              开始：{formatTimestamp(trip.start_time)} · 结束：{formatTimestamp(trip.end_time)} ·
              历时：{formatDuration(trip.start_time, trip.end_time)}
            </p>
          </div>
          <Badge variant="secondary">{trip.status}</Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>数据与展示控制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">抽稀容差</h2>
                <Slider
                  value={[toleranceIndex]}
                  onValueChange={(value) => setToleranceIndex(value[0] ?? toleranceIndex)}
                  min={0}
                  max={toleranceOptions.length - 1}
                  step={1}
                />
                <p className="text-sm text-muted-foreground">
                  当前值：{toleranceOptions[toleranceIndex]?.label ?? "-"}
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground">地图提供方</h2>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{mapProvider === "amap" ? "高德地图" : "Mapbox 地图"}</p>
                    <p className="text-xs text-muted-foreground">
                      切换至高德地图将启用 GCJ-02 坐标系与高德轨迹纠偏服务。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mapbox</span>
                    <Switch
                      id="toggle-map-provider"
                      checked={mapProvider === "amap"}
                      onCheckedChange={(checked) => setMapProvider(checked ? "amap" : "mapbox")}
                    />
                    <span className="text-xs text-muted-foreground">高德</span>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground">轨迹显示</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-original" className="text-sm">
                      显示原始轨迹
                    </Label>
                    <Switch
                      id="toggle-original"
                      checked={showOriginal}
                      onCheckedChange={setShowOriginal}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-simplified" className="text-sm">
                      显示抽稀轨迹
                    </Label>
                    <Switch
                      id="toggle-simplified"
                      checked={showSimplified}
                      onCheckedChange={setShowSimplified}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-simplified-points" className="text-sm">
                      显示抽稀采样点
                    </Label>
                    <Switch
                      id="toggle-simplified-points"
                      checked={showSimplifiedPoints}
                      onCheckedChange={setShowSimplifiedPoints}
                      disabled={!showSimplified}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground">地图匹配</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-map-matching" className="text-sm">
                      启用地图匹配
                    </Label>
                    <Switch
                      id="toggle-map-matching"
                      checked={enableMapMatching}
                      onCheckedChange={setEnableMapMatching}
                    />
                  </div>

                  {enableMapMatching && (
                    <div className="space-y-3 border-l-2 border-emerald-500 pl-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="toggle-mapmatched" className="text-sm">
                          显示匹配轨迹
                        </Label>
                        <Switch
                          id="toggle-mapmatched"
                          checked={showMapMatched}
                          onCheckedChange={setShowMapMatched}
                          disabled={!mapMatchedResult?.trajectory.length}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="toggle-mapmatched-points" className="text-sm">
                          显示匹配采样点
                        </Label>
                        <Switch
                          id="toggle-mapmatched-points"
                          checked={showMapMatchedPoints}
                          onCheckedChange={setShowMapMatchedPoints}
                          disabled={!showMapMatched || !mapMatchedResult?.trajectory.length}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="map-matching-threshold" className="text-sm">
                          置信度阈值（%）
                        </Label>
                        <Slider
                          id="map-matching-threshold"
                          min={0}
                          max={100}
                          step={5}
                          value={[mapMatchingThreshold]}
                          onValueChange={(value) =>
                            setMapMatchingThreshold(value[0] ?? mapMatchingThreshold)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          当前阈值：{mapMatchingThreshold}%
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="map-matching-radius" className="text-sm">
                          定位半径（米）
                        </Label>
                        <Slider
                          id="map-matching-radius"
                          min={0}
                          max={50}
                          step={1}
                          value={[mapMatchingRadius]}
                          onValueChange={(value) =>
                            setMapMatchingRadius(value[0] ?? mapMatchingRadius)
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          当前半径：{mapMatchingRadius > 0 ? `${mapMatchingRadius} m` : "关闭（使用 Mapbox 默认）"}
                        </p>
                      </div>
                      {mapMatchingProgress && (
                        <p className="text-xs text-muted-foreground">
                          匹配进度：{mapMatchingProgress.current}/{mapMatchingProgress.total}
                        </p>
                      )}
                      {mapMatchingError && (
                        <p className="text-xs text-destructive">{mapMatchingError}</p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">行程指标</h2>
                <ul className="space-y-2 text-sm">
                  <li>原始点数：{stats.originalCount}</li>
                  <li>抽稀点数：{stats.rdpSimplifiedCount ?? stats.finalCount}</li>
                  <li>压缩率：{stats.compressionRatio.toFixed(2)}%</li>
                  <li>
                    平均速度：
                    {formatSpeed(
                      typeof trip.average_speed === "number" ? trip.average_speed : undefined
                    )}
                  </li>
                  {typeof trip.mileage === "number" && <li>里程：{(trip.mileage / 1000).toFixed(2)} km</li>}
                  {typeof trip.max_speed === "number" && (
                    <li>最高速度：{trip.max_speed.toFixed(2)} km/h</li>
                  )}
                  {enableMapMatching && mapMatchedResult?.trajectory.length ? (
                    <li>地图匹配点数：{mapMatchedResult.trajectory.length}</li>
                  ) : null}
                </ul>
              </section>

              <Button asChild variant="outline" className="w-full">
                <Link href={`/device/${encodeURIComponent(deviceId)}`} prefetch={false}>
                  返回行程列表
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>行程轨迹对比</CardTitle>
            </CardHeader>
            <CardContent>
              {originalCoordinates.length > 0 ? (
                mapProvider === "mapbox" ? (
                  <TripMap
                    originalPath={originalCoordinates}
                    simplifiedPath={simplifiedCoordinates}
                    mapMatchedPath={mapMatchedCoordinates}
                    mapMatchedSegments={mapMatchedResult?.segments}
                    showOriginal={showOriginal}
                    showSimplified={showSimplified}
                    showSimplifiedPoints={showSimplifiedPoints}
                    showMapMatched={enableMapMatching && showMapMatched}
                    showMapMatchedPoints={enableMapMatching && showMapMatchedPoints}
                  />
                ) : (
                  <TripMapAmap
                    apiKey={process.env.NEXT_PUBLIC_AMAP_KEY ?? ""}
                    originalPath={originalCoordinatesGcj}
                    simplifiedPath={simplifiedCoordinatesGcj}
                    mapMatchedPath={mapMatchedCoordinatesGcj}
                    showOriginal={showOriginal}
                    showSimplified={showSimplified}
                    showSimplifiedPoints={showSimplifiedPoints}
                    showMapMatched={enableMapMatching && showMapMatched}
                    showMapMatchedPoints={enableMapMatching && showMapMatchedPoints}
                  />
                )
              ) : (
                <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  当前行程暂无可展示的轨迹点。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
