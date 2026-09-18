// Baixa les dades econòmiques de fonts oficials i les desa a dades.json.
// S'executa a mà (`node scripts/actualitza.js`) o cada mes des de GitHub Actions.
// Fonts: FMI (World Economic Outlook, Global Debt Database i reserves d'or), OCDE (salaris),
// BIS (tipus d'interès, habitatge i balanç dels bancs centrals), BCE (diners en circulació),
// OCDE (bons a 10 anys, impostos sobre el sou), Eurostat, Banc Mundial i Idescat (immigració).
// Per provar-lo sense gastar consultes de l'OCDE (té límit per hora): SENSE_OCDE=1 node scripts/actualitza.js
// (conserva les dades de l'OCDE de l'última descàrrega).
// L'app llegeix només dades.json: així no depèn del CORS de cap servidor i funciona sense connexió.

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

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
// Països europeus per a les dades d'immigració (codi Eurostat; Grècia és EL)
const EU_GEO = {
  ESP: 'ES', DEU: 'DE', FRA: 'FR', ITA: 'IT', NLD: 'NL', BEL: 'BE', AUT: 'AT', PRT: 'PT', GRC: 'EL', IRL: 'IE',
  SWE: 'SE', POL: 'PL', CHE: 'CH', NOR: 'NO', EU: 'EU27_2020',
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
  // saldo primari (sense interessos): interessos pagats = saldo primari − saldo total (deficit)
  GGXONLB_G01_GDP_PT: 'primari',
};

async function get(url, as = 'json', intents = 3, espera = 5000, extra = {}) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...extra }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return as === 'json' ? await r.json() : await r.text();
    } catch (e) {
      if (i >= intents) {
        // Últim recurs: curl. L'OCDE retorna HTTP 500 a moltes peticions fetch de Node
        // (sobretot des de GitHub Actions) però respon bé a curl.
        try {
          const text = await curl(url, extra);
          console.warn('  (recuperat amb curl)', url.slice(0, 60));
          return as === 'json' ? JSON.parse(text) : text;
        } catch (e2) {
          throw new Error(`${url}: ${e.message} · curl: ${e2.message}`);
        }
      }
      await new Promise(res => setTimeout(res, espera * i));
    }
  }
}

