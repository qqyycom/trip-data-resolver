"use client";

import { useCallback, useState } from "react";
import { parseGPSFile } from "@/lib/gpsParser";
import { GPSDataPoint } from "@/types";

interface FileUploadProps {
  onDataLoaded: (data: GPSDataPoint[], fileSize: number) => void;
}

export default function FileUpload({ onDataLoaded }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        const result = await parseGPSFile(file);

        if (result.data.length === 0) {
          throw new Error("未找到有效的GPS数据点");
        }

        onDataLoaded(result.data, result.fileSize);
      } catch (err) {
        setError(err instanceof Error ? err.message : "文件解析失败");
      } finally {
        setIsProcessing(false);
      }
    },
    [onDataLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${
            isDragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }
          ${isProcessing ? "opacity-50 pointer-events-none" : ""}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">正在处理文件...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              拖拽文件到此处或点击选择
            </p>
            <p className="text-sm text-gray-500 mb-4">
              支持单个GPS轨迹数据文件或包含多个.map文件的ZIP压缩包
            </p>
            <input
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              accept=".txt,.csv,.log,.map,.zip"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
            >
              选择文件
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-medium mb-2">支持的文件格式：</h3>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>单个轨迹文件：.txt, .csv, .log, .map</li>
          <li>ZIP压缩包：包含多个.map文件，将按时间顺序自动合并</li>
        </ul>
        <h3 className="font-medium mb-2">数据格式示例：</h3>
        <code className="block bg-gray-100 p-3 rounded text-xs">
          A,220725,033129,2235.1489,N,11357.0225,E,8.54,-0.66,0.42,-0.67;
        </code>
        <p className="text-xs text-gray-500 mt-2">
          ZIP文件中的.map文件将按文件名中的时间戳（如：20250722112147_NO_D_000003F.map）自动排序
        </p>
      </div>
    </div>
  );
}
