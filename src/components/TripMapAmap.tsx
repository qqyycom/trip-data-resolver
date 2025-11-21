"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AMapMap = {
  destroy: () => void;
  addControl: (control: unknown) => void;
  setFitView: (overlays?: unknown[]) => void;
  setZoomAndCenter: (zoom: number, center: [number, number]) => void;
};

type AMapPolyline = {
  setMap: (map: AMapMap | null) => void;
};

type AMapCircleMarker = {
  setMap: (map: AMapMap | null) => void;
};

type AMapNamespace = {
  Map: new (container: HTMLDivElement, options: Record<string, unknown>) => AMapMap;
  Scale: new () => unknown;
  ToolBar: new () => unknown;
  Polyline: new (options: Record<string, unknown>) => AMapPolyline;
  CircleMarker: new (options: Record<string, unknown>) => AMapCircleMarker;
};

interface TripMapAmapProps {
  apiKey: string;
  originalPath: [number, number][];
  simplifiedPath?: [number, number][];
  mapMatchedPath?: [number, number][];
  precomputedMapMatchedPath?: [number, number][];
  showOriginal: boolean;
  showSimplified: boolean;
  showSimplifiedPoints: boolean;
  showPrecomputedMapMatched?: boolean;
  showPrecomputedMapMatchedPoints?: boolean;
  showMapMatched?: boolean;
  showMapMatchedPoints?: boolean;
}

declare global {
  interface Window {
    AMap?: AMapNamespace;
  }
}

let amapLoaderPromise: Promise<AMapNamespace> | null = null;

