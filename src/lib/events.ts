// App-wide signal that transactions (or anything derived from them) changed,
// so pages that cache lists can reload without sharing state.
const DATA_CHANGED = 'finance:data-changed';

export const emitDataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED));

export const onDataChanged = (cb: () => void) => {
  window.addEventListener(DATA_CHANGED, cb);
  return () => window.removeEventListener(DATA_CHANGED, cb);
};
