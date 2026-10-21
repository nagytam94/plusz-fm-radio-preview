// Függőség nélküli Chrome DevTools Protocol ellenőrzés; meglévő Chrome-ot használ.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

const url = process.argv[2] || 'http://127.0.0.1:56856/index.html';
const chromePath = process.env.PLUSZ_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = await mkdtemp(join(tmpdir(), 'plusz-fm-chrome-'));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore'] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let passed = 0;
const pending = new Map();
const handlers = new Map();
let nextId = 0;
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
function on(method, fn) { handlers.set(method, fn); }
async function evaluate(expression, userGesture = false) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expression)) return;
    await sleep(150);
  }
  throw new Error(`Időtúllépés: ${expression}; állapot: ${await evaluate('document.body.dataset.state')}`);
}
function ok(label) { passed++; console.log(`PASS ${label}`); }
async function screenshot(name, full = true) {
  const metrics = await send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize;
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } } : {}) });
  await writeFile(new URL(`../.artifacts/${name}.png`, import.meta.url), Buffer.from(result.data, 'base64'));
}

try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  if (!port) throw new Error('A Chrome nem indult el.');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(JSON.stringify(message.error)));
      else request?.resolve(message.result);
    } else handlers.get(message.method)?.(message.params);
  });
  const errors = [];
  on('Runtime.exceptionThrown', ({ exceptionDetails }) => errors.push(exceptionDetails.text + ' ' + exceptionDetails.exception?.description));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  let streamRequests = 0;
  on('Network.requestWillBeSent', ({ request }) => { if (request.url.includes('stream2.radiotransilvania.ro')) streamRequests++; });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await waitFor("document.body.dataset.state === 'idle' && document.querySelectorAll('.schedule-row').length > 0");
  await evaluate('document.fonts.ready.then(() => true)');
  await evaluate("[...document.images].forEach(img => { img.loading = 'eager'; })");
  await waitFor('[...document.images].every(img => img.complete)');
  assert.equal(streamRequests, 0);
  assert.equal(await evaluate("document.querySelector('#radio').hasAttribute('src')"), false);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.deepEqual(await evaluate('[...document.images].filter(img=>!img.naturalWidth).map(img=>img.src)'), []);
  ok('asztali nézet, képek, nincs autoplay vagy előzetes streamkérés');
  await mkdir(new URL('../.artifacts/', import.meta.url), { recursive: true });
  await screenshot('desktop');
  const today = await evaluate("document.querySelector('#schedule-date').textContent");
  await evaluate("document.querySelector('[data-day=tomorrow]').click()");
  assert.notEqual(await evaluate("document.querySelector('#schedule-date').textContent"), today);
  assert.equal(await evaluate("document.querySelector('[data-day=tomorrow]').getAttribute('aria-pressed')"), 'true');
  await evaluate("document.querySelector('[data-day=today]').click()");
  ok('ma/holnap műsorrend váltás');
  for (const width of [320, 390, 768]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(100);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `túlcsordulás: ${width}`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('#menu-toggle').click()");
  assert.equal(await evaluate("document.querySelector('#mobile-menu').hidden"), false);
  await evaluate("document.querySelector('#mobile-menu a[href=\"#musorok\"]').click()");
  assert.equal(await evaluate("document.querySelector('#mobile-menu').hidden"), true);
  await evaluate("document.querySelector('#menu-toggle').click()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate("document.querySelector('#mobile-menu').hidden"), true);
  await evaluate("scrollTo({top:0,behavior:'instant'}); document.activeElement.blur()");
  await sleep(300);
  await screenshot('mobile');
  ok('320/390/768 px mobilnézet, menü, Escape');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('.hero-play').click()", true);
  await waitFor("document.body.dataset.state === 'playing' && !document.querySelector('#radio').paused && document.querySelector('#radio').currentTime > 0");
  assert.equal(await evaluate("[...document.querySelectorAll('[data-play]')].every(b=>b.getAttribute('aria-pressed')==='true')"), true);
  ok('valódi Nagyvárad MP3 lejátszás, összes indítógomb szinkronban');
  await evaluate("const s=document.querySelector('#station');s.value='margitta';s.dispatchEvent(new Event('change'))", true);
  await waitFor("document.body.dataset.state === 'playing' && document.querySelector('#radio').currentSrc.endsWith('/Margitta') && document.querySelector('#radio').currentTime > 0");
  ok('valódi Margitta MP3, adóváltás lejátszás közben');
  await evaluate("document.querySelector('#mute').click()");
  assert.equal(await evaluate("document.querySelector('#radio').muted"), true);
  await evaluate("const v=document.querySelector('#volume');v.value='35';v.dispatchEvent(new Event('input'))");
  assert.equal(await evaluate("document.querySelector('#radio').volume"), .35);
  assert.equal(await evaluate("document.querySelector('#radio').muted"), false);
  await evaluate("document.querySelector('.dock-play').click()");
  await waitFor("document.body.dataset.state === 'idle'");
  assert.equal(await evaluate("document.querySelector('#radio').hasAttribute('src')"), false);
  ok('hangerő, némítás, másik gombbal leállítás, streamkapcsolat bontása');

  on('Fetch.requestPaused', ({ requestId }) => { void send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }); });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*stream2.radiotransilvania.ro*' }] });
  await evaluate("document.querySelector('.hero-play').click()", true);
  await waitFor("document.body.dataset.state === 'error'");
  assert.equal(await evaluate("document.querySelector('#player-error').hidden"), false);
  assert.ok(await evaluate("document.querySelector('#player-error-text').textContent.length > 0"));
  assert.equal(await evaluate("document.querySelector('#radio').hasAttribute('src')"), false);
  await send('Fetch.disable');
  await evaluate("document.querySelector('#retry').click()", true);
  await waitFor("document.body.dataset.state === 'playing' && !document.querySelector('#radio').paused");
  assert.equal(await evaluate("document.querySelector('#player-error').hidden"), true);
  await evaluate("document.querySelector('.dock-play').click()");
  ok('hálózati hiba látható visszajelzéssel és sikeres újrapróbálás');
  assert.deepEqual(errors, [], 'böngészős JavaScript hibák');
  ok('nincs futásidejű JavaScript hiba');
  console.log(`BÖNGÉSZŐ: ${passed}/${passed} ellenőrzés sikeres; .artifacts/desktop.png és mobile.png`);
} finally {
  socket?.close();
  const exited = once(chrome, 'exit');
  chrome.kill('SIGTERM');
  await Promise.race([exited, sleep(3000)]);
  if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await Promise.race([exited, sleep(1500)]); }
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
