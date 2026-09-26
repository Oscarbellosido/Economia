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

## 🧭 Com està organitzada

- **Menú en 5 blocs**: 🧭 Comença aquí · 👛 La teva butxaca · 🏛️ Estats i deute · 🌍 El món · 🔎 Eines. En triar un bloc surten les seves pàgines.
- **⏱️ En 30 segons**: cada pàgina comença amb la conclusió principal, calculada amb les dades. Els gràfics i les taules queden plegats sota **"Veure el detall"** (l'app recorda si l'obres).
- **Rutes guiades**: des del Resum pots triar una pregunta ("Per què tot és més car?", "Cobraré pensió?", "Ve una crisi?", "Com funciona l'economia?") i l'app et porta pas a pas amb un botó **Següent**.
- **Paraules subratllades amb punts**: en tocar-les surt l'explicació del glossari.

## 📑 Què hi ha a l'app

| Pestanya | Què explica |
|---|---|
| 🧭 **Resum** (pantalla d'entrada) | Què ens espera a Espanya, a les grans economies i al món: un semàfor amb les conclusions, la lectura oficial i la crítica, tres escenaris i què convé vigilar. Cada punt porta a la pestanya amb el detall |
| 🏠 **El món en xifres** | Les xifres del món d'aquest any, un avís d'actualitat (la crisi d'Ormuz), les 15 economies més grans i tres idees clau |
| 🛒 **Inflació** | Inflació anual per país (des del 1980, el 2000 o el 2015), com es nota a la butxaca en euros, el preu del petroli i del gas mes a mes, i una calculadora de "què valen els teus diners" |
| 💶 **Sous** | Si els sous han guanyat o perdut contra la inflació, evolució del sou real i qui cobra més |
| 🧾 **Impostos** | L'IRPF d'un sou mitjà any per any (la "progressivitat en fred"), on van els diners de la nòmina, la cunya fiscal, el sou brut i net descomptant la inflació, i què es paga segons on vius: IRPF, successions i patrimoni per comunitat autònoma, i impostos sobre el PIB, cunya i IVA per país |
| 🏦 **Deute** | Deute públic de cada país, evolució, qui deu (estat, famílies, empreses), dèficit i **quant costa**: bons a 10 i 30 anys, corba de tipus, prima de risc i interessos pagats |
| 💵 **Deute dels EUA** | El deute dels EUA (dada diària), qui té els seus bons a l'estranger (governs vs inversors privats), el "coixí" de liquiditat de la Fed que s'ha buidat i com s'encalla el sistema (2019, Londres 2022, Japó 2024) |
| 📊 **Borsa** | Índex de la borsa de cada país, valor de la borsa en % del PIB ("indicador Buffett"), borsa vs economia i sous, i per què es parla de bombolla i de concentració en la IA |
| 📈 **Tipus d'interès** | Els tipus dels bancs centrals des del 2007 i els tipus reals (tipus menys inflació) |
| 🏭 **Creixement** | Creixement del PIB, atur, riquesa per habitant, d'on surt el creixement (més hores o més productivitat), producció per hora, inversió i renda mediana |
| 📍 **Fitxa de país** | Un resum en paraules i gràfics de qualsevol país o zona |
| 🔍 **L'altra cara** | El que no surt als titulars: pisos vs sous, la "màquina de fer diners" dels bancs centrals, diners vs economia a la zona euro, la febre de l'or i per què la inflació oficial pot semblar baixa |
| 🧳 **Immigració** | Quanta n'hi ha i com arriba, immigració irregular i expulsions que es fan efectives, feina i pobresa, llars amb un sou o amb dos, ocupació per nacionalitat i per lloc de naixement (Marroc, Colòmbia, Romania...), remeses, què aporta i què costa, i el percentatge de població nascuda a fora a **qualsevol poble de Catalunya** |
| 👴 **Pensions** | Gent gran per cada 100 persones en edat de treballar (avui i projecció fins al 2070), despesa en pensions, fills per dona i què vol dir tot plegat |
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
| Demografia, projeccions, pensions i llicències d'habitatge | **Eurostat** |
| Bons a 2, 10 i 30 anys | **Tresor dels EUA**, **Ministeri d'Hisenda del Japó**, **BCE** |
| Índex borsari i valor de la borsa | **OCDE** (share prices) i **Banc Mundial** (capitalització en % del PIB) |
| Tipus de canvi | **BIS** (efectius) i **BCE** (euro) |
| Reserves d'or (anuals i mensuals) | **FMI** — International Reserves (`api.imf.org`) |
| Deute dels EUA | **Tresor dels EUA** — Debt to the Penny (`api.fiscaldata.treasury.gov`) |
| Tenidors estrangers de bons dels EUA | **Tresor dels EUA** — Treasury International Capital (TIC) |
| Repo invers de la Fed | **Fed de Nova York** (`markets.newyorkfed.org`) |
| Immigració a Europa (població nascuda a fora, migració neta, irregulars, ordres d'expulsió i retorns, asil, permisos, feina i pobresa) | **Eurostat** |
| Afiliats i població per nacionalitat, Espanya (ocupació aproximada del Marroc, Colòmbia...) | **Seguretat Social** i **INE** (també Cens anual, per lloc de naixement) |
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
