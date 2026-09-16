# CLAUDE.md — guia del repositori per a assistents d'IA

El `README.md` explica el projecte a l'usuari; aquest fitxer explica **com s'hi treballa**.
Segueix les mateixes convencions que el projecte germà **El Temps** (`../Temps`).

## 1. Què és

App web d'**una sola pàgina**, estàtica, que explica l'economia mundial en llenguatge planer.
PWA instal·lable, pensada per a GitHub Pages.

**No hi ha build, ni bundler, ni `package.json`, ni dependències.** `index.html` conté HTML +
CSS + JS. No hi introdueixis frameworks ni llibreries de gràfics: els gràfics són SVG propis
(`lineChart`) i barres HTML (`barsHTML`).

## 2. Flux de dades

```
scripts/actualitza.js  (Node 18+, a mà o des de GitHub Actions cada mes)
  ├─ FMI DataMapper   → paisos[ISO3].s.{pib, creix, infl, atur, deute, deficit, cc, pibpc, pibpcppa, pob, quota, deuteLlars, deuteEmpreses}
  ├─ OCDE SDMX        → paisos[ISO3].s.{souReal, souNom}, moneda, souBase
  └─ BIS SDMX         → tipus[codi BIS]["AAAA-MM"]
        ↓
     dades.json  ──→  index.html: init() → D → go(vista) → renderXxx() → flushCharts()
```

- L'app **només** fa `fetch('dades.json')`. La CSP té `connect-src 'self'`. L'FMI no permet
  CORS, per això les dades es preparen al servidor i no al navegador.
- `Y` = any de `D.generat`. Els anys `>= Y` es tracten com a **previsió** (zona ombrejada).
- Afegir un país: una línia a `PAISOS` del script (nom català, bandera, codi BIS, és OCDE).
  Afegir un indicador FMI: una línia a `FMI`. Torna a executar el script.
- L'OCDE falla amb HTTP 500 si es demana una llista de països: es baixa el conjunt `all`.
- Si una font falla, el script conserva la versió anterior d'aquella font. Si l'FMI arriba
  buit, no desa res.

## 3. Estructura d'`index.html`

Banderoles `/* ── Nom ── */`. Cada pestanya és una funció `renderXxx()` que retorna HTML;
`renderView()` el posa a `#v-<vista>` i després dibuixa els gràfics pendents (`chart(id, fn)`
registra el gràfic i `flushCharts()` el pinta quan el contenidor ja té amplada).

- Tota la interactivitat és amb `onclick` en línia (com a El Temps).
- **`esc()` sempre** en qualsevol text interpolat a `innerHTML`.
- Colors dels gràfics: variables `--s1`…`--s8` (paleta categòrica validada, ordre fix; clar i
  fosc definits per separat). Cada país seleccionat conserva el seu color (`colorOf`) mentre
  estigui seleccionat. Màxim `MAX_SEL` = 6 sèries.
- Un sol eix Y per gràfic; mai dos eixos.
- Claus de `localStorage`: `economia_theme`, `economia_sel`(+`_c`), `economia_banks`(+`_c`),
  `economia_pais`, `economia_fitxa`, `economia_calc`, `economia_dades_v1` (còpia de seguretat).

## 4. Provar

`fetch` no funciona amb `file://`: fes servir `npx serve -l 8766 .` (hi ha `.claude/launch.json`).
Comprova totes les pestanyes, tema clar i fosc, i amplada de mòbil; cap error a la consola.

## 5. Ritual de versió

Quan es toca `index.html` o `sw.js`: puja `APP_VERSION`, posa `BUILD_DATE` a avui i incrementa
`CACHE` a `sw.js`. Missatges de commit **en català**, explicant el perquè.

## 6. Idioma i to

Tot en català. El públic no és economista: frases curtes, cap tecnicisme sense explicar,
i sempre dir si una xifra és previsió. Les valoracions ("alta", "elevat") són orientatives i
han de quedar clares com a tals.

## 7. Git

⚠️ La carpeta `C:\Users\Carles` sencera és un repositori git. Aquest projecte té el **seu propi**
`.git`; comprova `git rev-parse --show-toplevel` abans de fer cap commit.
