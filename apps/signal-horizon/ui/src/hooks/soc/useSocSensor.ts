import { useEffect, useState } from 'react';

const STORAGE_KEY = 'signal-horizon:soc-sensor';

export function useSocSensor(defaultId: string = 'synapse-waf-1') {
  const [sensorId, setSensorId] = useState(() => {
    if (typeof window === 'undefined') return defaultId;
    return window.localStorage.getItem(STORAGE_KEY) || defaultId;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, sensorId);
  }, [sensorId]);

  return { sensorId, setSensorId };
}
