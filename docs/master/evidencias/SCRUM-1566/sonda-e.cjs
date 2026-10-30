// docs/master/evidencias/SCRUM-1566/sonda-e.cjs — SCRUM-1566 tramo (e), J1, 30-oct-2026
//
// SIMULA C, D y E SIN CONSTRUIRLAS. No escribe NADA en `src/` ni en `dist/`: reescribe en MEMORIA, al
// cargar, el texto de `vat.service.js` e `invoiceLines.service.js`. Se carga con `node --require <esto>`
// desde la raíz de un árbol con `dist/` compilado. SIM es una lista: `SIM=C,D,E2`.
//
//   C  → el `round2` de c.21028: `Math.round(Number((n * 100).toPrecision(15))) / 100`
//   D  → `sonda-d.cjs` de S1, variante 1 (`calcTotal` = base + cuota de `calcVatBreakdown`)
//   D2 → `sonda-d.cjs`, variante 2 (`calcTotal` = `grossOfLines(lineasParaFacturar(...))`: lo firmado
//        es el bruto de las MISMAS líneas que se facturan, también con descuento global)
//   E1 → el último tramo se reconcilia contra «bruto de las líneas − lo que YA dieron los anteriores»
//   E2 → E1 y, además, si el penúltimo tramo o el último no alcanzan su importe, se prueba d = ±1..±5
//        céntimos en el penúltimo hasta encontrar una PAREJA alcanzable que sume lo mismo
//   F  → `reconcileToTarget`: si su ventana (±0,05 €, paso 0,0005) no alcanza, una segunda pasada más
//        fina (±0,25 €, paso 0,00005) antes de rendirse. Lo que ya alcanzaba no cambia
//
// E1/E2 sustituyen `stageLinesReconciled` conservando su firma. Con d = 0 y todo alcanzable dan
// exactamente lo de hoy. Sin plan de 2+ tramos o sin `targetGross`, llaman a la original.
const path = require('node:path');
const Module = require('node:module');

const SIM = String(process.env.SIM || '').split(',').map((s) => s.trim()).filter(Boolean);
for (const s of SIM) if (!['C', 'D', 'D2', 'E1', 'E2', 'F'].includes(s)) throw new Error(`CIEGO: SIM desconocida ${s}`);
const E = SIM.includes('E2') ? 2 : SIM.includes('E1') ? 1 : 0;

const VIEJO = 'Math.round(n * 100) / 100';
const NUEVO = 'Math.round(Number((n * 100).toPrecision(15))) / 100';
const CUERPO_E = `
function __centimos(n) { return Math.round(n * 100); }
function __planE(lines, plan) {
  const n = plan.length;
  const G = __centimos(grossOfLines(lines));
  const t = []; let acc0 = 0;
  for (let i = 0; i < n - 1; i++) { const c = Math.round(G * plan[i].percentage); t.push(c); acc0 += c; }
  t.push(G - acc0);
  const out = []; let acc = 0;
  for (let j = 0; j < n - 2; j++) {
    const ls = reconcileToTarget(stageLines(lines, plan, j), t[j] / 100);
    out.push(ls); acc += __centimos(grossOfLines(ls));
  }
  const pen = n - 2; const ult = n - 1;
  const desvios = ${E} === 2 ? [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5] : [0];
  let reserva = null;
  for (const d of desvios) {
    const a = reconcileToTarget(stageLines(lines, plan, pen), (t[pen] + d) / 100);
    const ga = __centimos(grossOfLines(a));
    if (${E} === 2 && ga !== t[pen] + d) continue;
    const resto = G - acc - ga;
    const b = reconcileToTarget(stageLines(lines, plan, ult), resto / 100);
    const res = [...out, a, b];
    if (__centimos(grossOfLines(b)) === resto) return res;
    if (!reserva) reserva = res;
  }
  return reserva;
}
function __E(lines, plan, i, targetGross) {
  if (targetGross == null || !Array.isArray(plan) || plan.length < 2) return __orig_slr(lines, plan, i, targetGross);
  // Sólo actúa si el importe que le pasan es el reparto del bruto de las líneas. Un presupuesto cuyo
  // total guardado no es ese bruto (uno anterior a D) sigue exactamente como hoy.
  const G = __centimos(grossOfLines(lines));
  const previos = plan.slice(0, -1).reduce((a, s) => a + Math.round(G * s.percentage), 0);
  const suyo = i < plan.length - 1 ? Math.round(G * plan[i].percentage) : G - previos;
  if (__centimos(targetGross) !== suyo) return __orig_slr(lines, plan, i, targetGross);
  const r = __planE(lines, plan);
  return r ? r[i] : __orig_slr(lines, plan, i, targetGross);
}
`;

const compilar = Module.prototype._compile;
const tocados = new Set();
Module.prototype._compile = function (src, filename) {
  const f = String(filename).replace(/\\/g, '/');
  let s = src;
  const esVat = f.endsWith('dist/modules/invoicing/domain/vat.service.js');
  const esLineas = f.endsWith('dist/modules/invoicing/domain/invoiceLines.service.js');
  if (SIM.includes('C') && (esVat || esLineas)) {
    if (!s.includes(VIEJO)) throw new Error(`CIEGO: no encuentro el round2 en ${f}`);
    s = s.split(VIEJO).join(NUEVO);
    tocados.add(`C:${path.basename(f)}`);
  }
  if (SIM.includes('F') && esLineas) {
    const fin = 'return src; // inalcanzable';
    if (!s.includes(fin)) throw new Error('CIEGO: no encuentro la salida de reconcileToTarget');
    s = s.replace(fin, `for (let k = 1; k <= 5000; k++) { for (const signo of [1, -1]) {
      const candidato = { ...last, price: basePrice + (signo * k * 0.00005) / qty };
      const prueba = [...src.slice(0, lastIdx), candidato];
      if (grossOfLines(prueba) === target) return prueba;
    } }
    return src; // inalcanzable`);
    tocados.add('F');
  }
  if (E && esLineas) {
    const firma = 'function stageLinesReconciled(';
    if (!s.includes(firma)) throw new Error('CIEGO: no encuentro stageLinesReconciled');
    s = s.replace(firma, 'function stageLinesReconciled(a,b,c,d){return __E(a,b,c,d)}\nfunction __orig_slr(') + CUERPO_E;
    tocados.add('E');
  }
  return compilar.call(this, s, filename);
};

const raiz = process.cwd();
for (const m of ['core/utils/utils', 'modules/invoicing/domain/vat.service', 'modules/invoicing/domain/invoiceLines.service']) {
  require(path.join(raiz, 'dist', `${m}.js`));
}
if (SIM.includes('C') && tocados.size < 2) throw new Error(`CIEGO: C no entró en los dos ficheros: ${[...tocados]}`);
if (E && !tocados.has('E')) throw new Error('CIEGO: E no entró');
if (SIM.includes('D') || SIM.includes('D2')) {
  process.env.SONDA_D = SIM.includes('D2') ? '2' : '1';
  require(path.join(__dirname, 'sonda-d.cjs'));
}
module.exports = { SIM, tocados: [...tocados] };
