import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import area from '@turf/area';
import type { Farm, GeoJSONPolygon } from '../types/fieldwise';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

export type BasemapMode = 'satellite' | 'standard';

interface MapWorkspaceProps {
  farms: Farm[];
  selectedFarm: Farm | null;
  onSelectFarm?: (farmId: string) => void;
  basemap: BasemapMode;
  rasterOverlay?: {
    id: string;
    tileUrl: string;
    maxZoom: number;
    opacity?: number;
  } | null;
  drawingMode?: boolean;
  draftCoords?: [number, number][];
  onAddDraftPoint?: (lngLat: [number, number]) => void;
  editingVertices?: boolean;
  onUpdateEditedGeometry?: (geom: GeoJSONPolygon) => void;
  heightClass?: string;
  wrapperClassName?: string;
}

function makeBasemapStyle(mode: BasemapMode): maplibregl.StyleSpecification {
  if (mode === 'satellite') {
    return {
      version: 8,
      sources: {
        esri_imagery: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
          maxzoom: 19,
        },
        esri_labels: {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 18,
        },
      },
      layers: [
        { id: 'esri-imagery-layer', type: 'raster', source: 'esri_imagery' },
        { id: 'esri-labels-layer', type: 'raster', source: 'esri_labels', paint: { 'raster-opacity': 0.78 } },
      ],
    };
  }
  return {
    version: 8,
    sources: {
      osm_tiles: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm-layer', type: 'raster', source: 'osm_tiles' }],
  };
}

