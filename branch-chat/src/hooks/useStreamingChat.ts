"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type StreamingState = 'idle' | 'streaming' | 'error';

interface StreamingChatRequest {
  conversationId: string;
  parentNodeId: string | null;
  content: string;
  provider: string;
  model: string;
}

interface DoneEventData {
  userNode: any;
  assistantNode: any;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export function useStreamingChat() {
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingState, setStreamingState] = useState<StreamingState>('idle');
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStreamingState('idle');
    setStreamingContent('');
    contentRef.current = '';
  }, []);

  const sendStreamingMessage = useCallback(async (
    request: StreamingChatRequest
  ): Promise<DoneEventData | null> => {
    // Reset state
    setStreamingState('streaming');
    setStreamingContent('');
    setStreamingError(null);
    contentRef.current = '';

    // Create abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Pre-stream JSON errors
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setStreamingState('error');
        setStreamingError(data.error ?? 'Request failed');
        return null;
      }

      if (!res.body) {
        setStreamingState('error');
        setStreamingError('No response body');
        return null;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneData: DoneEventData | null = null;
      let needsFlush = false;

      const flushContent = () => {
        setStreamingContent(contentRef.current);
        needsFlush = false;
        flushTimerRef.current = null;
      };

      const scheduleFlush = () => {
        if (!needsFlush) {
          needsFlush = true;
          flushTimerRef.current = setTimeout(flushContent, 50);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? ''; // Keep incomplete part in buffer

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          const lines = trimmed.split('\n');
          let event = '';
          let data = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              event = line.slice(7);
            } else if (line.startsWith('data: ')) {
              data = line.slice(6);
            }
          }

          if (!event || !data) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (event === 'token') {
            contentRef.current += parsed.content;
            scheduleFlush();
          } else if (event === 'done') {
            // Final flush
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            setStreamingContent(parsed.assistantNode?.content ?? contentRef.current);
            doneData = parsed;
            setStreamingState('idle');
          } else if (event === 'error') {
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            setStreamingState('error');
            setStreamingError(parsed.message ?? 'Stream error');
            return null;
          }
        }
      }

      return doneData;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Silent cleanup on user abort
        setStreamingState('idle');
        return null;
      }
      setStreamingState('error');
      setStreamingError(err?.message ?? 'Network error');
      return null;
    } finally {
      contentRef.current = '';
      abortControllerRef.current = null;
    }
  }, []);

  return {
    sendStreamingMessage,
    streamingContent,
    streamingState,
    streamingError,
    abortStream,
  };
}
