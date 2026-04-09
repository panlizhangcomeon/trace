import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export interface POI {
  id: string;
  latitude: string;
  longitude: string;
  name: string;
  type: 'attraction' | 'food' | 'accommodation' | 'checkin' | 'supply';
  icon?: string;
  note?: string;
  tags: string[];
  created_at: string;
}

export interface Route {
  id: string;
  trip?: string;
  name: string;
  color: string;
  day_number: number;
  order_index: number;
  pois: RoutePOI[];
  created_at: string;
}

export interface RoutePOI {
  id: string;
  poi: POI;
  order_index: number;
  stop_note?: string | null;
  segment_note?: string | null;
  created_at?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date?: string | null;
  routes: Route[];
  created_at: string;
}

/** 智能行程 LLM 草案（与后端 ItineraryDraftV1 对齐） */
export interface ItineraryDraftV1 {
  schema_version: '1';
  trip_summary: {
    title_hint: string;
    destination_summary: string;
  };
  origin: { label: string };
  segments?: Array<{
    city_label: string;
    country_hint?: string;
    days: number;
  }>;
  days: Array<{
    day_index: number;
    city_context: string;
    stops: Array<{
      display_name: string;
      search_query?: string;
      duration_minutes?: number;
      notes?: string;
      travel_hint?: string;
    }>;
  }>;
}

export interface CommitWarning {
  day_index: number;
  stop_display_name: string;
  code: string;
}

function smartCommitTimeoutMs(draft: ItineraryDraftV1): number {
  const n = draft.days.reduce((acc, d) => acc + d.stops.length, 0);
  return Math.min(180_000, 15_000 + n * 12_000);
}

/** 兼容后端直接返回数组或 `{ results: Trip[] }` */
export function unwrapTripList(data: unknown): Trip[] {
  if (Array.isArray(data)) return data as Trip[];
  if (
    data &&
    typeof data === 'object' &&
    'results' in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: Trip[] }).results;
  }
  return [];
}

export interface TrafficOption {
  id: string;
  mode: string;
  duration_minutes: number;
  cost?: number;
  operating_hours?: string;
  couple_friendly_tags: string[];
}

// POI API
export const poiApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: POI[] }>('/pois/', { params }),

  // Search real-world places: domestic=Baidu, international=Nominatim
  search: (params: {
    search: string;
    region?: string;
    limit?: number;
    geo_scope?: 'domestic' | 'international';
    country?: string;
  }) =>
    apiClient.get<{
      count: number;
      results: GeoPlace[];
      provider: 'baidu' | 'nominatim' | null;
      cached: boolean;
    }>('/pois/search/', { params }),

  // Search local database POIs (for admin/filtering)
  searchLocal: (params?: Record<string, string>) =>
    apiClient.get<{ count: number; results: POI[] }>('/pois/', { params }),

  create: (data: Partial<POI>) =>
    apiClient.post<POI>('/pois/', data),

  update: (id: string, data: Partial<POI>) =>
    apiClient.put<POI>(`/pois/${id}/`, data),

  delete: (id: string) =>
    apiClient.delete(`/pois/${id}/`),
};

export interface GeoPlace {
  uid: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  province: string;
  city: string;
  district: string;
  type: string;
  type_code: string;
  telephone?: string;
  detail_url?: string;
}

// Route API
export const routeApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Route[]>('/routes/', { params }),

  get: (id: string) =>
    apiClient.get<Route>(`/routes/${id}/`),

  create: (data: Partial<Route>) =>
    apiClient.post<Route>('/routes/', data),

  update: (id: string, data: Partial<Route>) =>
    apiClient.put<Route>(`/routes/${id}/`, data),

  delete: (id: string) =>
    apiClient.delete(`/routes/${id}/`),

  connect: (id: string, poiIds: string[], order?: number[]) =>
    apiClient.post<{ route_id: string; pois: RoutePOI[]; message: string }>(
      `/routes/${id}/connect/`,
      { poi_ids: poiIds, order: order || [] }
    ),
};

/** 更新路线上的站点备注 / 路段备注 */
export const routePoiApi = {
  patchNotes: (id: string, data: { stop_note?: string | null; segment_note?: string | null }) =>
    apiClient.patch<RoutePOI>(`/routes/route-pois/${id}/`, data),
};

// Trip API
export const tripApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<Trip[]>('/trips/', { params }),

  get: (id: string) =>
    apiClient.get<Trip>(`/trips/${id}/`),

  create: (data: Partial<Trip>) =>
    apiClient.post<Trip>('/trips/', data),

  update: (id: string, data: Partial<Trip>) =>
    apiClient.put<Trip>(`/trips/${id}/`, data),

  delete: (id: string) =>
    apiClient.delete(`/trips/${id}/`),
};

/** 智能创建行程（两阶段 API，不经 Refine） */
export const smartTripApi = {
  draft: (body: { user_text: string; locale?: string }) =>
    apiClient.post<{ draft: ItineraryDraftV1 }>('/trips/ai-draft/', body, { timeout: 90_000 }),

  commit: (body: {
    draft: ItineraryDraftV1;
    trip: { name?: string | null; destination?: string | null; start_date?: string | null };
  }) =>
    apiClient.post<{ trip: Trip; warnings?: CommitWarning[] }>('/trips/ai-commit/', body, {
      timeout: smartCommitTimeoutMs(body.draft),
    }),
};

// Traffic API
export const trafficApi = {
  getOptions: (fromPoiId: string, toPoiId: string, coupleFriendly?: boolean) =>
    apiClient.get<{ from_poi_id: string; to_poi_id: string; options: TrafficOption[] }>(
      '/traffic/options/',
      {
        params: {
          from_poi_id: fromPoiId,
          to_poi_id: toPoiId,
          couple_friendly: coupleFriendly,
        },
      }
    ),

  getRouteTraffic: (routeId: string) =>
    apiClient.post<{ route_id: string; segments: TrafficSegment[] }>(
      '/traffic/route-traffic/',
      { route_id: routeId }
    ),
};

export interface TrafficSegment {
  from_poi_id: string;
  to_poi_id: string;
  options: TrafficOption[];
}

export default apiClient;
