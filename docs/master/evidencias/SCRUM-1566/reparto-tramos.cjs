// docs/master/evidencias/SCRUM-1566/reparto-tramos.cjs — SCRUM-1566 tramo (e), J1, 30-oct-2026
//
// DÓNDE NACE EL CÉNTIMO EN LOS TRAMOS. Sólo lee `dist/` (con la simulación de `sonda-e.cjs`). Las
// muestras NO se copian: el texto de `muestra` y `muestraB` se saca de los propios tests, así que la
// población es la de los techos por construcción. Control sin simular: tienen que salir 18·18·14 y 23·31·43.
//
//   SIM=C,D node --require ./docs/master/evidencias/SCRUM-1566/sonda-e.cjs docs/master/evidencias/SCRUM-1566/reparto-tramos.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const raiz = process.cwd();
const U = require(path.join(raiz, 'dist/core/utils/utils.js'));
const V = require(path.join(raiz, 'dist/modules/invoicing/domain/vat.service.js'));
const IL = require(path.join(raiz, 'dist/modules/invoicing/domain/invoiceLines.service.js'));
const BP = require(path.join(raiz, 'dist/modules/quotes/domain/billingPlan.js'));
const SIM = String(process.env.SIM || '');
const DETALLE = process.env.DETALLE === '1';

function sacar(fichero, nombre) {
  const src = fs.readFileSync(path.join(raiz, 'tests', fichero), 'utf8');
  const i = src.indexOf(`function ${nombre}(`);
  const f = src.indexOf('\n}\n', i);
  if (i < 0 || f < 0) throw new Error(`CIEGO: no encuentro ${nombre} en ${fichero}`);
  return new Function('calcTotal', 'descuentoGlobalEnCentimos', `${src.slice(i, f + 2)}\nreturn ${nombre};`)(
    (...a) => U.calcTotal(...a), U.descuentoGlobalEnCentimos);
}
const muestra = sacar('scrum887-el-cobro-es-lo-firmado.test.mjs', 'muestra');
const muestraB = sacar('scrum887b-descuento-global.test.mjs', 'muestraB');

const c = (n) => Math.round(n * 100);
const P = (...p) => p.map((x, i) => ({ index: i, percentage: x, label: String(i) }));
const PLANES = { entero: P(1), '50/50': P(0.5, 0.5), '30/70': P(0.3, 0.7) };
const PLAN3 = P(0.3, 0.3, 0.4);

function facturas(q, plan) {
  const lineas = IL.lineasParaFacturar(q);
  const obj = BP.distributeStageAmounts(q.total, plan);
  return { lineas, obj, ls: plan.map((_, i) => IL.stageLinesReconciled(lineas, plan, i, obj[i])) };
}
const distintos = (q, plan) => {
  const f = facturas(q, plan);
  return f.ls.reduce((a, l) => a + c(IL.grossOfLines(l)), 0) !== c(Number(q.total));
};

// ¿Algún precio de la última línea da ese bruto? Ventana y paso 10 y 5 veces los de `reconcileToTarget`.
function alcanzable(ls, objetivoC) {
  const k = ls.length - 1;
  const qty = V.cantidadDeLinea(ls[k].qty);
  for (let i = -5000; i <= 5000; i++) {
    const prueba = [...ls.slice(0, k), { ...ls[k], price: Number(ls[k].price) + (i * 0.0001) / qty }];
    if (c(IL.grossOfLines(prueba)) === objetivoC) return true;
  }
  return false;
}

