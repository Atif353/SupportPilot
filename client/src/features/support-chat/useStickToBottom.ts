import { useCallback, useEffect, useRef, useState } from "react";

const nearBottom = (element: HTMLElement): boolean =>
  element.scrollHeight - element.scrollTop - element.clientHeight < 120;

/**
 * Keeps a scrolling message log pinned to its newest content. A new message always scrolls
 * into view; content that grows afterwards (expanded sources, images) keeps the view pinned
 * unless the reader has scrolled up, in which case `pinned` is false and a jump control can show.
 */
export function useStickToBottom(trigger: unknown, resetKey: unknown) {
  const logRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);

  const scrollToEnd = useCallback((behavior: ScrollBehavior = "smooth") => {
    const log = logRef.current;
    if (!log) return;
    pinnedRef.current = true;
    setPinned(true);
    requestAnimationFrame(() => log.scrollTo?.({ top: log.scrollHeight, behavior }));
  }, []);

  const onScroll = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    const next = nearBottom(log);
    pinnedRef.current = next;
    setPinned(next);
  }, []);

  useEffect(() => {
    scrollToEnd("auto");
  }, [resetKey, scrollToEnd]);

  useEffect(() => {
    scrollToEnd("smooth");
  }, [trigger, scrollToEnd]);

  useEffect(() => {
    const content = contentRef.current;
    const log = logRef.current;
    if (!content || !log || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) log.scrollTo?.({ top: log.scrollHeight });
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return { logRef, contentRef, pinned, onScroll, scrollToEnd };
}
