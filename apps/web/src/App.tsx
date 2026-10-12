import { useEffect, useState } from 'react';
import type { ApiResponse, HealthStatus } from '@platinum/shared';

export function App() {
  const [health, setHealth] = useState<string>('consultando…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<ApiResponse<HealthStatus>>)
      .then((r) => setHealth(r.data?.status ?? 'error'))
      .catch(() => setHealth('sin conexión'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Platinum Intranet</h1>
      <p>API: {health}</p>
    </main>
  );
}
