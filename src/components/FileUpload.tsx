"use client";

import { useCallback, useState } from "react";
import { parseGPSFile } from "@/lib/gpsParser";
import { GPSDataPoint } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";

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
    <div className="w-full max-w-2xl mx-auto">
      <Card>
        <CardContent className="p-8">
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
              ${
                isDragOver
                  ? "border-primary bg-primary/10"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }
              ${isProcessing ? "opacity-50 pointer-events-none" : ""}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">正在处理文件...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    拖拽文件到此处或点击选择
                  </p>
                  <p className="text-sm text-muted-foreground">
                    支持单个GPS轨迹数据文件或包含多个.map文件的ZIP压缩包
                  </p>
                </div>
                <div className="space-y-2">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    accept=".txt,.csv,.log,.map,.zip"
                  />
                  <Button
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    选择文件
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <Card className="mt-4 border-destructive">
              <CardContent className="p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-medium mb-2 text-foreground">支持的文件格式：</h3>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li>单个轨迹文件：.txt, .csv, .log, .map</li>
                <li>ZIP压缩包：包含多个.map文件，将按时间顺序自动合并</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-foreground">数据格式示例：</h3>
              <Card>
                <CardContent className="p-3">
                  <code className="text-xs">
                    A,220725,033129,2235.1489,N,11357.0225,E,8.54,-0.66,0.42,-0.67;
                  </code>
                </CardContent>
              </Card>
              <p className="text-xs mt-2">
                ZIP文件中的.map文件将按文件名中的时间戳（如：20250722112147_NO_D_000003F.map）自动排序
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
