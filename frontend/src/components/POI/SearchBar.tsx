import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AutoComplete, Input, Select, Space } from 'antd';

interface POISearchBarProps {
  onSearch: (params: {
    search?: string;
    type?: string;
    tags?: string;
  }) => void;
  /** 用于联想下拉的候选项（通常为当前接口返回的地点列表） */
  suggestionPlaces?: Array<{
    /** 作为选项唯一 value，避免同名地点导致 Ant Design 内部 key 冲突 */
    key: string;
    /** 选中后填入搜索框并作为关键词请求 */
    searchKeyword: string;
    sub?: string;
  }>;
}

const POI_TYPES = [
  { value: '', label: '全部类型' },
  { value: 'attraction', label: '景点' },
  { value: 'food', label: '美食' },
  { value: 'accommodation', label: '住宿' },
  { value: 'checkin', label: '打卡' },
  { value: 'supply', label: '补给' },
];

const POI_TAGS = [
  { value: 'local_secret', label: '本地私藏' },
  { value: 'non_commercial', label: '非商业化' },
  { value: 'couple_friendly', label: '情侣友好' },
  { value: 'hiking', label: '徒步' },
  { value: 'scenic_view', label: '风景' },
];

const DEBOUNCE_MS = 320;

const POISearchBar: React.FC<POISearchBarProps> = ({ onSearch, suggestionPlaces = [] }) => {
  const [searchText, setSearchText] = useState('');
  const [poiType, setPoiType] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const suggestionOptions = useMemo(
    () =>
      suggestionPlaces.map((p) => ({
        value: p.key,
        searchKeyword: p.searchKeyword,
        label: (
          <div className="py-0.5">
            <div className="text-sm text-text-primary">{p.searchKeyword}</div>
            {p.sub ? <div className="text-xs text-text-muted">{p.sub}</div> : null}
          </div>
        ),
      })),
    [suggestionPlaces]
  );

  const submitParams = () => ({
    search: searchText.trim() || undefined,
    type: poiType || undefined,
    tags: tags.length > 0 ? tags.join(',') : undefined,
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      onSearchRef.current({
        search: searchText.trim() || undefined,
        type: poiType || undefined,
        tags: tags.length > 0 ? tags.join(',') : undefined,
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchText, poiType, tags]);

  return (
    <Space direction="vertical" className="w-full">
      <AutoComplete
        className="w-full"
        value={searchText}
        filterOption={false}
        options={suggestionOptions}
        onSelect={(value: string, option) => {
          const opt = option as { searchKeyword?: string } | undefined;
          const keyword = (opt?.searchKeyword ?? value).trim() || value;
          setSearchText(keyword);
          window.setTimeout(() => {
            onSearchRef.current({
              search: keyword || undefined,
              type: poiType || undefined,
              tags: tags.length > 0 ? tags.join(',') : undefined,
            });
          }, 0);
        }}
        onChange={(val) => setSearchText(val)}
      >
        <Input.Search
          placeholder="搜索景点..."
          onSearch={() => onSearchRef.current(submitParams())}
          enterButton
        />
      </AutoComplete>
      <Space className="poi-search-filters w-full" wrap size="middle">
        <Select
          placeholder="类型"
          value={poiType}
          onChange={setPoiType}
          options={POI_TYPES}
          className="poi-search-filter-select w-[8.5rem] min-w-[8.5rem] max-w-full cursor-pointer"
          variant="borderless"
          popupMatchSelectWidth={false}
        />
        <Select
          mode="multiple"
          placeholder="标签筛选"
          value={tags}
          onChange={setTags}
          options={POI_TAGS}
          className="poi-search-filter-select poi-search-filter-select--tags flex-1 min-w-[12rem] max-w-full cursor-pointer"
          maxTagCount={2}
          variant="borderless"
          popupMatchSelectWidth={260}
        />
      </Space>
    </Space>
  );
};

export default POISearchBar;