function loadAmapSdk(apiKey: string): Promise<AMapNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("AMap SDK requires browser environment"));
  }

  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }

  if (!apiKey) {
    return Promise.reject(new Error("Missing AMap apiKey"));
  }

  if (!amapLoaderPromise) {
    amapLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&plugin=AMap.Scale,AMap.ToolBar`;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load AMap SDK"));
      script.onload = () => {
        if (window.AMap) {
          resolve(window.AMap);
        } else {
          reject(new Error("AMap SDK not available"));
        }
      };
      document.head.appendChild(script);
    });
  }

  return amapLoaderPromise;
}

export default function TripMapAmap({
  apiKey,
  originalPath,
  simplifiedPath = [],
  mapMatchedPath = [],
  precomputedMapMatchedPath = [],
  showOriginal,
  showSimplified,
  showSimplifiedPoints,
  showPrecomputedMapMatched = true,
  showPrecomputedMapMatchedPoints = false,
  showMapMatched = true,
  showMapMatchedPoints = false,
}: TripMapAmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<AMapMap | null>(null);
  const overlaysRef = useRef<{
    original?: AMapPolyline;
    simplified?: AMapPolyline;
    simplifiedPoints?: AMapCircleMarker[];
    precomputed?: AMapPolyline;
    precomputedPoints?: AMapCircleMarker[];
    matched?: AMapPolyline;
    matchedPoints?: AMapCircleMarker[];
  }>({});
  const [mapReady, setMapReady] = useState(false);

  const finishPoint = useMemo(() => {
    if (mapMatchedPath.length > 0) {
      return mapMatchedPath[mapMatchedPath.length - 1];
    }
    if (precomputedMapMatchedPath.length > 0) {
      return precomputedMapMatchedPath[precomputedMapMatchedPath.length - 1];
    }
    if (simplifiedPath.length > 0) {
      return simplifiedPath[simplifiedPath.length - 1];
    }
    return originalPath[originalPath.length - 1];
  }, [mapMatchedPath, originalPath, precomputedMapMatchedPath, simplifiedPath]);

  useEffect(() => {
    let cancelled = false;

    if (!containerRef.current) {
      return;
    }

    loadAmapSdk(apiKey)
      .then((AMap) => {
        if (cancelled) {
          return;
        }

        const map = new AMap.Map(containerRef.current as HTMLDivElement, {
          zoom: 12,
          center: finishPoint ?? [116.397428, 39.90923],
          mapStyle: "amap://styles/normal",
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar());

        mapRef.current = map;
        setMapReady(true);
      })
      .catch((error) => {
        console.error("Failed to initialise AMap", error);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [apiKey, finishPoint]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const overlays = overlaysRef.current;

    const removeOverlay = (key: keyof typeof overlays) => {
      const overlay = overlays[key];
      if (!overlay) return;

      if (Array.isArray(overlay)) {
        overlay.forEach((item) => item.setMap(null));
      } else {
        overlay.setMap(null);
      }
      overlays[key] = undefined;
    };

    if (overlays.original) {
      overlays.original.setMap(null);
      overlays.original = undefined;
    }

    if (showOriginal && originalPath.length > 1) {
      overlays.original = new window.AMap!.Polyline({
        map,
        path: originalPath,
        strokeColor: "#2563eb",
        strokeOpacity: 0.85,
        strokeWeight: 4,
      });
    }

    removeOverlay("simplified");
    removeOverlay("simplifiedPoints");

    if (showSimplified && simplifiedPath.length > 1) {
      overlays.simplified = new window.AMap!.Polyline({
        map,
        path: simplifiedPath,
        strokeColor: "#ef4444",
        strokeOpacity: 0.9,
        strokeWeight: 3,
        isOutline: false,
        strokeStyle: "dashed",
        strokeDasharray: [10, 10],
      });

      if (showSimplifiedPoints) {
        overlays.simplifiedPoints = simplifiedPath.map((coord) => {
          return new window.AMap!.CircleMarker({
            map,
            center: coord,
            radius: 3.5,
            strokeColor: "#ffffff",
            strokeWeight: 1,
            fillColor: "#ef4444",
            fillOpacity: 1,
          });
        });
      }
    }

    removeOverlay("matched");
    removeOverlay("matchedPoints");

    removeOverlay("precomputed");
    removeOverlay("precomputedPoints");

    if (showPrecomputedMapMatched && precomputedMapMatchedPath.length > 1) {
      overlays.precomputed = new window.AMap!.Polyline({
        map,
        path: precomputedMapMatchedPath,
        strokeColor: "#f97316",
        strokeOpacity: 0.95,
        strokeWeight: 3.5,
        showDir: false,
      });

      if (showPrecomputedMapMatchedPoints) {
        overlays.precomputedPoints = precomputedMapMatchedPath.map((coord) => {
          return new window.AMap!.CircleMarker({
            map,
            center: coord,
            radius: 3.5,
            strokeColor: "#ffffff",
            strokeWeight: 1,
            fillColor: "#f97316",
            fillOpacity: 1,
          });
        });
      }
    }

    if (showMapMatched && mapMatchedPath.length > 1) {
      overlays.matched = new window.AMap!.Polyline({
        map,
        path: mapMatchedPath,
        strokeColor: "#22c55e",
        strokeOpacity: 0.95,
        strokeWeight: 4,
        showDir: true,
      });

      if (showMapMatchedPoints) {
        overlays.matchedPoints = mapMatchedPath.map((coord) => {
          return new window.AMap!.CircleMarker({
            map,
            center: coord,
            radius: 3.5,
            strokeColor: "#ffffff",
            strokeWeight: 1,
            fillColor: "#22c55e",
            fillOpacity: 1,
          });
        });
      }
    }

    const overlaysForFit = [
      overlays.original,
      overlays.simplified,
      overlays.precomputed,
      overlays.matched,
    ].filter(Boolean);

    if (overlaysForFit.length > 0) {
      map.setFitView(overlaysForFit);
    } else if (finishPoint) {
      map.setZoomAndCenter(12, finishPoint);
    }
  }, [
    mapReady,
    originalPath,
    simplifiedPath,
    mapMatchedPath,
    precomputedMapMatchedPath,
    showOriginal,
    showSimplified,
    showSimplifiedPoints,
    showPrecomputedMapMatched,
    showPrecomputedMapMatchedPoints,
    showMapMatched,
    showMapMatchedPoints,
    finishPoint,
  ]);

  return <div ref={containerRef} className="h-[480px] w-full rounded-lg overflow-hidden shadow" />;
}
