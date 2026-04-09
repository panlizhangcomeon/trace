import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Button, message, Spin } from 'antd';
import { DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { POI, Route, RoutePOI, routeApi, poiApi, GeoPlace } from '../../services/api';
import POISearchBar from '../POI/SearchBar';
import { colors } from '../../styles/theme';

type RoutePlace = POI | GeoPlace;

function placeKey(p: RoutePlace): string {
  if ('id' in p && (p as POI).id) return String((p as POI).id);
  const g = p as GeoPlace;
  if (g.uid) return String(g.uid);
  const lng = parseFloat(String(g.longitude));
  const lat = parseFloat(String(g.latitude));
  if (Number.isFinite(lng) && Number.isFinite(lat)) return `${lng},${lat}`;
  const name = String(g.name ?? '');
  const addr = String(g.address ?? '');
  return `raw:${name}|${addr}`;
}

export interface RouteStopsEditorProps {
  tripId: string;
  selectedDay: number;
  /** 当前选中的当日路线（与侧栏一致） */
  activeRoute: Route | null;
  /** 当日全部路线（用于提示） */
  routesForDay: Route[];
  onRoutePoisSynced: (routeId: string, pois: RoutePOI[]) => void;
  /** 新建空白路线后由父级写入 trip 并选中 */
  onRouteCreated: (route: Route) => void;
}

const RouteStopsEditor: React.FC<RouteStopsEditorProps> = ({
  tripId,
  selectedDay,
  activeRoute,
  routesForDay,
  onRoutePoisSynced,
  onRouteCreated,
}) => {
  const [saving, setSaving] = useState(false);
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [availablePlaces, setAvailablePlaces] = useState<RoutePlace[]>([]);
  const dragIdRef = useRef<string | null>(null);

  const sortedPois = useMemo(() => {
    const list = activeRoute?.pois ? [...activeRoute.pois] : [];
    return list.sort((a, b) => a.order_index - b.order_index);
  }, [activeRoute]);

  const fetchPlaces = useCallback(async (params?: Record<string, string>) => {
    try {
      const q = params?.search?.trim();
      if (!q) {
        const res = await poiApi.list(params);
        setAvailablePlaces(res.data.results);
        return;
      }
      const response = await poiApi.search({
        search: q,
        region: params?.region,
        limit: params?.limit ? Number(params.limit) : undefined,
        geo_scope: params?.geo_scope as 'domestic' | 'international' | undefined,
        country: params?.country,
      });
      setAvailablePlaces(response.data.results as RoutePlace[]);
    } catch {
      message.error('搜索地点失败');
    }
  }, []);

  useEffect(() => {
    void fetchPlaces({});
  }, [fetchPlaces]);

  const persistPoiOrder = useCallback(
    async (routeId: string, poiIds: string[]): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await routeApi.connect(routeId, poiIds);
        onRoutePoisSynced(routeId, res.data.pois);
        return true;
      } catch {
        message.error('保存路线站点失败');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [onRoutePoisSynced]
  );

  const handleCreateDayRoute = async () => {
    setCreatingRoute(true);
    try {
      const res = await routeApi.create({
        name: `Day ${selectedDay}`,
        color: colors.primary,
        day_number: selectedDay,
        trip: tripId,
      });
      message.success('已创建本日路线');
      onRouteCreated(res.data);
    } catch {
      message.error('创建路线失败');
    } finally {
      setCreatingRoute(false);
    }
  };

  const resolveToPoi = async (raw: RoutePlace): Promise<POI | null> => {
    if ('id' in raw && (raw as POI).id) {
      return raw as POI;
    }
    const g = raw as GeoPlace;
    try {
      const res = await poiApi.create({
        name: g.name,
        latitude: String(g.latitude),
        longitude: String(g.longitude),
        type: 'attraction',
        tags: [],
        note: g.address || '',
      });
      const poi = res.data;
      const gKey = placeKey(g);
      setAvailablePlaces((list) => list.map((x) => (placeKey(x) === gKey ? poi : x)));
      return poi;
    } catch {
      message.error('创建标点失败');
      return null;
    }
  };

  const handleAddFromMapPick = useCallback(
    async (raw: RoutePlace) => {
      if (!activeRoute) {
        message.warning('请先创建或选择本日路线');
        return;
      }
      const poi = await resolveToPoi(raw);
      if (!poi) return;
      const existingIds = sortedPois.map((rp) => rp.poi.id);
      if (existingIds.includes(poi.id)) {
        message.info('该地点已在当日路线中');
        return;
      }
      const ok = await persistPoiOrder(activeRoute.id, [...existingIds, poi.id]);
      if (ok) message.success('已加入当日路线');
    },
    [activeRoute, sortedPois, persistPoiOrder]
  );

  const handleRemoveStop = async (routePoiId: string) => {
    if (!activeRoute) return;
    const nextIds = sortedPois.filter((rp) => rp.id !== routePoiId).map((rp) => rp.poi.id);
    const ok = await persistPoiOrder(activeRoute.id, nextIds);
    if (ok) message.success('已移除站点');
  };

  const handleDragStart = (e: React.DragEvent, routePoiId: string) => {
    dragIdRef.current = routePoiId;
    e.dataTransfer.setData('text/plain', routePoiId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOn = async (e: React.DragEvent, targetRoutePoiId: string) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain') || dragIdRef.current;
    dragIdRef.current = null;
    if (!fromId || !activeRoute || fromId === targetRoutePoiId) return;

    const arr = [...sortedPois];
    const fromIdx = arr.findIndex((rp) => rp.id === fromId);
    const toIdx = arr.findIndex((rp) => rp.id === targetRoutePoiId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...arr];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    const poiIds = next.map((rp) => rp.poi.id);
    const ok = await persistPoiOrder(activeRoute.id, poiIds);
    if (ok) message.success('顺序已更新');
  };

  const suggestionPlaces = useMemo(
    () =>
      availablePlaces.map((p, i) => {
        const base = placeKey(p);
        return {
          key: `${base}::${i}`,
          searchKeyword: String(p.name ?? '').trim() || `地点 ${i + 1}`,
          sub: 'address' in p && p.address ? p.address : 'city' in p && p.city ? p.city : undefined,
        };
      }),
    [availablePlaces]
  );

  if (routesForDay.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-surface p-3 border border-transparent shadow-[inset_0_0_0_1px_rgba(62,48,38,0.06)]">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">编辑站点</p>
        <p className="text-sm text-on-surface-variant mb-3 leading-relaxed">这一天还没有路线，可先创建再添加标点。</p>
        <Button
          type="primary"
          block
          loading={creatingRoute}
          className="rounded-full font-semibold"
          onClick={() => void handleCreateDayRoute()}
        >
          创建本日路线
        </Button>
      </div>
    );
  }

  if (!activeRoute) {
    return (
      <div className="mt-4 rounded-2xl bg-surface p-3 border border-transparent shadow-[inset_0_0_0_1px_rgba(62,48,38,0.06)]">
        <p className="text-xs text-on-surface-variant">请在上方选择一条当日路线以编辑站点。</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-surface p-3 border border-transparent shadow-[inset_0_0_0_1px_rgba(62,48,38,0.06)]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Day {selectedDay} 选点</p>
        {saving ? <Spin size="small" /> : null}
      </div>
      <p className="text-xs text-on-surface-variant mb-2 leading-relaxed">
        搜索添加地点，或点击地图上的候选点。拖动 ⋮⋮ 调整顺序。
      </p>

      <POISearchBar onSearch={(p) => void fetchPlaces(p as Record<string, string>)} suggestionPlaces={suggestionPlaces} />

      <ul className="mt-3 space-y-2 list-none p-0 m-0 max-h-[40vh] overflow-y-auto">
        {sortedPois.map((rp) => (
          <li
            key={rp.id}
            draggable
            onDragStart={(e) => handleDragStart(e, rp.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => void handleDropOn(e, rp.id)}
            className="flex items-center gap-2 rounded-xl bg-surface-container-low px-2 py-2 border border-transparent hover:bg-surface-container-high transition-colors"
          >
            <span className="text-on-surface-variant cursor-grab active:cursor-grabbing shrink-0 touch-none" title="拖动排序">
              <HolderOutlined />
            </span>
            <span className="flex-1 min-w-0 text-sm font-medium text-on-surface truncate">{rp.poi.name}</span>
            <button
              type="button"
              className="shrink-0 p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors cursor-pointer"
              aria-label={`移除 ${rp.poi.name}`}
              onClick={() => void handleRemoveStop(rp.id)}
            >
              <DeleteOutlined />
            </button>
          </li>
        ))}
      </ul>

      {sortedPois.length === 0 ? (
        <p className="text-xs text-on-surface-variant mt-2">暂无站点，请搜索或点击地图添加。</p>
      ) : null}

      <div className="mt-3 pt-2 border-t border-[rgba(62,48,38,0.08)]">
        <p className="text-[11px] text-on-surface-variant mb-1">地图上的地点（点击加入当日路线）</p>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {availablePlaces.slice(0, 12).map((p, i) => {
            const k = `${placeKey(p)}-pick-${i}`;
            return (
              <button
                key={k}
                type="button"
                onClick={() => void handleAddFromMapPick(p)}
                className="text-xs rounded-full px-2.5 py-1 bg-secondary-container/80 text-on-secondary-container hover:opacity-90 cursor-pointer max-w-full truncate"
              >
                {String(p.name ?? '').trim() || `地点 ${i + 1}`}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RouteStopsEditor;
