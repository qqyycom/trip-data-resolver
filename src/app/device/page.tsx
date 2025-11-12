"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function DeviceSearchPage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = deviceId.trim();
    if (!trimmed) {
      setError("请输入设备 ID");
      return;
    }

    setError("");
    router.push(`/device/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>设备行程查询</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device-id">设备 ID</Label>
              <Input
                id="device-id"
                value={deviceId}
                placeholder="例如：D22472C05B5C28A74CE807228AFFC3EBD7CF0D74"
                onChange={(event) => setDeviceId(event.target.value)}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full">
              搜索行程
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