export function MapWorkspace({
  farms,
  selectedFarm,
  onSelectFarm,
  basemap,
  rasterOverlay = null,
  drawingMode = false,
  draftCoords = [],
  onAddDraftPoint,
  editingVertices = false,
  onUpdateEditedGeometry,
  heightClass = 'h-[480px]',
  wrapperClassName = '',
}: MapWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const drawingRef = useRef(drawingMode);
  const onAddPointRef = useRef(onAddDraftPoint);
  const onSelectFarmRef = useRef(onSelectFarm);
  drawingRef.current = drawingMode;
  onAddPointRef.current = onAddDraftPoint;
  onSelectFarmRef.current = onSelectFarm;

  // Initialize MapLibre instance once
  useEffect(() => {
    if (!containerRef.current) return;
    const initCenter: [number, number] = selectedFarm
      ? [selectedFarm.centroid_lon, selectedFarm.centroid_lat]
      : [76.2805, 9.878];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: makeBasemapStyle(basemap),
      center: initCenter,
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      setMapReady(true);
    });

    map.on('mousemove', (e: MapMouseEvent) => {
      setCursorCoords({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    map.on('click', (e: MapMouseEvent) => {
      if (drawingRef.current && onAddPointRef.current) {
        onAddPointRef.current([Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))]);
        return;
      }
      if (map.getLayer('farms-fill')) {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['farms-fill'] });
        if (hits.length > 0 && hits[0].properties?.farmId && onSelectFarmRef.current) {
          onSelectFarmRef.current(String(hits[0].properties.farmId));
        }
      }
    });

    mapRef.current = map;
    return () => {
      vertexMarkersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch basemap style cleanly and re-mark ready on style.load
  const prevBasemapRef = useRef<BasemapMode>(basemap);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevBasemapRef.current === basemap) return;
    prevBasemapRef.current = basemap;
    setMapReady(false);
    map.setStyle(makeBasemapStyle(basemap));
    map.once('styledata', () => setMapReady(true));
  }, [basemap]);

  // Cursor hint when drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = drawingMode ? 'crosshair' : 'grab';
  }, [drawingMode]);

  // Sync NASA GIBS / GEE raster overlay layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer('nasa-overlay-layer')) map.removeLayer('nasa-overlay-layer');
    if (map.getSource('nasa-overlay-src')) map.removeSource('nasa-overlay-src');

    if (rasterOverlay) {
      map.addSource('nasa-overlay-src', {
        type: 'raster',
        tiles: [rasterOverlay.tileUrl],
        tileSize: 256,
        maxzoom: rasterOverlay.maxZoom,
      });
      // Insert overlay below vector boundaries if vector layer exists
      const beforeId = map.getLayer('farms-fill') ? 'farms-fill' : undefined;
      map.addLayer(
        {
          id: 'nasa-overlay-layer',
          type: 'raster',
          source: 'nasa-overlay-src',
          paint: {
            'raster-opacity': rasterOverlay.opacity ?? 0.72,
          },
        },
        beforeId,
      );
    }
  }, [rasterOverlay, mapReady]);

  // Sync Saved Farm Polygons & Draft Drawing Polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const farmFeatures = farms.map((f) => ({
      type: 'Feature' as const,
      properties: {
        farmId: f.id,
        name: f.name,
        selected: selectedFarm?.id === f.id ? 1 : 0,
      },
      geometry: f.geometry_geojson,
    }));

    const farmsFc = { type: 'FeatureCollection' as const, features: farmFeatures };

    if (map.getSource('farms-src')) {
      (map.getSource('farms-src') as GeoJSONSource).setData(farmsFc as GeoJSON.FeatureCollection);
    } else {
      map.addSource('farms-src', { type: 'geojson', data: farmsFc as GeoJSON.FeatureCollection });
      map.addLayer({
        id: 'farms-fill',
        type: 'fill',
        source: 'farms-src',
        paint: {
          'fill-color': ['case', ['==', ['get', 'selected'], 1], '#16A34A', '#0284C7'],
          'fill-opacity': ['case', ['==', ['get', 'selected'], 1], 0.25, 0.14],
        },
      });
      map.addLayer({
        id: 'farms-outline',
        type: 'line',
        source: 'farms-src',
        paint: {
          'line-color': ['case', ['==', ['get', 'selected'], 1], '#DCFCE7', '#7DD3FC'],
          'line-width': ['case', ['==', ['get', 'selected'], 1], 2.5, 1.5],
        },
      });
    }

    // Draft polygon & vertices
    const draftFeatures: GeoJSON.Feature[] = [];
    if (draftCoords.length >= 2) {
      const closed = draftCoords.length >= 3 ? [...draftCoords, draftCoords[0]] : draftCoords;
      if (draftCoords.length >= 3) {
        draftFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [closed] },
        });
      } else {
        draftFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: draftCoords },
        });
      }
    }
    for (const pt of draftCoords) {
      draftFeatures.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: pt },
      });
    }
    const draftFc = { type: 'FeatureCollection' as const, features: draftFeatures };

    if (map.getSource('draft-src')) {
      (map.getSource('draft-src') as GeoJSONSource).setData(draftFc);
    } else {
      map.addSource('draft-src', { type: 'geojson', data: draftFc });
      map.addLayer({
        id: 'draft-fill',
        type: 'fill',
        source: 'draft-src',
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.25 },
      });
      map.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft-src',
        paint: { 'line-color': '#FBBF24', 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'draft-points',
        type: 'circle',
        source: 'draft-src',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#FBBF24', 'circle-stroke-color': '#171C19', 'circle-stroke-width': 1.5 },
      });
    }
  }, [farms, selectedFarm, draftCoords, mapReady]);

  // Fly to selected farm when selection changes (unless user is actively drawing or dragging vertices)
  const lastCenteredIdRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFarm || drawingMode || editingVertices) return;
    if (lastCenteredIdRef.current !== selectedFarm.id) {
      lastCenteredIdRef.current = selectedFarm.id;
      const targetZoom = rasterOverlay && rasterOverlay.maxZoom < 12 ? Math.min(9, rasterOverlay.maxZoom + 1) : 15;
      map.flyTo({
        center: [selectedFarm.centroid_lon, selectedFarm.centroid_lat],
        zoom: targetZoom,
        duration: 850,
      });
    }
  }, [selectedFarm, drawingMode, editingVertices, rasterOverlay]);

  // Zoom adjustment when switching to coarse satellite layer on Earth Intelligence page
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFarm || !rasterOverlay) return;
    if (rasterOverlay.maxZoom <= 9 && map.getZoom() > 12) {
      map.easeTo({
        center: [selectedFarm.centroid_lon, selectedFarm.centroid_lat],
        zoom: Math.min(10, rasterOverlay.maxZoom + 1),
        duration: 600,
      });
    }
  }, [rasterOverlay, selectedFarm]);

  // Draggable Vertex Markers when editing existing farm boundary
  useEffect(() => {
    const map = mapRef.current;
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];
    if (!map || !mapReady || !editingVertices || !selectedFarm || !onUpdateEditedGeometry) return;

    const ring =
      selectedFarm.geometry_geojson.type === 'Polygon'
        ? (selectedFarm.geometry_geojson.coordinates[0] as number[][])
        : ((selectedFarm.geometry_geojson.coordinates[0] as number[][][])[0] as number[][]);

    if (!ring || ring.length < 4) return;
    const openRing = ring.slice(0, -1).map((c) => [c[0], c[1]]);

    openRing.forEach((coord, idx) => {
      const el = document.createElement('div');
      el.className = 'h-3.5 w-3.5 rounded-full border-2 border-[#171C19] bg-amber-400 shadow cursor-move';
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([coord[0], coord[1]])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        openRing[idx] = [Number(lngLat.lng.toFixed(6)), Number(lngLat.lat.toFixed(6))];
        const closed = [...openRing, openRing[0]];
        onUpdateEditedGeometry({
          type: 'Polygon',
          coordinates: [closed],
        });
      });
      vertexMarkersRef.current.push(marker);
    });

    return () => {
      vertexMarkersRef.current.forEach((m) => m.remove());
      vertexMarkersRef.current = [];
    };
  }, [editingVertices, selectedFarm, mapReady, onUpdateEditedGeometry]);

  const draftAreaHa =
    draftCoords.length >= 3
      ? area({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[...draftCoords, draftCoords[0]]] },
        }) / 10000
      : 0;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-[#DDDAD0] bg-[#131C18] shadow-[0_1px_3px_rgba(23,28,25,0.06)] ${wrapperClassName}`}
    >
      <div ref={containerRef} className={`w-full ${heightClass}`} />

      {/* Top-Left Telemetry Overlay */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <div className="rounded-md bg-[#131C18]/85 px-2.5 py-1 text-[11px] font-mono text-white/95 backdrop-blur-xs border border-white/15 shadow-xs">
          {cursorCoords ? `${cursorCoords.lat.toFixed(5)}°N, ${cursorCoords.lon.toFixed(5)}°E` : 'Cursor Telemetry Ready'}
        </div>
        {drawingMode && (
          <div className="rounded-md bg-[#FBBF24] px-2.5 py-1 text-[11px] font-semibold text-[#171C19] shadow">
            Drawing · {draftCoords.length} pts {draftAreaHa > 0 ? `· ${draftAreaHa.toFixed(2)} ha` : ''}
          </div>
        )}
        {editingVertices && (
          <div className="rounded-md bg-[#34D399] px-2.5 py-1 text-[11px] font-semibold text-[#171C19] shadow">
            Drag boundary vertices to reshape field
          </div>
        )}
      </div>
    </div>
  );
}
