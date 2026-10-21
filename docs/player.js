const DEFAULT_VOLUME = 0.75;
const DEFAULT_TIMEOUT_MS = 18000;
const DEFAULT_STATION_ID = 'nagyvarad';

function clampVolume(value, fallback = DEFAULT_VOLUME) {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, num));
}

function formatPlayError(err) {
  if (err && typeof err === 'object' && err.name === 'NotAllowedError') {
    return 'A böngésző blokkolta a lejátszást. Kattints a lejátszás gombra az indításhoz.';
  }
  return 'A lejátszás nem indítható el. Kérjük, próbáld újra.';
}

export function createRadioPlayer({
  audio,
  stations,
  initialStation = DEFAULT_STATION_ID,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onChange = () => {},
} = {}) {
  if (!audio || typeof audio !== 'object') {
    throw new TypeError('Érvényes HTMLAudioElement példány szükséges.');
  }
  if (!stations || typeof stations !== 'object' || Object.keys(stations).length === 0) {
    throw new TypeError('Érvényes állomásobjektum szükséges.');
  }

  const hasStation = (id) =>
    typeof id === 'string' &&
    id.length > 0 &&
    Object.prototype.hasOwnProperty.call(stations, id) &&
    Boolean(
      stations[id] &&
        typeof stations[id].url === 'string' &&
        stations[id].url.trim().length > 0
    );

  const resolvedInitialStation = hasStation(initialStation)
    ? initialStation
    : Object.keys(stations).find((key) => hasStation(key)) || Object.keys(stations)[0];

  audio.preload = 'none';
  audio.volume = DEFAULT_VOLUME;
  audio.muted = Boolean(audio.muted);

  const readAudioVolume = (fallback = DEFAULT_VOLUME) =>
    clampVolume(audio.volume, fallback);
  const readAudioMuted = () => Boolean(audio.muted);

  const state = {
    status: 'idle',
    stationId: resolvedInitialStation,
    volume: readAudioVolume(DEFAULT_VOLUME),
    muted: readAudioMuted(),
    error: '',
  };

  let generation = 0;
  let activeToken = 0;
  let timeoutId = null;
  let isInternalTeardown = false;
  let destroyed = false;

  function getState() {
    return {
      status: state.status,
      stationId: state.stationId,
      volume: state.volume,
      muted: state.muted,
      error: state.error,
    };
  }

  function updateState(patch = {}) {
    const nextStatus = patch.status !== undefined ? patch.status : state.status;
    const nextStationId =
      patch.stationId !== undefined ? patch.stationId : state.stationId;
    const nextVolume =
      patch.volume !== undefined ? patch.volume : readAudioVolume(state.volume);
    const nextMuted =
      patch.muted !== undefined ? patch.muted : readAudioMuted();
    const nextError = patch.error !== undefined ? patch.error : state.error;

    const changed =
      state.status !== nextStatus ||
      state.stationId !== nextStationId ||
      state.volume !== nextVolume ||
      state.muted !== nextMuted ||
      state.error !== nextError;

    state.status = nextStatus;
    state.stationId = nextStationId;
    state.volume = nextVolume;
    state.muted = nextMuted;
    state.error = nextError;

    if (changed && typeof onChange === 'function') {
      onChange(getState());
    }
  }

  function clearLoadingTimeout() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function resetAudioNetwork() {
    isInternalTeardown = true;
    try {
      if (typeof audio.pause === 'function') {
        audio.pause();
      }
      if (typeof audio.removeAttribute === 'function') {
        audio.removeAttribute('src');
      }
      if (audio.src !== '' && audio.src !== undefined) {
        try {
          audio.src = '';
        } catch {
          // Ignore read-only src property on custom mocks
        }
      }
      if (typeof audio.load === 'function') {
        audio.load();
      }
    } finally {
      isInternalTeardown = false;
    }
  }

  function failWithError(token, message) {
    if (destroyed || token !== activeToken) {
      return;
    }
    clearLoadingTimeout();
    generation += 1;
    activeToken = 0;
    resetAudioNetwork();
    updateState({
      status: 'error',
      error: message || 'Hiba történt az élő adás lejátszása közben.',
    });
  }

  function startLoadingTimeout(token) {
    clearLoadingTimeout();
    if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (destroyed || token !== activeToken) {
          return;
        }
        failWithError(
          token,
          'Időtúllépés: az élő adás nem válaszol. Kérjük, próbáld újra.'
        );
      }, timeoutMs);
    }
  }

  async function startStream(targetStationId = state.stationId) {
    if (destroyed) {
      return getState();
    }

    if (!hasStation(targetStationId)) {
      clearLoadingTimeout();
      generation += 1;
      activeToken = 0;
      resetAudioNetwork();
      updateState({
        status: 'error',
        error: 'A kiválasztott állomás stream címe nem érhető el.',
      });
      return getState();
    }

    const station = stations[targetStationId];
    clearLoadingTimeout();
    const token = ++generation;
    activeToken = token;

    isInternalTeardown = true;
    try {
      if (typeof audio.pause === 'function') {
        audio.pause();
      }
      audio.src = station.url;
      if (typeof audio.load === 'function') {
        audio.load();
      }
    } finally {
      isInternalTeardown = false;
    }

    updateState({
      stationId: targetStationId,
      status: 'loading',
      error: '',
    });

    startLoadingTimeout(token);

    let playPromise;
    try {
      playPromise = audio.play();
    } catch (err) {
      if (!destroyed && token === activeToken) {
        failWithError(token, formatPlayError(err));
      }
      return getState();
    }

    if (playPromise && typeof playPromise.then === 'function') {
      try {
        await playPromise;
      } catch (err) {
        if (!destroyed && token === activeToken) {
          failWithError(token, formatPlayError(err));
        }
        return getState();
      }
    }

    return getState();
  }

  function play() {
    return startStream(state.stationId);
  }

  function stop() {
    if (destroyed) {
      return getState();
    }
    clearLoadingTimeout();
    generation += 1;
    activeToken = 0;
    resetAudioNetwork();
    updateState({
      status: 'idle',
      error: '',
    });
    return getState();
  }

  async function toggle() {
    if (destroyed) {
      return getState();
    }
    if (state.status === 'playing' || state.status === 'loading') {
      return stop();
    }
    return play();
  }

  function setStation(id) {
    if (destroyed || !hasStation(id)) {
      return false;
    }

    if (id === state.stationId) {
      return true;
    }

    const wasActive = state.status === 'playing' || state.status === 'loading';
    if (wasActive) {
      void startStream(id);
      return true;
    }

    updateState({
      stationId: id,
      status: 'idle',
      error: '',
    });
    return true;
  }

  function setVolume(value) {
    if (destroyed) {
      return state.volume;
    }
    const num =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : NaN;
    if (!Number.isFinite(num)) {
      return state.volume;
    }
    const clamped = Math.min(1, Math.max(0, num));
    audio.volume = clamped;
    updateState({
      volume: readAudioVolume(clamped),
      muted: readAudioMuted(),
    });
    return state.volume;
  }

  function setMuted(value) {
    if (destroyed) {
      return state.muted;
    }
    audio.muted = Boolean(value);
    updateState({
      volume: readAudioVolume(state.volume),
      muted: readAudioMuted(),
    });
    return state.muted;
  }

  function onPlaying() {
    if (destroyed || isInternalTeardown || activeToken === 0) {
      return;
    }
    clearLoadingTimeout();
    updateState({
      status: 'playing',
      error: '',
    });
  }

  function onBuffering() {
    if (destroyed || isInternalTeardown || activeToken === 0) {
      return;
    }
    startLoadingTimeout(activeToken);
    updateState({
      status: 'loading',
      error: '',
    });
  }

  function onPause() {
    // A pause esemény feladatsorba kerülhet: közben már az új adó játszik.
    if (destroyed || isInternalTeardown || activeToken === 0 || audio.paused === false) {
      return;
    }
    clearLoadingTimeout();
    generation += 1;
    activeToken = 0;
    resetAudioNetwork();
    updateState({
      status: 'idle',
      error: '',
    });
  }

  function onError() {
    if (destroyed || isInternalTeardown || activeToken === 0) {
      return;
    }
    failWithError(
      activeToken,
      'Hálózati hiba: az élő adás jelenleg nem érhető el.'
    );
  }

  function onVolumeChange() {
    if (destroyed) {
      return;
    }
    updateState({
      volume: readAudioVolume(state.volume),
      muted: readAudioMuted(),
    });
  }

  function onEnded() {
    if (destroyed || isInternalTeardown || activeToken === 0) return;
    failWithError(activeToken, 'Az élő adás megszakadt. Próbálj újra kapcsolódni.');
  }

  const listeners = [
    ['playing', onPlaying],
    ['waiting', onBuffering],
    ['stalled', onBuffering],
    ['pause', onPause],
    ['error', onError],
    ['ended', onEnded],
    ['volumechange', onVolumeChange],
  ];

  for (const [eventName, handler] of listeners) {
    audio.addEventListener(eventName, handler);
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    clearLoadingTimeout();
    generation += 1;
    activeToken = 0;
    for (const [eventName, handler] of listeners) {
      audio.removeEventListener(eventName, handler);
    }
    resetAudioNetwork();
    state.status = 'idle';
    state.error = '';
  }

  return {
    play,
    stop,
    toggle,
    setStation,
    setVolume,
    setMuted,
    getState,
    destroy,
  };
}
