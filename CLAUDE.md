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
  ├─ BIS SDMX         → tipus[codi BIS]["AAAA-MM"]
  ├─ BIS SDMX         → altra.habitatge[ISO3], altra.balanc[codi BIS]   (pestanya "L'altra cara")
  ├─ BCE              → altra.diners {m3, pib, preus}
  ├─ FMI IRFCL        → altra.or[ISO3][any] en tones (+ altra.orNoms per als països extra)
  ├─ OCDE FINMARK     → fiscal.bons[ISO3|EURO]["AAAA-MM"] (IRLT) i borsa.index (SHARE, 2015=100), una sola consulta
  ├─ Banc Mundial     → borsa.capPib[ISO3][any] (capitalització en % del PIB)
  ├─ Tresor/MoF/BCE   → llarg[USA|JPN|EURO]["AAAA-MM"] = [2 anys, 10 anys, 30 anys]
  │                     (el Tresor és un fitxer per any de ~18 s: es reaprofiten els anys tancats de dades.json)
  ├─ OCDE Taxing Wages→ fiscal.impostos[ISO3].{irpf, irpfSS, cunya, brut, net}  (pestanya Impostos)
  ├─ Tresor EUA       → eua.deute["AAAA-MM"] = [total, en mans del públic], eua.deuteUltim
  ├─ Tresor TIC       → eua.tenidors[país|TOTAL|OFICIAL]["AAAA-MM"]  (mfhhis01.txt històric + slt_table5.txt recent)
  ├─ Fed NY           → eua.rrp["AAAA-MM"] (mitjana), eua.rrpUltim, eua.rrpMax
  ├─ FMI IRFCL mensual→ altra.orMensual[ISO3]["AAAA-MM"] (compres de l'any en curs)
  ├─ Eurostat demo    → demo.eu[ISO3|EU].{depVell, depVellProj, pensions, fecunditat, creixPob, llar, llicencies}
  ├─ BIS EER + BCE    → divises.eer[moneda]["AAAA-MM"] (2020=100), divises.eur[moneda]["AAAA-MM"] (unitats per euro)
  ├─ Eurostat         → immi.eu[ISO3|EU][clau][any]   (pestanya "Immigració"; Grècia és EL a Eurostat)
  ├─ Banc Mundial     → immi.mon[ISO3].{estoc, remesesEnviades, remesesRebudes}
  └─ Idescat (taules) → immi.cat {mun, com, anys, dades}: padró per lloc de naixement 2000-2022
        ↓
     dades.json  ──→  index.html: init() → D → go(vista) → renderXxx() → flushCharts()
```

- L'app fa `fetch('dades.json')` i, a Immigració, `loadMun()` demana en directe l'última dada del municipi a
  l'EMEX de l'Idescat (CORS obert). La CSP té `connect-src 'self' https://api.idescat.cat`. L'FMI no permet
  CORS, per això les dades es preparen al servidor i no al navegador.
- `Y` = any de `D.generat`. Els anys `>= Y` es tracten com a **previsió** (zona ombrejada).
- Afegir un país: una línia a `PAISOS` del script (nom català, bandera, codi BIS, és OCDE).
  Afegir un indicador FMI: una línia a `FMI`. Torna a executar el script.
- L'OCDE falla amb HTTP 500 si es demana una llista de països: es baixa el conjunt `all`.
  Retorna HTTP 500 a molts `fetch` de Node (sobretot des de GitHub Actions) però respon bé a `curl`:
  per això `get()` acaba provant amb `curl` quan fetch falla (comprovat el 2026-09-16).
  També té un **límit de consultes per hora (HTTP 429)**: no facis proves repetides ni consultes país per país.
- FRED (Fed de St. Louis) no respon des d'aquí: no el facis servir.
- Les xifres de concentració de la borsa (pes de la tecnologia a l'S&P 500) no tenen font oficial oberta: a la pestanya Borsa
  surten citades com a xifres dels divulgadors.
- Interessos del deute = `primari` (FMI Fiscal Monitor) − `deficit` (WEO). Són interessos **nets**.
- La prima de risc es calcula sempre amb el **mateix mes** per al país i per a Alemanya.
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

- Per provar el script sense gastar consultes de l'OCDE: `SENSE_OCDE=1 node scripts/actualitza.js`
  (conserva els sous de l'última descàrrega).
- "L'altra cara" ha de continuar sent **dades oficials** amb context crític, no índexs alternatius
  sense metodologia clara. El balanç dels bancs centrals va en dòlars (el BIS no dona la Fed en
  una altra unitat), i es divideix pel PIB en dòlars de l'FMI.

## 4. Provar

`fetch` no funciona amb `file://`: fes servir `npx serve -l 8766 .` (hi ha `.claude/launch.json`).
Comprova totes les pestanyes, tema clar i fosc, i amplada de mòbil; cap error a la consola.

**Abans de cada commit**, comprova que el JavaScript d'`index.html` no té errors de sintaxi
(una sola errada deixa l'app en blanc):

```bash
node -e "const s=require('fs').readFileSync('index.html','utf8');new Function(s.slice(s.indexOf('<script>')+8,s.lastIndexOf('</script>')));console.log('ok')"
```

⚠️ Si edites el fitxer amb scripts que fan `String.replace(text, nou)`, passa el text nou com a funció
(`() => nou`): si conté `$'`, `$&` o `$`` (per exemple `' $'`), JavaScript hi insereix trossos del fitxer.
Això va trencar la v1.6.0.

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

## 8. Immigració: to i límits

Tema políticament sensible. La pestanya ha de mantenir **beneficis i costos junts**, només dades
oficials amb la font a la vista, i sense generalitzacions sobre col·lectius. La part de "control"
es mesura amb dades objectives (irregulars detectats, ordres d'expulsió, retorns efectius). No s'hi
han posat dades de delinqüència per nacionalitat: són fàcils de malinterpretar sense context.

## 9. Textos d'actualitat (revisar-los!)

El **Resum** (`renderResum()`, pantalla d'entrada) barreja conclusions calculades amb les dades (semàfor,
fitxes de país) amb text escrit a mà: la frase d'Espanya, les lectures oficial/crítica, `CONTEXT` de cada
país, les tendències i els escenaris (data a `RESUM_DATA`). Revisa'ls quan canviïn les dades o l'actualitat:
si una xifra contradiu el text, el text està malament. El creixement per habitant es compara amb el **2019**
(el 2020 va ser l'any de la caiguda per la pandèmia i infla qualsevol comparació).


La targeta "⚠️ Actualitat" d'Inici (`actualitatHTML()`, amb la data a `ACTUALITAT_DATA`) és
**text escrit a mà** sobre la crisi de l'estret d'Ormuz del 2026. Les xifres que l'acompanyen
(últim moviment del BCE, edició de l'FMI) surten de les dades, però el relat no. Quan l'usuari
torni a treballar en el projecte, comprova si la situació ha canviat i actualitza el text i la
data, o treu la targeta si ja no és actualitat. No hi posis res que no estigui contrastat.
