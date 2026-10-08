import { useEffect, useState, useRef, useCallback } from 'react';
import { listCaseMessages, sendCaseMessage, getErrorMessage } from '../services/caseService';

export function useCaseChat(caseReference, accessToken, conversationType = 'client') {
  const typeSlug = conversationType?.toLowerCase().includes('team') ? 'team' : 'client';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const maxReconnectAttempts = 5;

  const appendMessage = useCallback((newMsg) => {
    if (!newMsg || !newMsg.id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) {
        return prev;
      }
      return [...prev, newMsg];
    });
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!caseReference || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listCaseMessages(accessToken, caseReference, typeSlug);
      const list = Array.isArray(data) ? data : data.results || [];
      setMessages(list);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load case conversation history.'));
    } finally {
      setLoading(false);
    }
  }, [caseReference, accessToken, typeSlug]);

  useEffect(() => {
    setMessages([]);
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!caseReference || !accessToken) return;

    isMountedRef.current = true;

    function buildWebSocketUrl() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const explicitWsBase = import.meta.env.VITE_WS_BASE_URL;
      const base = explicitWsBase || `${protocol}//${host}`;
      return `${base}/ws/cases/${caseReference}/chat/${typeSlug}/?token=${encodeURIComponent(accessToken)}`;
    }

    function connectWebSocket() {
      if (!isMountedRef.current) return;

      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setConnectionStatus(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

      try {
        const wsUrl = buildWebSocketUrl();
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          setError(null);
        };

        ws.onmessage = (event) => {
          if (!isMountedRef.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              setError(data.error);
            } else if (data.id) {
              appendMessage(data);
            }
          } catch (e) {
            console.error('Failed to parse incoming WebSocket message', e);
          }
        };

        ws.onerror = () => {
          if (!isMountedRef.current) return;
        };

        ws.onclose = (event) => {
          if (!isMountedRef.current) return;
          wsRef.current = null;
          setConnectionStatus('disconnected');

          if (event.code === 4001 || event.code === 4003) {
            setError(
              event.code === 4003
                ? `Access forbidden: You are not authorized for ${typeSlug === 'client' ? 'Client' : 'Team'} chat.`
                : 'Authentication required for case chat.'
            );
            return;
          }

          if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            reconnectAttemptsRef.current += 1;
            setConnectionStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
          }
        };
      } catch (err) {
        setConnectionStatus('disconnected');
      }
    }

    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted or channel changed');
        wsRef.current = null;
      }
    };
  }, [caseReference, accessToken, typeSlug, appendMessage]);

  const sendMessage = useCallback(
    async (content, file = null) => {
      const trimmed = (content || '').trim();
      if (!trimmed && !file) return;

      if (!file && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ content: trimmed }));
      } else {
        const newMsg = await sendCaseMessage(accessToken, caseReference, trimmed, typeSlug, file);
        appendMessage(newMsg);
      }
    },
    [accessToken, caseReference, typeSlug, appendMessage]
  );

  return {
    messages,
    loading,
    error,
    connectionStatus,
    conversationType: typeSlug,
    sendMessage,
    refetchHistory: fetchHistory,
  };
}
