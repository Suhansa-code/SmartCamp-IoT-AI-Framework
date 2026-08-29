"use client";

import { useEffect, useRef, useState } from "react";
import * as MapLibreGL from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/components/common/ThemeProvider";
import { Mountain, MapPin, Loader2, AlertCircle } from "lucide-react";

const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_SOURCE = "terrain-3d-dem";
const TERRAIN_EXAGGERATION = 2;
const HILLSHADE_LAYER = "terrain-3d-hillshade";
const CAMP_MARKER_SOURCE = "camp-marker-source";
const CAMP_MARKER_LAYER = "camp-marker-layer";

const DEFAULT_STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DEFAULT_STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function TerrainVisualization3D({ lat, lng, elevation, campName, campCode, campStatus }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { T } = useTheme();
  const dark = T.mode === "dark";

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (lat == null || lng == null) {
      setError("No coordinates available");
      setLoading(false);
      return;
    }

    let map;
    try {
      map = new MapLibreGL.Map({
        container: containerRef.current,
        style: dark ? DEFAULT_STYLE_DARK : DEFAULT_STYLE_LIGHT,
        center: [lng, lat],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        antialias: true,
        maxPitch: 70,
      });

      map.addControl(new MapLibreGL.NavigationControl({ visualizePitch: true }), "top-right");

      map.on("load", () => {
        map.addSource(TERRAIN_SOURCE, {
          type: "raster-dem",
          tiles: [TERRAIN_TILES],
          tileSize: 256,
          encoding: "terrarium",
          maxzoom: 12,
        });
        map.setTerrain({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });

        map.addLayer(
          {
            id: HILLSHADE_LAYER,
            type: "hillshade",
            source: TERRAIN_SOURCE,
            paint: {
              "hillshade-exaggeration": 0.8,
              "hillshade-shadow-color": "#334155",
              "hillshade-highlight-color": "#e2e8f0",
              "hillshade-accent-color": "#94a3b8",
            },
          },
          "waterway"
        );

        const statusColors = {
          critical: "#DC2626",
          high: "#D97706",
          medium: "#F59E0B",
          stable: "#16A34A",
          recovery: "#16A34A",
        };
        const markerColor = statusColors[campStatus] || "#059669";

        map.addSource(CAMP_MARKER_SOURCE, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [lng, lat] },
                properties: { name: campName, code: campCode },
              },
            ],
          },
        });

        map.addLayer({
          id: CAMP_MARKER_LAYER,
          type: "circle",
          source: CAMP_MARKER_SOURCE,
          paint: {
            "circle-radius": 10,
            "circle-color": markerColor,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
            "circle-opacity": 0.95,
          },
        });

        map.addSource("camp-glow-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [lng, lat] },
                properties: {},
              },
            ],
          },
        });

        map.addLayer({
          id: "camp-glow-layer",
          type: "circle",
          source: "camp-glow-source",
          paint: {
            "circle-radius": 20,
            "circle-color": markerColor,
            "circle-blur": 0.6,
            "circle-opacity": 0.3,
          },
        });

        const popup = new MapLibreGL.Popup({ offset: 25, closeButton: false })
          .setHTML(
            `<div style="font-family: Inter, sans-serif; padding: 4px 0;">
              <div style="font-weight: 700; font-size: 13px; color: ${T.ink};">${campCode || "Camp"}</div>
              <div style="font-size: 11px; color: ${T.muted};">${campName || ""}</div>
            </div>`
          )
          .setLngLat([lng, lat])
          .addTo(map);

        mapRef.current = map;
        setLoading(false);
      });

      map.on("error", (e) => {
        console.error("Terrain map error:", e);
        setError("Failed to load terrain map");
        setLoading(false);
      });
    } catch (e) {
      console.error("Terrain map init error:", e);
      setError("Failed to initialize map");
      setLoading(false);
    }

    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng, dark, campName, campCode, campStatus, T]);

  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: "1.25rem",
        background: T.card,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1.1rem 1.25rem 0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `${T.teal}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Mountain size={16} style={{ color: T.teal }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Terrain & Elevation</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>Geographic terrain visualization</div>
          </div>
        </div>
      </div>

      {/* Map container */}
      <div style={{ padding: "0 1.25rem 1rem" }}>
        <div
          style={{
            position: "relative",
            borderRadius: "1rem",
            overflow: "hidden",
            height: "clamp(350px, 45vh, 500px)",
            background: dark ? "#030c18" : "#ddeaf5",
            border: `1px solid ${T.border}`,
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: dark ? "rgba(3,12,24,0.8)" : "rgba(221,234,245,0.8)",
                zIndex: 10,
              }}
            >
              <Loader2 size={24} className="animate-spin" style={{ color: T.teal }} />
              <span style={{ fontSize: 12, color: T.muted }}>Loading terrain…</span>
            </div>
          )}

          {error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: dark ? "rgba(3,12,24,0.8)" : "rgba(221,234,245,0.8)",
                zIndex: 10,
              }}
            >
              <AlertCircle size={24} style={{ color: T.red }} />
              <span style={{ fontSize: 12, color: T.muted }}>{error}</span>
            </div>
          )}

          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>
      </div>

      {/* Info bar */}
      <div
        style={{
          padding: "0.75rem 1.25rem 1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          borderTop: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={12} style={{ color: T.teal }} />
          <span style={{ fontSize: 11, color: T.muted }}>Latitude:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
            {lat?.toFixed(4) ?? "—"}°
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={12} style={{ color: T.teal }} />
          <span style={{ fontSize: 11, color: T.muted }}>Longitude:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
            {lng?.toFixed(4) ?? "—"}°
          </span>
        </div>
        {elevation != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Mountain size={12} style={{ color: T.teal }} />
            <span style={{ fontSize: 11, color: T.muted }}>Camp Elevation:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>
              {elevation} m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
