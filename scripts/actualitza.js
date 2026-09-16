// Baixa les dades econòmiques de fonts oficials i les desa a dades.json.
// S'executa a mà (`node scripts/actualitza.js`) o cada mes des de GitHub Actions.
// Fonts: FMI (World Economic Outlook, Global Debt Database i reserves d'or), OCDE (salaris),
// BIS (tipus d'interès, habitatge i balanç dels bancs centrals) i BCE (diners en circulació).
// Per provar-lo sense gastar consultes de l'OCDE (té límit per hora): SENSE_OCDE=1 node scripts/actualitza.js
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
// Codi ISO de 2 lletres (el BIS el fa servir per als preus de l'habitatge)
const ISO2 = {
  USA: 'US', CHN: 'CN', DEU: 'DE', JPN: 'JP', IND: 'IN', GBR: 'GB', FRA: 'FR', ITA: 'IT', CAN: 'CA', BRA: 'BR',
  RUS: 'RU', KOR: 'KR', AUS: 'AU', ESP: 'ES', MEX: 'MX', IDN: 'ID', TUR: 'TR', NLD: 'NL', CHE: 'CH', POL: 'PL',
  SWE: 'SE', BEL: 'BE', IRL: 'IE', AUT: 'AT', NOR: 'NO', PRT: 'PT', GRC: 'GR', ZAF: 'ZA',
};
// Països que no surten a la resta de l'app però són importants en or
const OR_EXTRA = {
  KAZ: ['Kazakhstan', '🇰🇿'], UZB: ['Uzbekistan', '🇺🇿'], CZE: ['Txèquia', '🇨🇿'], HUN: ['Hongria', '🇭🇺'],
  QAT: ['Qatar', '🇶🇦'], IRQ: ['Iraq', '🇮🇶'], SGP: ['Singapur', '🇸🇬'], THA: ['Tailàndia', '🇹🇭'], PHL: ['Filipines', '🇵🇭'],
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

async function get(url, as = 'json', intents = 3, espera = 5000, extra = {}) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...extra }, signal: AbortSignal.timeout(60000) });
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
  if (!process.env.SENSE_OCDE) try {
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

  // ════ L'altra cara: dades que ajuden a contrastar la versió oficial ════
  out.altra = {};
  const any = p => p.slice(0, 4);
  const mitjanaAnual = llista => { // [[periode, valor]] → {any: mitjana}, només anys amb dades de tot l'any
    const g = {};
    for (const [p, v] of llista) (g[any(p)] ||= []).push(v);
    const r = {};
    for (const [a, vs] of Object.entries(g)) if (vs.length >= (llista[0][0].includes('Q') ? 4 : 12)) r[a] = r1(vs.reduce((s, x) => s + x, 0) / vs.length);
    return r;
  };

  // ── BIS: preu real de l'habitatge (descomptada la inflació), índex 2010 = 100 ──
  try {
    const iso2 = Object.fromEntries(Object.keys(PAISOS).map(k => [ISO2[k], k]).filter(([a]) => a));
    const text = await get(`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0/Q.${Object.keys(iso2).join('+')}.R.628?startPeriod=${ANY0}-Q1&format=csv`, 'text');
    const per = {};
    for (const f of csv(text)) if (f.OBS_VALUE !== '' && f.OBS_VALUE !== 'NaN') (per[iso2[f.REF_AREA]] ||= []).push([f.TIME_PERIOD, +f.OBS_VALUE]);
    out.altra.habitatge = {};
    for (const [k, l] of Object.entries(per)) { l.sort((a, b) => a[0] < b[0] ? -1 : 1); out.altra.habitatge[k] = { anual: mitjanaAnual(l), ultim: l[l.length - 1] }; }
    out.fonts.habitatge = { font: 'BIS · Residential property prices', unitat: 'Índex real, 2010 = 100' };
    console.log('BIS habitatge ok', Object.keys(per).length, 'països');
  } catch (e) { console.warn('BIS habitatge ha fallat:', e.message); }

  // ── BIS: balanç dels bancs centrals (tot el que tenen: deute comprat, préstecs, or…) ──
  // En dòlars; la Reserva Federal només hi és en la seva moneda, que ja és el dòlar.
  try {
    const codis = [...new Set(Object.values(PAISOS).map(p => p[2]).filter(Boolean))].join('+');
    const text = await get(`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBTA/1.0/M.${codis}..?startPeriod=${ANY0}-01&format=csv`, 'text');
    const per = {};
    for (const f of csv(text)) {
      if (f.OBS_VALUE === '' || f.TRANSFORMATION !== 'B') continue;
      const bo = f.REF_AREA === 'US' ? f.UNIT_MEASURE === 'XDC' : f.UNIT_MEASURE === 'USD';
      if (bo) (per[f.REF_AREA] ||= []).push([f.TIME_PERIOD, +f.OBS_VALUE]);
    }
    out.altra.balanc = {};
    for (const [b, l] of Object.entries(per)) {
      l.sort((a, c) => a[0] < c[0] ? -1 : 1);
      const desembre = {}; // valor de final d'any (o l'últim de l'any en curs)
      for (const [p, v] of l) desembre[any(p)] = Math.round(v);
      out.altra.balanc[b] = { anual: desembre, mensual: Object.fromEntries(l.map(([p, v]) => [p, Math.round(v)])) };
    }
    out.fonts.balanc = { font: 'BIS · Central bank total assets', unitat: 'Milers de milions de dòlars' };
    console.log('BIS balanç ok', Object.keys(per).length, 'bancs centrals');
  } catch (e) { console.warn('BIS balanç ha fallat:', e.message); }

  // ── BCE: diners en circulació (M3), PIB nominal i preus de la zona euro ──
  try {
    const ecb = async k => csv(await get(`https://data-api.ecb.europa.eu/service/data/${k}?startPeriod=${ANY0}&format=csvdata`, 'text'))
      .filter(f => f.OBS_VALUE !== '').map(f => [f.TIME_PERIOD, +f.OBS_VALUE]);
    const m3 = await ecb('BSI/M.U2.Y.V.M30.X.1.U2.2300.Z01.E');       // milions d'euros, final de mes
    const pib = await ecb('MNA/Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.V.N'); // milions d'euros per trimestre
    const preus = await ecb('ICP/M.U2.N.000000.4.INX');                // IPCH, índex
    const d = { m3: {}, pib: {}, preus: mitjanaAnual(preus) };
    for (const [p, v] of m3) if (p.endsWith('-12')) d.m3[any(p)] = Math.round(v / 1000);
    const sum = {};
    for (const [p, v] of pib) (sum[any(p)] ||= []).push(v);
    for (const [a, vs] of Object.entries(sum)) if (vs.length === 4) d.pib[a] = Math.round(vs.reduce((s, x) => s + x, 0) / 1000);
    d.m3Ultim = [m3[m3.length - 1][0], Math.round(m3[m3.length - 1][1] / 1000)];
    out.altra.diners = d;
    out.fonts.diners = { font: 'BCE · M3, PIB nominal i IPCH', unitat: "Milers de milions d'euros" };
    console.log('BCE ok');
  } catch (e) { console.warn('BCE ha fallat:', e.message); }

  // ── FMI: reserves d'or de cada país (tones) ──
  try {
    const text = await get(`https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IRFCL/.IRFCLDT1_IRFCL56V_FTO.S1XS1311.A?startPeriod=${ANY0}`, 'text', 3, 5000,
      { Accept: 'application/vnd.sdmx.data+csv;version=1.0.0' });
    const or = {};
    for (const f of csv(text)) {
      if (!(f.COUNTRY in PAISOS || f.COUNTRY in OR_EXTRA) || f.OBS_VALUE === '') continue;
      const t = +f.OBS_VALUE / 1e6 * 31.1035; // unces troy → tones (1 milió d'unces = 31,1 t)
      if (t > 0 && t < 10000) // alguns països tenen l'escala malament a l'FMI (surten milers de tones)
        (or[f.COUNTRY] ||= {})[f.TIME_PERIOD] = Math.round(t);
    }
    out.altra.or = or;
    out.altra.orNoms = OR_EXTRA;
    out.fonts.or = { font: 'FMI · International Reserves (IRFCL)', unitat: 'Tones, final d\'any' };
    console.log('FMI or ok', Object.keys(or).length, 'països');
  } catch (e) { console.warn('FMI or ha fallat:', e.message); }

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
    for (const c of ['habitatge', 'balanc', 'diners', 'or']) if (!out.altra[c] && vell.altra?.[c]) { out.altra[c] = vell.altra[c]; out.fonts[c] = vell.fonts[c]; }
    if (!out.altra.orNoms && vell.altra?.orNoms) out.altra.orNoms = vell.altra.orNoms;
  }
  if (!out.paisos.USA.s.pib) throw new Error('Les dades del FMI han arribat buides; no es desa res.');

  fs.writeFileSync(fitxer, JSON.stringify(out));
  console.log('Desat', fitxer, (fs.statSync(fitxer).size / 1024).toFixed(0), 'KB');
}

main().catch(e => { console.error(e); process.exit(1); });