function diagnostico(nombre, quotes, plan) {
  const r = {
    poblacion: quotes.length, distintos: 0, sumaObjetivosRota: 0, ventanaLoImpedia: 0,
    firmadoEsCanonico: 0, firmadoNoEsCanonico: 0, cae: { tramo1: 0, ultimo: 0, ambos: 0 }, porTipo: {},
    sinReconciliar: 0, maxDesv: 0, parejaD: {}, sinPareja: 0, derivaSplitMax: 0, indices: new Set(),
  };
  quotes.forEach((q, i) => {
    const f = facturas(q, plan);
    const suma = f.obj.reduce((a, x) => a + c(x), 0);
    if (suma !== c(Number(q.total))) r.sumaObjetivosRota++;
    const crudas = plan.map((_, k) => IL.stageLines(f.lineas, plan, k));
    if (crudas.reduce((a, l) => a + c(IL.grossOfLines(l)), 0) !== c(Number(q.total))) r.sinReconciliar++;
    const deriva = Math.abs(crudas.flat().reduce((a, l) => a + Number(l.qty) * Number(l.price), 0)
      - f.lineas.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0));
    r.derivaSplitMax = Math.max(r.derivaSplitMax, deriva);
    const reales = f.ls.map((l) => c(IL.grossOfLines(l)));
    if (reales.reduce((a, b) => a + b, 0) === c(Number(q.total))) return;
    r.distintos++; r.indices.add(i);
    r.maxDesv = Math.max(r.maxDesv, Math.abs(reales.reduce((a, b) => a + b, 0) - c(Number(q.total))));
    if (c(IL.grossOfLines(f.lineas)) === c(Number(q.total))) r.firmadoEsCanonico++; else r.firmadoNoEsCanonico++;
    const fallan = reales.map((g, k) => g !== c(f.obj[k]));
    if (fallan[0] && fallan[fallan.length - 1]) r.cae.ambos++; else if (fallan[0]) r.cae.tramo1++; else r.cae.ultimo++;
    const tipos = [...new Set(f.lineas.map((l) => `${Math.round(Number(l.tax) * 100)}%`))].sort().join('+');
    r.porTipo[tipos] = (r.porTipo[tipos] || 0) + 1;
    fallan.forEach((x, k) => { if (x && alcanzable(crudas[k], c(f.obj[k]))) r.ventanaLoImpedia++; });
    // ¿Existe un reparto de PAREJA alcanzable que sume lo firmado? (2 tramos; desvío ±5 cént.)
    if (plan.length === 2) {
      let hallado = null;
      for (const d of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
        const a = c(f.obj[0]) + d;
        const b = c(f.obj[1]) - d;
        if (c(IL.grossOfLines(IL.reconcileToTarget(crudas[0], a / 100))) === a
          && c(IL.grossOfLines(IL.reconcileToTarget(crudas[1], b / 100))) === b) { hallado = d; break; }
      }
      if (hallado === null) r.sinPareja++; else r.parejaD[Math.abs(hallado)] = (r.parejaD[Math.abs(hallado)] || 0) + 1;
    }
  });
  return r;
}

const fila = (o) => JSON.stringify(o, (k, v) => (v instanceof Set ? undefined : v));
console.log(`SIM=[${SIM}]`);

// CONTROLES: si la simulación no entró, lo dice el caso que la motivó.
const lin225 = [{ concept: 'x', qty: 1, price: 22.5, tax: 0.21 }];
const lin9451 = [{ concept: 'x', qty: 2.5, price: 36.35, tax: 0.04 }];
const cuota = V.calcVatBreakdown(lin225).cuota;
assert.equal(cuota, SIM.includes('C') ? 4.73 : 4.72, 'CIEGO: la C simulada no es la que dice SIM');
assert.equal(c(U.calcTotal(lin9451, null)), SIM.includes('D') ? 9452 : 9451,
  'CIEGO: la D simulada no es la que dice SIM');

const B = muestraB(8870, 2000);
const cuenta = (q, plan) => q.filter((x) => distintos(x, plan)).length;
const techoB = { entero: 23, '50/50': 31, '30/70': 43 };
const fBs = Object.entries(PLANES).map(([n, p]) => `${n}=${cuenta(B, p)}/${techoB[n]}`);
const techoA = { SIN: 18, A_uno: 18, A_mixto: 14 };
const fAs = Object.keys(techoA).map((t) => `${t}=${cuenta(muestra(887, 2000, t), PLANES.entero)}/${techoA[t]}`);
console.log(`TECHOS 887 entero: ${fAs.join(' · ')}`);
console.log(`TECHOS 887b      : ${fBs.join(' · ')}`);

