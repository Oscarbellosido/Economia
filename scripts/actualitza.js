// Baixa les dades econòmiques de fonts oficials i les desa a dades.json.
// S'executa a mà (`node scripts/actualitza.js`) o cada mes des de GitHub Actions.
// Fonts: FMI (World Economic Outlook i Global Debt Database), OCDE (salaris) i BIS (tipus d'interès).
// L'app llegeix només dades.json: així no depèn del CORS de cap servidor i funciona sense connexió.

const fs = require('fs');
const path = require('path');

const UA = { 'User-Agent': 'Mozilla/5.0 (Economia app; +https://github.com/Oscarbellosido)' };
const ANY0 = 2000;

// codi ISO3 → nom en català, bandera, codi BIS del banc central, és de l'OCDE
const PAISOS = {
  USA: ['Estats Units', '🇺🇸', 'US', 1], CHN: ['Xina', '🇨🇳', 'CN', 0], DEU: ['Alemanya', '🇩🇪', 'XM', 1],
  JPN: ['Japó', '🇯🇵', 'JP', 1], IND: ['Índia', '🇮🇳', 'IN', 0], GBR: ['Regne Unit', '🇬🇧', 'GB', 1],
  FRA: ['França', '🇫🇷', 'XM', 1], ITA: ['Itàlia', '🇮🇹', 'XM', 1], CAN: ['Canadà', '🇨🇦', 'CA', 1],
  BRA: ['Brasil', '🇧🇷', 'BR', 0], RUS: ['Rússia', '🇷🇺', 'RU', 0], KOR: ['Corea del Sud', '🇰🇷', 'KR', 1],
  AUS: ['Austràlia', '🇦🇺', 'AU', 1], ESP: ['Espanya', '🇪🇸', 'XM', 1], MEX: ['Mèxic', '🇲🇽', 'MX', 1],
  IDN: ['Indonèsia', '🇮🇩', 'ID', 0], TUR: ['Turquia', '🇹🇷', 'TR', 1], NLD: ['Països Baixos', '🇳🇱', 'XM', 1],
  SAU: ['Aràbia Saudita', '🇸🇦', 'SA', 0], CHE: ['Suïssa', '🇨🇭', 'CH', 1], POL: ['Polònia', '🇵🇱', 'PL', 1],
  ARG: ['Argentina', '🇦🇷', 'AR', 0], SWE: ['Suècia', '🇸🇪', 'SE', 1], BEL: ['Bèlgica', '🇧🇪', 'XM', 1],
  IRL: ['Irlanda', '🇮🇪', 'XM', 1], AUT: ['Àustria', '🇦🇹', 'XM', 1], NOR: ['Noruega', '🇳🇴', 'NO', 1],
  PRT: ['Portugal', '🇵🇹', 'XM', 1], GRC: ['Grècia', '🇬🇷', 'XM', 1], ZAF: ['Sud-àfrica', '🇿🇦', 'ZA', 0],
  NGA: ['Nigèria', '🇳🇬', null, 0], EGY: ['Egipte', '🇪🇬', null, 0], AND: ['Andorra', '🇦🇩', null, 0],
};
const GRUPS = {
  WEOWORLD: ['Món', '🌍'], ADVEC: ['Economies avançades', '🏙️'], OEMDC: ['Economies emergents', '🌱'],
  EURO: ['Zona euro', '🇪🇺'], EU: ['Unió Europea', '🇪🇺'],
};

// indicador FMI → clau curta a dades.json
const FMI = {
  NGDPD: 'pib', NGDP_RPCH: 'creix', PCPIPCH: 'infl', LUR: 'atur', GGXWDG_NGDP: 'deute',
  GGXCNL_NGDP: 'deficit', BCA_NGDPD: 'cc', NGDPDPC: 'pibpc', PPPPC: 'pibpcppa', LP: 'pob',
  PPPSH: 'quota', HH_LS: 'deuteLlars', NFC_LS: 'deuteEmpreses',
};

async function get(url, as = 'json', intents = 3, espera = 5000) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return as === 'json' ? await r.json() : await r.text();
    } catch (e) {
      if (i >= intents) throw new Error(`${url}: ${e.message}`);
      await new Promise(res => setTimeout(res, espera * i));
    }
  }
}

// CSV senzill amb cometes (l'OCDE i el BIS en fan servir)
function csv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const r1 = v => Math.round(v * 100) / 100;

