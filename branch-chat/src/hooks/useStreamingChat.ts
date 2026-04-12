"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type StreamingState = 'idle' | 'streaming' | 'error';

interface StreamingChatRequest {
  conversationId: string;
  parentNodeId: string | null;
  content: string;
  provider: string;
  model: string;
  attachments?: { filename: string; mimeType: string; data: string; size: number }[];
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
}

interface DoneEventData {
  userNode: any;
  assistantNode: any;
  tokenUsage: { inputTokens: number; outputTokens: number };
  generatedTitle?: string;
}

export type StreamingResult =
  | { type: 'done'; data: DoneEventData }
  | { type: 'error'; message: string }
  | { type: 'aborted' };

export function useStreamingChat() {
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinkingContent, setStreamingThinkingContent] = useState('');
  const [streamingState, setStreamingState] = useState<StreamingState>('idle');
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef('');
  const thinkingContentRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkingFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (thinkingFlushTimerRef.current) {
        clearTimeout(thinkingFlushTimerRef.current);
      }
    };
  }, []);

  const abortStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStreamingState('idle');
    setStreamingContent('');
    setStreamingThinkingContent('');
    contentRef.current = '';
    thinkingContentRef.current = '';
  }, []);

  const sendStreamingMessage = useCallback(async (
    request: StreamingChatRequest
  ): Promise<StreamingResult> => {
    // Reset state
    setStreamingState('streaming');
    setStreamingContent('');
    setStreamingThinkingContent('');
    setStreamingError(null);
    contentRef.current = '';
    thinkingContentRef.current = '';

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
        const errorMsg = data.error ?? 'Request failed';
        setStreamingState('error');
        setStreamingError(errorMsg);
        return { type: 'error', message: errorMsg };
      }

      if (!res.body) {
        setStreamingState('error');
        setStreamingError('No response body');
        return { type: 'error', message: 'No response body' };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneData: DoneEventData | null = null;
      let needsFlush = false;
      let needsThinkingFlush = false;

      const flushContent = () => {
        setStreamingContent(contentRef.current);
        needsFlush = false;
        flushTimerRef.current = null;
      };

      const flushThinkingContent = () => {
        setStreamingThinkingContent(thinkingContentRef.current);
        needsThinkingFlush = false;
        thinkingFlushTimerRef.current = null;
      };

      const scheduleFlush = () => {
        if (!needsFlush) {
          needsFlush = true;
          flushTimerRef.current = setTimeout(flushContent, 50);
        }
      };

      const scheduleThinkingFlush = () => {
        if (!needsThinkingFlush) {
          needsThinkingFlush = true;
          thinkingFlushTimerRef.current = setTimeout(flushThinkingContent, 50);
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
          } else if (event === 'thinking') {
            thinkingContentRef.current += parsed.content;
            scheduleThinkingFlush();
          } else if (event === 'done') {
            // Final flush
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            if (thinkingFlushTimerRef.current) {
              clearTimeout(thinkingFlushTimerRef.current);
              thinkingFlushTimerRef.current = null;
            }
            setStreamingContent(parsed.assistantNode?.content ?? contentRef.current);
            setStreamingThinkingContent(parsed.assistantNode?.thinkingContent ?? thinkingContentRef.current);
            doneData = parsed;
            setStreamingState('idle');
          } else if (event === 'title') {
            // Auto-generated title arrived — attach to done data
            if (doneData) {
              doneData.generatedTitle = parsed.title;
            }
          } else if (event === 'error') {
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            if (thinkingFlushTimerRef.current) {
              clearTimeout(thinkingFlushTimerRef.current);
              thinkingFlushTimerRef.current = null;
            }
            const streamErr = parsed.message ?? 'Stream error';
            setStreamingState('error');
            setStreamingError(streamErr);
            return { type: 'error', message: streamErr };
          }
        }
      }

      return doneData ? { type: 'done' as const, data: doneData } : { type: 'error' as const, message: 'Stream ended without completion' };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Silent cleanup on user abort
        setStreamingState('idle');
        return { type: 'aborted' };
      }
      const networkErr = err?.message ?? 'Network error';
      setStreamingState('error');
      setStreamingError(networkErr);
      return { type: 'error', message: networkErr };
    } finally {
      contentRef.current = '';
      thinkingContentRef.current = '';
      abortControllerRef.current = null;
    }
  }, []);

  return {
    sendStreamingMessage,
    streamingContent,
    streamingThinkingContent,
    streamingState,
    streamingError,
    abortStream,
  };
}
