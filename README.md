# 🌍 Economia Mundial — explicada fàcil

Aplicació web d'una sola pàgina (com **El Temps**) que explica l'economia dels principals
països del món de manera senzilla: deute, inflació, sous, tipus d'interès, creixement i atur.

- **🗂️ Fitxer principal:** `index.html` (tot —HTML, CSS i JavaScript— en un sol fitxer)
- **📊 Dades:** `dades.json`, que es genera amb `scripts/actualitza.js`

---

## 🧩 Estructura

```
Economia/
├── index.html        ← l'aplicació sencera (edita aquí)
├── dades.json        ← totes les xifres (es regenera sol cada mes)
├── scripts/
│   └── actualitza.js ← baixa les dades de l'FMI, l'OCDE i el BIS
├── manifest.json     ← configuració PWA (instal·lable al mòbil)
├── sw.js             ← service worker (funciona sense connexió)
├── icon.svg / icon-192.png / icon-512.png
├── .github/workflows/actualitza-dades.yml ← actualització automàtica mensual
├── README.md         ← aquest document
└── CLAUDE.md         ← guia per a assistents d'IA
```

## 📑 Què hi ha a l'app

| Pestanya | Què explica |
|---|---|
| 🧭 **Resum** (pantalla d'entrada) | Què ens espera a Espanya, a les grans economies i al món: un semàfor amb les conclusions, la lectura oficial i la crítica, tres escenaris i què convé vigilar. Cada punt porta a la pestanya amb el detall |
| 🏠 **El món en xifres** | Les xifres del món d'aquest any, un avís d'actualitat (la crisi d'Ormuz), les 15 economies més grans i tres idees clau |
| 🛒 **Inflació** | Inflació anual per país des del 2000, quant han pujat els preus des del 2020 i una calculadora de "què valen els teus diners" |
| 💶 **Sous** | Si els sous han guanyat o perdut contra la inflació, evolució del sou real i qui cobra més |
| 🧾 **Impostos** | L'IRPF d'un sou mitjà any per any (la "progressivitat en fred"), on van els diners de la nòmina, la cunya fiscal i el sou brut i net descomptant la inflació |
| 🏦 **Deute** | Deute públic de cada país, evolució, qui deu (estat, famílies, empreses), dèficit i **quant costa**: bons a 10 anys, prima de risc i interessos pagats |
| 📈 **Tipus d'interès** | Els tipus dels bancs centrals des del 2007 i els tipus reals (tipus menys inflació) |
| 🏭 **Creixement** | Creixement del PIB, atur i riquesa per habitant |
| 📍 **Fitxa de país** | Un resum en paraules i gràfics de qualsevol país o zona |
| 🔍 **L'altra cara** | El que no surt als titulars: pisos vs sous, la "màquina de fer diners" dels bancs centrals, diners vs economia a la zona euro, la febre de l'or i per què la inflació oficial pot semblar baixa |
| 🧳 **Immigració** | Quanta n'hi ha i com arriba, immigració irregular i expulsions que es fan efectives, feina i pobresa, remeses, què aporta i què costa, i el percentatge de població nascuda a fora a **qualsevol poble de Catalunya** |
| 📊 **Comparar** | Taula de tots els països, ordenable, per a qualsevol any |
| 📘 **Com funciona** | El cicle de l'economia explicat i un glossari |

Els països que es poden triar als gràfics es recorden al dispositiu. Els anys ombrejats són
**previsions** de l'FMI.

## 📡 D'on surten les dades

Totes són oficials i gratuïtes, sense clau:

| Dada | Font |
|---|---|
| PIB, creixement, inflació, atur, deute públic, dèficit, balança exterior, població | **FMI** — World Economic Outlook (`imf.org/external/datamapper/api`) |
| Deute de famílies i empreses | **FMI** — Global Debt Database |
| Sou mitjà anual (nominal i real) | **OCDE** — Average annual wages (`sdmx.oecd.org`) |
| Rendiment dels bons a 10 anys | **OCDE** — Financial market (long-term interest rates) |
| IRPF, cotitzacions i cunya fiscal | **OCDE** — Taxing Wages |
| Interessos del deute (saldo primari) | **FMI** — Fiscal Monitor |
| Tipus d'interès oficials | **BIS** (Banc de Pagaments Internacionals) — Central bank policy rates (`stats.bis.org`) |
| Preu real de l'habitatge | **BIS** — Residential property prices |
| Balanç dels bancs centrals | **BIS** — Central bank total assets |
| Diners en circulació (M3), PIB nominal i preus de la zona euro | **BCE** (`data-api.ecb.europa.eu`) |
| Reserves d'or | **FMI** — International Reserves (`api.imf.org`) |
| Immigració a Europa (població nascuda a fora, migració neta, irregulars, ordres d'expulsió i retorns, asil, permisos, feina i pobresa) | **Eurostat** |
| Immigrants al món i remeses | **Banc Mundial** |
| Població nascuda a l'estranger per municipi i comarca | **Idescat** (padró; l'última dada de cada poble es consulta en directe) |

L'app **no** es connecta a aquests servidors: només llegeix `dades.json` (l'única excepció és l'última dada de cada municipi, que es demana a l'Idescat quan tries el poble). Així carrega de
pressa, funciona sense connexió i no depèn de si aquests servidors permeten connexions des
del navegador (l'FMI no ho permet).

## 🔄 Actualitzar les dades

- **Automàticament:** el dia 3 de cada mes GitHub Actions executa el script i puja el
  `dades.json` nou. També es pot llançar a mà des de la pestanya *Actions* → *Actualitza les dades* → *Run workflow*.
- **A mà, a l'ordinador:** cal tenir Node.js instal·lat.

```bash
node scripts/actualitza.js
```

Si una font falla, el script conserva les dades antigues d'aquella font en lloc de deixar-la buida.


## 🖥️ Provar-la a l'ordinador

Com que l'app llegeix `dades.json`, **no funciona obrint `index.html` amb doble clic**: cal un
petit servidor local.

```bash
npx serve -l 8766 .
```

I obrir http://localhost:8766/

## 🚀 Publicar

Pensada per anar a **GitHub Pages**, com El Temps: puja el repositori a GitHub, activa
*Settings → Pages → Deploy from branch → main*, i cada `git push` la publica.

Quan canviïs `index.html`, puja també la versió:
1. `APP_VERSION` i `BUILD_DATE` a `index.html`.
2. `CACHE` a `sw.js` (`economia-v1` → `economia-v2`), perquè els mòbils agafin la versió nova.
