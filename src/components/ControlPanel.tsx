"use client";

import { TrajectoryStats } from "@/types";
import { formatFileSize } from "@/lib/utils";

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

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-6">轨迹控制面板</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            抽稀容差参数
          </label>
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max={toleranceValues.length - 1}
              step="1"
              value={toleranceValues.findIndex((t) => t.value === tolerance)}
              onChange={(e) => {
                const index = parseInt(e.target.value);
                onToleranceChange(toleranceValues[index].value);
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              disabled={isProcessing}
            />
            <div className="text-sm text-gray-600 text-center">
              当前值: {tolerance}°
            </div>
            <div className="grid grid-cols-1 gap-1 text-xs text-gray-500">
              {toleranceValues.map((item, index) => (
                <div
                  key={item.value}
                  className={`text-center ${
                    item.value === tolerance ? "font-bold text-blue-600" : ""
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            轨迹显示控制
          </label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showOriginal}
                onChange={(e) => onShowOriginalChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                <div className="w-4 h-1 bg-blue-500 mr-2"></div>
                显示原始轨迹
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showSimplified}
                onChange={(e) => onShowSimplifiedChange(e.target.checked)}
                className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 flex items-center">
                <div className="w-4 h-1 bg-red-500 mr-2"></div>
                显示抽稀轨迹
              </span>
            </label>
          </div>
        </div>

        {stats && (
          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">轨迹统计</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">文件大小:</span>
                <span className="font-medium">{formatFileSize(stats.fileSize)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">原始点数:</span>
                <span className="font-medium">
                  {stats.originalCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">抽稀后点数:</span>
                <span className="font-medium">
                  {stats.simplifiedCount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">压缩比:</span>
                <span className="font-medium text-green-600">
                  {stats.compressionRatio}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">减少点数:</span>
                <span className="font-medium">
                  {(
                    stats.originalCount - stats.simplifiedCount
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="border-t pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-sm text-gray-600">正在处理轨迹数据...</span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 2px 0 #555;
        }
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px 0 #555;
        }
      `}</style>
    </div>
  );
}
