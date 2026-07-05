// scripts/voice-eval.mjs — VZ-2 (VOZ-1, master U1.5): eval del pipe dictado→líneas.
// 10 transcripciones FIJAS (aprobadas por el fundador, 5-jul-2026) contra el catálogo
// del merchant demo (id=1, Fontanería García). GATE DURO: ≥8/10 casos OK con ≥80% de
// líneas correctas por caso — si no pasa, la voz NO entra en la maqueta ni en la demo.
//
// Uso local:   node scripts/voice-eval.mjs        (ANTHROPIC_API_KEY y BD en .env)
// Uso remoto:  EVAL_REMOTE=1 EVAL_COOKIE="pf_session=..." node scripts/voice-eval.mjs
//              → llama al endpoint DESPLEGADO /admin/ai/suggest-quote en yaqu.app
//              (misma ruta de código que usará el micro; la key vive en Railway).
// Salida commiteada: docs/evidencias/voice-eval/RESULTS.md + results.json
import fs from 'node:fs';
import path from 'node:path';

const REMOTE = process.env.EVAL_REMOTE === '1';
const EVAL_BASE = process.env.EVAL_BASE || 'https://yaqu.app';
const EVAL_COOKIE = process.env.EVAL_COOKIE || '';

let suggestQuoteLines;
if (REMOTE) {
  if (!EVAL_COOKIE) { console.error('EVAL_REMOTE=1 requiere EVAL_COOKIE (pf_session=…)'); process.exit(2); }
  suggestQuoteLines = async ({ description }) => {
    const r = await fetch(`${EVAL_BASE}/admin/ai/suggest-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: EVAL_COOKIE },
      body: JSON.stringify({ description }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return (await r.json()).lines;
  };
} else {
  ({ suggestQuoteLines } = await import('../dist/modules/ai/domain/ai.service.js'));
}

const MERCHANT_ID = 1; // demo Fontanería García (regla 8)
const OUT_DIR = 'docs/evidencias/voice-eval';

// ── Casos fijos ──────────────────────────────────────────────────────────────
// expected: líneas que DEBEN estar. match por claves (todas las palabras clave en el
// concepto, normalizado), precio (exacto si catalogPrice; ±30% si free; exacto si
// dictatedPrice) y qty exacta. Un caso pasa con ≥80% de sus líneas correctas y sin
// más de (esperadas+2) líneas totales (anti-invención).
const CASES = [
  {
    id: 1,
    say: 'cambio de termo de 80 litros y desplazamiento',
    expected: [
      { keys: ['termo'], catalogPrice: 240, qty: 1 },
      { keys: ['desplazamiento'], free: true, qty: 1 },
    ],
  },
  {
    id: 2,
    say: 'ponme un grifo monomando nuevo en la cocina y una hora de mano de obra',
    expected: [
      { keys: ['grifo', 'monomando'], catalogPrice: 65, qty: 1 },
      { keys: ['mano de obra'], catalogPrice: 35, qty: 1 },
    ],
  },
  {
    id: 3,
    say: 'el desagüe del baño está atascado otra vez hay que desatascar la tubería y de paso una revisión general',
    expected: [
      { keys: ['desatasco'], catalogPrice: 90, qty: 1 },
      { keys: ['revisión'], catalogPrice: 45, qty: 1 },
    ],
  },
  {
    id: 4,
    say: 'se ha roto la cisterna del váter del bar ponme cambiarla entera y dos horas de mano de obra',
    expected: [
      { keys: ['cisterna'], catalogPrice: 85, qty: 1 },
      { keys: ['mano de obra'], catalogPrice: 35, qty: 2 },
    ],
  },
  {
    id: 5,
    say: 'tengo una fuga debajo del fregadero mira ponme la reparación y si eso una hora de mano de obra por si acaso',
    expected: [
      { keys: ['fuga'], catalogPrice: 75, qty: 1 },
      { keys: ['mano de obra'], catalogPrice: 35, qty: 1 },
    ],
  },
  {
    id: 6,
    say: 'instalar un lavabo nuevo con su grifería en el aseo de arriba',
    expected: [{ keys: ['lavabo'], catalogPrice: 160, qty: 1 }],
  },
  {
    id: 7,
    say: 'eh mira apúntame revisión general de la fontanería del piso de la calle mayor y el desatasco de la tubería de la cocina',
    expected: [
      { keys: ['revisión'], catalogPrice: 45, qty: 1 },
      { keys: ['desatasco'], catalogPrice: 90, qty: 1 },
    ],
  },
  {
    id: 8,
    say: 'un termo eléctrico nuevo que el viejo ya no calienta y quitar el viejo son dos horas de mano de obra más o menos',
    expected: [
      { keys: ['termo'], catalogPrice: 240, qty: 1 },
      { keys: ['mano de obra'], catalogPrice: 35, qty: 2 },
    ],
  },
  {
    id: 9,
    say: 'ponme tres horas de mano de obra para la reforma del baño y unos doscientos euros de material de fontanería',
    expected: [
      { keys: ['mano de obra'], catalogPrice: 35, qty: 3 },
      { keys: ['material'], dictatedPrice: 200, qty: 1 },
    ],
  },
  {
    id: 10,
    say: 'cambiar dos grifos monomando uno en la cocina y otro en el baño',
    expected: [{ keys: ['grifo', 'monomando'], catalogPrice: 65, qty: 2 }],
  },
];

// ── Scoring ──────────────────────────────────────────────────────────────────
const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, ''); // sin tildes

function lineMatches(expected, line) {
  const c = norm(line.concept);
  if (!expected.keys.every((k) => c.includes(norm(k)))) return { ok: false };
  const qtyOk = Number(line.qty) === expected.qty;
  let priceOk;
  if (expected.catalogPrice != null) priceOk = Math.abs(Number(line.price) - expected.catalogPrice) < 0.01;
  else if (expected.dictatedPrice != null) priceOk = Math.abs(Number(line.price) - expected.dictatedPrice) < 0.01;
  else priceOk = Number(line.price) > 0 && Number(line.price) <= 400; // free: razonable
  return { ok: qtyOk && priceOk, qtyOk, priceOk };
}

function scoreCase(c, lines) {
  const details = [];
  let correct = 0;
  for (const exp of c.expected) {
    const hit = lines.find((l) => lineMatches(exp, l).ok);
    const near = hit || lines.find((l) => exp.keys.every((k) => norm(l.concept).includes(norm(k))));
    details.push({
      expected: `${exp.keys.join('+')} · qty ${exp.qty} · ${exp.catalogPrice ?? exp.dictatedPrice ?? 'libre'}`,
      got: near ? `${near.concept} · qty ${near.qty} · ${near.price}` : '(no encontrada)',
      ok: !!hit,
    });
    if (hit) correct++;
  }
  const ratio = correct / c.expected.length;
  const tooMany = lines.length > c.expected.length + 2; // anti-invención
  return { pass: ratio >= 0.8 && !tooMany, ratio, tooMany, details, lineCount: lines.length };
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(`VZ-2 eval — ${CASES.length} transcripciones contra merchant ${MERCHANT_ID}\n`);
const results = [];
for (const c of CASES) {
  process.stdout.write(`Caso ${c.id}… `);
  let lines = [];
  let error = null;
  try {
    lines = await suggestQuoteLines({
      description: c.say,
      merchantId: MERCHANT_ID,
      country: 'ES',
      currency: 'EUR',
    });
  } catch (e) {
    error = e?.message || String(e);
  }
  const score = error ? { pass: false, ratio: 0, tooMany: false, details: [], lineCount: 0 } : scoreCase(c, lines);
  results.push({ id: c.id, say: c.say, error, lines, ...score });
  console.log(error ? `ERROR (${error})` : `${score.pass ? 'OK' : 'FALLO'} (${Math.round(score.ratio * 100)}% líneas${score.tooMany ? ', inventa de más' : ''})`);
}

const passed = results.filter((r) => r.pass).length;
const gate = passed >= 8;
console.log(`\nRESULTADO: ${passed}/10 casos OK → gate ≥8/10 ${gate ? '✅ PASA' : '❌ NO PASA'}`);

// ── Persistir evidencias ─────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'results.json'), JSON.stringify({ date: new Date().toISOString(), passed, gate, results }, null, 2));

const md = [
  `# VZ-2 · Resultados del eval de voz (${new Date().toISOString().slice(0, 10)})`,
  '',
  `**Gate del master (U1.5): ≥8/10 con ≥80% de líneas correctas → ${passed}/10 ${gate ? '✅ PASA' : '❌ NO PASA'}**`,
  '',
  '| # | Transcripción | Resultado | Líneas | Detalle |',
  '|---|---|---|---|---|',
  ...results.map((r) => {
    const det = r.error
      ? `ERROR: ${r.error}`
      : r.details.map((d) => `${d.ok ? '✓' : '✗'} ${d.expected} → ${d.got}`).join('<br/>');
    return `| ${r.id} | ${r.say} | ${r.pass ? '✅' : '❌'} ${Math.round(r.ratio * 100)}%${r.tooMany ? ' (inventa)' : ''} | ${r.lineCount} | ${det} |`;
  }),
  '',
  `Modelo: claude-opus-4-7 · Merchant: ${MERCHANT_ID} (Fontanería García, catálogo seed) · Script: scripts/voice-eval.mjs`,
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'RESULTS.md'), md);
console.log(`Evidencias: ${OUT_DIR}/RESULTS.md + results.json`);

if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
process.exit(gate ? 0 : 1);
