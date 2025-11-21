"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Marker } from "mapbox-gl";
import type { Feature } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapMatchedSegments } from "@/lib/mapMatching";

interface TripMapProps {
  originalPath: [number, number][];
  simplifiedPath?: [number, number][];
  mapMatchedPath?: [number, number][];
  precomputedMapMatchedPath?: [number, number][];
  mapMatchedSegments?: MapMatchedSegments | null;
  showOriginal: boolean;
  showSimplified: boolean;
  showSimplifiedPoints: boolean;
  showPrecomputedMapMatched?: boolean;
  showPrecomputedMapMatchedPoints?: boolean;
  showMapMatched?: boolean;
  showMapMatchedPoints?: boolean;
}

function coordinatesEqual(
  a: [number, number] | undefined,
  b: [number, number] | undefined,
  epsilon = 1e-9
) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
}

export default function TripMap({
  originalPath,
  simplifiedPath = [],
  mapMatchedPath = [],
  precomputedMapMatchedPath = [],
  mapMatchedSegments = null,
  showOriginal,
  showSimplified,
  showSimplifiedPoints,
  showPrecomputedMapMatched = true,
  showPrecomputedMapMatchedPoints = false,
  showMapMatched = true,
  showMapMatchedPoints = false,
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const finishMarkerRef = useRef<Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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
    if (!mapContainer.current || mapRef.current) return;

    const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("Mapbox access token is required");
      return;
    }

    mapboxgl.accessToken = accessToken;

    const initialCenter = finishPoint ?? [113.9, 22.5];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard",
      center: initialCenter,
      zoom: 10,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    map.on("load", () => setMapLoaded(true));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      finishMarkerRef.current?.remove();
      finishMarkerRef.current = null;
    };
  }, [finishPoint]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || originalPath.length === 0) {
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    originalPath.forEach((coord) => bounds.extend(coord));
    if (simplifiedPath.length > 0) {
      simplifiedPath.forEach((coord) => bounds.extend(coord));
    }
    if (mapMatchedPath.length > 0) {
      mapMatchedPath.forEach((coord) => bounds.extend(coord));
    }
    if (precomputedMapMatchedPath.length > 0) {
      precomputedMapMatchedPath.forEach((coord) => bounds.extend(coord));
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 48, maxZoom: 16 });
    }
    const target = finishPoint;

    if (target) {
      mapRef.current.setCenter(target);
    }
  }, [
    finishPoint,
    mapLoaded,
    mapMatchedPath,
    originalPath,
    precomputedMapMatchedPath,
    simplifiedPath,
  ]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    if (map.getSource("trip-original")) {
      map.removeLayer("trip-original-line");
      map.removeLayer("trip-original-points");
      map.removeSource("trip-original");
    }

    if (originalPath.length > 0) {
      map.addSource("trip-original", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            ...(originalPath.length > 1
              ? [
                  {
                    type: "Feature" as const,
                    geometry: {
                      type: "LineString" as const,
                      coordinates: originalPath,
                    },
                    properties: {},
                  },
                ]
              : []),
            ...originalPath.map((coord, index) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: coord,
              },
              properties: { index },
            })),
          ],
        },
      });

      if (originalPath.length > 1) {
        map.addLayer({
          id: "trip-original-line",
          type: "line",
          source: "trip-original",
          filter: ["==", "$type", "LineString"],
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: showOriginal ? "visible" : "none",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
      }

      map.addLayer({
        id: "trip-original-points",
        type: "circle",
        source: "trip-original",
        filter: ["==", "$type", "Point"],
        layout: {
          visibility: showOriginal ? "visible" : "none",
        },
        paint: {
          "circle-color": "#2563eb",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    }
  }, [mapLoaded, originalPath, showOriginal]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    const hasRenderableStyle = () => {
      try {
        return Boolean(map.getStyle());
      } catch {
        return false;
      }
    };

    const cleanupLayers = () => {
      if (!hasRenderableStyle()) return;

      try {
        if (map.getLayer("trip-simplified-line")) {
          map.removeLayer("trip-simplified-line");
        }
        if (map.getLayer("trip-simplified-points")) {
          map.removeLayer("trip-simplified-points");
        }
        if (map.getSource("trip-simplified")) {
          map.removeSource("trip-simplified");
        }
      } catch (error) {
        console.warn("清理抽稀图层失败", error);
      }
    };

    const applyLayers = () => {
      if (!hasRenderableStyle()) return;

      cleanupLayers();

      if (simplifiedPath.length <= 1) {
        return;
      }

      map.addSource("trip-simplified", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "LineString" as const,
                coordinates: simplifiedPath,
              },
            },
            ...simplifiedPath.map((coord, index) => ({
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

      map.addLayer({
        id: "trip-simplified-line",
        type: "line",
        source: "trip-simplified",
        filter: ["==", "$type", "LineString"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: showSimplified ? "visible" : "none",
        },
        paint: {
          "line-color": "#ef4444",
          "line-width": 3,
          "line-opacity": 0.9,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "trip-simplified-points",
        type: "circle",
        source: "trip-simplified",
        filter: ["==", "$type", "Point"],
        layout: {
          visibility:
            showSimplified && showSimplifiedPoints ? "visible" : "none",
        },
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    };

    if (!map.isStyleLoaded()) {
      const handleStyle = () => {
        if (!map.isStyleLoaded() || !hasRenderableStyle()) {
          return;
        }
        map.off("styledata", handleStyle);
        applyLayers();
      };

      map.on("styledata", handleStyle);

      return () => {
        map.off("styledata", handleStyle);
        cleanupLayers();
      };
    }

    applyLayers();

    return () => {
      cleanupLayers();
    };
  }, [mapLoaded, showSimplified, showSimplifiedPoints, simplifiedPath]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    const hasRenderableStyle = () => {
      try {
        return Boolean(map.getStyle());
      } catch {
        return false;
      }
    };

    const cleanup = () => {
      if (!hasRenderableStyle()) return;
      if (map.getLayer("trip-precomputed-line")) {
        map.removeLayer("trip-precomputed-line");
      }
      if (map.getLayer("trip-precomputed-points")) {
        map.removeLayer("trip-precomputed-points");
      }
      if (map.getSource("trip-precomputed")) {
        map.removeSource("trip-precomputed");
      }
    };

    const applyLayers = () => {
      if (!hasRenderableStyle()) return;

      cleanup();

      if (precomputedMapMatchedPath.length <= 1) {
        return;
      }

      map.addSource("trip-precomputed", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: precomputedMapMatchedPath,
              },
              properties: {},
            },
            ...precomputedMapMatchedPath.map((coord, index) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: coord,
              },
              properties: { index },
            })),
          ],
        },
      });

      map.addLayer({
        id: "trip-precomputed-line",
        type: "line",
        source: "trip-precomputed",
        filter: ["==", "$type", "LineString"],
        layout: {
          "line-cap": "round",
          "line-join": "round",
          visibility: showPrecomputedMapMatched ? "visible" : "none",
        },
        paint: {
          "line-color": "#f97316",
          "line-width": 3.5,
          "line-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "trip-precomputed-points",
        type: "circle",
        source: "trip-precomputed",
        filter: ["==", "$type", "Point"],
        layout: {
          visibility:
            showPrecomputedMapMatched && showPrecomputedMapMatchedPoints
              ? "visible"
              : "none",
        },
        paint: {
          "circle-color": "#f97316",
          "circle-radius": 4,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    };

    if (!map.isStyleLoaded()) {
      const handleStyle = () => {
        if (!map.isStyleLoaded() || !hasRenderableStyle()) {
          return;
        }
        map.off("styledata", handleStyle);
        applyLayers();
      };

      map.on("styledata", handleStyle);

      return () => {
        map.off("styledata", handleStyle);
        cleanup();
      };
    }

    applyLayers();

    return () => {
      cleanup();
    };
  }, [
    mapLoaded,
    precomputedMapMatchedPath,
    showPrecomputedMapMatched,
    showPrecomputedMapMatchedPoints,
  ]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    const hasRenderableStyle = () => {
      try {
        return Boolean(map.getStyle());
      } catch {
        return false;
      }
    };

    const removeMapMatchedLayers = () => {
      if (!hasRenderableStyle()) return;

      try {
        const layersToRemove = [
          "trip-mapmatched-line-matched",
          "trip-mapmatched-line-matched-arrows",
          "trip-mapmatched-line-raw",
          "trip-mapmatched-line-raw-arrows",
          "trip-mapmatched-line-connector",
          "trip-mapmatched-line-connector-arrows",
          "trip-mapmatched-points",
        ];
        layersToRemove.forEach((layerId) => {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        });
        if (map.getSource("trip-mapmatched")) {
          map.removeSource("trip-mapmatched");
        }
      } catch (error) {
        console.warn("移除地图匹配图层失败", error);
      }
    };

    const applyMapMatchedLayers = () => {
      if (!hasRenderableStyle()) return;

      removeMapMatchedLayers();

      const matchedSegments = mapMatchedSegments?.matched ?? [];
      const rawSegments = mapMatchedSegments?.raw ?? [];
      const orderedSegments = mapMatchedSegments?.ordered ?? [];
      const effectiveMatchedSegments =
        matchedSegments.length === 0 &&
        rawSegments.length === 0 &&
        mapMatchedPath.length > 1
          ? [mapMatchedPath]
          : matchedSegments;

      const connectorSegments: [number, number][][] = [];
      if (orderedSegments.length > 1) {
        for (let index = 1; index < orderedSegments.length; index += 1) {
          const previous = orderedSegments[index - 1];
          const next = orderedSegments[index];
          const prevEnd = previous.coordinates[previous.coordinates.length - 1];
          const nextStart = next.coordinates[0];

          if (!prevEnd || !nextStart || coordinatesEqual(prevEnd, nextStart)) {
            continue;
          }

          connectorSegments.push([prevEnd, nextStart]);
        }
      }

      const hasMatchedSegments = effectiveMatchedSegments.some(
        (segment) => segment.length > 1
      );
      const hasRawSegments = rawSegments.some((segment) => segment.length > 1);
      const hasConnectorSegments = connectorSegments.length > 0;
      const hasPoints = mapMatchedPath.length > 0;

      if (
        !hasMatchedSegments &&
        !hasRawSegments &&
        !hasConnectorSegments &&
        !hasPoints
      ) {
        return;
      }

      const features: Feature[] = [];

      effectiveMatchedSegments.forEach((coords, index) => {
        if (coords.length < 2) return;
        features.push({
          type: "Feature",
          properties: {
            featureKind: "line",
            segmentType: "matched",
            segmentIndex: index,
          },
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        });
      });

      rawSegments.forEach((coords, index) => {
        if (coords.length < 2) return;
        features.push({
          type: "Feature",
          properties: {
            featureKind: "line",
            segmentType: "raw",
            segmentIndex: index,
          },
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        });
      });

      connectorSegments.forEach((coords, index) => {
        if (coords.length < 2) return;
        features.push({
          type: "Feature",
          properties: {
            featureKind: "line",
            segmentType: "connector",
            segmentIndex: index,
          },
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        });
      });

      if (hasPoints) {
        features.push(
          ...mapMatchedPath.map((coord, index) => ({
            type: "Feature" as const,
            properties: {
              featureKind: "point",
              segmentType: "matched",
              index,
            },
            geometry: {
              type: "Point" as const,
              coordinates: coord,
            },
          }))
        );
      }

      map.addSource("trip-mapmatched", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      if (hasMatchedSegments) {
        map.addLayer({
          id: "trip-mapmatched-line-matched",
          type: "line",
          source: "trip-mapmatched",
          filter: [
            "all",
            ["==", ["get", "featureKind"], "line"],
            ["==", ["get", "segmentType"], "matched"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: showMapMatched ? "visible" : "none",
          },
          paint: {
            "line-color": "#22c55e",
            "line-width": 3,
            "line-opacity": 0.95,
          },
        });

        map.addLayer(
          {
            id: "trip-mapmatched-line-matched-arrows",
            type: "symbol",
            source: "trip-mapmatched",
            filter: [
              "all",
              ["==", ["get", "featureKind"], "line"],
              ["==", ["get", "segmentType"], "matched"],
            ],
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 80,
              "text-field": ">",
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-size": 18,
              "text-anchor": "center",
              "text-allow-overlap": true,
              "text-rotation-alignment": "map",
              "text-keep-upright": false,
              "symbol-z-order": "source",
              visibility: showMapMatched ? "visible" : "none",
            },
            paint: {
              "text-color": "#15803d",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.2,
            },
          },
          "trip-mapmatched-line-matched"
        );
      }

      if (hasRawSegments) {
        map.addLayer({
          id: "trip-mapmatched-line-raw",
          type: "line",
          source: "trip-mapmatched",
          filter: [
            "all",
            ["==", ["get", "featureKind"], "line"],
            ["==", ["get", "segmentType"], "raw"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: showMapMatched ? "visible" : "none",
          },
          paint: {
            "line-color": "#22c55e",
            "line-width": 2.5,
            "line-opacity": 0.9,
            "line-dasharray": [1.5, 1.5],
          },
        });

        map.addLayer(
          {
            id: "trip-mapmatched-line-raw-arrows",
            type: "symbol",
            source: "trip-mapmatched",
            filter: [
              "all",
              ["==", ["get", "featureKind"], "line"],
              ["==", ["get", "segmentType"], "raw"],
            ],
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 80,
              "text-field": ">",
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-size": 16,
              "text-anchor": "center",
              "text-allow-overlap": true,
              "text-rotation-alignment": "map",
              "text-keep-upright": false,
              "symbol-z-order": "source",
              visibility: showMapMatched ? "visible" : "none",
            },
            paint: {
              "text-color": "#16a34a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.2,
            },
          },
          "trip-mapmatched-line-raw"
        );
      }

      if (hasConnectorSegments) {
        map.addLayer({
          id: "trip-mapmatched-line-connector",
          type: "line",
          source: "trip-mapmatched",
          filter: [
            "all",
            ["==", ["get", "featureKind"], "line"],
            ["==", ["get", "segmentType"], "connector"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: showMapMatched ? "visible" : "none",
          },
          paint: {
            "line-color": "#6b7280",
            "line-width": 2.5,
            "line-opacity": 0.85,
            "line-dasharray": [0.4, 1.1],
          },
        });

        map.addLayer(
          {
            id: "trip-mapmatched-line-connector-arrows",
            type: "symbol",
            source: "trip-mapmatched",
            filter: [
              "all",
              ["==", ["get", "featureKind"], "line"],
              ["==", ["get", "segmentType"], "connector"],
            ],
            layout: {
              "symbol-placement": "line",
              "symbol-spacing": 80,
              "text-field": ">",
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-size": 14,
              "text-anchor": "center",
              "text-allow-overlap": true,
              "text-rotation-alignment": "map",
              "text-keep-upright": false,
              "symbol-z-order": "source",
              visibility: showMapMatched ? "visible" : "none",
            },
            paint: {
              "text-color": "#4b5563",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1,
            },
          },
          "trip-mapmatched-line-connector"
        );
      }

      if (hasPoints) {
        map.addLayer({
          id: "trip-mapmatched-points",
          type: "circle",
          source: "trip-mapmatched",
          filter: [
            "all",
            ["==", ["get", "featureKind"], "point"],
            ["==", ["geometry-type"], "Point"],
          ],
          layout: {
            visibility:
              showMapMatched && showMapMatchedPoints ? "visible" : "none",
          },
          paint: {
            "circle-color": "#22c55e",
            "circle-radius": 4,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      }
    };

    if (!map.isStyleLoaded()) {
      const handleStyleData = () => {
        if (!map.isStyleLoaded()) {
          return;
        }
        map.off("styledata", handleStyleData);
        applyMapMatchedLayers();
      };
      map.on("styledata", handleStyleData);

      return () => {
        map.off("styledata", handleStyleData);
        removeMapMatchedLayers();
      };
    }

    applyMapMatchedLayers();

    return () => {
      removeMapMatchedLayers();
    };
  }, [
    mapLoaded,
    mapMatchedPath,
    mapMatchedSegments,
    showMapMatched,
    showMapMatchedPoints,
  ]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    finishMarkerRef.current?.remove();
    finishMarkerRef.current = null;

    if (!finishPoint) return;

    const markerEl = document.createElement("div");
    markerEl.className = "flex h-8 w-8 items-center justify-center text-2xl";
    markerEl.textContent = "🏁";

    finishMarkerRef.current = new mapboxgl.Marker({
      element: markerEl,
      anchor: "bottom",
    })
      .setLngLat(finishPoint)
      .addTo(mapRef.current);
  }, [finishPoint, mapLoaded]);

  return (
    <div
      ref={mapContainer}
      className="h-[480px] w-full rounded-lg overflow-hidden shadow"
    />
  );
}
