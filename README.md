# Plusz FM

Magyar, reszponzív rádióoldal a tulaj arculati referenciái alapján. Statikus HTML/CSS/ES-modulok, telepítés és build nélkül.

## Előnézet

Az Ember munkatérből:

```sh
eszkozok/mutat /Users/nagytamas/Aurora/projektek/plusz-fm/index.html
```

Az eszköz kiírja az érvényes helyi címet. Másik gépen bármely statikus HTTP-kiszolgáló használható; a JavaScript-modulok miatt HTTP szükséges.

## Ellenőrzés

```sh
npm test
node tests/browser.mjs http://127.0.0.1:56856/index.html
```

Nincs külső tesztfüggőség. A böngészős ellenőrzés a gépen meglévő Chrome-ot és Node 22+ WebSocket API-ját használja; a Chrome útvonala felülírható a `PLUSZ_TEST_CHROME` változóval. A teszt saját ideiglenes profilt indít és takarít, valódi streamet tesztel, hibaágat is szimulál. A teszt alatt a hangkimenet némított. Képernyőképek: `.artifacts/` (gitből kizárva).

## Adás és műsorrend

- A két élő URL a hivatalos oldal audio eleméből származik, ellenőrzés: 2026-10-21.
- Nagyvárad: https://stream2.radiotransilvania.ro/Nagyvarad
- Margitta: https://stream2.radiotransilvania.ro/Margitta
- Forrás: https://www.pluszfm.ro/ és https://www.pluszfm.ro/helyseg/3/margitta
- A tájékoztató műsorrend ismétlődő adatait a `schedule.js` tartalmazza. Az adó helyi idejét (`Europe/Bucharest`) használja, a nyári/téli időszámítást kezeli. Nem automatikus, élő program- vagy dalmetaadat.
- Hivatalos program: https://www.pluszfm.ro/program/2/nagyvarad
- A hangot a hallgató indítja; egyetlen közös audio elem szolgálja ki az összes kezelőszervet. Leállításkor a stream kapcsolata megszakad. Harmadik fél a hangot a hallgatás indításakor szolgálja ki.
- A hullámforma dekoráció; nem állítjuk, hogy a tényleges hangot méri. A képek illusztrációk. Nincsenek kitalált hallgatottsági adatok vagy aktuális dalcímek.
- A böngészőben csak a hangerő beállítása marad meg. Nincs analitika, belépés, API-kulcs vagy szerveroldali komponens.

## Közreműködők

- Ember / Codex: arculat, oldal, integráció, böngészős ellenőrzés.
- Gemini Argon: `player.js`, `tests/player.test.mjs`.
- OpenRouter, `cohere/north-mini-code:free`: független tesztesetek; Ember átnézte, a szerződéshez igazította és lefuttatta a kódot.
- Végső ellenőrzés (2026-10-21): 20/20 egységteszt és 8/8 Chrome-próba sikeres; valódi stream mindkét állomásról. A késleltetett pause és a váratlan streamvég javítását Ember végezte regressziós tesztekkel.

## Képek és betű

A logó saját SVG a tulaj mintája alapján. A fotók Unsplash-illusztrációk:

- https://images.unsplash.com/photo-1478737270239-2f02b77fc618 (mikrofon)
- https://images.unsplash.com/photo-1598488035139-bdbb2231ce04 (stúdió)
- https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3 (koncert)
- https://images.unsplash.com/photo-1484704849700-f032a568e944 (fejhallgató)

Inter: Google Fonts, saját kiszolgálás; SIL Open Font License (`assets/Inter-OFL.txt`).

## Átadás

A változat arculati előnézet. Az eredeti rádióoldalt nem módosítja. A záró jóváhagyás a tulajé a projektkártyán.

## GitHub Pages

Nyilvános előnézet: https://nagytam94.github.io/plusz-fm-radio-preview/

Külön tároló: https://github.com/nagytam94/plusz-fm-radio-preview — a meglévő Plusz FM tárolót nem módosítja. A tulaj jóváhagyásával nyilvános. Élő ellenőrzés: HTTP 200, 8/8 Chrome-próba sikeres, HTTPS kötelező (2026-10-21).

Kitételi csomag készítése: `npm run build:pages`. A Pages forrása a `main` ág `/docs` mappája. A fájlhivatkozások relatívak, így projektútvonalon is működnek. A csomag kizárólag a weboldalhoz szükséges fájlokat tartalmazza; a projektkártyát és a teszteket nem szolgálja ki a webhely.

Frissítéskor az oldal módosítása után futtasd újra a build parancsot, majd a változásokkal együtt a `docs` mappát is mentsd és töltsd fel. A kitétel nem használ külön fizetős szolgáltatást vagy telepített függőséget. A privát forrásból publikáló Pages elérhetősége a GitHub-csomagtól függ.