async function main() {
  const out = { generat: new Date().toISOString().slice(0, 10), fonts: {}, paisos: {}, grups: {} };
  for (const [k, [nom, flag, bis, ocde]] of Object.entries(PAISOS)) out.paisos[k] = { nom, flag, bis, ocde: !!ocde, s: {} };
  for (const [k, [nom, flag]] of Object.entries(GRUPS)) out.grups[k] = { nom, flag, s: {} };

  // ── FMI ──
  const meta = (await get('https://www.imf.org/external/datamapper/api/v1/indicators')).indicators;
  for (const [ind, clau] of Object.entries(FMI)) {
    const vals = (await get(`https://www.imf.org/external/datamapper/api/v1/${ind}`)).values[ind] || {};
    out.fonts[clau] = { font: 'FMI · ' + (meta[ind]?.source || ''), unitat: meta[ind]?.unit || '' };
    for (const dest of [out.paisos, out.grups]) {
      for (const k of Object.keys(dest)) {
        const serie = {};
        for (const [any, v] of Object.entries(vals[k] || {})) if (+any >= ANY0 && v != null) serie[any] = r1(v);
        if (Object.keys(serie).length) dest[k].s[clau] = serie;
      }
    }
    console.log('FMI', ind, 'ok');
  }

  // ── OCDE: salari mitjà anual ──
  // souReal = dòlars PPA a preus constants (comparable entre països)
  // souNom  = moneda nacional a preus corrents (per comparar-ne el creixement amb la inflació)
  // Es demana el conjunt sencer ("all", ~700 KB): la consulta amb llista de països falla sovint amb HTTP 500.
  // L'OCDE té un límit de consultes per hora (HTTP 429) i errors 500 puntuals: una sola consulta,
  // amb reintents ben espaiats. Si tot falla, es conserven els sous de la descàrrega anterior.
  try {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@AV_AN_WAGE,1.0/all?startPeriod=${ANY0}&format=csvfilewithlabels`;
    const files = csv(await get(url, 'text', 4, 30000));
    for (const f of files) {
      const p = out.paisos[f.REF_AREA];
      if (!p || f.OBS_VALUE === '' || f.MEASURE !== 'WG' || f.AGGREGATION_OPERATION !== 'MEAN') continue;
      let clau = null;
      if (f.UNIT_MEASURE === 'USD_PPP' && f.PRICE_BASE === 'Q') clau = 'souReal';
      else if (f.UNIT_MEASURE !== 'USD_PPP' && f.PRICE_BASE === 'V') { clau = 'souNom'; p.moneda = f.UNIT_MEASURE; }
      if (!clau) continue;
      (p.s[clau] ||= {})[f.TIME_PERIOD] = Math.round(+f.OBS_VALUE);
      if (clau === 'souReal') p.souBase = f.BASE_PER;
    }
    out.fonts.souReal = { font: 'OCDE · Average annual wages', unitat: 'Dòlars PPA a preus constants' };
    out.fonts.souNom = { font: 'OCDE · Average annual wages', unitat: 'Moneda nacional, preus corrents' };
    console.log('OCDE ok');
  } catch (e) { console.warn('OCDE ha fallat:', e.message); }

  // ── BIS: tipus d'interès oficial dels bancs centrals (final de mes) ──
  try {
    const codis = [...new Set(Object.values(PAISOS).map(p => p[2]).filter(Boolean))].join('+');
    const text = await get(`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.${codis}?startPeriod=2007-01&format=csv`, 'text');
    const tipus = {};
    for (const f of csv(text)) if (f.OBS_VALUE !== '' && f.OBS_VALUE !== 'NaN') (tipus[f.REF_AREA] ||= {})[f.TIME_PERIOD] = +f.OBS_VALUE;
    out.tipus = tipus;
    out.fonts.tipus = { font: 'BIS · Central bank policy rates', unitat: 'Percentatge, final de mes' };
    console.log('BIS ok', Object.keys(tipus).length, 'bancs centrals');
  } catch (e) { console.warn('BIS ha fallat:', e.message); }

  // Si una font falla, conserva el que hi havia abans en lloc de deixar-la buida
  const fitxer = path.join(__dirname, '..', 'dades.json');
  if (fs.existsSync(fitxer)) {
    const vell = JSON.parse(fs.readFileSync(fitxer, 'utf8'));
    if (!out.tipus && vell.tipus) { out.tipus = vell.tipus; out.fonts.tipus = vell.fonts.tipus; }
    for (const [k, p] of Object.entries(out.paisos)) {
      const v = vell.paisos?.[k];
      if (!v) continue;
      for (const c of ['souReal', 'souNom']) if (!p.s[c] && v.s[c]) { p.s[c] = v.s[c]; p.moneda ||= v.moneda; p.souBase ||= v.souBase; }
    }
    for (const c of ['souReal', 'souNom']) if (!out.fonts[c] && vell.fonts[c]) out.fonts[c] = vell.fonts[c];
  }
  if (!out.paisos.USA.s.pib) throw new Error('Les dades del FMI han arribat buides; no es desa res.');

  fs.writeFileSync(fitxer, JSON.stringify(out));
  console.log('Desat', fitxer, (fs.statSync(fitxer).size / 1024).toFixed(0), 'KB');
}

main().catch(e => { console.error(e); process.exit(1); });
