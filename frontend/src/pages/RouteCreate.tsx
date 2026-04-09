import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Space, message, List, Select, Popconfirm } from 'antd';
import { POI, routeApi, poiApi, tripApi, Trip, GeoPlace, unwrapTripList } from '../services/api';
import MapView from '../components/Map/MapView';
import POISearchBar from '../components/POI/SearchBar';
import RouteNameInput from '../components/Route/RouteNameInput';
import TraceHeader from '../components/Layout/TraceHeader';
import { colors } from '../styles/theme';

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

const RouteCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [routeName, setRouteName] = useState('');
  const [selectedPois, setSelectedPois] = useState<POI[]>([]);
  const [availablePois, setAvailablePois] = useState<RoutePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [dayNumber, setDayNumber] = useState(1);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    const tripId = searchParams.get('trip_id');
    if (tripId) {
      setSelectedTripId(tripId);
    }
  }, [searchParams]);

  const fetchPois = useCallback(async (params?: Record<string, string>) => {
    try {
      const q = params?.search?.trim();
      if (!q) {
        const res = await poiApi.list(params);
        setAvailablePois(res.data.results);
        return;
      }
      const response = await poiApi.search({
        search: q,
        region: params?.region,
        limit: params?.limit ? Number(params.limit) : undefined,
      });
      setAvailablePois(response.data.results as RoutePlace[]);
    } catch (error) {
      message.error('获取POI列表失败');
    }
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await tripApi.list();
      setTrips(unwrapTripList(response.data));
    } catch (error) {
      console.error('获取行程列表失败', error);
    }
  };

  const handleSearch = useCallback(
    (params: { search?: string; type?: string; tags?: string }) => {
      fetchPois(params as Record<string, string>);
    },
    [fetchPois]
  );

  const handlePoiClick = async (raw: RoutePlace) => {
    let poi: POI;
    if ('id' in raw && (raw as POI).id) {
      poi = raw as POI;
    } else {
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
        poi = res.data;
        const gKey = placeKey(g);
        setAvailablePois((list) => list.map((x) => (placeKey(x) === gKey ? poi : x)));
      } catch {
        message.error('创建标点失败');
        return;
      }
    }

    setSelectedPois((prev) => {
      if (prev.some((p) => p.id === poi.id)) {
        return prev.filter((p) => p.id !== poi.id);
      }
      return [...prev, poi];
    });
  };

  const handleMovePoi = (poiId: string, direction: 'up' | 'down') => {
    setSelectedPois((prev) => {
      const index = prev.findIndex((p) => p.id === poiId);
      if (index === -1) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newPois = [...prev];
      [newPois[index], newPois[newIndex]] = [newPois[newIndex], newPois[index]];
      return newPois;
    });
  };

  const handleRemovePoi = (poiId: string) => {
    setSelectedPois((prev) => prev.filter((p) => p.id !== poiId));
  };

  const handleSaveRoute = async () => {
    if (selectedPois.length < 2) {
      message.warning('请至少选择2个POI来创建路线');
      return;
    }

    if (!selectedTripId) {
      message.warning('请先选择关联的行程');
      return;
    }

    setLoading(true);
    try {
      const route = await routeApi.create({
        name: routeName || `Day ${dayNumber}`,
        color: colors.primary,
        day_number: dayNumber,
        trip: selectedTripId,
      });

      await routeApi.connect(route.data.id, selectedPois.map((p) => p.id));

      message.success('路线创建成功');
      navigate(`/trips/${selectedTripId}`);
    } catch (error) {
      message.error('路线创建失败');
    } finally {
      setLoading(false);
    }
  };

  const routeCoordinates: [number, number][] = selectedPois
    .map((poi) => [parseFloat(String(poi.longitude)), parseFloat(String(poi.latitude))] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

  const mapFollowSelected = useMemo(() => {
    if (selectedPois.length === 0) return {};
    const p = selectedPois[selectedPois.length - 1];
    const lng = parseFloat(String(p.longitude));
    const lat = parseFloat(String(p.latitude));
    if (Number.isNaN(lng) || Number.isNaN(lat)) return {};
    return { center: [lng, lat] as [number, number], zoom: 13 };
  }, [selectedPois]);

  const displayPois = useMemo(() => {
    const m = new Map<string, RoutePlace>();
    selectedPois.forEach((p) => m.set(placeKey(p), p));
    availablePois.forEach((p) => {
      const k = placeKey(p);
      if (!m.has(k)) m.set(k, p);
    });
    return Array.from(m.values());
  }, [selectedPois, availablePois]);

  const suggestionPlaces = useMemo(
    () =>
      availablePois.map((p, i) => {
        const base = placeKey(p);
        return {
          key: `${base}::${i}`,
          searchKeyword: String(p.name ?? '').trim() || `地点 ${i + 1}`,
          sub: 'address' in p && p.address ? p.address : 'city' in p && p.city ? p.city : undefined,
        };
      }),
    [availablePois]
  );

  const addablePois = useMemo(
    () => availablePois.filter((p) => !selectedPois.some((sp) => placeKey(sp) === placeKey(p))),
    [availablePois, selectedPois]
  );

  return (
    <div className="flex flex-col h-screen bg-surface-bright text-on-surface">
      <TraceHeader variant="minimal" title="规划路线" />
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="w-80 p-4 bg-surface-container-low border-r border-transparent shadow-[1px_0_0_rgba(62,48,38,0.07)]  overflow-y-auto transition-colors duration-normal">
        <h1 className="font-headline text-lg font-bold text-primary mb-1">拖动地图 · 串起点滴</h1>
        <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
          先选行程与星期，再在搜索里打捞灵感；已选动线会叠在地图上。
        </p>

        <Space direction="vertical" className="w-full">
          <div>
            <label className="text-sm text-on-surface-variant mb-1 block font-medium">关联行程</label>
            <Select
              className="w-full"
              placeholder="选择行程"
              value={selectedTripId}
              onChange={setSelectedTripId}
              options={trips.map((t) => ({
                value: t.id,
                label: t.name || t.destination || '未命名行程',
              }))}
            />
          </div>

          <RouteNameInput
            value={routeName}
            onChange={setRouteName}
            placeholder="路线名称 (如: 大理Day1苍山徒步)"
          />

          <div>
            <label className="text-sm text-on-surface-variant font-medium">Day</label>
            <input
              type="number"
              min={1}
              value={dayNumber}
              onChange={(e) => setDayNumber(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2.5 border-none rounded-2xl bg-surface text-on-surface transition-all duration-normal focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            />
          </div>
        </Space>

        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-6 mb-2">已选 POI · {selectedPois.length}</h3>
        <List
          size="small"
          dataSource={selectedPois}
          renderItem={(poi, index) => (
            <List.Item
              className="flex justify-between items-center gap-2"
              extra={
                <Space size={0} className="flex-shrink-0">
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => handleMovePoi(poi.id, 'up')}
                    title="上移"
                    aria-label={`将「${poi.name}」上移`}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowDownOutlined />}
                    disabled={index === selectedPois.length - 1}
                    onClick={() => handleMovePoi(poi.id, 'down')}
                    title="下移"
                    aria-label={`将「${poi.name}」下移`}
                  />
                  <Popconfirm
                    title="从已选列表中移除该标点？"
                    okText="移除"
                    cancelText="取消"
                    onConfirm={() => handleRemovePoi(poi.id)}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      title="移除"
                      aria-label={`移除「${poi.name}」`}
                    />
                  </Popconfirm>
                </Space>
              }
            >
              <span className="min-w-0 break-words pr-1">
                {index + 1}. {poi.name}
              </span>
            </List.Item>
          )}
          locale={{ emptyText: '点击地图或搜索添加POI' }}
        />

        <Button
          type="primary"
          className="mt-6 w-full h-12 font-semibold"
          loading={loading}
          onClick={() => void handleSaveRoute()}
        >
          保存路线
        </Button>

        <div className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">搜索与发现</h3>
          <POISearchBar onSearch={handleSearch} suggestionPlaces={suggestionPlaces} />

          <List
            size="small"
            className="mt-2 max-h-48 overflow-y-auto"
            dataSource={addablePois}
            renderItem={(poi) => (
              <List.Item
                className="cursor-pointer rounded-xl hover:bg-surface-container-high transition-colors duration-200"
                onClick={() => handlePoiClick(poi)}
              >
                {poi.name}
              </List.Item>
            )}
          />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapView
          pois={displayPois as POI[]}
          selectedPois={selectedPois}
          routes={[
            {
              id: 'current-route',
              coordinates: routeCoordinates,
              color: colors.primary,
            },
          ]}
          onPoiClick={(p) => {
            void handlePoiClick(p as RoutePlace);
          }}
          {...mapFollowSelected}
        />
      </div>
      </div>
    </div>
  );
};

export default RouteCreate;
