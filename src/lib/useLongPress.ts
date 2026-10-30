import React, { useRef } from 'react';

/**
 * Tap and long-press on the same element. Returns a function that gives the
 * handlers for one item, so a list can share a single hook. Moving the finger
 * (scrolling) cancels the press.
 */
export function useLongPress<T>(onLongPress: (item: T) => void, onTap: (item: T) => void, ms = 450) {
  const timer = useRef<number>();
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };

  return (item: T) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLongPress(item);
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick: () => {
      if (fired.current) { fired.current = false; return; }
      onTap(item);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
}
