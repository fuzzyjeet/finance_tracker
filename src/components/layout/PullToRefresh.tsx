import React, { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

const TRIGGER = 72;       // how far the indicator must travel to refresh
const RESIST = 0.4;       // the indicator moves at this share of the finger
const SETTLED_MS = 400;   // the list must have rested at the top this long before a pull counts

/** Reloads the app, picking up a new version first if one was deployed. */
async function forceRefresh() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch { /* offline: just reload from the cache */ }
  window.location.reload();
}

/**
 * Pull down from the top of a page to refresh the whole app. To avoid accidental
 * refreshes it only starts when the page was already resting at the top (not when a
 * fling scrolls up into it), needs a deliberate, mostly vertical pull, and fires on
 * release past the mark.
 */
export const PullToRefresh: React.FC<{ scroller: React.RefObject<HTMLElement> }> = ({ scroller }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let atTopSince: number | null = el.scrollTop <= 0 ? performance.now() : null;
    let start: { x: number; y: number } | null = null;
    let engaged = false;

    const setPullBoth = (v: number) => { pullRef.current = v; setPull(v); };
    const onScroll = () => {
      if (el.scrollTop <= 0) { if (atTopSince === null) atTopSince = performance.now(); }
      else atTopSince = null;
    };
    const onStart = (e: TouchEvent) => {
      engaged = false;
      start = null;
      const modalOpen = document.body.style.overflow === 'hidden';
      const settled = atTopSince !== null && performance.now() - atTopSince > SETTLED_MS;
      if (e.touches.length !== 1 || el.scrollTop > 0 || !settled || modalOpen) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const dx = e.touches[0].clientX - start.x;
      const dy = e.touches[0].clientY - start.y;
      if (!engaged) {
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { start = null; return; } // scrolling down or sideways
        if (dy < 12) return;
        engaged = true;
      }
      e.preventDefault(); // hold the page still while pulling
      setPullBoth(Math.min(TRIGGER * 1.5, Math.max(0, dy - 12) * RESIST));
    };
    const onEnd = () => {
      if (engaged && pullRef.current >= TRIGGER) {
        setRefreshing(true);
        setPullBoth(TRIGGER);
        forceRefresh();
      } else {
        setPullBoth(0);
      }
      start = null;
      engaged = false;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [scroller]);

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= TRIGGER;
  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top) + ${pull - 40}px)`, transition: pull === 0 ? 'top 0.2s' : undefined }}
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-2 h-10 pl-3 pr-4 rounded-full shadow-lg text-sm font-semibold"
        style={{ background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)', color: ready ? 'var(--accent)' : 'var(--text-2)' }}
      >
        <RotateCw
          size={16}
          className={refreshing ? 'animate-spin' : undefined}
          style={{ transform: refreshing ? undefined : `rotate(${(pull / TRIGGER) * 270}deg)` }}
        />
        {refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
      </div>
    </div>
  );
};