function curl(url, extra = {}) {
  const args = ['-sS', '--fail', '--max-time', '90', '-A', UA['User-Agent']];
  for (const [k, v] of Object.entries(extra)) args.push('-H', `${k}: ${v}`);
  args.push(url);
  return new Promise((ok, ko) => execFile('curl', args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => err ? ko(err) : ok(stdout)));
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

// JSON-stat (Eurostat, Idescat) → [{dimensió: codi, ..., value}]
function jsonstat(j) {
  if (j.class === 'error' || j.error) throw new Error(JSON.stringify(j.error || j.label).slice(0, 150));
  const ids = j.id, size = j.size;
  const cats = ids.map(d => { const ix = j.dimension[d].category.index; return Array.isArray(ix) ? ix : Object.keys(ix).sort((a, b) => ix[a] - ix[b]); });
  const out = [];
  for (const [k, v] of Object.entries(j.value)) {
    if (v == null) continue;
    let n = +k; const rec = { value: v };
    for (let d = ids.length - 1; d >= 0; d--) { rec[ids[d]] = cats[d][n % size[d]]; n = Math.floor(n / size[d]); }
    rec.time = rec.time ?? rec.YEAR;
    out.push(rec);
  }
  return out;
}

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
  // L'OCDE té un límit de consultes per hora (HTTP 429) i dona errors 500 a fetch de Node: una sola consulta,
  // amb reintents i, al final, curl (vegeu get). Si tot falla, es conserven els sous de la descàrrega anterior.
  if (!process.env.SENSE_OCDE) try {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.ELS.SAE,DSD_EARNINGS@AV_AN_WAGE,1.0/all?startPeriod=${ANY0}&format=csvfilewithlabels`;
    const files = csv(await get(url, 'text', 2, 20000));
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

  // ════ El preu del deute i els impostos sobre el sou ════
  out.fiscal = {};

  // ── OCDE: rendiment del bo públic a 10 anys i índex de la borsa (mensual, una sola consulta) ──
  out.borsa = {};
  if (!process.env.SENSE_OCDE) try {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/.M.IRLT+SHARE.......?startPeriod=${ANY0}-01&format=csvfile`;
    const bons = {}, index = {};
    for (const f of csv(await get(url, 'text', 2, 20000))) {
      const k = f.REF_AREA === 'EA20' ? 'EURO' : f.REF_AREA;
      if (!(k in PAISOS || k === 'EURO') || f.OBS_VALUE === '' || f.OBS_VALUE === 'NaN') continue;
      if (f.MEASURE === 'IRLT') (bons[k] ||= {})[f.TIME_PERIOD] = r1(+f.OBS_VALUE);
      else if (f.MEASURE === 'SHARE') (index[k] ||= {})[f.TIME_PERIOD] = r1(+f.OBS_VALUE);
    }
    out.fiscal.bons = bons;
    out.fonts.bons = { font: 'OCDE · Long-term interest rates (bons a 10 anys)', unitat: '% anual, mitjana del mes' };
    if (Object.keys(index).length) {
      out.borsa.index = index;
      out.fonts.borsa = { font: 'OCDE · Share prices', unitat: 'Índex 2015 = 100' };
    }
    console.log('OCDE bons ok', Object.keys(bons).length, 'països · borsa', Object.keys(index).length);
  } catch (e) { console.warn('OCDE bons ha fallat:', e.message); }

  // ── Banc Mundial: valor de les empreses cotitzades en % del PIB ──
  try {
    const j = await get(`https://api.worldbank.org/v2/country/${Object.keys(PAISOS).join(';')}/indicator/CM.MKT.LCAP.GD.ZS?format=json&per_page=5000&date=${ANY0}:2030`);
    const cap = {};
    for (const r of j[1] || []) if (r.value != null) (cap[r.countryiso3code] ||= {})[r.date] = r1(r.value);
    out.borsa.capPib = cap;
    out.fonts.borsaCap = { font: 'Banc Mundial · Market capitalization of listed domestic companies', unitat: '% del PIB' };
    console.log('Banc Mundial borsa ok', Object.keys(cap).length);
  } catch (e) { console.warn('Banc Mundial borsa ha fallat:', e.message); }

  // ── Tipus a 2, 10 i 30 anys: EUA (Tresor), Japó (Ministeri d'Hisenda) i zona euro (BCE) ──
  out.llarg = {};
  const mitjanaMes = (llista) => { // [[AAAA-MM-DD, [v2, v10, v30]]] → {AAAA-MM: [m2, m10, m30]}
    const g = {};
    for (const [d, vs] of llista) { const k = d.slice(0, 7); const x = (g[k] ||= vs.map(() => [0, 0])); vs.forEach((v, i) => { if (v != null && !isNaN(v)) { x[i][0] += v; x[i][1]++; } }); }
    return Object.fromEntries(Object.entries(g).map(([k, x]) => [k, x.map(([s, n]) => n ? r1(s / n) : null)]));
  };
  try {
    // Cada any és un fitxer que triga uns 18 s: es reaprofiten els anys tancats de la descàrrega anterior
    let previ = {};
    try { previ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'dades.json'), 'utf8')).llarg?.USA || {}; } catch { }
    const anyActual = new Date().getFullYear();
    const files = [], guardats = {};
    for (let a = ANY0; a <= anyActual; a++) {
      const mesos = Object.keys(previ).filter(k => k.startsWith(a + '-'));
      if (a < anyActual - 1 && mesos.length === 12) { for (const k of mesos) guardats[k] = previ[k]; continue; }
      const t = await get(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${a}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${a}&page&_format=csv`, 'text');
      for (const f of csv(t)) {
        const [m, d, y] = f.Date.split('/');
        const n = k => f[k] === '' || f[k] == null ? null : +f[k];
        files.push([`${y}-${m}-${d}`, [n('2 Yr'), n('10 Yr'), n('30 Yr')]]);
      }
    }
    out.llarg.USA = Object.fromEntries(Object.entries({ ...guardats, ...mitjanaMes(files) }).sort());
    console.log('Tresor corba ok', Object.keys(out.llarg.USA).length, 'mesos');
  } catch (e) { console.warn('Tresor corba ha fallat:', e.message); }
  try {
    const base = 'https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/';
    const files = [];
    for (const t of [await get(base + 'historical/jgbcme_all.csv', 'text'), await get(base + 'jgbcme.csv', 'text')]) {
      const linies = t.split(/\r?\n/);
      const cap = linies.find(l => l.startsWith('Date,')).split(',');
      const i2 = cap.indexOf('2Y'), i10 = cap.indexOf('10Y'), i30 = cap.indexOf('30Y');
      for (const l of linies) {
        const c = l.split(','); const m = c[0].match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (!m || +m[1] < ANY0) continue;
        const n = v => v === '-' || v === '' || v == null ? null : +v;
        files.push([`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, [n(c[i2]), n(c[i10]), n(c[i30])]]);
      }
    }
    out.llarg.JPN = mitjanaMes(files);
    console.log('MoF Japó ok', Object.keys(out.llarg.JPN).length, 'mesos');
  } catch (e) { console.warn('MoF Japó ha fallat:', e.message); }
  try {
    const t = await get(`https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y+SR_10Y+SR_30Y?startPeriod=2004-09-01&format=csvdata`, 'text');
    const dies = {};
    const pos = { SR_2Y: 0, SR_10Y: 1, SR_30Y: 2 };
    for (const f of csv(t)) if (f.OBS_VALUE !== '') ((dies[f.TIME_PERIOD] ||= [null, null, null])[pos[f.DATA_TYPE_FM]] = +f.OBS_VALUE);
    out.llarg.EURO = mitjanaMes(Object.entries(dies));
    console.log('BCE corba ok', Object.keys(out.llarg.EURO).length, 'mesos');
  } catch (e) { console.warn('BCE corba ha fallat:', e.message); }
  out.fonts.llarg = { font: 'Tresor dels EUA · Ministeri d\'Hisenda del Japó · BCE (corba AAA de la zona euro)', unitat: '% anual, mitjana del mes' };

  // ── OCDE Taxing Wages: impostos d'un treballador sense fills que cobra el sou mitjà ──
  if (!process.env.SENSE_OCDE) try {
    const url = `https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_TAX_WAGES_COMP@DF_TW_COMP,2.1/.AV_ITR+NPATR+AV_TW+GEBT+NIAT..S_C0.AW100.....?startPeriod=${ANY0}&format=csvfile`;
    const CLAU = { AV_ITR: 'irpf', NPATR: 'irpfSS', AV_TW: 'cunya', GEBT: 'brut', NIAT: 'net' };
    const tw = {};
    for (const f of csv(await get(url, 'text', 2, 20000))) {
      const k = CLAU[f.MEASURE];
      if (!k || !(f.REF_AREA in PAISOS) || f.OBS_VALUE === '') continue;
      if ((k === 'brut' || k === 'net') && f.UNIT_MEASURE !== 'XDC') continue; // en moneda del país
      ((tw[f.REF_AREA] ||= {})[k] ||= {})[f.TIME_PERIOD] = k === 'brut' || k === 'net' ? Math.round(+f.OBS_VALUE) : r1(+f.OBS_VALUE);
    }
    out.fiscal.impostos = tw;
    out.fonts.impostos = { font: 'OCDE · Taxing Wages (treballador sense fills, sou mitjà)', unitat: '% del sou brut o del cost laboral' };
    console.log('OCDE impostos ok', Object.keys(tw).length, 'països');
  } catch (e) { console.warn('OCDE impostos ha fallat:', e.message); }

  // ════ El deute dels EUA i la "fontaneria" del sistema ════
  out.eua = {};

  // ── Tresor dels EUA: deute total (dada diària → últim dia de cada mes) ──
  try {
    const u = `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt,debt_held_public_amt&filter=record_date:gte:${ANY0}-01-01&sort=record_date&page[size]=10000`;
    const rows = (await get(u)).data;
    const deute = {};
    for (const r of rows) deute[r.record_date.slice(0, 7)] = [r1(+r.tot_pub_debt_out_amt / 1e9), r1(+r.debt_held_public_amt / 1e9)];
    const ult = rows[rows.length - 1];
    out.eua.deute = deute;
    out.eua.deuteUltim = [ult.record_date, r1(+ult.tot_pub_debt_out_amt / 1e9)];
    out.fonts.euaDeute = { font: 'Tresor dels EUA · Debt to the Penny', unitat: 'Milers de milions de dòlars' };
    console.log('Tresor deute ok', ult.record_date);
  } catch (e) { console.warn('Tresor deute ha fallat:', e.message); }

  // ── Tresor dels EUA (TIC): qui té bons del Tresor a l'estranger ──
  try {
    const base = 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/';
    const MES = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const NOMS = { 'Grand Total': 'TOTAL', 'For. Official': 'OFICIAL', 'Of Which: Foreign Official': 'OFICIAL' };
    const tenidors = {};
    const llegeix = text => {
      let periodes = null, mesos = null;
      for (const brut of text.split(/\r?\n/)) {
        const c = brut.split('\t').map(x => x.trim().replace(/^"|"$/g, ''));
        if (c.slice(1).filter(Boolean).every(x => MES[x]) && c.slice(1).some(Boolean)) { mesos = c; continue; }
        if (c[0] === 'Country') {
          periodes = c.map((x, i) => /^\d{4}-\d{2}$/.test(x) ? x : (/^\d{4}$/.test(x) && mesos?.[i] ? `${x}-${MES[mesos[i]]}` : null));
          continue;
        }
        if (!periodes || !c[0] || c[0].startsWith('-')) continue;
        const nom = NOMS[c[0]] || c[0];
        if (/^(Of Which|Notes|The data|Estimated|individual|overseas|International|as reported|and on)/.test(nom)) continue;
        for (let i = 1; i < c.length; i++) if (periodes[i] && c[i] !== '' && !isNaN(+c[i])) (tenidors[nom] ||= {})[periodes[i]] = +c[i];
      }
    };
    llegeix(await get(base + 'mfhhis01.txt', 'text'));   // històric
    llegeix(await get(base + 'slt_table5.txt', 'text'));  // últims 13 mesos (mana sobre l'històric)
    // Només els que avui tenen més de 100.000 milions, més els totals
    const ultimMes = Object.keys(tenidors.TOTAL || {}).sort().at(-1);
    out.eua.tenidors = Object.fromEntries(Object.entries(tenidors)
      .filter(([k, s]) => k === 'TOTAL' || k === 'OFICIAL' || (k !== 'All Other' && (s[ultimMes] || 0) >= 100)));
    out.fonts.euaTic = { font: 'Tresor dels EUA · Treasury International Capital (TIC)', unitat: 'Milers de milions de dòlars' };
    console.log('Tresor TIC ok', Object.keys(out.eua.tenidors).length, 'tenidors fins a', ultimMes);
  } catch (e) { console.warn('Tresor TIC ha fallat:', e.message); }

  // ── Fed de Nova York: diners aparcats al repo invers (el "coixí" de liquiditat) ──
  try {
    const avui = new Date().toISOString().slice(0, 10);
    const j = await get(`https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate=2013-09-01&endDate=${avui}`);
    const ops = (j.repo?.operations || []).filter(o => o.totalAmtAccepted != null).sort((a, b) => a.operationDate < b.operationDate ? -1 : 1);
    const mes = {};
    for (const o of ops) { const k = o.operationDate.slice(0, 7); (mes[k] ||= []).push(o.totalAmtAccepted / 1e9); }
    out.eua.rrp = Object.fromEntries(Object.entries(mes).map(([k, v]) => [k, r1(v.reduce((s, x) => s + x, 0) / v.length)]));
    const u = ops[ops.length - 1], mx = ops.reduce((m, o) => o.totalAmtAccepted > m.totalAmtAccepted ? o : m, ops[0]);
    out.eua.rrpUltim = [u.operationDate, r1(u.totalAmtAccepted / 1e9)];
    out.eua.rrpMax = [mx.operationDate, r1(mx.totalAmtAccepted / 1e9)];
    out.fonts.euaRrp = { font: 'Fed de Nova York · Reverse repo operations', unitat: 'Milers de milions de dòlars (mitjana del mes)' };
    console.log('Fed RRP ok', u.operationDate);
  } catch (e) { console.warn('Fed RRP ha fallat:', e.message); }

  // ── FMI: or mensual des del 2021, per veure les compres i vendes de l'any en curs ──
  try {
    const llista = [...Object.keys(PAISOS), ...Object.keys(OR_EXTRA)].join('+');
    const text = await get(`https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IRFCL/${llista}.IRFCLDT1_IRFCL56V_FTO.S1XS1311.M?startPeriod=2021-01`, 'text', 3, 5000,
      { Accept: 'application/vnd.sdmx.data+csv;version=1.0.0' });
    const orM = {};
    for (const f of csv(text)) {
      if (f.OBS_VALUE === '') continue;
      const t = +f.OBS_VALUE / 1e6 * 31.1035;
      if (t > 0 && t < 10000) (orM[f.COUNTRY] ||= {})[f.TIME_PERIOD.replace('-M', '-')] = Math.round(t);
    }
    out.altra.orMensual = orM;
    console.log('FMI or mensual ok', Object.keys(orM).length, 'països');
  } catch (e) { console.warn('FMI or mensual ha fallat:', e.message); }

  // ════ Demografia, pensions i habitatge nou (Eurostat) ════
  out.demo = {};
  try {
    const geos = Object.fromEntries(Object.entries(EU_GEO).map(([k, g]) => [g, k]));
    const q = Object.keys(geos).map(g => 'geo=' + g).join('&');
    const E = async (ds, params, fix = {}) => jsonstat(await get(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ds}?${q}&${params}`))
      .filter(r => Object.entries(fix).every(([d, v]) => r[d] === v));
    const demo = {};
    const put = (rows, clau, f = x => x) => { for (const r of rows) ((demo[geos[r.geo]] ||= {})[clau] ||= {})[r.time] = f(r.value); };
    put(await E('demo_pjanind', `indic_de=OLDDEP1&sinceTimePeriod=${ANY0}`), 'depVell');
    const anysProj = [2030, 2035, 2040, 2045, 2050, 2055, 2060, 2070, 2080, 2090, 2100].map(a => 'time=' + a).join('&');
    put(await E('proj_23ndbi', `indic_de=OLDDEP1&projection=BSL&${anysProj}`), 'depVellProj');
    put(await E('tps00103', `unit=PC_GDP&spdepm=TOTAL&spdepb=TOTAL&sinceTimePeriod=${ANY0}`), 'pensions');
    put(await E('demo_find', `indic_de=TOTFERRT&sinceTimePeriod=${ANY0}`), 'fecunditat');
    put(await E('demo_gind', `indic_de=GROW&sinceTimePeriod=${ANY0}`), 'creixPob');
    put(await E('ilc_lvph01', `unit=AVG&sinceTimePeriod=${ANY0}`), 'llar');
    put(await E('sts_cobp_a', `indic_bt=BPRM_DW&unit=THS&s_adj=NSA&sinceTimePeriod=${ANY0}`, { cpa2_1: 'CPA_F41001_X_410014' }), 'llicencies', v => Math.round(v * 1000));
    out.demo.eu = demo;
    out.fonts.demo = { font: 'Eurostat · demografia, projeccions (EUROPOP2023), despesa en pensions i llicències d\'obra', unitat: '' };
    console.log('Eurostat demografia ok', Object.keys(demo).length, 'països');
  } catch (e) { console.warn('Eurostat demografia ha fallat:', e.message); }


  // ════ Productivitat, inversió i renda de les llars (Eurostat) ════
  // Respon a la pregunta clau: el creixement ve de treballar més hores o de produir més per hora?
  out.prod = {};
  try {
    const geos = Object.fromEntries(Object.entries(EU_GEO).map(([k, g]) => [g, k]));
    const q = Object.keys(geos).map(g => 'geo=' + g).join('&');
    const E = async (ds, params) => jsonstat(await get(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ds}?${q}&sinceTimePeriod=${ANY0}&${params}`));
    const pr = {};
    const put = (rows, clau, f = x => x) => { for (const r of rows) ((pr[geos[r.geo]] ||= {})[clau] ||= {})[r.time] = f(r.value); };
    put(await E('nama_10_gdp', 'na_item=B1GQ&unit=CLV15_MEUR'), 'pibReal', Math.round);
    put(await E('nama_10_pe', 'na_item=POP_NC&unit=THS_PER'), 'pob', Math.round);
    put(await E('nama_10_pe', 'na_item=EMP_DC&unit=THS_PER'), 'ocupats', Math.round);
    put(await E('nama_10_a10_e', 'na_item=EMP_DC&unit=THS_HW&nace_r2=TOTAL'), 'hores', v => Math.round(v / 1000)); // milions d'hores
    // PIB en paritat de poder adquisitiu: dividit per les hores, dona la productivitat comparable entre països
    put(await E('nama_10_gdp', 'na_item=B1GQ&unit=CP_MPPS_EU27_2020'), 'pibPPA', Math.round);
    // inversió (formació bruta de capital fix) sobre el PIB, tots dos a preus corrents
    const inv = {}, pibN = {};
    for (const r of await E('nama_10_gdp', 'na_item=P51G&unit=CP_MEUR')) (inv[geos[r.geo]] ||= {})[r.time] = r.value;
    for (const r of await E('nama_10_gdp', 'na_item=B1GQ&unit=CP_MEUR')) (pibN[geos[r.geo]] ||= {})[r.time] = r.value;
    for (const c of Object.keys(inv)) for (const a of Object.keys(inv[c])) if (pibN[c]?.[a]) ((pr[c] ||= {}).inversio ||= {})[a] = r1(inv[c][a] / pibN[c][a] * 100);
    for (const c of Object.keys(pibN)) for (const a of Object.keys(pibN[c])) ((pr[c] ||= {}).pibNom ||= {})[a] = Math.round(pibN[c][a]);
    // renda de les llars: mitjana i mediana. La distància entre totes dues diu com es reparteix
    put(await E('ilc_di03', 'statinfo=MED_EI&unit=EUR&age=TOTAL&sex=T'), 'rendaMed', Math.round);
    put(await E('ilc_di03', 'statinfo=MEAN_EI&unit=EUR&age=TOTAL&sex=T'), 'rendaMitj', Math.round);
    out.prod.eu = pr;
    out.fonts.prod = { font: 'Eurostat · comptes nacionals (PIB, població, ocupació i hores), renda de les llars (EU-SILC)',
      unitat: 'Milions d\'euros del 2015 · milers de persones · milions d\'hores · % de la mitjana de la UE · % del PIB · euros l\'any' };
    console.log('Eurostat productivitat ok', Object.keys(pr).length, 'països');
  } catch (e) { console.warn('Eurostat productivitat ha fallat:', e.message); }

  // ════ Divises ════
  out.divises = {};
  try {
    const codis = { US: 'USD', XM: 'EUR', JP: 'JPY', CN: 'CNY', GB: 'GBP', CH: 'CHF' };
    const text = await get(`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_EER/1.0/M.N.B.${Object.keys(codis).join('+')}?startPeriod=${ANY0}-01&format=csv`, 'text');
    const eer = {};
    for (const f of csv(text)) if (f.OBS_VALUE !== '' && f.OBS_VALUE !== 'NaN') (eer[codis[f.REF_AREA]] ||= {})[f.TIME_PERIOD] = r1(+f.OBS_VALUE);
    out.divises.eer = eer;
    const ecb = csv(await get(`https://data-api.ecb.europa.eu/service/data/EXR/M.USD+JPY+GBP+CNY+CHF.EUR.SP00.A?startPeriod=${ANY0}-01&format=csvdata`, 'text'));
    const eur = {};
    for (const f of ecb) if (f.OBS_VALUE !== '') (eur[f.CURRENCY] ||= {})[f.TIME_PERIOD] = +(+f.OBS_VALUE).toFixed(4);
    out.divises.eur = eur;
    out.fonts.divises = { font: 'BIS · Effective exchange rates · BCE · tipus de canvi de l\'euro', unitat: 'Índex 2020 = 100 · unitats per euro' };
    console.log('Divises ok', Object.keys(eer).length, Object.keys(eur).length);
  } catch (e) { console.warn('Divises ha fallat:', e.message); }

  // ════ Immigració ════
  out.immi = {};

  // ── Eurostat: països europeus + mitjana de la UE ──
  try {
    const geos = Object.fromEntries(Object.keys(EU_GEO).map(k => [EU_GEO[k], k]));
    const q = Object.keys(geos).map(g => 'geo=' + g).join('&');
    const E = async (ds, params, fix = {}) => {
      const j = await get(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${ds}?${q}&sinceTimePeriod=${ANY0}&${params}`);
      return jsonstat(j).filter(r => Object.entries(fix).every(([d, v]) => r[d] === v));
    };
    const eu = {};
    const put = (rows, clau, dim, map) => {
      for (const r of rows) {
        const k = map ? map[r[dim]] : clau;
        if (!k) continue;
        ((eu[geos[r.geo]] ||= {})[k] ||= {})[r.time] = typeof r.value === 'number' && r.value % 1 ? r1(r.value) : r.value;
      }
    };
    put(await E('migr_pop3ctb', 'age=TOTAL&sex=T&unit=NR&c_birth=TOTAL&c_birth=FOR&c_birth=NEU27_2020_FOR'), null, 'c_birth',
      { TOTAL: 'pob', FOR: 'nascutsFora', NEU27_2020_FOR: 'nascutsForaUE' });
    put(await E('demo_gind', 'indic_de=CNMIGRATRT'), 'migNeta');
    put(await E('migr_eipre', 'citizen=TOTAL&age=TOTAL&sex=T&reason=TOTAL&apprehen=TOTAL'), 'irregulars');
    put(await E('migr_eiord', 'citizen=TOTAL&age=TOTAL&sex=T'), 'ordres');
    put(await E('migr_eirtn', 'citizen=TOTAL&age=TOTAL&sex=T&c_dest=TOTAL'), 'retorns');
    put(await E('migr_asyappctza', 'citizen=TOTAL&applicant=FRST&age=TOTAL&sex=T&unit=PER'), 'asil');
    put(await E('migr_resfirst', 'citizen=TOTAL&duration=TOTAL&unit=PER'), null, 'reason',
      { FAM: 'permisFamilia', EDUC: 'permisEstudis', EMP: 'permisFeina', OTH: 'permisAltres' });
    put(await E('lfsa_ergacob', 'age=Y20-64&sex=T&c_birth=NAT&c_birth=NEU27_2020_FOR', { unit: 'PC' }), null, 'c_birth',
      { NAT: 'ocupNat', NEU27_2020_FOR: 'ocupNoUE' });
    put(await E('lfsa_urgacob', 'age=Y20-64&sex=T&c_birth=NAT&c_birth=NEU27_2020_FOR', { unit: 'PC' }), null, 'c_birth',
      { NAT: 'aturNat', NEU27_2020_FOR: 'aturNoUE' });
    put(await E('ilc_li32', 'age=Y18-64&c_birth=NAT&c_birth=NEU27_2020_FOR', { sex: 'T', unit: 'PC' }), null, 'c_birth',
      { NAT: 'pobresaNat', NEU27_2020_FOR: 'pobresaNoUE' });
    // ocupació per sexe (llars amb un sol sou) i llars on gairebé no treballa ningú
    put((await E('lfsa_ergacob', 'age=Y20-64&sex=M&sex=F&c_birth=NAT&c_birth=NEU27_2020_FOR', { unit: 'PC' })).map(r => ({ ...r, k: r.sex + r.c_birth })), null, 'k',
      { MNAT: 'ocupHomesNat', MNEU27_2020_FOR: 'ocupHomesNoUE', FNAT: 'ocupDonesNat', FNEU27_2020_FOR: 'ocupDonesNoUE' });
    put(await E('ilc_lvhl16n', 'age=Y18-64&sex=T&unit=PC&c_birth=NAT&c_birth=NEU27_2020_FOR'), null, 'c_birth',
      { NAT: 'senseFeinaNat', NEU27_2020_FOR: 'senseFeinaNoUE' });
    out.immi.eu = eu;
    out.fonts.immiEU = { font: 'Eurostat · migració, asil, retorns, mercat laboral i pobresa per país de naixement', unitat: '' };
    console.log('Eurostat ok', Object.keys(eu).length, 'països');
  } catch (e) { console.warn('Eurostat ha fallat:', e.message); }

  // ── Ocupació per nacionalitat: afiliats a la Seguretat Social ÷ població de 16 a 64 anys (INE) ──
  // Cap enquesta oficial publica la taxa d'ocupació d'un país d'origen concret (el Marroc, Colòmbia...).
  // L'aproximem amb dues fonts oficials del MATEIX mes: afiliats mitjans (Seguretat Social, PxWeb) i
  // població per nacionalitat, sexe i edat (INE, Estadística Continua de Població, taula 56936).
  try {
    // [nom a l'INE, codi de país a la Seguretat Social, nom en català, bandera]
    const NACIONS = [
      ['Española', 724, 'Espanyola', '🇪🇸'], ['Marruecos', 504, 'Marroc', '🇲🇦'], ['Rumanía', 642, 'Romania', '🇷🇴'],
      ['Colombia', 170, 'Colòmbia', '🇨🇴'], ['Venezuela', 862, 'Veneçuela', '🇻🇪'], ['Italia', 380, 'Itàlia', '🇮🇹'],
      ['China', 156, 'Xina', '🇨🇳'], ['Reino Unido', 826, 'Regne Unit', '🇬🇧'], ['Ucrania', 804, 'Ucraïna', '🇺🇦'],
      ['Perú', 604, 'Perú', '🇵🇪'], ['Honduras', 340, 'Hondures', '🇭🇳'], ['Ecuador', 218, 'Equador', '🇪🇨'],
      ['Argentina', 32, 'Argentina', '🇦🇷'], ['Bulgaria', 100, 'Bulgària', '🇧🇬'], ['Portugal', 620, 'Portugal', '🇵🇹'],
      ['Paraguay', 600, 'Paraguai', '🇵🇾'], ['Bolivia', 68, 'Bolívia', '🇧🇴'], ['Brasil', 76, 'Brasil', '🇧🇷'],
      ['Cuba', 192, 'Cuba', '🇨🇺'], ['Nicaragua', 558, 'Nicaragua', '🇳🇮'], ['República Dominicana', 214, 'República Dominicana', '🇩🇴'],
      ['Argelia', 12, 'Algèria', '🇩🇿'], ['Senegal', 686, 'Senegal', '🇸🇳'], ['Pakistán', 586, 'Pakistan', '🇵🇰'],
      ['India', 356, 'Índia', '🇮🇳'], ['Filipinas', 608, 'Filipines', '🇵🇭'], ['Francia', 250, 'França', '🇫🇷'], ['Alemania', 276, 'Alemanya', '🇩🇪'],
    ];
    // 1 · població de 16 a 64 anys per nacionalitat i sexe (grups de 5 anys: el de 15-19 compta 4/5)
    const ine = await get('https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/56936?nult=1');
    const EDATS = { 'De 15 a 19 años': 0.8, 'De 20 a 24 años': 1, 'De 25 a 29 años': 1, 'De 30 a 34 años': 1, 'De 35 a 39 años': 1, 'De 40 a 44 años': 1,
      'De 45 a 49 años': 1, 'De 50 a 54 años': 1, 'De 55 a 59 años': 1, 'De 60 a 64 años': 1 };
    const pob = {}; let data = null;
    for (const s of ine) {
      const [ambit, nac, edat, sexe] = s.Nombre.split('. ').map(x => x.trim());
      const d = s.Data?.[0];
      if (ambit !== 'Total Nacional' || !(edat in EDATS) || sexe === 'Total' || !d) continue;
      const k = sexe === 'Hombres' ? 'H' : 'D';
      (pob[nac] ||= { H: 0, D: 0 })[k] += d.Valor * EDATS[edat];
      data ||= new Date(d.Fecha + 12 * 3600e3);   // l'INE dona la data a mitjanit hora espanyola
    }
    if (!data || !pob.Marruecos) throw new Error('INE: sense població per nacionalitat');
    const mesSS = `${data.getUTCFullYear()}${String(data.getUTCMonth() + 1).padStart(2, '0')}`;

    // 2 · afiliats mitjans d'aquell mes per país i sexe (formulari PxWeb de la Seguretat Social)
    const URL_SS = 'https://w6.seg-social.es/PXWeb/pxweb/es/Afiliados%20en%20alta%20laboral/Afiliados%20en%20alta%20laboral__Afiliados%20Medios%20Extranjeros/1m.%20Afiliados%20Total%20Sistema%20por%20sexo,%20tramo%20de%20edad%20y%20pais.px/';
    const dec = t => t.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
    const r0 = await fetch(URL_SS, { headers: UA, signal: AbortSignal.timeout(60000) });
    const cookie = (r0.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
    const html = await r0.text();
    const form = new URLSearchParams();
    for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = m[0].match(/name="([^"]+)"/)?.[1];
      if (name) form.append(name, dec(m[0].match(/value="([^"]*)"/)?.[1] ?? ''));
    }
    const sels = [...html.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)]
      .map(m => ({ name: m[1], opts: [...m[2].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</g)].map(o => ({ v: dec(o[1]), t: dec(o[2]).trim() })) }));
    const [sMes, sPais, sSexe, sEdat] = sels;
    const optMes = sMes?.opts.find(o => o.t === mesSS);
    if (!optMes) throw new Error('Seguretat Social: no hi ha el mes ' + mesSS);
    form.append(sMes.name, optMes.v);
    const codis = new Set(NACIONS.map(n => n[1]));
    for (const o of sPais.opts) if (o.t === 'TOTAL' || codis.has(parseInt(o.t))) form.append(sPais.name, o.v);
    for (const o of sSexe.opts) if (o.t === 'Mujer' || o.t === 'Varón') form.append(sSexe.name, o.v);
    form.append(sEdat.name, sEdat.opts.find(o => o.t === 'TOTAL EDAD').v);
    form.append('ctl00$ContentPlaceHolderMain$VariableSelector1$VariableSelector1$ButtonViewTable', 'Continuar');
    const r1 = await fetch(URL_SS, { method: 'POST', headers: { ...UA, cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(), redirect: 'manual', signal: AbortSignal.timeout(60000) });
    const loc = r1.headers.get('location');
    if (!loc) throw new Error('Seguretat Social: el formulari no ha respost (HTTP ' + r1.status + ')');
    const taula = await (await fetch(new URL(loc, URL_SS), { headers: { ...UA, cookie }, signal: AbortSignal.timeout(60000) })).text();
    const cel = [...taula.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(m => dec(m[1].replace(/<[^>]+>/g, '')).trim()).filter(Boolean);
    const iDona = cel.indexOf('Mujer'), iHome = cel.indexOf('Varón');
    if (iDona < 0 || iHome < 0) throw new Error('Seguretat Social: taula inesperada');
    const num = t => +t.replace(/\./g, '').replace(',', '.');
    const af = {};
    for (let i = 0; i < cel.length - 2; i++) {
      const codi = cel[i] === 'TOTAL' ? 'TOTAL' : /^\d+\.\s/.test(cel[i]) ? parseInt(cel[i]) : null;
      if (codi == null || isNaN(num(cel[i + 1])) || isNaN(num(cel[i + 2]))) continue;
      const [a, b] = [num(cel[i + 1]), num(cel[i + 2])];
      af[codi] = iDona < iHome ? { D: a, H: b } : { D: b, H: a };
    }

    // 3 · taxa aproximada = afiliats ÷ població de 16 a 64 anys
    const nac = {};
    for (const [ine_, codi, nom, flag] of NACIONS) {
      const p = pob[ine_], a = af[codi];
      if (!p || !a || p.H < 5000 || p.D < 5000) continue;   // col·lectius massa petits: soroll
      nac[codi === 724 ? 'ESP' : String(codi)] = { nom, flag, pobH: Math.round(p.H), pobD: Math.round(p.D), afH: Math.round(a.H), afD: Math.round(a.D) };
    }
    // tots els estrangers junts: afiliats totals menys els espanyols; població "Extranjera"
    if (af.TOTAL && af[724] && pob.Extranjera)
      nac.EXT = { nom: 'Tots els estrangers', flag: '🌍', pobH: Math.round(pob.Extranjera.H), pobD: Math.round(pob.Extranjera.D),
        afH: Math.round(af.TOTAL.H - af[724].H), afD: Math.round(af.TOTAL.D - af[724].D) };
    if (!nac.ESP || !nac['504']) throw new Error('falten dades d\'Espanya o del Marroc');
    out.immi.nac = { mes: `${mesSS.slice(0, 4)}-${mesSS.slice(4)}`, paisos: nac };
    out.fonts.immiNac = { font: 'Seguretat Social (afiliats mitjans per país i sexe) · INE (Estadística Continua de Població, per nacionalitat, sexe i edat)', unitat: 'persones' };
    console.log('Ocupació per nacionalitat ok', Object.keys(nac).length, 'nacionalitats,', mesSS);
  } catch (e) { console.warn('Ocupació per nacionalitat ha fallat:', e.message); }

  // ── Banc Mundial: immigrants al món i remeses que s'envien als països d'origen ──
  try {
    const mon = {};
    const llista = Object.keys(PAISOS).join(';');
    for (const [ind, clau] of [['SM.POP.TOTL.ZS', 'estoc'], ['BM.TRF.PWKR.CD.DT', 'remesesEnviades'], ['BX.TRF.PWKR.CD.DT', 'remesesRebudes']]) {
      const j = await get(`https://api.worldbank.org/v2/country/${llista}/indicator/${ind}?format=json&per_page=5000&date=${ANY0}:2030`);
      for (const r of j[1] || []) if (r.value != null) ((mon[r.countryiso3code] ||= {})[clau] ||= {})[r.date] = clau === 'estoc' ? r1(r.value) : Math.round(r.value / 1e6);
    }
    out.immi.mon = mon;
    out.fonts.immiMon = { font: 'Banc Mundial · migrant stock i remeses', unitat: '% de la població · milions de $' };
    console.log('Banc Mundial ok');
  } catch (e) { console.warn('Banc Mundial ha fallat:', e.message); }

  // ── Idescat: població nascuda a l'estranger a cada municipi i comarca de Catalunya ──
  // La taula del padró va del 2000 al 2022; l'app hi afegeix en directe l'última dada (EMEX).
  try {
    const arbre = await get('https://api.idescat.cat/emex/v1/nodes.json?lang=ca');
    const mun = {}, com = {};
    for (const c of [arbre.fitxes.v.v].flat()) {
      if (c.scheme !== 'com') continue;
      com[c.id] = c.content || c.id;
      for (const m of [c.v].flat()) if (m?.scheme === 'mun') mun[m.id] = [m.content, c.id];
    }
    const anys = [2000, 2005, 2010, 2015, 2020, 2022];
    const dades = { mun: {}, com: {} };
    for (const geo of ['mun', 'com']) for (const a of anys) {
      const j = await get(`https://api.idescat.cat/taules/v2/pmh/674/684/${geo}/data?lang=ca&PBIRTH=ESTR,TOTAL&YEAR=${a}`);
      for (const r of jsonstat(j)) {
        const id = r.MUN || r.COM;
        const d = ((dades[geo][id] ||= {})[a] ||= [0, 0]);
        d[r.PBIRTH === 'ESTR' ? 0 : 1] = r.value;
      }
    }
    out.immi.cat = { mun, com, anys, dades };
    out.fonts.immiCat = { font: 'Idescat · Padró municipal (població per lloc de naixement)', unitat: 'Persones' };
    console.log('Idescat ok', Object.keys(mun).length, 'municipis', Object.keys(com).length, 'comarques');
  } catch (e) { console.warn('Idescat ha fallat:', e.message); }

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
    for (const c of ['index', 'capPib']) if (!out.borsa[c] && vell.borsa?.[c]) out.borsa[c] = vell.borsa[c];
    if (!out.fonts.borsa && vell.fonts.borsa) out.fonts.borsa = vell.fonts.borsa;
    if (!out.fonts.borsaCap && vell.fonts.borsaCap) out.fonts.borsaCap = vell.fonts.borsaCap;
    for (const c of ['USA', 'JPN', 'EURO']) if (!out.llarg[c] && vell.llarg?.[c]) out.llarg[c] = vell.llarg[c];
    if (!out.demo.eu && vell.demo?.eu) { out.demo.eu = vell.demo.eu; out.fonts.demo = vell.fonts.demo; }
    if (!out.prod.eu && vell.prod?.eu) { out.prod.eu = vell.prod.eu; out.fonts.prod = vell.fonts.prod; }
    for (const c of ['eer', 'eur']) if (!out.divises[c] && vell.divises?.[c]) { out.divises[c] = vell.divises[c]; out.fonts.divises = vell.fonts.divises; }
    for (const [c, f] of [['deute', 'euaDeute'], ['deuteUltim', null], ['tenidors', 'euaTic'], ['rrp', 'euaRrp'], ['rrpUltim', null], ['rrpMax', null]])
      if (!out.eua[c] && vell.eua?.[c]) { out.eua[c] = vell.eua[c]; if (f) out.fonts[f] = vell.fonts[f]; }
    if (!out.altra.orMensual && vell.altra?.orMensual) out.altra.orMensual = vell.altra.orMensual;
    for (const [c, f] of [['bons', 'bons'], ['impostos', 'impostos']]) if (!out.fiscal[c] && vell.fiscal?.[c]) { out.fiscal[c] = vell.fiscal[c]; out.fonts[f] = vell.fonts[f]; }
    for (const [c, f] of [['eu', 'immiEU'], ['mon', 'immiMon'], ['cat', 'immiCat'], ['nac', 'immiNac']]) if (!out.immi[c] && vell.immi?.[c]) { out.immi[c] = vell.immi[c]; out.fonts[f] = vell.fonts[f]; }
  }
  if (!out.paisos.USA.s.pib) throw new Error('Les dades del FMI han arribat buides; no es desa res.');

  fs.writeFileSync(fitxer, JSON.stringify(out));
  console.log('Desat', fitxer, (fs.statSync(fitxer).size / 1024).toFixed(0), 'KB');
}

main().catch(e => { console.error(e); process.exit(1); });
