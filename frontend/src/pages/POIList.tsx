import React, { useState, useEffect, useCallback } from 'react';
import { List, Card, Button, message, Popconfirm } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { POI, poiApi, GeoPlace } from '../services/api';
import POISearchBar from '../components/POI/SearchBar';
import CreatePOIModal from '../components/POI/CreatePOIModal';
import MapView from '../components/Map/MapView';
import TraceHeader from '../components/Layout/TraceHeader';

const POIList: React.FC = () => {
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPois, setSelectedPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [clickPosition, setClickPosition] = useState<{ lat: number; lng: number } | undefined>();

  // 地图中心位置状态
  const [mapCenter, setMapCenter] = useState<[number, number]>([116.404, 39.915]); // 北京
  const [mapZoom, setMapZoom] = useState(12);

  // 搜索相关状态
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoPlace[]>([]);
  const [autoCreate, setAutoCreate] = useState(true); // 自动创建标点

  useEffect(() => {
    fetchLocalPois();
  }, []);

  // 获取本地数据库的POI
  const fetchLocalPois = async () => {
    setLoading(true);
    try {
      const response = await poiApi.list();
      setPois(response.data.results);
    } catch (error) {
      console.error('获取本地POI失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 外部 POI 搜索（国内百度 / 境外 Nominatim）
  const handleSearch = useCallback(
    async (params: {
      search?: string;
      type?: string;
      tags?: string;
      geo_scope?: 'domestic' | 'international';
      country?: string;
    }) => {
    const keyword = params.search?.trim();
    if (!keyword) {
      setSearchResults([]);
      fetchLocalPois();
      return;
    }

    setLoading(true);
    setSearchQuery(keyword);
    try {
      const response = await poiApi.search({
        search: keyword,
        geo_scope: params.geo_scope,
        country: params.country,
      });
      const results = response.data.results || [];
      setSearchResults(results);

      // 如果有结果，自动定位地图到第一个结果
      if (results.length > 0) {
        const firstResult = results[0];
        const lng = firstResult.longitude;
        const lat = firstResult.latitude;

        // 地图飞到此位置
        setMapCenter([lng, lat]);
        setMapZoom(15);

        // 如果开启自动创建，自动创建标点
        if (autoCreate) {
          await autoCreatePoi(firstResult);
        }

        message.success(`找到 ${results.length} 个结果`);
      } else {
        message.info('未找到相关地点');
      }
    } catch (error) {
      console.error('搜索失败', error);
      message.error('搜索失败，请重试');
    } finally {
      setLoading(false);
    }
  },
  [autoCreate],
);

  // 自动创建POI到本地数据库
  const autoCreatePoi = async (place: GeoPlace) => {
    try {
      const poiData: Partial<POI> = {
        name: place.name,
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        type: 'attraction',
        tags: [],
        note: place.address || '',
      };

      const response = await poiApi.create(poiData);
      const newPoi = response.data;

      // 添加到本地POI列表
      setPois((prev) => [newPoi, ...prev]);

      // 自动选中
      setSelectedPois((prev) => [...prev, newPoi]);

      message.success(`已创建标点: ${place.name}`);
    } catch (error) {
      console.error('自动创建POI失败', error);
    }
  };

  // 点击搜索结果项
  const handleResultClick = (place: GeoPlace) => {
    // 定位地图
    setMapCenter([place.longitude, place.latitude]);
    setMapZoom(16);

    // 自动创建POI
    autoCreatePoi(place);
  };

  // 地图点击
  const handleMapClick = (lng: number, lat: number) => {
    setClickPosition({ lat, lng });
    setModalOpen(true);
  };

  /** 地图飞到指定 POI（与搜索结果点击行为一致） */
  const focusMapOnPoi = useCallback((poi: Pick<POI, 'longitude' | 'latitude'>) => {
    const lng = parseFloat(String(poi.longitude));
    const lat = parseFloat(String(poi.latitude));
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      setMapCenter([lng, lat]);
      setMapZoom(15);
    }
  }, []);

  // POI 点击：多选高亮 + 右侧地图始终定位到该点（本地列表 / 地图标记共用）
  const handlePoiClick = (poi: POI) => {
    focusMapOnPoi(poi);
    setSelectedPois((prev) => {
      if (prev.some((p) => p.id === poi.id)) {
        return prev.filter((p) => p.id !== poi.id);
      }
      return [...prev, poi];
    });
  };

  const handleDeletePoi = async (poi: POI) => {
    try {
      await poiApi.delete(poi.id);
      setPois((prev) => prev.filter((p) => p.id !== poi.id));
      setSelectedPois((prev) => prev.filter((p) => p.id !== poi.id));
      message.success('已删除标点');
    } catch {
      message.error('删除标点失败');
    }
  };

  // 创建成功回调
  const handleCreateSuccess = (poi: POI) => {
    setPois((prev) => [poi, ...prev]);
    setModalOpen(false);
    focusMapOnPoi(poi);
  };

  // 切换自动创建
  const toggleAutoCreate = () => {
    setAutoCreate((prev) => !prev);
  };

  return (
    <div className="flex flex-col h-screen bg-surface-bright text-on-surface">
      <TraceHeader variant="minimal" title="标点与搜索" />
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <div className="w-96 p-4 bg-surface-container-low border-r border-transparent shadow-[1px_0_0_rgba(62,48,38,0.07)] overflow-y-auto transition-colors duration-normal">
        <h1 className="font-headline text-lg font-bold text-primary mb-1">搜索 · 打捞灵感</h1>
        <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
          与 PRD 中「搜索与发现」一致：大圆角搜索、柔和分层列表；选中即高亮，地图会跟随。
        </p>

        {/* 自动创建开关 */}
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="autoCreate"
            checked={autoCreate}
            onChange={toggleAutoCreate}
            className="mr-2 cursor-pointer"
          />
          <label htmlFor="autoCreate" className="text-sm text-on-surface-variant cursor-pointer">
            搜索时自动创建标点
          </label>
        </div>

        <POISearchBar onSearch={handleSearch} />

        {/* 百度搜索结果列表 */}
        {searchResults.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-on-surface-variant mb-2">
              搜索 "{searchQuery}" 找到 {searchResults.length} 个结果：
            </div>
            <List
              size="small"
              dataSource={searchResults}
              renderItem={(place) => (
                <List.Item
                  className="cursor-pointer rounded-xl hover:bg-surface-container-high px-2 py-2 transition-colors duration-200"
                  onClick={() => handleResultClick(place)}
                >
                  <div>
                    <div className="font-medium text-sm text-on-surface">{place.name}</div>
                    <div className="text-xs text-on-surface-variant">
                      {place.city} {place.district} {place.address}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}

        <Button
          type="primary"
          className="mt-4 w-full h-11 font-semibold"
          onClick={() => {
            setClickPosition(undefined);
            setModalOpen(true);
          }}
        >
          手动添加标点
        </Button>

        {/* 本地POI列表 */}
        <div className="mt-4">
          <div className="text-sm text-on-surface-variant mb-2">
            本地标点 ({pois.length})
          </div>
          <List
            loading={loading}
            dataSource={pois}
            renderItem={(poi) => (
              <List.Item
                className={`cursor-pointer rounded-xl transition-colors duration-200 ${
                  selectedPois.some((p) => p.id === poi.id)
                    ? 'bg-secondary-container/60'
                    : 'hover:bg-surface-container-high'
                }`}
                onClick={() => handlePoiClick(poi)}
                extra={
                  <Popconfirm
                    title="删除该标点？"
                    description="将从本地库删除；若已加入某条行程路线，也会从该路线中移除此点。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void handleDeletePoi(poi)}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`删除标点「${poi.name}」`}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                }
              >
                <Card size="small" className="w-full bg-surface rounded-2xl border-0 editorial-shadow">
                  <div className="font-medium text-on-surface">{poi.name}</div>
                  <div className="text-xs text-on-surface-variant">
                    {poi.type} | {poi.latitude}, {poi.longitude}
                  </div>
                  {poi.tags && poi.tags.length > 0 && (
                    <div className="mt-1">
                      {poi.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-block px-2 py-0.5 mr-1 text-xs bg-primary-container/40 text-on-primary-container rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </List.Item>
            )}
            locale={{ emptyText: '暂无本地标点' }}
          />
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 h-full">
        <MapView
          pois={pois}
          selectedPois={selectedPois}
          onMapClick={handleMapClick}
          onPoiClick={handlePoiClick}
          center={mapCenter}
          zoom={mapZoom}
        />
      </div>

      {/* Create Modal */}
      <CreatePOIModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onSuccess={handleCreateSuccess}
        initialPosition={clickPosition}
      />
      </div>
    </div>
  );
};

export default POIList;
