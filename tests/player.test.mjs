import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadioPlayer } from '../player.js';

const STATIONS = {
  nagyvarad: {
    name: 'Plusz FM Nagyvárad',
    frequency: '89.6 MHz',
    url: 'https://stream.example.test/nagyvarad.mp3',
  },
  margitta: {
    name: 'Plusz FM Margitta',
    frequency: '105.5 MHz',
    url: 'https://stream.example.test/margitta.mp3',
  },
};

class FakeAudio extends EventTarget {
  constructor() {
    super();
    this.preload = 'auto';
    this.volume = 1;
    this.muted = false;
    this.src = '';
    this.calls = [];
    this.playImpl = () => Promise.resolve();
    this.listenerCount = 0;
    this._listeners = new Map();
  }

  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(listener);
    this.listenerCount = this._countListeners();
  }

  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    const set = this._listeners.get(type);
    if (set) {
      set.delete(listener);
    }
    this.listenerCount = this._countListeners();
  }

  _countListeners() {
    let total = 0;
    for (const set of this._listeners.values()) {
      total += set.size;
    }
    return total;
  }

  play() {
    this.calls.push({ method: 'play', src: this.src });
    return this.playImpl(this.src);
  }

  pause() {
    this.calls.push({ method: 'pause', src: this.src });
  }

  load() {
    this.calls.push({ method: 'load', src: this.src });
  }

  removeAttribute(attr) {
    this.calls.push({ method: 'removeAttribute', attr });
    if (attr === 'src') {
      this.src = '';
    }
  }
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('konstrukció: nincs automatikus lejátszás vagy hálózat, alapértékek helyesek, getState másolatot ad', () => {
  const audio = new FakeAudio();
  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    initialStation: 'nagyvarad',
    onChange: (s) => states.push(s),
  });

  assert.equal(audio.preload, 'none');
  assert.equal(audio.volume, 0.75);
  assert.equal(audio.muted, false);
  assert.equal(audio.src, '');
  assert.deepEqual(audio.calls, []);
  assert.equal(states.length, 0);

  const initial = player.getState();
  assert.deepEqual(initial, {
    status: 'idle',
    stationId: 'nagyvarad',
    volume: 0.75,
    muted: false,
    error: '',
  });

  initial.status = 'playing';
  initial.volume = 0.1;
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getState().volume, 0.75);

  player.destroy();
});

test('lejátszás: audio.play() feloldása önmagában még loading, csak valós playing esemény után lesz playing', async () => {
  const audio = new FakeAudio();
  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    onChange: (s) => states.push(s),
  });

  const playPromise = player.play();
  assert.equal(player.getState().status, 'loading');
  assert.equal(audio.src, STATIONS.nagyvarad.url);

  await playPromise;
  // Még nem érkezett meg a HTMLAudioElement 'playing' eseménye
  assert.equal(player.getState().status, 'loading');
  assert.deepEqual(
    states.map((s) => s.status),
    ['loading']
  );

  audio.dispatchEvent(new Event('playing'));
  assert.equal(player.getState().status, 'playing');
  assert.equal(player.getState().error, '');
  assert.deepEqual(
    states.map((s) => s.status),
    ['loading', 'playing']
  );

  // waiting és stalled visszaállítja loading-ra, majd playing újra playing-re
  audio.dispatchEvent(new Event('waiting'));
  assert.equal(player.getState().status, 'loading');

  audio.dispatchEvent(new Event('playing'));
  assert.equal(player.getState().status, 'playing');

  audio.dispatchEvent(new Event('stalled'));
  assert.equal(player.getState().status, 'loading');

  audio.dispatchEvent(new Event('playing'));
  assert.equal(player.getState().status, 'playing');

  // Külső pause esemény -> idle
  audio.dispatchEvent(new Event('pause'));
  assert.equal(player.getState().status, 'idle');

  player.destroy();
});

