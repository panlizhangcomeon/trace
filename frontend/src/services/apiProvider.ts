import { Refine } from '@refinedev/core';
import { RefineThemes, dataProvider, authProvider } from '@refinedev/antd';
import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesHandler,
} from '@refinedev/react-router-v6';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { App as AntdApp } from 'antd';
import { ConfigProvider } from 'antd';
import { theme } from './styles/theme';

import POIList from './pages/POIList';
import RouteCreate from './pages/RouteCreate';
import TripDetail from './pages/TripDetail';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ConfigProvider theme={theme}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider(API_URL)}
            routerProvider={routerProvider}
            resources={[
              {
                name: 'pois',
                list: '/pois',
                create: '/pois/create',
                edit: '/pois/edit/:id',
                show: '/pois/show/:id',
              },
              {
                name: 'routes',
                list: '/routes',
                create: '/routes/create',
                edit: '/routes/edit/:id',
                show: '/routes/show/:id',
              },
              {
                name: 'trips',
                list: '/trips',
                create: '/trips/create',
                edit: '/trips/edit/:id',
                show: '/trips/show/:id',
              },
            ]}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
            }}
          >
            <Routes>
              <Route path="/" element={<div>Welcome to Travel Route Planner</div>} />
              <Route path="/pois" element={<POIList />} />
              <Route path="/routes/create" element={<RouteCreate />} />
              <Route path="/trips/:id" element={<TripDetail />} />
            </Routes>
            <DocumentTitleHandler />
            <UnsavedChangesHandler />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
};

export default App;
