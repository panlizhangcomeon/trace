import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import Map, { Marker, NavigationControl, MapRef, Source, Layer } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { POI } from '../../services/api';
import POIMarker from './POIMarker';

export interface RouteHitSegment {
  id: string;
  routeId: string;
  toRoutePoiId: string;
  color: string;
  coordinates: [[number, number], [number, number]];
}

interface MapViewProps {
  pois: POI[];
  selectedPois: POI[];
  routes?: Array<{
    id: string;
    coordinates: [number, number][];
    color: string;
  }>;
  /** 宽透明线用于捕获「路段」点击（与 routes 几何一致，按段拆分） */
  routeHitSegments?: RouteHitSegment[];
  onRouteHitSegmentClick?: (payload: { routeId: string; toRoutePoiId: string }) => void;
  onMapClick?: (lng: number, lat: number) => void;
  onPoiClick?: (poi: POI) => void;
  /** @deprecated 使用 onRouteHitSegmentClick */
  onSegmentClick?: (fromPoi: POI, toPoi: POI) => void;
  center?: [number, number];
  zoom?: number;
  /** 变化时重新 fit：建议 `day-routeId` */
  fitBoundsKey?: string;
  /** 用于自动缩放展示全部标点（至少 1 个点） */
  fitBoundsCoords?: [number, number][];
  /** 透明路段点击层的线宽（px），编辑模式下宜略大以便点中线 */
  routeHitLineWidth?: number;
  /**
   * 行程详情页传入当前选中的行程日：换日时强制重新 fit，并为线图层提供稳定 key，
   * 避免 MapLibre 在相同 source id 下未正确刷新 GeoJSON（表现为切换日后折线不显示）。
   */
  tripDayForMap?: number;
  /** 行程详情换日时递增，用于强制 `<Map>` remount（彻底刷新 WebGL 与数据源） */
  mapRemountToken?: number;
}

export const MAP_DEFAULT_CENTER: [number, number] = [102.8463, 25.0968]; // Dali, Yunnan
export const MAP_DEFAULT_ZOOM = 12;

const ROUTE_HIT_LAYER_ID = 'trace-route-hit-lines';
const DEFAULT_CENTER = MAP_DEFAULT_CENTER;
const DEFAULT_ZOOM = MAP_DEFAULT_ZOOM;

function cleanLineCoordinates(coords: [number, number][]): [number, number][] {
  return coords.filter(
    (c, i) =>
      c.length >= 2 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]) &&
      (i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  );
}