test('szinkron és aszinkron play hiba, valamint audio error esemény: soha nem rejectel, magyar hibaüzenet és hálózatbontás', async () => {
  const audio = new FakeAudio();
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
  });

  // 1. Szinkron dobott hiba
  audio.playImpl = () => {
    throw new Error('Sync failure');
  };
  await assert.doesNotReject(() => player.play());
  assert.equal(player.getState().status, 'error');
  assert.match(player.getState().error, /lejátszás|próbáld/i);
  assert.equal(audio.src, '');

  // 2. Promise elutasítás (NotAllowedError)
  audio.playImpl = () => {
    const err = new Error('Autoplay blocked');
    err.name = 'NotAllowedError';
    return Promise.reject(err);
  };
  await assert.doesNotReject(() => player.toggle());
  assert.equal(player.getState().status, 'error');
  assert.match(player.getState().error, /böngésző|lejátszás/i);
  assert.equal(audio.src, '');

  // 3. Hálózati error esemény lejátszás közben
  audio.playImpl = () => Promise.resolve();
  await player.play();
  audio.dispatchEvent(new Event('playing'));
  assert.equal(player.getState().status, 'playing');

  audio.dispatchEvent(new Event('error'));
  assert.equal(player.getState().status, 'error');
  assert.match(player.getState().error, /Hálózati hiba|nem érhető el/i);
  assert.equal(audio.src, '');

  player.destroy();
});

test('timeout: ha nem érkezik playing esemény időben, hálózatot bont és magyar hibaállapotra vált', async () => {
  const audio = new FakeAudio();
  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    timeoutMs: 35,
    onChange: (s) => states.push(s),
  });

  await player.play();
  assert.equal(player.getState().status, 'loading');

  await new Promise((r) => setTimeout(r, 70));

  const finalState = player.getState();
  assert.equal(finalState.status, 'error');
  assert.match(finalState.error, /Időtúllépés/i);
  assert.equal(audio.src, '');
  assert.ok(
    audio.calls.some((c) => c.method === 'removeAttribute' && c.attr === 'src')
  );
  assert.deepEqual(
    states.map((s) => s.status),
    ['loading', 'error']
  );

  player.destroy();
});

test('stop() azonnal megszakítja a betöltést, és a függőben lévő play() elutasítása nem írja felül az idle állapotot', async () => {
  const audio = new FakeAudio();
  const deferred = createDeferred();
  audio.playImpl = () => deferred.promise;

  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    onChange: (s) => states.push(s),
  });

  const playCall = player.play();
  assert.equal(player.getState().status, 'loading');

  player.stop();
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getState().error, '');
  assert.equal(audio.src, '');

  // A megszakított play() a böngészőben AbortError-ral utasítódik el
  const abortErr = new Error('The play() request was interrupted');
  abortErr.name = 'AbortError';
  deferred.reject(abortErr);

  await assert.doesNotReject(() => playCall);
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getState().error, '');
  assert.deepEqual(
    states.map((s) => s.status),
    ['loading', 'idle']
  );

  // Újraindításnál újra src + load hívódik az élő ponthoz csatlakozáshoz
  audio.calls = [];
  audio.playImpl = () => Promise.resolve();
  await player.play();
  assert.equal(audio.src, STATIONS.nagyvarad.url);
  assert.deepEqual(
    audio.calls.map((c) => c.method),
    ['pause', 'load', 'play']
  );

  player.destroy();
});

