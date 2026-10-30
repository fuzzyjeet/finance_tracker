// App-wide signal that transactions (or anything derived from them) changed,
// so pages that cache lists can reload without sharing state.
const DATA_CHANGED = 'finance:data-changed';

export const emitDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED));

export const onDataChanged = (cb: () => void) => {
  window.addEventListener(DATA_CHANGED, cb);
  return () => window.removeEventListener(DATA_CHANGED, cb);
};

// Tapping the tab of the page you're already on: that page goes back to its start
const TAB_RESELECTED = 'finance:tab-reselected';

export const emitTabReselected = (path: string) =>
  window.dispatchEvent(new CustomEvent(TAB_RESELECTED, { detail: path }));

export const onTabReselected = (path: string, cb: () => void) => {
  const handler = (e: Event) => { if ((e as CustomEvent<string>).detail === path) cb(); };
  window.addEventListener(TAB_RESELECTED, handler);
  return () => window.removeEventListener(TAB_RESELECTED, handler);
};
