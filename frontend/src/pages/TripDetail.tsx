import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button, Space, Switch, message, Modal, Input } from 'antd';
import { Trip, POI, tripApi, routeApi, Route, RoutePOI, routePoiApi } from '../services/api';
import MapView from '../components/Map/MapView';
import type { RouteHitSegment } from '../components/Map/MapView';
import DayModeToggle from '../components/Route/DayModeToggle';
import CalendarSidebar from '../components/Route/CalendarSidebar';
import RouteStopsEditor from '../components/Route/RouteStopsEditor';
import TrafficPanel from '../components/Traffic/TrafficPanel';
import PosterPreview from '../components/Couple/PosterPreview';
import ShareButton from '../components/Couple/ShareButton';
import { useUserPreferences } from '../hooks/useLocalStorage';

function mergeRoutePoiIntoTrip(trip: Trip, routeId: string, updated: RoutePOI): Trip {
  return {
    ...trip,
    routes: trip.routes.map((r) =>
      r.id === routeId ? { ...r, pois: r.pois.map((rp) => (rp.id === updated.id ? updated : rp)) } : r
    ),
  };
}

function mergeRoutePoisInTrip(trip: Trip, routeId: string, pois: RoutePOI[]): Trip {
  return {
    ...trip,
    routes: trip.routes.map((r) => (r.id === routeId ? { ...r, pois } : r)),
  };
}

const TripDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [routeEditMode, setRouteEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [coupleFriendly, setCoupleFriendly] = useState(false);
  const [trafficPanelOpen, setTrafficPanelOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<{ from: POI; to: POI } | null>(null);
  const [posterPreviewOpen, setPosterPreviewOpen] = useState(false);
  const [userPrefs] = useUserPreferences();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const [stopEdit, setStopEdit] = useState<{
    routeId: string;
    routePoi: RoutePOI;
  } | null>(null);
  const [stopNoteDraft, setStopNoteDraft] = useState('');
  const [stopSaving, setStopSaving] = useState(false);

  const [legEdit, setLegEdit] = useState<{
    routeId: string;
    routePoi: RoutePOI;
    fromPoi: POI;
    toPoi: POI;
  } | null>(null);
  const [legNoteDraft, setLegNoteDraft] = useState('');
  const [legSaving, setLegSaving] = useState(false);

  /** 换日：递增 token 以刷新 GeoJSON Source id + 静默重拉行程（数据在 GET /trips/:id/，不单独调 /pois/） */
  const [mapRemountToken, setMapRemountToken] = useState(0);
  const refreshTripData = useCallback(async (tripId: string) => {
    try {
      const { data } = await tripApi.get(tripId);
      setTrip(data);
    } catch {
      /* 静默，避免换日打断 */
    }
  }, []);

  const prevDayForMapRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevDayForMapRef.current === null) {
      prevDayForMapRef.current = selectedDay;
      return;
    }
    if (prevDayForMapRef.current === selectedDay) return;
    prevDayForMapRef.current = selectedDay;
    setMapRemountToken((t) => t + 1);
    if (id) void refreshTripData(id);
  }, [selectedDay, id, refreshTripData]);

  const fetchTrip = useCallback(async (tripId: string) => {
    setLoading(true);
    try {
      const response = await tripApi.get(tripId);
      const data = response.data;
      setTrip(data);
      if (data.routes && data.routes.length > 0) {
        const firstDay = Number(String(data.routes[0].day_number).trim());
        setSelectedDay(firstDay);
        const dayRoutes = data.routes.filter(
          (r) => Number(String(r.day_number).trim()) === firstDay
        );
        setSelectedRouteId(dayRoutes[0]?.id ?? data.routes[0].id ?? null);
      } else {
        setSelectedRouteId(null);
      }
    } catch {
      message.error('获取行程详情失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      void fetchTrip(id);
    }
  }, [id, fetchTrip]);

  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setRouteEditMode(true);
      setViewMode('calendar');
    }
  }, [searchParams]);

  const currentDayRoutes = useMemo(
    () =>
      trip?.routes?.filter((r) => Number(String(r.day_number).trim()) === Number(selectedDay)) ?? [],
    [trip?.routes, selectedDay]
  );

  /** 地图上始终展示「当前选中日期」下的全部路线，避免切换日时 selectedRouteId 尚未校正导致空白 */
  const mapDayRoutes = currentDayRoutes;

  useEffect(() => {
    if (currentDayRoutes.length === 0) {
      setSelectedRouteId(null);
      return;
    }
    const stillValid = currentDayRoutes.some((r) => r.id === selectedRouteId);
    if (!stillValid) {
      const best =
        [...currentDayRoutes].sort((a, b) => (b.pois?.length ?? 0) - (a.pois?.length ?? 0))[0] ??
        currentDayRoutes[0];
      setSelectedRouteId(best.id);
    }
  }, [currentDayRoutes, selectedRouteId]);

  const mapPois = useMemo(() => {
    const list = mapDayRoutes.flatMap((r) => r.pois?.map((rp) => rp.poi) || []);
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [mapDayRoutes]);

  const fitBoundsCoords = useMemo(() => {
    const coords: [number, number][] = [];
    mapDayRoutes.forEach((route) => {
      route.pois?.forEach((rp) => {
        const lng = parseFloat(String(rp.poi.longitude));
        const lat = parseFloat(String(rp.poi.latitude));
        if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat]);
      });
    });
    return coords;
  }, [mapDayRoutes]);

  /** 带上坐标摘要，避免 Day1→Day2→Day1 时 key 与上次相同导致地图不重新 fit */
  const fitBoundsKey = useMemo(() => {
    const sig = fitBoundsCoords.map((c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`).join('|');
    return `${selectedDay}-${sig}`;
  }, [selectedDay, fitBoundsCoords]);

  const routeLines = useMemo(
    () =>
      mapDayRoutes.map((route) => {
        const sorted = [...(route.pois || [])].sort((a, b) => a.order_index - b.order_index);
        return {
          id: route.id,
          coordinates: sorted.map(
            (rp) =>
              [parseFloat(String(rp.poi.longitude)), parseFloat(String(rp.poi.latitude))] as [number, number]
          ),
          color: route.color,
        };
      }),
    [mapDayRoutes]
  );

  const routeHitSegments = useMemo((): RouteHitSegment[] => {
    const out: RouteHitSegment[] = [];
    mapDayRoutes.forEach((route) => {
      const list = [...(route.pois || [])].sort((a, b) => a.order_index - b.order_index);
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const cur = list[i];
        const lng0 = parseFloat(String(prev.poi.longitude));
        const lat0 = parseFloat(String(prev.poi.latitude));
        const lng1 = parseFloat(String(cur.poi.longitude));
        const lat1 = parseFloat(String(cur.poi.latitude));
        if (![lng0, lat0, lng1, lat1].every(Number.isFinite)) continue;
        out.push({
          id: `${route.id}-leg-${cur.id}`,
          routeId: route.id,
          toRoutePoiId: cur.id,
          color: route.color || '#8b4513',
          coordinates: [
            [lng0, lat0],
            [lng1, lat1],
          ],
        });
      }
    });
    return out;
  }, [mapDayRoutes]);

  const openStopEditor = useCallback(
    (poi: POI) => {
      for (const route of mapDayRoutes) {
        const rp = route.pois?.find((x) => x.poi.id === poi.id);
        if (rp) {
          setStopNoteDraft(rp.stop_note ?? '');
          setStopEdit({ routeId: route.id, routePoi: rp });
          return;
        }
      }
      message.warning('当前地图未找到该标点所属路线');
    },
    [mapDayRoutes]
  );

  const handleMapPoiClick = useCallback(
    async (poi: POI) => {
      if (!routeEditMode || !selectedRouteId || !trip) {
        openStopEditor(poi);
        return;
      }
      const route = trip.routes.find((r) => r.id === selectedRouteId);
      if (!route) {
        openStopEditor(poi);
        return;
      }
      const ordered = [...(route.pois || [])].sort((a, b) => a.order_index - b.order_index);
      if (ordered.some((rp) => rp.poi.id === poi.id)) {
        openStopEditor(poi);
        return;
      }
      try {
        const res = await routeApi.connect(selectedRouteId, [...ordered.map((rp) => rp.poi.id), poi.id]);
        setTrip((t) => (t ? mergeRoutePoisInTrip(t, selectedRouteId, res.data.pois) : t));
        message.success('已加入当日路线');
      } catch {
        message.error('加入路线失败');
      }
    },
    [routeEditMode, selectedRouteId, trip, openStopEditor]
  );

  const exitRouteEditMode = useCallback(() => {
    setRouteEditMode(false);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const removeStopFromRoute = async () => {
    if (!stopEdit || !trip) return;
    try {
      const route = trip.routes.find((r) => r.id === stopEdit.routeId);
      if (!route) return;
      const ordered = [...(route.pois || [])].sort((a, b) => a.order_index - b.order_index);
      const nextIds = ordered.filter((rp) => rp.id !== stopEdit.routePoi.id).map((rp) => rp.poi.id);
      const res = await routeApi.connect(stopEdit.routeId, nextIds);
      setTrip((t) => (t ? mergeRoutePoisInTrip(t, stopEdit.routeId, res.data.pois) : t));
      message.success('已移除站点');
      setStopEdit(null);
    } catch {
      message.error('移除失败');
    }
  };

  const handleRouteHitSegmentClick = useCallback(
    ({ routeId, toRoutePoiId }: { routeId: string; toRoutePoiId: string }) => {
      const route = mapDayRoutes.find((r) => r.id === routeId);
      if (!route?.pois?.length) return;
      const ordered = [...route.pois].sort((a, b) => a.order_index - b.order_index);
      const idx = ordered.findIndex((rp) => rp.id === toRoutePoiId);
      if (idx < 1) return;
      const routePoi = ordered[idx];
      const fromPoi = ordered[idx - 1].poi;
      const toPoi = routePoi.poi;
      setLegNoteDraft(routePoi.segment_note ?? '');
      setLegEdit({ routeId, routePoi, fromPoi, toPoi });
    },
    [mapDayRoutes]
  );

  const submitStopNote = async () => {
    if (!stopEdit || !trip) return;
    setStopSaving(true);
    try {
      const updated = (await routePoiApi.patchNotes(stopEdit.routePoi.id, { stop_note: stopNoteDraft || null }))
        .data;
      setTrip((t) => (t ? mergeRoutePoiIntoTrip(t, stopEdit.routeId, updated) : t));
      message.success('已保存站点备注');
      setStopEdit(null);
    } catch {
      message.error('保存失败');
    } finally {
      setStopSaving(false);
    }
  };

  const submitLegNote = async () => {
    if (!legEdit || !trip) return;
    setLegSaving(true);
    try {
      const updated = (await routePoiApi.patchNotes(legEdit.routePoi.id, { segment_note: legNoteDraft || null }))
        .data;
      setTrip((t) => (t ? mergeRoutePoiIntoTrip(t, legEdit.routeId, updated) : t));
      message.success('已保存路段备注');
      setLegEdit(null);
    } catch {
      message.error('保存失败');
    } finally {
      setLegSaving(false);
    }
  };

  const openTrafficFromLeg = () => {
    if (!legEdit) return;
    setSelectedSegment({ from: legEdit.fromPoi, to: legEdit.toPoi });
    setTrafficPanelOpen(true);
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-surface-bright p-6 text-on-surface">
        无效的行程 ID
      </div>
    );
  }

  const handleSaveToDevice = () => {
    setPosterPreviewOpen(true);
  };

  const handleShareToSocial = (platform: string) => {
    message.info(`分享到 ${platform} 功能开发中`);
  };

  const handleRouteDelete = async (route: Route) => {
    try {
      await routeApi.delete(route.id);
      setTrip((prev) => {
        if (!prev) return prev;
        return { ...prev, routes: prev.routes.filter((r) => r.id !== route.id) };
      });
      message.success('路线已删除');
    } catch {
      message.error('删除路线失败');
    }
  };

  if (loading && !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-bright text-on-surface-variant">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-bright text-on-surface">
      {viewMode === 'calendar' && (
        <CalendarSidebar
          routes={trip?.routes || []}
          selectedDay={selectedDay}
          selectedRouteId={selectedRouteId}
          onDaySelect={(day) => setSelectedDay(day)}
          onRouteClick={(route) => setSelectedRouteId(route.id)}
          onRouteDelete={handleRouteDelete}
          tripStartDate={trip?.start_date ?? null}
          extra={
            routeEditMode && id ? (
              <RouteStopsEditor
                tripId={id}
                selectedDay={selectedDay}
                activeRoute={currentDayRoutes.find((r) => r.id === selectedRouteId) ?? null}
                routesForDay={currentDayRoutes}
                onRoutePoisSynced={(routeId, pois) => {
                  setTrip((t) => (t ? mergeRoutePoisInTrip(t, routeId, pois) : t));
                }}
                onRouteCreated={(route) => {
                  setTrip((t) => (t ? { ...t, routes: [...t.routes, route] } : t));
                  setSelectedRouteId(route.id);
                }}
              />
            ) : null
          }
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 md:px-6 md:py-4 bg-surface-bright/85 backdrop-blur-xl border-b border-transparent shadow-[0_1px_0_rgba(62,48,38,0.07)] transition-colors duration-normal z-ribbon">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <Link
                to="/trips"
                className="mt-0.5 shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
                aria-label="返回行程列表"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path
                    fillRule="evenodd"
                    d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <div className="min-w-0">
                <h1 className="font-headline text-xl md:text-2xl font-bold text-primary truncate">
                  {trip?.name || '行程详情'}
                </h1>
                <p className="text-sm text-on-surface-variant truncate">{trip?.destination}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5">
                <span className="text-sm text-on-surface-variant whitespace-nowrap">情侣友好</span>
                <Switch checked={coupleFriendly} onChange={setCoupleFriendly} />
              </div>
              <Space wrap size={10}>
                <Button
                  size="large"
                  type={routeEditMode ? 'primary' : 'default'}
                  className="rounded-full font-semibold cursor-pointer"
                  onClick={() => {
                    if (routeEditMode) {
                      exitRouteEditMode();
                    } else {
                      setRouteEditMode(true);
                      if (viewMode !== 'calendar') setViewMode('calendar');
                    }
                  }}
                >
                  {routeEditMode ? '完成编辑' : '编辑路线'}
                </Button>
                <Button
                  size="large"
                  className="rounded-full font-semibold cursor-pointer"
                  onClick={() => {
                    if (viewMode === 'calendar' && routeEditMode) {
                      message.info('编辑路线时请保持日历侧栏打开');
                      return;
                    }
                    setViewMode(viewMode === 'calendar' ? 'list' : 'calendar');
                  }}
                >
                  {viewMode === 'calendar' ? '隐藏日历' : '显示日历'}
                </Button>
                <ShareButton onSaveToDevice={handleSaveToDevice} onShareToSocial={handleShareToSocial} />
              </Space>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-1 -mx-1 px-1">
            <DayModeToggle
              currentDay={selectedDay}
              totalDays={Math.max(...(trip?.routes?.map((r) => Number(r.day_number)) || [1]), 1)}
              onDayChange={(day) => setSelectedDay(day)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <MapView
            pois={mapPois}
            selectedPois={[]}
            routes={routeLines}
            routeHitSegments={routeHitSegments}
            onPoiClick={handleMapPoiClick}
            onRouteHitSegmentClick={handleRouteHitSegmentClick}
            fitBoundsKey={fitBoundsKey}
            fitBoundsCoords={fitBoundsCoords}
            routeHitLineWidth={routeEditMode ? 36 : 18}
            tripDayForMap={selectedDay}
            mapRemountToken={mapRemountToken}
          />
        </div>
      </div>

      <TrafficPanel
        open={trafficPanelOpen}
        onCancel={() => setTrafficPanelOpen(false)}
        fromPoi={selectedSegment?.from || null}
        toPoi={selectedSegment?.to || null}
        coupleFriendly={coupleFriendly}
      />

      <PosterPreview
        open={posterPreviewOpen}
        onCancel={() => setPosterPreviewOpen(false)}
        trip={trip}
        coupleAvatars={userPrefs.couple_avatars}
      />

      <Modal
        title={stopEdit ? `站点：${stopEdit.routePoi.poi.name}` : ''}
        open={!!stopEdit}
        onCancel={() => setStopEdit(null)}
        destroyOnHidden
        footer={
          stopEdit ? (
            <Space className="w-full justify-end flex-wrap">
              {routeEditMode ? (
                <Button danger onClick={() => void removeStopFromRoute()}>
                  从当日路线移除
                </Button>
              ) : null}
              <Button onClick={() => setStopEdit(null)}>取消</Button>
              <Button type="primary" loading={stopSaving} onClick={() => void submitStopNote()}>
                保存
              </Button>
            </Space>
          ) : null
        }
      >
        {stopEdit ? (
          <div className="space-y-3">
            <p className="text-xs text-on-surface-variant">
              填写本站在当日行程中的备忘（如到达时间、停留时长）。不影响标点库里的全局备注。
            </p>
            {stopEdit.routePoi.poi.note ? (
              <div className="text-xs text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2">
                标点库备注：{stopEdit.routePoi.poi.note}
              </div>
            ) : null}
            <Input.TextArea
              rows={4}
              value={stopNoteDraft}
              onChange={(e) => setStopNoteDraft(e.target.value)}
              placeholder="例如：14:30 抵达，游览约 2 小时"
              maxLength={500}
              showCount
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        title={legEdit ? `路段：${legEdit.fromPoi.name} → ${legEdit.toPoi.name}` : ''}
        open={!!legEdit}
        onCancel={() => setLegEdit(null)}
        onOk={() => void submitLegNote()}
        okText="保存路段备注"
        cancelText="取消"
        confirmLoading={legSaving}
        destroyOnHidden
        footer={
          <Space className="w-full justify-end flex-wrap">
            <Button onClick={openTrafficFromLeg}>查看路线方案</Button>
            <Button onClick={() => setLegEdit(null)}>取消</Button>
            <Button type="primary" loading={legSaving} onClick={() => void submitLegNote()}>
              保存
            </Button>
          </Space>
        }
      >
        {legEdit ? (
          <div className="space-y-3">
            <p className="text-xs text-on-surface-variant">
              记录两地之间的交通方式或路途备忘，会显示在分享海报上。
            </p>
            <Input.TextArea
              rows={4}
              value={legNoteDraft}
              onChange={(e) => setLegNoteDraft(e.target.value)}
              placeholder="例如：包车 40 分钟 / 景区大巴 / 步行 15 分钟"
              maxLength={500}
              showCount
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default TripDetail;
