// OpenRouter: cohere/north-mini-code:free; a vezető ellenőrizte és javította
// a promise-kezelést és a cleanupot a kért, soha nem rejectelő API szerint.
import { createRadioPlayer } from '../player.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const stations = {
  nagyvarad: { name: 'A', frequency: '89.6', url: 'https://radio.example/a' },
  margitta: { name: 'B', frequency: '105.5', url: 'https://radio.example/b' },
};
class FakeAudio extends EventTarget {
  constructor() {
    super();
    Object.assign(this, { src: '', volume: 1, muted: false, paused: true, readyState: 0, error: null, preload: 'none', pending: [] });
  }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() {}
  pause() {
    if (!this.paused) {
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    }
  }
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
  }
  emitPlaying() { this.paused = false; this.readyState = 3; this.dispatchEvent(new Event('playing')); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(t, options = {}) {
  const audio = new FakeAudio();
  const player = createRadioPlayer({ audio, stations, ...options });
  t.after(() => player.destroy());
  return { audio, player };
}

test('OR: stop közbeni késői elutasítás nem írja felül az idle állapotot', async t => {
  const { audio, player } = setup(t);
  const pending = player.play();
  player.stop();
  audio.pending[0].reject(new Error('late failure'));
  await assert.doesNotReject(() => pending);
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getState().error, '');
  assert.equal(audio.src, '');
});
test('OR: régi A hiba nem szakítja meg a már elindult B állomást', async t => {
  const { audio, player } = setup(t);
  const oldPlay = player.play();
  player.setStation('margitta');
  audio.pending[1].resolve();
  audio.emitPlaying();
  audio.pending[0].reject(new Error('stale failure'));
  await assert.doesNotReject(() => oldPlay);
  await flush();
  assert.equal(player.getState().status, 'playing');
  assert.equal(player.getState().stationId, 'margitta');
  assert.equal(audio.src, stations.margitta.url);
});
test('OR: gyors A/B/A váltás helyes URL-en marad régi promise feloldás után', async t => {
  const { audio, player } = setup(t);
  const first = player.play();
  player.setStation('margitta');
  player.setStation('nagyvarad');
  audio.pending[2].resolve();
  audio.emitPlaying();
  audio.pending[0].resolve();
  audio.pending[1].reject(new Error('old B'));
  await first;
  await flush();
  assert.equal(audio.src, stations.nagyvarad.url);
  assert.equal(player.getState().stationId, 'nagyvarad');
  assert.equal(player.getState().status, 'playing');
});
test('OR: kapcsolódási timeout után sikeresen újrapróbálható', async t => {
  const { audio, player } = setup(t, { timeoutMs: 30 });
  const first = player.play();
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(player.getState().status, 'error');
  assert.ok(player.getState().error.length);
  assert.equal(audio.src, '');
  const retry = player.play();
  audio.pending[1].resolve();
  audio.emitPlaying();
  await retry;
  audio.pending[0].reject(new Error('timed-out request settles later'));
  await first;
  assert.equal(player.getState().status, 'playing');
});
test('OR: állapotmásolat módosítása nem változtat állomást vagy hangerőt', t => {
  const { player } = setup(t);
  Object.assign(player.getState(), { status: 'playing', stationId: 'margitta', volume: 0 });
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getState().stationId, 'nagyvarad');
  assert.equal(player.getState().volume, .75);
});
test('OR: álló adóváltás nem kér streamet és nem indít hangot', t => {
  const { audio, player } = setup(t);
  player.setStation('margitta');
  assert.equal(player.getState().stationId, 'margitta');
  assert.equal(player.getState().status, 'idle');
  assert.equal(audio.src, '');
  assert.equal(audio.pending.length, 0);
});
test('OR: destroy után késői hiba és audio esemény sem éleszti újra a lejátszót', async t => {
  const { audio, player } = setup(t);
  const pending = player.play();
  player.destroy();
  audio.pending[0].reject(new Error('settled after destroy'));
  audio.emitPlaying();
  await pending;
  assert.equal(player.getState().status, 'idle');
  assert.equal(player.getState().error, '');
  assert.equal(audio.src, '');
});

test('a stream váratlan vége nem hagy néma playing állapotot', async t => {
  const { audio, player } = setup(t);
  const started = player.play();
  audio.pending[0].resolve();
  audio.emitPlaying();
  await started;
  audio.dispatchEvent(new Event('ended'));
  assert.equal(player.getState().status, 'error');
  assert.ok(player.getState().error);
  assert.equal(audio.src, '');
});

test('korábbi adó késleltetett pause eseménye nem állítja meg az új adót', async t => {
  const { audio, player } = setup(t);
  const started = player.play();
  audio.pending[0].resolve();
  audio.emitPlaying();
  await started;
  audio.pause = () => {
    if (!audio.paused) {
      audio.paused = true;
      queueMicrotask(() => audio.dispatchEvent(new Event('pause')));
    }
  };
  player.setStation('margitta');
  audio.pending[1].resolve();
  audio.emitPlaying();
  await flush();
  assert.equal(player.getState().status, 'playing');
  assert.equal(audio.src, stations.margitta.url);
});
