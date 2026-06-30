import { Suspense, lazy } from 'react';

const App = lazy(() => import('./App.jsx'));

function AppFallback() {
  return (
    <div className="loading-screen">
      <div className="loading-screen__content">
        <h1 className="loading-title">Wild Trails</h1>
        <p className="loading-subtitle">Loading Terrain</p>
        <div className="loading-bar-container">
          <div className="loading-bar-fill" style={{ width: '12%' }} />
        </div>
      </div>
    </div>
  );
}

export default function Root() {
  return (
    <Suspense fallback={<AppFallback />}>
      <App />
    </Suspense>
  );
}
