import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { theme } from './styles/theme';

import POIList from './pages/POIList';
import RouteCreate from './pages/RouteCreate';
import TripDetail from './pages/TripDetail';
import TripList from './pages/TripList';
import SmartTripCreate from './pages/SmartTripCreate';

const App: React.FC = () => {
  return (
    <ConfigProvider theme={theme}>
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<TripList />} />
            <Route path="/pois" element={<POIList />} />
            <Route path="/routes/create" element={<RouteCreate />} />
            <Route path="/trips" element={<TripList />} />
            <Route path="/trips/smart-create" element={<SmartTripCreate />} />
            <Route path="/trips/:id" element={<TripDetail />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
