import { createRadioPlayer } from './player.js';
import { STATIONS, getSchedule, getCurrentShow, formatTime } from './schedule.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const audio = $('#radio');
const labels = new Map($$('[data-play-label]').map(el => [el, el.textContent]));
let currentStation = 'nagyvarad';
let selectedDay = 0;

function renderPlayer(state) {
  const active = state.status === 'playing';
  const loading = state.status === 'loading';
  document.body.dataset.state = state.status;
  $$('[data-play]').forEach(button => {
    button.setAttribute('aria-label', active ? 'Élő adás leállítása' : loading ? 'Kapcsolódás megszakítása' : 'Élő adás indítása');
    button.setAttribute('aria-pressed', String(active || loading));
    button.setAttribute('aria-busy', String(loading));
    button.querySelector('.icon use')?.setAttribute('href', active || loading ? '#i-pause' : '#i-play');
    const label = button.querySelector('[data-play-label]');
    if (label) label.textContent = active ? 'Adás leállítása' : loading ? 'Kapcsolódás…' : labels.get(label);
  });
  const statusText = { idle: 'Kapcsolódj a jó zenékhez!', loading: 'Kapcsolódás az élő adáshoz…', playing: 'Most élőben hallgatod', error: 'Az adás most nem érhető el' }[state.status];
  if ($('#playback-status').textContent !== statusText) $('#playback-status').textContent = statusText;
  $('#player-error').hidden = state.status !== 'error';
  $('#player-error-text').textContent = state.error || '';
  const station = STATIONS[state.stationId];
  currentStation = state.stationId;
  $('#station').value = state.stationId;
  $$('[data-station-name]').forEach(el => { el.textContent = `${station.name}${el.classList.contains('dock-station') ? ` · ${station.frequency} FM` : ''}`; });
  $('#official-schedule').href = station.schedule;
  $('#volume').value = Math.round(state.volume * 100);
  $('#volume').setAttribute('aria-valuetext', `${Math.round(state.volume * 100)} százalék`);
  $('#volume').style.background = `linear-gradient(to right, var(--orange) ${state.volume * 100}%, #4b3830 ${state.volume * 100}%)`;
  $('#volume-value').textContent = `${Math.round(state.volume * 100)}%`;
  $('#mute').setAttribute('aria-pressed', String(state.muted));
  $('#mute').setAttribute('aria-label', state.muted ? 'Hang bekapcsolása' : 'Némítás');
  $('#mute use').setAttribute('href', state.muted || state.volume === 0 ? '#i-muted' : '#i-volume');
}

const player = createRadioPlayer({ audio, stations: STATIONS, initialStation: currentStation, onChange: renderPlayer });
renderPlayer(player.getState());
try {
  const volume = localStorage.getItem('plusz-fm-volume');
  if (volume !== null && Number.isFinite(Number(volume))) player.setVolume(Number(volume));
} catch { /* Privát böngészésben is használható marad. */ }

$$('[data-play]').forEach(button => button.addEventListener('click', () => player.toggle()));
$('#retry').addEventListener('click', () => player.play());
$('#station').addEventListener('change', e => player.setStation(e.target.value));
$('#mute').addEventListener('click', () => player.setMuted(!player.getState().muted));
$('#volume').addEventListener('input', e => {
  player.setVolume(Number(e.target.value) / 100);
  if (player.getState().muted) player.setMuted(false);
  try { localStorage.setItem('plusz-fm-volume', String(player.getState().volume)); } catch { /* Nincs kötelező tárolás. */ }
});

$$('[data-wave]').forEach((wave, n) => {
  const count = Number(wave.dataset.wave);
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('i');
    const envelope = .2 + .8 * Math.sin(Math.PI * (i + 1) / (count + 1));
    bar.style.setProperty('--height', `${Math.round((15 + Math.abs(Math.sin(i * 2.38 + n * 1.7)) * 85) * envelope)}%`);
    bar.style.setProperty('--speed', `${.6 + (i % 7) * .13}s`);
    bar.style.setProperty('--delay', `${-(i % 11) * .17}s`);
    fragment.append(bar);
  }
  wave.append(fragment);
});

function renderSchedule() {
  const { date, programs, minutes } = getSchedule(selectedDay);
  $('#schedule-date').textContent = new Intl.DateTimeFormat('hu-HU', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(date);
  const fragment = document.createDocumentFragment();
  programs.forEach(program => {
    const row = document.createElement('article');
    row.className = 'schedule-row';
    const isCurrent = minutes >= program.start && minutes < program.end;
    if (isCurrent) row.classList.add('is-current');
    // Csak a saját, rögzített műsoradatok kerülnek ide.
    row.innerHTML = `<div><time>${formatTime(program.start)} – ${formatTime(program.end)}</time>${isCurrent ? '<span class="row-live"><span class="live-dot"></span> MOST A MŰSORRENDBEN</span>' : ''}</div><div><h3>${program.title}</h3><p>${program.host}</p></div><a class="round-arrow" href="${program.href}" target="_blank" rel="noopener noreferrer" aria-label="${program.title} a rádió oldalán"><svg class="icon"><use href="#i-up-right"/></svg></a>`;
    fragment.append(row);
  });
  $('#schedule-list').replaceChildren(fragment);
  const show = getCurrentShow();
  $$('[data-current-show]').forEach(el => { el.textContent = show.title; });
  $$('[data-current-description]').forEach(el => { el.textContent = show.host; });
}
$$('[data-day]').forEach(button => button.addEventListener('click', () => {
  selectedDay = button.dataset.day === 'tomorrow' ? 1 : 0;
  $$('[data-day]').forEach(other => {
    const selected = other === button;
    other.classList.toggle('selected', selected);
    other.setAttribute('aria-pressed', String(selected));
  });
  renderSchedule();
}));
renderSchedule();
setInterval(renderSchedule, 30_000);
$('#year').textContent = new Date().getFullYear();

const menuToggle = $('#menu-toggle');
function closeMenu() {
  $('#mobile-menu').hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Menü megnyitása');
  menuToggle.querySelector('use').setAttribute('href', '#i-menu');
}
menuToggle.addEventListener('click', () => {
  const open = $('#mobile-menu').hidden;
  $('#mobile-menu').hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
  menuToggle.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
});
$$('#mobile-menu a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#mobile-menu').hidden) { closeMenu(); menuToggle.focus(); } });
matchMedia('(min-width: 651px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Plusz FM — Élő adás', artist: 'Több zene. Több élet.' });
  navigator.mediaSession.setActionHandler('play', () => player.play());
  navigator.mediaSession.setActionHandler('pause', () => player.stop());
  navigator.mediaSession.setActionHandler('stop', () => player.stop());
}