test('gyors állomásváltás és későn érkező régi promise: token védelem és ismeretlen állomás elutasítása', async () => {
  const audio = new FakeAudio();
  const deferredNagyvarad = createDeferred();
  const deferredMargitta = createDeferred();

  audio.playImpl = (src) => {
    if (src === STATIONS.nagyvarad.url) {
      return deferredNagyvarad.promise;
    }
    return deferredMargitta.promise;
  };

  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    initialStation: 'nagyvarad',
    onChange: (s) => states.push(s),
  });

  // Idle állapotban az állomásváltás nem indítja el a lejátszást
  assert.equal(player.setStation('ismeretlen'), false);
  assert.equal(player.getState().stationId, 'nagyvarad');
  assert.equal(player.setStation('margitta'), true);
  assert.equal(player.getState().stationId, 'margitta');
  assert.equal(player.getState().status, 'idle');
  assert.equal(audio.calls.length, 0);

  // Vissza Nagyváradra, majd indítás
  player.setStation('nagyvarad');
  const firstPlay = player.play();
  assert.equal(player.getState().stationId, 'nagyvarad');
  assert.equal(player.getState().status, 'loading');

  // Betöltés közben gyors váltás Margittára
  assert.equal(player.setStation('margitta'), true);
  assert.equal(player.getState().stationId, 'margitta');
  assert.equal(player.getState().status, 'loading');
  assert.equal(audio.src, STATIONS.margitta.url);

  // Ismeretlen állomás aktív betöltés közben sem rontja el az állapotot
  assert.equal(player.setStation('nem_letezo'), false);
  assert.equal(player.getState().stationId, 'margitta');

  // A korábbi (Nagyvárad) promise késve hibával tér vissza -> nem írhatja felül Margittát!
  deferredNagyvarad.reject(new Error('Old stream failed'));
  await firstPlay;

  assert.equal(player.getState().stationId, 'margitta');
  assert.equal(player.getState().status, 'loading');
  assert.equal(player.getState().error, '');

  // Margitta sikeresen elindul
  deferredMargitta.resolve();
  audio.dispatchEvent(new Event('playing'));

  assert.equal(player.getState().stationId, 'margitta');
  assert.equal(player.getState().status, 'playing');
  assert.equal(player.getState().error, '');

  player.destroy();
});

test('hangerő és mute kezelés: 0..1 clamp, nem-véges értékek szűrése és valós audio állapot követése', () => {
  const audio = new FakeAudio();
  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    onChange: (s) => states.push(s),
  });

  player.setVolume(1.5);
  assert.equal(audio.volume, 1);
  assert.equal(player.getState().volume, 1);

  player.setVolume(-0.4);
  assert.equal(audio.volume, 0);
  assert.equal(player.getState().volume, 0);

  player.setVolume(0.42);
  assert.equal(audio.volume, 0.42);
  assert.equal(player.getState().volume, 0.42);

  // Nem finite értékek figyelmen kívül hagyása
  player.setVolume(Number.NaN);
  player.setVolume(Number.POSITIVE_INFINITY);
  player.setVolume(Number.NEGATIVE_INFINITY);
  assert.equal(player.getState().volume, 0.42);

  player.setMuted(true);
  assert.equal(audio.muted, true);
  assert.equal(player.getState().muted, true);

  player.setMuted(0);
  assert.equal(audio.muted, false);
  assert.equal(player.getState().muted, false);

  // Külső volumechange esemény szinkronizálása
  audio.volume = 0.6;
  audio.muted = true;
  audio.dispatchEvent(new Event('volumechange'));
  assert.equal(player.getState().volume, 0.6);
  assert.equal(player.getState().muted, true);

  player.destroy();
});

test('hibaállapotból újrapróbálkozás (retry) és destroy() teljes takarítása', async () => {
  const audio = new FakeAudio();
  let shouldFail = true;
  audio.playImpl = () =>
    shouldFail ? Promise.reject(new Error('Network down')) : Promise.resolve();

  const states = [];
  const player = createRadioPlayer({
    audio,
    stations: STATIONS,
    timeoutMs: 40,
    onChange: (s) => states.push(s),
  });

  assert.ok(audio.listenerCount > 0);

  // Első próba: hiba
  await player.play();
  assert.equal(player.getState().status, 'error');
  assert.ok(player.getState().error.length > 0);

  // Második próba (retry): sikeres betöltés és lejátszás
  shouldFail = false;
  await player.play();
  assert.equal(player.getState().status, 'loading');
  assert.equal(player.getState().error, '');

  audio.dispatchEvent(new Event('playing'));
  assert.equal(player.getState().status, 'playing');

  // Újabb betöltés indítása, majd azonnali destroy timeout előtt
  audio.playImpl = () => new Promise(() => {});
  void player.play();
  assert.equal(player.getState().status, 'loading');

  player.destroy();
  assert.equal(audio.listenerCount, 0);
  assert.equal(audio.src, '');
  assert.equal(player.getState().status, 'idle');

  const countBeforeWait = states.length;
  await new Promise((r) => setTimeout(r, 70));
  audio.dispatchEvent(new Event('playing'));
  audio.dispatchEvent(new Event('error'));

  assert.equal(states.length, countBeforeWait);
  assert.equal(player.getState().status, 'idle');
});
