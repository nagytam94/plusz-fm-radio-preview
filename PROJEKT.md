---
nev: plusz-fm
allapot: aktiv
vezeto: ember
munkamod: alapos
fo_motor: codex
segedmotorok: [argon, flash]
kozzetett:
letrehozva: 2026-10-21
---

# Plusz FM — Több zene. Több élet.

## Cél
Magyar nyelvű, fiatalos Plusz FM rádióoldal a tulaj két arculati referenciája alapján, narancs–fekete megjelenéssel és a jelenlegi rádióoldal élő adásával.

## Kinek
A Plusz FM magyar nyelvű hallgatóinak, mobilon és számítógépen, gyors rádióhallgatáshoz és műsortájékozódáshoz.

## Legkisebb működő változat
Reszponzív rádiós kezdőlap saját arculati logóval, magyar szövegekkel, műsorokkal, kapcsolattal és az eredeti oldalról ellenőrzött élő adás lejátszójával. A mintatartalom egyértelműen jelölt; a böngészőben a hallgató indítja a hangot.

## Mikor kész — pontok (3–7)
- [x] 1. Narancs–fekete, magyar rádiós arculat a referenciák alapján — ellenőrzés: asztali és mobil képernyőképek átnézve.
- [x] 2. Eredeti Plusz FM stream, közös lejátszásvezérlés és hangerő — ellenőrzés: mindkét stream HTTP 200 audio/mpeg; Chrome-ban valódi hangdekódolás, adóváltás, hiba és retry sikeres.
- [x] 3. Műsorrend, rádióbemutató és kapcsolat — ellenőrzés: menük, ma/holnap gombok, hivatalos műsor- és kapcsolati hivatkozások.
- [x] 4. Akadálymentes kezelőszervek, működő mobilnézet és helyi előnézet — ellenőrzés: 20/20 egységteszt, 8/8 böngészős próba; 320/390/768/1440 px; helyi oldal HTTP 200.
- [ ] Megmutatás: kipróbálod, és kimondod: kész.

## Ki mit csinál
Az ügynök a fix, a motor cserélhető; motorváltáskor a Napló kap egy sort.

| Ki | Motor (most) | Mit |
|---|---|---|
| Tomtom (tulaj) | — | döntés, kipróbálás, „kész” |
| Ember | Codex | kártya, arculat, építés, stream bekötése, ellenőrzés |
| Ember alügynöke | Gemini Argon | Élő lejátszó és egységteszt (saját fájlok: player.js, tests/player.test.mjs) |
| Ember alügynöke | Gemini Flash | Tartalék; most nincs kiosztott rész (saját fájlok: nincs) |
| Ember tesztsegédje | OpenRouter · cohere/north-mini-code:free | Független lejátszó-határesetek; a tesztkódot Ember ellenőrzi és futtatja (tests/player-adversarial.test.mjs) |

## Nem része
- Fiókok, adminisztráció, saját rádióstream üzemeltetése.
- A jelenlegi pluszfm.ro oldal módosítása; a külön GitHub Pages előnézet a tulaj későbbi kérésére része lett a munkának.

## Parkoló
- Későbbi szerkesztőségi tartalomkezelés, automatikus dalinformáció és archívum.

## Napló
- 2026-10-21 — Projektindítás. A tulaj az eredeti angol zenekari oldalt magyar Plusz FM rádióoldalra módosította, két arculati referenciát adott és a jelenlegi oldal streamjét kérte.
- 2026-10-21 — A tulaj kérésére Argon kapta a lejátszó modult és tesztjeit; az ingyenes OpenRouter külön teszteseteket adott. Az első OpenRouter-modell 404-et adott, a második (cohere/north-mini-code:free) sikeres. Ember saját futtatása: 18/18 egységteszt sikeres.
- 2026-10-21 — Első változat megépítve, a műsorrend tájékoztató, a képek illusztrációk. Ember kiegészítő tesztje feltárta a késleltetett pause és a váratlan streamvég hibáját; javítva. Végső saját futtatás: 20/20 egységteszt és 8/8 Chrome-próba sikeres, mindkét valódi MP3 streammel. Előnézet: http://127.0.0.1:56856/index.html. A projekt aktív, tulajdonosi lezárásra nem került sor.
- 2026-10-21 — A tulaj GitHub Pages kitételt kért. Külön docs csomag készült kizárólag a weboldal fájljaival; a projektkártya és a tesztek nem kerülnek a webes könyvtárba. A GitHub tároló alapbeállítása privát.
