const STORAGE_KEY_PREFIX = "device.trips.state";

export interface PersistedTripState {
  deviceId: string;
  cursor?: string;
  hasMore: boolean;
  trips: unknown[];
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveTripsState(state: PersistedTripState) {
  const storage = getStorage();
  if (!storage) return;

  const key = `${STORAGE_KEY_PREFIX}:${state.deviceId}`;
  const payload = JSON.stringify(state);
  storage.setItem(key, payload);
}

export function loadTripsState(deviceId: string): PersistedTripState | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = `${STORAGE_KEY_PREFIX}:${deviceId}`;
  const payload = storage.getItem(key);

  if (!payload) return null;

  try {
    const state = JSON.parse(payload) as PersistedTripState;
    if (state.deviceId !== deviceId) return null;
    return state;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearTripsState(deviceId: string) {
  const storage = getStorage();
  if (!storage) return;

  const key = `${STORAGE_KEY_PREFIX}:${deviceId}`;
  storage.removeItem(key);
}
