"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TripRecord } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSpeed, formatTimestamp } from "@/lib/utils";
import { encodeCursor } from "@/lib/cursor";
import { loadTripsState, saveTripsState } from "@/lib/trip-storage";

interface TripsListClientProps {
  deviceId: string;
  initialTrips: TripRecord[];
  initialCursor?: string;
}

const PAGE_SIZE = 10;

function tripToCursor(trip?: TripRecord) {
  if (!trip) return undefined;

  return encodeCursor({
    device_id: trip.device_id,
    start_time: trip.start_time,
    id: trip.id,
  });
}

export default function TripsListClient({
  deviceId,
  initialTrips,
  initialCursor,
}: TripsListClientProps) {
  const persisted = loadTripsState(deviceId);

  const [trips, setTrips] = useState<TripRecord[]>(
    persisted?.trips?.length ? (persisted.trips as TripRecord[]) : initialTrips
  );
  const fallbackHasMore = Boolean(initialCursor) || initialTrips.length === PAGE_SIZE;
  const initialHasMore = persisted?.hasMore ?? fallbackHasMore;

  const [cursor, setCursor] = useState<string | undefined>(
    persisted?.cursor ?? (initialHasMore ? initialCursor ?? tripToCursor(initialTrips[initialTrips.length - 1]) : undefined)
  );
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveTripsState({
      deviceId,
      trips,
      cursor,
      hasMore,
    });
  }, [cursor, deviceId, hasMore, trips]);

  const resolveCursor = useCallback(() => {
    if (cursor) return cursor;
    return tripToCursor(trips[trips.length - 1]);
  }, [cursor, trips]);
  const emptyState = trips.length === 0 && !isLoading;

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    const cursorToUse = resolveCursor();
    if (!cursorToUse) {
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const search = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
      });
      search.set("cursor", cursorToUse);

      const response = await fetch(
        `/api/device/${encodeURIComponent(
          deviceId
        )}/trips?${search.toString()}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("请求失败");
      }

      const data = (await response.json()) as {
        trips?: TripRecord[];
        nextCursor?: string;
      };

      const newTrips = data.trips ?? [];
      setTrips((prev) => [...prev, ...newTrips]);
      const fallbackCursor = tripToCursor(newTrips[newTrips.length - 1]);
      const nextCursor = data.nextCursor ?? fallbackCursor;
      setCursor(nextCursor);
      const hasNext = Boolean(nextCursor) || newTrips.length === PAGE_SIZE;
      setHasMore(hasNext);
    } catch (err) {
      console.error("加载更多行程失败", err);
      setError("加载更多行程失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, hasMore, isLoading, resolveCursor]);

  return (
    <div className="min-h-screen bg-muted/10">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">设备 {deviceId} 行程列表</h1>
          <p className="text-sm text-muted-foreground">
            展示所有状态为 FINISH 或 PART_FINISHED，且未删除的行程。
          </p>
        </header>

        {emptyState ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              暂无符合条件的行程记录。
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {trips.map((trip) => (
              <Card key={`${trip.device_id}-${trip.id}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">行程 {trip.id}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      开始：{formatTimestamp(trip.start_time)} · 结束：
                      {formatTimestamp(trip.end_time)}
                    </p>
                  </div>
                  <Badge variant="secondary">{trip.status}</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm space-y-1">
                    <p>
                      平均速度：
                      {formatSpeed(
                        typeof trip.average_speed === "number"
                          ? trip.average_speed
                          : undefined
                      )}
                    </p>
                    {typeof trip.mileage === "number" && (
                      <p>里程：{(trip.mileage / 1000).toFixed(2)} km</p>
                    )}
                  </div>
                  <Button asChild>
                    <Link
                      href={`/device/${encodeURIComponent(
                        deviceId
                      )}/${encodeURIComponent(trip.id)}`}
                    >
                      查看详情
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="py-4 text-destructive text-sm">
              {error}{" "}
              <Button variant="link" className="px-1" onClick={loadMore}>
                重新加载
              </Button>
            </CardContent>
          </Card>
        )}

        {hasMore && (
          <div className="flex items-center justify-center py-6">
            <Button onClick={loadMore} disabled={isLoading}>
              {isLoading ? "加载中…" : "点击加载更多"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
