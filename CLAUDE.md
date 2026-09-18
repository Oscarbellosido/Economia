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
  ├─ Eurostat prod    → prod.eu[ISO3|EU].{pibReal, pibNom, pibPPA, pob, ocupats, hores, inversio, rendaMed, rendaMitj}
  │                     (pestanya Creixement: d'on surt el creixement, productivitat per hora, inversió i renda mediana)
  ├─ BIS EER + BCE    → divises.eer[moneda]["AAAA-MM"] (2020=100), divises.eur[moneda]["AAAA-MM"] (unitats per euro)
  ├─ Eurostat         → immi.eu[ISO3|EU][clau][any]   (pestanya "Immigració"; Grècia és EL a Eurostat)
  │                     inclou ocupació per sexe (ocupHomes/ocupDones + Nat/NoUE) i llars sense feina (senseFeinaNat/NoUE)
  ├─ Banc Mundial     → immi.mon[ISO3].{estoc, remesesEnviades, remesesRebudes}
  ├─ Seg. Social + INE→ immi.nac {mes, paisos[codi país SS|ESP|EXT].{nom, flag, pobH, pobD, afH, afD}}
  │                     (ocupació aproximada per nacionalitat: afiliats ÷ població de 16 a 64 anys, Espanya)
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
- La productivitat de l'OCDE (DSD_PDB) retorna HTTP 500 sempre, també amb curl: no la facis servir. Per això
  `prod` es calcula amb Eurostat (només països europeus): PIB real i nominal, PIB en PPA, població, ocupats i
  hores treballades, i d'aquí surten la producció per hora i el desglossament del creixement.
- La renda mediana i mitjana surten de l'EU-SILC (`ilc_di03`, dimensions `statinfo` i `unit`): els ingressos
  són els de **l'any anterior** a l'enquesta; per passar-los a euros constants cal desplaçar la inflació un any.
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

## 3b. Guia de lectura (menú, "en 30 segons", rutes, glossari)

- `MENU` agrupa les vistes en 5 blocs i `NOMS` en dona el nom; si afegeixes una vista, posa-la en tots dos.
- `renderView()` fa, per ordre: `renderNav()` → HTML de la vista → `plega()` (si és a `PLEGA`) → rutes → `glossaritza()` → `flushCharts()`.
- `plega()` deixa a la vista el primer `.intro`, la primera fila de `.tiles` i qualsevol targeta amb classe `.sempre`, hi afegeix `RAPID[vista]()` i posa la resta dins
  `<details class="detall">`. Els gràfics d'un detall tancat **no es dibuixen** fins que s'obre (`flushCharts` els guarda a `pending`).
- `RAPID` són frases escrites a mà amb xifres calculades: si les dades canvien de signe, revisa que el text encara digui la veritat.
- `RUTES`: preguntes amb passos `[vista, per què]`. L'estat es desa a `economia_ruta`.
- `GLOSSARI`: [títol, definició, regex]. Només es marca la **primera** aparició de cada terme per pàgina, i mai dins de
  botons, enllaços, gràfics, taules, barres ni textos `.muted` (`NO_GLOS`). Vigila que la regex no enganxi paraules comunes.

## 3c. Crítica de les dades oficials ("la lletra petita")

L'usuari vol que l'app sigui **crítica amb les xifres oficials sense enganyar**. La regla, escrita a la pestanya
Aprendre, és: *criticar no és inventar*. De cada dada es diu **què mesura, què deixa fora i on mirar-ho**.

- `LP` és un objecte amb el text de cada pestanya (pib, ipc, sous, deute, immi, borsa) i `petita(html)` el
  renderitza com un `<details class="petita">` al final de la vista.
- Només s'hi posen límits **comprovables** de la font (definicions, cobertura, metodologia) o comparacions que
  fa la mateixa app (per exemple: el deute en euros puja mentre el % del PIB baixa). Res d'índexs alternatius
  sense metodologia ni xifres de tercers no verificables.
- Quan una crítica d'un divulgador es pot contrastar amb dades, es contrasta; si no es pot, es cita com a
  opinió i es diu qui la fa (vegeu la targeta de contrapunt sobre la IA a Borsa).

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
No hi ha cap taula oficial de parelles amb un o dos sous per origen (ni a l'EPA de l'INE ni a Eurostat): la targeta
"Llars amb un sou o amb dos?" s'hi acosta amb l'ocupació per sexe (`lfsa_ergacob`) i les llars amb intensitat laboral
molt baixa (`ilc_lvhl16n`). La xifra exacta es podria calcular amb les microdades de l'EPA.
Per a nacionalitats concretes (Marroc, Colòmbia...) `immi.nac` combina dues fonts del **mateix mes**:
- Afiliats mitjans per país i sexe de la **Seguretat Social**. No té API: el script omple el formulari PxWeb
  (`1m. Afiliados Total Sistema por sexo, tramo de edad y pais.px`) amb la galeta de sessió i llegeix la taula HTML.
  Si canvien els noms dels camps, deixarà de funcionar i es conservaran les dades anteriors.
- Població per nacionalitat, sexe i grups d'edat de l'**INE** (ECP, taula 56936; la de 15-19 anys compta 4/5).
  Aquesta taula arriba fins a l'1 de gener del 2025; el mes de la Seguretat Social s'agafa igual que la data de població.
- El text de la targeta ha de conservar els avisos: feina no declarada, nacionalitat ≠ lloc de naixement, aproximació.

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
