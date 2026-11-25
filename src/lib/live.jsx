import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { planPath } from './guidance';

/**
 * Shared live-scan state. The scan page writes detections + guidance here so the
 * floating panel can keep guiding the user on every page.
 */
const LiveScanContext = createContext(null);

export function LiveScanProvider({ children }) {
  const [scene, setScene] = useState({
    active: false,
    mode: 'idle', // idle | camera | simulation
    camera: 'off', // off | starting | on | denied
    obstacles: [],
    plan: null,
    spokenAt: 0,
    detectionsTotal: 0,
    lastFrameAt: 0,
  });

  const update = useCallback((patch) => {
    setScene((prev) => ({ ...prev, ...patch }));
  }, []);

  const pushFrame = useCallback((obstacles, previousOffset = 0) => {
    setScene((prev) => {
      const plan = planPath(obstacles, prev.plan?.offset ?? 0, { previousLaneOffset: previousOffset });
      return {
        ...prev,
        obstacles,
        plan,
        lastFrameAt: Date.now(),
        detectionsTotal: prev.detectionsTotal + Math.max(0, obstacles.length - prev.obstacles.length),
      };
    });
  }, []);

  const value = useMemo(() => ({ scene, update, pushFrame }), [scene, update, pushFrame]);
  return <LiveScanContext.Provider value={value}>{children}</LiveScanContext.Provider>;
}

export function useLiveScan() {
  const ctx = useContext(LiveScanContext);
  if (!ctx) throw new Error('useLiveScan must be used inside LiveScanProvider');
  return ctx;
}

/** Small helper for interval-driven loops that should stay stable. */
export function useStableCallback(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}