const MapView: React.FC<MapViewProps> = ({
  pois,
  selectedPois,
  routes = [],
  routeHitSegments = [],
  onRouteHitSegmentClick,
  onMapClick,
  onPoiClick,
  onSegmentClick: _onSegmentClick,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  fitBoundsKey,
  fitBoundsCoords,
  routeHitLineWidth = 18,
  tripDayForMap,
  mapRemountToken = 0,
}) => {
  const mapRef = useRef<MapRef>(null);
  const moveEndSyncRef = useRef<(() => void) | null>(null);

  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude: center[1],
    zoom,
    pitch: 0,
    bearing: 0,
  });

  /**
   * 将 props 的 center/zoom 同步到受控 viewState。
   * 行程详情页不传 center（沿用默认大理），但用 fitBounds 展示华东等地标点：若仍执行本 effect，
   * 会在 layout 阶段锚点/fit 之后把视野拉回默认中心，导致标点与折线「全在屏外」。
   */
  useEffect(() => {
    if (typeof tripDayForMap === 'number') return;
    setViewState((vs) => ({
      ...vs,
      longitude: center[0],
      latitude: center[1],
      zoom,
    }));
  }, [center[0], center[1], zoom, tripDayForMap]);

  /** 合并为单个 GeoJSON Source，避免多 Source + 无效 symbol 图层导致折线整段不渲染 */
  const routeLineFeatureCollection = useMemo(() => {
    const features = routes
      .map((route) => {
        const raw = route.coordinates.filter(
          (c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])
        ) as [number, number][];
        const coordinates = cleanLineCoordinates(raw);
        if (coordinates.length < 2) return null;
        const color =
          typeof route.color === 'string' && route.color.trim() !== '' ? route.color : '#8b4513';
        return {
          type: 'Feature' as const,
          properties: { routeId: route.id, color },
          geometry: {
            type: 'LineString' as const,
            coordinates,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    return { type: 'FeatureCollection' as const, features };
  }, [routes]);

  const hitFeatureCollection = useMemo(() => {
    const features = routeHitSegments
      .map((seg) => {
        const [a, b] = seg.coordinates;
        if (
          !a ||
          !b ||
          !Number.isFinite(a[0]) ||
          !Number.isFinite(a[1]) ||
          !Number.isFinite(b[0]) ||
          !Number.isFinite(b[1])
        ) {
          return null;
        }
        return {
          type: 'Feature' as const,
          properties: {
            routeId: String(seg.routeId),
            toRoutePoiId: String(seg.toRoutePoiId),
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [a, b] as [number, number][],
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  }, [routeHitSegments]);

  const routeHitLayerId = useMemo(
    () => (tripDayForMap != null ? `${ROUTE_HIT_LAYER_ID}-d${tripDayForMap}` : ROUTE_HIT_LAYER_ID),
    [tripDayForMap]
  );

  const interactiveLayerIds = useMemo(
    () => (hitFeatureCollection.features.length > 0 ? [routeHitLayerId] : undefined),
    [hitFeatureCollection.features.length, routeHitLayerId]
  );

  const fitMapToCoords = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !fitBoundsCoords || fitBoundsCoords.length === 0) return;

    map.resize();

    const valid = fitBoundsCoords.filter(
      (c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])
    ) as [number, number][];
    if (valid.length === 0) return;

    if (moveEndSyncRef.current) {
      map.off('moveend', moveEndSyncRef.current);
      moveEndSyncRef.current = null;
    }

    const syncViewToMap = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      setViewState((vs) => ({
        ...vs,
        longitude: c.lng,
        latitude: c.lat,
        zoom: z,
      }));
      map.off('moveend', syncViewToMap);
      if (moveEndSyncRef.current === syncViewToMap) {
        moveEndSyncRef.current = null;
      }
    };
    moveEndSyncRef.current = syncViewToMap;

    if (valid.length === 1) {
      const [lng, lat] = valid[0];
      map.easeTo({ center: [lng, lat], zoom: 14, duration: 450 });
      map.once('moveend', syncViewToMap);
      return;
    }

    const b = new maplibregl.LngLatBounds();
    valid.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: { top: 72, bottom: 72, left: 72, right: 72 }, maxZoom: 15.5, duration: 550 });
    map.once('moveend', syncViewToMap);
  }, [fitBoundsCoords]);

  /** 换日 remount 的同一帧内把受控视野锚到当日点（先于下方 fit，减轻首帧停在上一日区域） */
  const fitBoundsCoordsRef = useRef(fitBoundsCoords);
  fitBoundsCoordsRef.current = fitBoundsCoords;
  useLayoutEffect(() => {
    if (typeof tripDayForMap !== 'number') return;
    const coords = fitBoundsCoordsRef.current;
    if (!coords?.length) return;
    const [lng, lat] = coords[0];
    setViewState((vs) => ({
      ...vs,
      longitude: lng,
      latitude: lat,
    }));
  }, [mapRemountToken, tripDayForMap]);

  /**
   * 换日曾用 `<Map key>` 整图 remount，导致本 effect 当帧 `getMap()` 常为 null 且未挂上 `load`，Day2 永远不 fit，视野留在默认中心（大理）。
   * 现保留单例 Map，并在 ref 未就绪时 rAF 轮询直到可调度 fit。
   */
  useLayoutEffect(() => {
    if (!fitBoundsKey || !fitBoundsCoords?.length) return;

    let cancelled = false;
    let rafPoll = 0;
    let onLoadCb: (() => void) | null = null;

    const runFit = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) fitMapToCoords();
        });
      });
    };

    const tryAttach = (): boolean => {
      const map = mapRef.current?.getMap();
      if (!map) return false;
      if (map.loaded()) {
        runFit();
      } else {
        onLoadCb = () => {
          if (!cancelled) runFit();
        };
        map.once('load', onLoadCb);
      }
      return true;
    };

    const poll = () => {
      if (cancelled) return;
      if (tryAttach()) return;
      rafPoll = requestAnimationFrame(poll);
    };

    poll();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafPoll);
      const map = mapRef.current?.getMap();
      if (map && onLoadCb) {
        map.off('load', onLoadCb);
      }
    };
  }, [fitBoundsKey, fitBoundsCoords, fitMapToCoords, tripDayForMap, mapRemountToken]);

  const handleMapLoad = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => fitMapToCoords());
    });
  }, [fitMapToCoords]);

  /** 换日后 style/布局偶发晚就绪：多次延迟 fit，确保最终视野与图层一致 */
  useEffect(() => {
    if (typeof tripDayForMap !== 'number' || !fitBoundsCoords?.length) return;
    const delays = [0, 120, 320, 700];
    const ids = delays.map((ms) => window.setTimeout(() => fitMapToCoords(), ms));
    return () => ids.forEach(clearTimeout);
  }, [fitBoundsKey, fitMapToCoords, tripDayForMap, mapRemountToken]);

  const handleMapClick = useCallback(
    (event: maplibregl.MapLayerMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const hit = event.features?.find((f) => f.layer?.id === routeHitLayerId);
      if (hit?.properties && onRouteHitSegmentClick) {
        const routeId = hit.properties.routeId as string;
        const toRoutePoiId = hit.properties.toRoutePoiId as string;
        if (routeId && toRoutePoiId) {
          onRouteHitSegmentClick({ routeId, toRoutePoiId });
          return;
        }
      }

      if (onMapClick) {
        const { lng, lat } = event.lngLat;
        onMapClick(lng, lat);
      }
    },
    [onMapClick, onRouteHitSegmentClick, routeHitLayerId]
  );

  return (
    <div className="w-full h-full min-h-0" style={{ width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        {...viewState}
        onLoad={handleMapLoad}
        onMove={(e) => setViewState(e.viewState)}
        onClick={handleMapClick}
        interactiveLayerIds={interactiveLayerIds}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        dragPan={true}
        dragRotate={true}
        scrollZoom={true}
      >
        <NavigationControl position="top-right" />

        {routeLineFeatureCollection.features.length > 0 ? (
          <Source
            key={
              tripDayForMap != null
                ? `lines-d${tripDayForMap}-t${mapRemountToken}`
                : `lines-t${mapRemountToken}`
            }
            id="trace-all-route-lines"
            type="geojson"
            data={routeLineFeatureCollection}
          >
            <Layer
              id="trace-route-line-layer"
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
              paint={{
                'line-color': ['get', 'color'] as unknown as string,
                'line-width': 5,
                'line-opacity': 0.92,
              }}
            />
          </Source>
        ) : null}

        {hitFeatureCollection.features.length > 0 ? (
          <Source
            key={tripDayForMap != null ? `hit-d${tripDayForMap}` : 'hit'}
            id={tripDayForMap != null ? `trace-route-hit-d${tripDayForMap}` : 'trace-route-hit-src'}
            type="geojson"
            data={hitFeatureCollection}
          >
            <Layer
              id={routeHitLayerId}
              type="line"
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
              paint={{
                'line-color': '#000000',
                'line-opacity': 0,
                'line-width': routeHitLineWidth,
              }}
            />
          </Source>
        ) : null}

        {pois.map((poi, index) => {
          const longitude = parseFloat(String(poi.longitude));
          const latitude = parseFloat(String(poi.latitude));
          if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
          const uid = (poi as POI & { uid?: string }).uid;
          const baseKey =
            poi.id || (uid ? `${uid}-${longitude}-${latitude}` : `pin-${index}-${longitude}-${latitude}`);
          /** 与 fitBoundsKey 组合，避免不同日程复用同一 POI id 时标点不随日切换重挂 */
          const markerKey = fitBoundsKey ? `${fitBoundsKey}-${baseKey}` : baseKey;
          return (
            <Marker key={markerKey} longitude={longitude} latitude={latitude} anchor="bottom">
              <POIMarker
                poi={poi}
                isSelected={selectedPois.some((p) => p.id === poi.id)}
                onClick={() => onPoiClick?.(poi)}
              />
            </Marker>
          );
        })}
      </Map>
    </div>
  );
};

export default MapView;
