"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { GPSDataPoint } from "@/types";

interface MapboxMapProps {
  gpsData: GPSDataPoint[];
  originalTrajectory: [number, number][];
  timeFilteredTrajectory: [number, number][];
  simplifiedTrajectory: [number, number][];
  showOriginal: boolean;
  showTimeFiltered: boolean;
  showSimplified: boolean;
}

export default function MapboxMap({
  gpsData,
  originalTrajectory,
  timeFilteredTrajectory,
  simplifiedTrajectory,
  showOriginal,
  showTimeFiltered,
  showSimplified,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("Mapbox access token is required");
      return;
    }

    mapboxgl.accessToken = accessToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [113.9, 22.5],
      zoom: 10,
      projection: "mercator",
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded || gpsData.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    gpsData.forEach((point) => {
      bounds.extend([point.longitude, point.latitude]);
    });

    map.current.fitBounds(bounds, {
      padding: 50,
      maxZoom: 16,
    });
  }, [gpsData, mapLoaded]);

  // 原始轨迹 - 蓝色
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getSource("original-trajectory")) {
      map.current.removeLayer("original-trajectory-line");
      map.current.removeSource("original-trajectory");
    }

    if (originalTrajectory.length > 0) {
      map.current.addSource("original-trajectory", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: originalTrajectory,
          },
        },
      });

      map.current.addLayer({
        id: "original-trajectory-line",
        type: "line",
        source: "original-trajectory",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: showOriginal ? "visible" : "none",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 3,
          "line-opacity": 0.8,
        },
      });
    }
  }, [originalTrajectory, mapLoaded, showOriginal]);

  // 时间间隔抽稀轨迹 - 黄色
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getSource("time-filtered-trajectory")) {
      map.current.removeLayer("time-filtered-trajectory-line");
      map.current.removeLayer("time-filtered-trajectory-points");
      map.current.removeSource("time-filtered-trajectory");
    }

    if (timeFilteredTrajectory.length > 0) {
      map.current.addSource("time-filtered-trajectory", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: timeFilteredTrajectory,
              },
            },
            ...timeFilteredTrajectory.map((coord, index) => ({
              type: "Feature" as const,
              properties: { index },
              geometry: {
                type: "Point" as const,
                coordinates: coord,
              },
            })),
          ],
        },
      });

      map.current.addLayer({
        id: "time-filtered-trajectory-line",
        type: "line",
        source: "time-filtered-trajectory",
        filter: ["==", "$type", "LineString"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: showTimeFiltered ? "visible" : "none",
        },
        paint: {
          "line-color": "#eab308",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });

      map.current.addLayer({
        id: "time-filtered-trajectory-points",
        type: "circle",
        source: "time-filtered-trajectory",
        filter: ["==", "$type", "Point"],
        layout: {
          visibility: showTimeFiltered ? "visible" : "none",
        },
        paint: {
          "circle-color": "#eab308",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [timeFilteredTrajectory, mapLoaded, showTimeFiltered]);

  // RDP 抽稀轨迹 - 红色
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getSource("simplified-trajectory")) {
      map.current.removeLayer("simplified-trajectory-line");
      map.current.removeLayer("simplified-trajectory-points");
      map.current.removeSource("simplified-trajectory");
    }

    if (simplifiedTrajectory.length > 0) {
      map.current.addSource("simplified-trajectory", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: simplifiedTrajectory,
              },
            },
            ...simplifiedTrajectory.map((coord, index) => ({
              type: "Feature" as const,
              properties: { index },
              geometry: {
                type: "Point" as const,
                coordinates: coord,
              },
            })),
          ],
        },
      });

      map.current.addLayer({
        id: "simplified-trajectory-line",
        type: "line",
        source: "simplified-trajectory",
        filter: ["==", "$type", "LineString"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: showSimplified ? "visible" : "none",
        },
        paint: {
          "line-color": "#ef4444",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });

      map.current.addLayer({
        id: "simplified-trajectory-points",
        type: "circle",
        source: "simplified-trajectory",
        filter: ["==", "$type", "Point"],
        layout: {
          visibility: showSimplified ? "visible" : "none",
        },
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [simplifiedTrajectory, mapLoaded, showSimplified]);

  // 控制原始轨迹显示/隐藏
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer("original-trajectory-line")) {
      map.current.setLayoutProperty(
        "original-trajectory-line",
        "visibility",
        showOriginal ? "visible" : "none"
      );
    }
  }, [showOriginal, mapLoaded]);

  // 控制时间抽稀轨迹显示/隐藏
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer("time-filtered-trajectory-line")) {
      map.current.setLayoutProperty(
        "time-filtered-trajectory-line",
        "visibility",
        showTimeFiltered ? "visible" : "none"
      );
    }

    if (map.current.getLayer("time-filtered-trajectory-points")) {
      map.current.setLayoutProperty(
        "time-filtered-trajectory-points",
        "visibility",
        showTimeFiltered ? "visible" : "none"
      );
    }
  }, [showTimeFiltered, mapLoaded]);

  // 控制RDP抽稀轨迹显示/隐藏
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer("simplified-trajectory-line")) {
      map.current.setLayoutProperty(
        "simplified-trajectory-line",
        "visibility",
        showSimplified ? "visible" : "none"
      );
    }

    if (map.current.getLayer("simplified-trajectory-points")) {
      map.current.setLayoutProperty(
        "simplified-trajectory-points",
        "visibility",
        showSimplified ? "visible" : "none"
      );
    }
  }, [showSimplified, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center p-6">
            <p className="text-gray-600 mb-2">请配置 Mapbox Access Token</p>
            <p className="text-sm text-gray-500">
              在 .env.local 文件中设置 NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-white p-2 sm:p-3 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 text-xs sm:text-sm">
          <div className="flex items-center">
            <div className="w-3 h-1 sm:w-4 sm:h-1 bg-blue-500 mr-1 sm:mr-2"></div>
            <span>原始轨迹</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-1 sm:w-4 sm:h-1 bg-yellow-500 mr-1 sm:mr-2"></div>
            <span>时间抽稀</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-1 sm:w-4 sm:h-1 bg-red-500 mr-1 sm:mr-2"></div>
            <span>RDP抽稀</span>
          </div>
        </div>
      </div>
    </div>
  );
}
