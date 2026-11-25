/**
 * Realtime client. One WebSocket keeps the whole app in sync with the
 * authoritative live model on the server: hazards, peers, SOS, journeys,
 * crossing signals and journey sharing.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

const RealtimeContext = createContext(null);
const MAX_EVENTS = 50;

function wsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function RealtimeProvider({ children }) {
  const [status, setStatus] = useState('connecting');
  const [you, setYou] = useState(null);
  const [peers, setPeers] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [sos, setSos] = useState(null);
  const [signals, setSignals] = useState([]);
  const [journey, setJourney] = useState(null);
  const [events, setEvents] = useState([]);
  const [lastAt, setLastAt] = useState(null);

  const wsRef = useRef(null);
  const queueRef = useRef([]);
  const retryRef = useRef(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const pushEvent = useCallback((event) => {
    setEvents((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), ...event },
      ...prev,
    ].slice(0, MAX_EVENTS));
  }, []);

  const upsertHazard = useCallback((hazard) => {
    if (!hazard?.id) return;
    setHazards((prev) => {
      const idx = prev.findIndex((h) => h.id === hazard.id);
      if (idx === -1) return [hazard, ...prev].slice(0, 120);
      const next = [...prev];
      next[idx] = hazard;
      return next;
    });
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    clearTimeout(timerRef.current);
    let socket;
    try {
      socket = new WebSocket(wsUrl());
    } catch {
      setStatus('offline');
      timerRef.current = setTimeout(connect, 2000);
      return;
    }
    wsRef.current = socket;
    setStatus((s) => (s === 'live' ? s : 'connecting'));

    socket.onopen = () => {
      retryRef.current = 0;
      setStatus('live');
      const name = localStorage.getItem('visionpath:name') || 'Guest navigator';
      socket.send(JSON.stringify({ type: 'hello', name }));
      while (queueRef.current.length) socket.send(JSON.stringify(queueRef.current.shift()));
    };

    socket.onmessage = (evt) => {
      let msg;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      setLastAt(Date.now());
      switch (msg.type) {
        case 'welcome':
          setYou(msg.you);
          setPeers(msg.peers || []);
          setHazards(msg.hazards || []);
          setSos(msg.sos || null);
          setSignals(msg.signals || []);
          break;
        case 'peers':
          setPeers(msg.peers || []);
          break;
        case 'hazard:new':
          upsertHazard(msg.hazard);
          if (msg.reason) {
            pushEvent({
              kind: 'hazard',
              severity: msg.hazard?.severity || 'medium',
              title: msg.hazard?.label || 'New hazard',
              detail: msg.reason,
            });
          }
          break;
        case 'hazard:update':
          upsertHazard(msg.hazard);
          if (msg.reason) {
            pushEvent({
              kind: 'update',
              severity: msg.hazard?.severity || 'low',
              title: msg.hazard?.label || 'Hazard updated',
              detail: msg.reason,
            });
          }
          break;
        case 'hazard:created':
          upsertHazard(msg.hazard);
          break;
        case 'sos':
          setSos(msg.sos);
          break;
        case 'sos:end':
          setSos(null);
          pushEvent({ kind: 'sos-end', severity: 'low', title: 'SOS resolved', detail: `${msg.sos?.by || 'Navigator'} confirmed they are safe.` });
          break;
        case 'signal':
          setSignals(msg.signals || []);
          break;
        case 'journey':
          setJourney(msg.journey);
          break;
        case 'journey:missing':
          pushEvent({ kind: 'system', severity: 'medium', title: 'Share code not found', detail: 'Check the code with the traveller.' });
          break;
        case 'route:selected':
          pushEvent({ kind: 'route', severity: 'low', title: 'Shared route update', detail: `${msg.by} switched to ${msg.route?.name || 'another route'}.` });
          break;
        case 'heartbeat':
          break;
        default:
          break;
      }
    };

    socket.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('offline');
      retryRef.current = Math.min(retryRef.current + 1, 6);
      timerRef.current = setTimeout(connect, Math.min(800 * 2 ** retryRef.current, 6000));
    };
    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        /* noop */
      }
    };
  }, [pushEvent, upsertHazard]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      const socket = wsRef.current;
      if (!socket) return;
      // Closing a socket mid-handshake logs a browser warning, so wait for it.
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener('open', () => socket.close());
      } else {
        socket.close();
      }
    };
  }, [connect]);

  const send = useCallback((msg) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    else queueRef.current.push(msg);
  }, []);

  const reportHazard = useCallback((hazard) => {
    send({ type: 'hazard:report', hazard });
  }, [send]);

  const vote = useCallback((id, kind) => send({ type: 'hazard:vote', id, kind }), [send]);

  const setName = useCallback((name) => {
    const clean = String(name || '').trim().slice(0, 40) || 'Guest navigator';
    localStorage.setItem('visionpath:name', clean);
    send({ type: 'hello', name: clean });
    setYou((prev) => (prev ? { ...prev, name: clean } : prev));
  }, [send]);

  const value = useMemo(() => ({
    status,
    live: status === 'live',
    you,
    peers,
    hazards,
    sos,
    signals,
    journey,
    events,
    lastAt,
    send,
    reportHazard,
    vote,
    setName,
    pushEvent,
    clearEvents: () => setEvents([]),
  }), [status, you, peers, hazards, sos, signals, journey, events, lastAt, send, reportHazard, vote, setName, pushEvent]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}

/** Geolocation with graceful fallback to the Bengaluru demo centre. */
export const FALLBACK_POSITION = { lat: 12.9719, lng: 77.5946 };

export function useLivePosition(enabled = true) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState('');
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined;
    let id;
    try {
      id = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          setWatching(true);
          setError('');
        },
        (err) => {
          setError(err.message || 'Location unavailable');
          setWatching(false);
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 },
      );
    } catch {
      setError('Location unavailable');
    }
    return () => {
      if (id) navigator.geolocation.clearWatch(id);
    };
  }, [enabled]);

  return { position, error, watching, current: position || FALLBACK_POSITION, isFallback: !position };
}
