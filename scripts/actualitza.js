// Baixa les dades econòmiques de fonts oficials i les desa a dades.json.
// S'executa a mà (`node scripts/actualitza.js`) o cada mes des de GitHub Actions.
// Fonts: FMI (World Economic Outlook, Global Debt Database i reserves d'or), OCDE (salaris),
// BIS (tipus d'interès, habitatge i balanç dels bancs centrals) i BCE (diners en circulació).
// Per provar-lo sense gastar consultes de l'OCDE (té límit per hora): SENSE_OCDE=1 node scripts/actualitza.js
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
    out.immi.eu = eu;
    out.fonts.immiEU = { font: 'Eurostat · migració, asil, retorns, mercat laboral i pobresa per país de naixement', unitat: '' };
    console.log('Eurostat ok', Object.keys(eu).length, 'països');
  } catch (e) { console.warn('Eurostat ha fallat:', e.message); }

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
    for (const [c, f] of [['eu', 'immiEU'], ['mon', 'immiMon'], ['cat', 'immiCat']]) if (!out.immi[c] && vell.immi?.[c]) { out.immi[c] = vell.immi[c]; out.fonts[f] = vell.fonts[f]; }
  }
  if (!out.paisos.USA.s.pib) throw new Error('Les dades del FMI han arribat buides; no es desa res.');

  fs.writeFileSync(fitxer, JSON.stringify(out));
  console.log('Desat', fitxer, (fs.statSync(fitxer).size / 1024).toFixed(0), 'KB');
}

main().catch(e => { console.error(e); process.exit(1); });