// Población sin techo: 3 tramos, y SIN global en 2 tramos (¿es cosa del descuento global?).
const sinGlobal = B.map((q) => ({ lines: q.lines, discountGlobalAmount: null, total: U.calcTotal(q.lines, null).toFixed(2) }));
const A_uno = muestra(887, 2000, 'A_uno');
const A_mixto = muestra(887, 2000, 'A_mixto');
const SIN = muestra(887, 2000, 'SIN');
console.log(`3 TRAMOS 30/30/40: B=${cuenta(B, PLAN3)} · SIN=${cuenta(SIN, PLAN3)}`);
for (const [n, p] of [['50/50', PLANES['50/50']], ['30/70', PLANES['30/70']]]) {
  console.log(`SIN GLOBAL ${n}: mismas líneas de B=${cuenta(sinGlobal, p)} · SIN=${cuenta(SIN, p)} · A_uno=${cuenta(A_uno, p)} · A_mixto=${cuenta(A_mixto, p)} (de 2.000 cada una)`);
}

if (process.env.DUMP) {
  const volcado = {};
  for (const [m, qs] of [['B', B], ['SIN', SIN], ['A_uno', A_uno]]) {
    for (const [n, p] of [['50/50', PLANES['50/50']], ['30/70', PLANES['30/70']]]) {
      volcado[`${m} ${n}`] = qs.map((q) => { const f = facturas(q, p); return { t: c(Number(q.total)), o: f.obj.map(c), g: f.ls.map((l) => c(IL.grossOfLines(l))) }; });
    }
  }
  fs.writeFileSync(process.env.DUMP, JSON.stringify(volcado));
}

if (DETALLE) {
  for (const [n, p] of [['50/50', PLANES['50/50']], ['30/70', PLANES['30/70']]]) {
    const d = diagnostico('B', B, p);
    const s = diagnostico('sinGlobal', sinGlobal, p);
    const ambos = [...d.indices].filter((i) => s.indices.has(i)).length;
    console.log(`DIAG B ${n}: ${fila(d)}`);
    console.log(`DIAG mismas líneas SIN global ${n}: ${fila(s)}`);
    console.log(`CONJUNTOS ${n}: con global ${d.indices.size} · sin global ${s.indices.size} · en los dos ${ambos}`);
  }
  // CONTROL POSITIVO SEMBRADO del diagnóstico: 1 línea al 4 % cuyo objetivo cae en el hueco del escalón.
  const sem = [{ concept: 'x', qty: 1, price: 12.5 / 100, tax: 0.04 }];
  const g = (x) => c(IL.grossOfLines([{ ...sem[0], price: x }]));
  const vistos = new Set(); for (let x = 0; x <= 0.3; x += 0.00001) vistos.add(g(x));
  const huecos = []; for (let k = 0; k <= 30; k++) if (!vistos.has(k)) huecos.push(k);
  console.log(`SEMBRADO 4 %, bruto de 0 a 0,30 €: inalcanzables (cént.) ${huecos.join(',') || 'NINGUNO'} · vistos ${vistos.size}`);
  const barre = (t) => { const v = new Set(); for (let x = 0; x <= 12; x += 0.00013) v.add(c(IL.grossOfLines([{ qty: 1, price: x, tax: t }]))); const max = Math.max(...v); return `${(max + 1 - v.size)} huecos en ${max + 1}`; };
  console.log(`ESCALÓN 0-12 €: 21 % ${barre(0.21)} · 10 % ${barre(0.10)} · 4 % ${barre(0.04)} · 0 % ${barre(0)}`);
}
