// Az idősávok forrása: pluszfm.ro/program/2/nagyvarad, 2026-10-21.
// Tájékoztató, ismétlődő műsorrend; nem élő metaadat-szolgáltatás.
export const TIME_ZONE = 'Europe/Bucharest';
export const STATIONS = {
  nagyvarad: { name: 'Nagyvárad', frequency: '89.6', url: 'https://stream2.radiotransilvania.ro/Nagyvarad', schedule: 'https://www.pluszfm.ro/program/2/nagyvarad' },
  margitta: { name: 'Margitta', frequency: '105.5', url: 'https://stream2.radiotransilvania.ro/Margitta', schedule: 'https://www.pluszfm.ro/program/3/margitta' },
};

const WEEKDAYS = [
  { start: 360, end: 660, title: 'Reggeli Plusz', host: 'Hosszú Sándor & Szegedi Mária', href: 'https://www.pluszfm.ro/emisiuni/1/reggeli-plusz-hosszu-sandorral-es-szegedi-mariaval' },
  { start: 720, end: 900, title: 'Délutáni Plusz', host: 'Balogh István Vilmossal', href: 'https://www.pluszfm.ro/emisiuni/27/delutani-plusz-balogh-istvan-vilmossal' },
  { start: 900, end: 1140, title: 'Sláger Plusz', host: 'Keserü Tamással', href: 'https://www.pluszfm.ro/emisiuni/20/slager-plusz-keserue-tamassal' },
  { start: 1200, end: 1260, title: 'Zenevonat', host: 'Egy óra, ami magával visz.', href: 'https://www.pluszfm.ro/emisiuni/21/zenevonat' },
];
const WEEKEND = [
  { start: 240, end: 840, title: 'Hétvégi zenei maraton', host: 'Kapcsolj ki, tekerd fel!', href: 'https://www.pluszfm.ro/musorok' },
  { start: 840, end: 1440, title: 'Hétvégi zenei maraton', host: 'A hétvégéd a kedvenceiddel.', href: 'https://www.pluszfm.ro/musorok' },
];
const localFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function localParts(now = new Date()) {
  return Object.fromEntries(localFormat.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export function getSchedule(offset = 0, now = new Date()) {
  const p = localParts(now);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day + offset, 12));
  const weekend = [0, 6].includes(date.getUTCDay());
  return { date, programs: (weekend ? WEEKEND : WEEKDAYS).map(p => ({ ...p })), minutes: offset === 0 ? p.hour * 60 + p.minute : -1 };
}
export function getCurrentShow(now = new Date()) {
  const { programs, minutes } = getSchedule(0, now);
  return programs.find(p => minutes >= p.start && minutes < p.end) ?? { title: 'Plusz FM', host: 'A te zenéd. A te rádiód.' };
}
export function formatTime(minutes) {
  if (minutes === 1440) return '00:00';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
