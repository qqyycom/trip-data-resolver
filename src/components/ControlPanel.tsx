"use client";

import { TrajectoryStats } from "@/types";
import { formatFileSize } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface ControlPanelProps {
  tolerance: number;
  onToleranceChange: (tolerance: number) => void;
  showOriginal: boolean;
  onShowOriginalChange: (show: boolean) => void;
  showSimplified: boolean;
  onShowSimplifiedChange: (show: boolean) => void;
  stats: TrajectoryStats | null;
  isProcessing: boolean;
}

export default function ControlPanel({
  tolerance,
  onToleranceChange,
  showOriginal,
  onShowOriginalChange,
  showSimplified,
  onShowSimplifiedChange,
  stats,
  isProcessing,
}: ControlPanelProps) {
  const toleranceValues = [
    { value: 0.00001, label: "0.00001°(约1m) (最精细)" },
    { value: 0.00005, label: "0.00005°(约5m)" },
    { value: 0.0001, label: "0.0001°(约10m) (默认)" },
    { value: 0.0005, label: "0.0005°(约50m)" },
    { value: 0.001, label: "0.001°(约100m)" },
    { value: 0.005, label: "0.005°(约500m)" },
    { value: 0.01, label: "0.01° (约1000m)(粗略)" },
  ];

  const currentIndex = toleranceValues.findIndex((t) => t.value === tolerance);

  return (
    <Card>
      <CardHeader>
        <CardTitle>轨迹控制面板</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-sm font-medium">抽稀容差参数</Label>
          <div className="space-y-3">
            <Slider
              value={[currentIndex]}
              onValueChange={(value) => {
                onToleranceChange(toleranceValues[value[0]].value);
              }}
              max={toleranceValues.length - 1}
              step={1}
              disabled={isProcessing}
              className="w-full"
            />
            <div className="text-sm text-muted-foreground text-center">
              当前值: {tolerance}°
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              {toleranceValues.map((item) => (
                <div
                  key={item.value}
                  className={`text-center ${
                    item.value === tolerance ? "font-bold text-primary" : ""
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-medium">轨迹显示控制</Label>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-1 bg-blue-500 rounded"></div>
                <Label htmlFor="show-original" className="text-sm font-normal">
                  显示原始轨迹
                </Label>
              </div>
              <Switch
                id="show-original"
                checked={showOriginal}
                onCheckedChange={onShowOriginalChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-1 bg-red-500 rounded"></div>
                <Label htmlFor="show-simplified" className="text-sm font-normal">
                  显示抽稀轨迹
                </Label>
              </div>
              <Switch
                id="show-simplified"
                checked={showSimplified}
                onCheckedChange={onShowSimplifiedChange}
              />
            </div>
          </div>
        </div>

        {stats && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">轨迹统计</Label>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">文件大小:</span>
                <Badge variant="secondary">{formatFileSize(stats.fileSize)}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">原始点数:</span>
                <Badge variant="outline">
                  {stats.originalCount.toLocaleString()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">抽稀后点数:</span>
                <Badge variant="outline">
                  {stats.simplifiedCount.toLocaleString()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">压缩比:</span>
                <Badge variant="default" className="bg-green-600">
                  {stats.compressionRatio}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">减少点数:</span>
                <Badge variant="outline">
                  {(
                    stats.originalCount - stats.simplifiedCount
                  ).toLocaleString()}
                </Badge>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>压缩进度</span>
                  <span>{stats.compressionRatio}%</span>
                </div>
                <Progress value={stats.compressionRatio} className="h-2" />
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">正在处理轨迹数据...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
