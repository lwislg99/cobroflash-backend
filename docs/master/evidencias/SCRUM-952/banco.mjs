// docs/master/evidencias/SCRUM-952/banco.mjs — SCRUM-952 · la calidad de un presupuesto, modelo a modelo.
//
// Corre el `suggestQuoteLines` REAL de dist/ (prompt, esquema y `mapearLineasSugeridas`) con las dos
// costuras que mide `sonda-viabilidad.mjs`: catálogo doble por `global.prisma` y UN proceso por
// modelo con `GEMINI_MODEL=<ese modelo>` (sin respaldo: se mide ESE modelo). No toca src/.
//
//   node banco.mjs --simulado                         autoprueba sin red: el juez tiene que distinguir
//                                                     una respuesta perfecta de una mala (control + y −)
//   node banco.mjs --clave-fichero <ruta> [--modelos a,b] [--pausa-ms 13000]
//                                                     peticiones REALES a Google. La clave se lee del
//                                                     fichero (una línea, o GEMINI_API_KEY=…) y NO se
//                                                     imprime ni se escribe (regla 9).
//
// Escribe `resultados-<modo>.json` junto a este fichero. Sale 1 si algún modelo no dejó su testigo
// (A21) o si ninguna petición llegó a un modelo.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const ARBOL = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const MARCA = 'BANCO952>';

export const CATALOGO = [
  { name: 'Mano de obra fontanería (hora)', price: 40 },
  { name: 'Cisterna completa', price: 95 },
  { name: 'Grifo monomando', price: 65 },
  { name: 'Termo eléctrico 80 L', price: 320 },
  { name: 'Desatasco', price: 90 },
  { name: 'Desplazamiento', price: 25 },
];

// Candidatos con cupo MEDIDO distinto de 0 (tabla de AI Studio del fundador, 18-sep). Los ids de
// los 3.x no están comprobados: si uno da 404, sale como error de ese modelo, no se adivina.
const CANDIDATOS = [
  'gemini-2.5-flash', // la referencia: la de hoy
  'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash',
  'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite',
];

// ── Los 5 casos y su verdad ────────────────────────────────────────────────────────────────
const linea = (ls, nombre) => ls.filter((l) => l.concept === nombre);
const hay = (ls, re) => ls.some((l) => re.test(l.concept));
const exacta = (ls, nombre, qty, price) => { const m = linea(ls, nombre); return m.length === 1 && m[0].qty === qty && m[0].price === price; };

export const CASOS = [
  {
    id: 'c1-cisterna-y-horas',
    dictado: 'eh mira ponme cambiar la cisterna del váter y dos horas de mano de obra',
    min: 2,
    checks: {
      'Cisterna completa ×1 a 95': (ls) => exacta(ls, 'Cisterna completa', 1, 95),
      'Mano de obra ×2 a 40, UNA línea': (ls) => exacta(ls, 'Mano de obra fontanería (hora)', 2, 40),
      'sin desplazamiento (no se dijo)': (ls) => !hay(ls, /desplaz/i),
      'sin muletillas como concepto': (ls) => !hay(ls, /^(eh|mira|ponme)\b/i),
    },
  },
  {
    id: 'c2-calentador-precio-dictado',
    dictado: 'cambiar el calentador por uno de ochenta litros, la instalación son unos doscientos euros',
    min: 2,
    checks: {
      'Termo eléctrico 80 L ×1 a 320 (sinónimo)': (ls) => exacta(ls, 'Termo eléctrico 80 L', 1, 320),
      'la instalación a 200 (precio dictado)': (ls) => ls.some((l) => l.price === 200),
      'sin desatasco': (ls) => !hay(ls, /desatasc/i),
    },
  },
  {
    id: 'c3-dos-grifos',
    dictado: 'dos grifos monomando uno en la cocina y otro en el baño',
    min: 1,
    checks: {
      'Grifo monomando ×2 a 65, UNA línea': (ls) => exacta(ls, 'Grifo monomando', 2, 65),
      'sin termo ni cisterna': (ls) => !hay(ls, /termo|cisterna/i),
    },
  },
  {
    id: 'c4-desague-y-desplazamiento',
    dictado: 'desagüe embozado en el fregadero y apúntame el desplazamiento',
    min: 2,
    checks: {
      'Desatasco ×1 a 90 (sinónimo)': (ls) => exacta(ls, 'Desatasco', 1, 90),
      'Desplazamiento ×1 a 25': (ls) => exacta(ls, 'Desplazamiento', 1, 25),
      'sin cisterna ni grifo': (ls) => !hay(ls, /cisterna|grifo/i),
    },
  },
  {
    id: 'c5-fuera-de-catalogo',
    dictado: 'pintar un salón de veinte metros cuadrados con la pintura incluida',
    min: 2,
    checks: {
      'ninguna línea del catálogo': (ls) => !ls.some((l) => CATALOGO.some((p) => p.name === l.concept)),
      'total entre 150 y 900 €': (ls) => { const t = ls.reduce((s, l) => s + l.qty * l.price, 0); return t >= 150 && t <= 900; },
    },
  },
];

/** El juez: puro, sin red. Devuelve cada comprobación con su resultado. */
export function juzgar(caso, salida) {
  const r = {};
  if (salida.error) { r['respondió'] = false; return r; }
  const ls = salida.lineas;
  r['respondió'] = true;
  r[`entre ${caso.min} y 8 líneas`] = ls.length >= caso.min && ls.length <= 8;
  r['IVA 0,21 en todas'] = ls.length > 0 && ls.every((l) => l.tax === 0.21);
  r['ninguna descartada ni supuesta'] = salida.descartadas.length === 0 && ls.every((l) => l.supuestos.length === 0);
  for (const [nombre, f] of Object.entries(caso.checks)) r[nombre] = f(ls);
  return r;
}
const nChecks = (caso) => 4 + Object.keys(caso.checks).length;

// ── Hijo: un modelo, los 5 casos ───────────────────────────────────────────────────────────
async function hijo() {
  const modo = process.env.BANCO952_MODO;
  const modelo = process.env.GEMINI_MODEL;
  const pausa = Number(process.env.BANCO952_PAUSA_MS || 0);
  const clave = process.env.GEMINI_API_KEY || '';
  const tapa = (s) => (clave && typeof s === 'string' ? s.split(clave).join('«clave»') : s);

  globalThis.prisma = { product: { findMany: async (q) => {
    if (q?.where?.merchantId !== 952) throw new Error('catálogo pedido sin el merchantId del banco');
    return CATALOGO;
  } } };

  const vistas = [];
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const pedido = String(url).match(/\/models\/([^:]+):generateContent/)?.[1];
    const res = modo === 'simulado' ? simular(pedido, JSON.parse(init.body)) : await fetchReal(url, init);
    const j = await res.clone().json().catch(() => null);
    vistas.push({ pedido, status: res.status, modelVersion: j?.modelVersion ?? null, uso: j?.usageMetadata ?? null });
    return res;
  };

  const require = createRequire(path.join(ARBOL, 'package.json'));
  const { suggestQuoteLines } = require('./dist/modules/ai/domain/ai.service.js');
  const salidas = [];
  for (const [i, caso] of CASOS.entries()) {
    if (i > 0 && pausa) await new Promise((r) => setTimeout(r, pausa));
    const antes = vistas.length;
    const t0 = Date.now();
    try {
      const r = await suggestQuoteLines({ description: caso.dictado, merchantId: 952, country: 'ES', currency: 'EUR' });
      salidas.push({ caso: caso.id, ms: Date.now() - t0, lineas: r.lineas, descartadas: r.descartadas, google: vistas.slice(antes) });
    } catch (e) {
      salidas.push({ caso: caso.id, ms: Date.now() - t0, error: e?.code || e?.message || 'desconocido',
        detalle: tapa(String(e?.providerDetail || '').slice(0, 200)), google: vistas.slice(antes) });
    }
  }
  process.stdout.write(`${MARCA}${JSON.stringify({ modelo, salidas })}\n`);
}

// Google fingido para la autoprueba: `sim-perfecto` contesta la verdad; `sim-malo` comete un error
// en cada caso (inventa, parte líneas, IVA en porcentaje, ignora el precio dictado, usa el catálogo).
function simular(modelo, cuerpo) {
  const texto = cuerpo.contents[0].parts.at(-1).text;
  const L = (concept, qty, price, tax = 0.21) => ({ concept, qty, price, tax });
  const perfecto = [
    [/cisterna/, [L('Cisterna completa', 1, 95), L('Mano de obra fontanería (hora)', 2, 40)]],
    [/calentador/, [L('Termo eléctrico 80 L', 1, 320), L('Instalación termo', 1, 200)]],
    [/grifos/, [L('Grifo monomando', 2, 65)]],
    [/desagüe/, [L('Desatasco', 1, 90), L('Desplazamiento', 1, 25)]],
    [/pintar/, [L('Pintura plástica salón 20 m²', 1, 120), L('Mano de obra pintura', 1, 280)]],
  ];
  const malo = [
    [/cisterna/, [L('Cisterna completa', 1, 95), L('Mano de obra fontanería (hora)', 1, 40), L('Mano de obra fontanería (hora)', 1, 40), L('Desplazamiento', 1, 25)]],
    [/calentador/, [L('Termo eléctrico 80 L', 1, 320), L('Instalación termo', 1, 150)]],
    [/grifos/, [L('Grifo monomando', 1, 65), L('Grifo monomando', 1, 65)]],
    [/desagüe/, [L('Desatasco', 1, 90, 21), L('Desplazamiento', 1, 25)]],
    [/pintar/, [L('Mano de obra fontanería (hora)', 8, 40), L('Pintura', 1, 60)]],
  ];
  const tabla = modelo === 'sim-perfecto' ? perfecto : malo;
  const lineas = tabla.find(([re]) => re.test(texto))?.[1] ?? [];
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(lineas) }] } }],
    modelVersion: `${modelo}-fingido`, usageMetadata: { promptTokenCount: 0 } }), { status: 200 });
}

// ── Padre ──────────────────────────────────────────────────────────────────────────────────
function opcion(nombre) { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? process.argv[i + 1] : null; }

function padre() {
  const simulado = process.argv.includes('--simulado');
  let clave = 'clave-falsa-del-banco';
  if (!simulado) {
    const fichero = opcion('clave-fichero');
    if (!fichero) throw new Error('uso: node banco.mjs --simulado | --clave-fichero <ruta> [--modelos a,b] [--pausa-ms N]');
    const bruto = fs.readFileSync(fichero, 'utf8').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
    clave = bruto.startsWith('GEMINI_API_KEY=') ? bruto.slice('GEMINI_API_KEY='.length).trim() : bruto;
    if (!clave) throw new Error('el fichero de la clave está vacío');
  }
  const modelos = simulado ? ['sim-perfecto', 'sim-malo'] : (opcion('modelos')?.split(',').map((m) => m.trim()).filter(Boolean) ?? CANDIDATOS);
  const pausa = simulado ? 0 : Number(opcion('pausa-ms') ?? 13000); // 5 por minuto en los Flash

  const resultados = [];
  const sinTestigo = [];
  for (const modelo of modelos) {
    const env = { ...process.env, GEMINI_API_KEY: clave, GEMINI_MODEL: modelo, BANCO952_MODO: simulado ? 'simulado' : 'real', BANCO952_PAUSA_MS: String(pausa) };
    delete env.FORCE_COLOR;
    const h = spawnSync(process.execPath, [import.meta.filename, '--hijo'], { env, encoding: 'utf8', cwd: ARBOL, timeout: 15 * 60_000 });
    const lineaMarca = (h.stdout || '').split(/\r?\n/).find((l) => l.startsWith(MARCA));
    if (!lineaMarca) { sinTestigo.push(`${modelo} (salida ${h.status}): ${(h.stderr || '').split(clave).join('«clave»').slice(0, 300)}`); continue; }
    const { salidas } = JSON.parse(lineaMarca.slice(MARCA.length));
    const casos = salidas.map((s) => {
      const caso = CASOS.find((c) => c.id === s.caso);
      const juicio = juzgar(caso, s);
      return { ...s, juicio, bien: Object.values(juicio).filter(Boolean).length, de: nChecks(caso) };
    });
    const bien = casos.reduce((a, c) => a + c.bien, 0);
    const de = CASOS.reduce((a, c) => a + nChecks(c), 0);
    const contestadas = casos.filter((c) => c.google.some((g) => g.status === 200)).length;
    resultados.push({ modelo, nota: `${bien}/${de}`, pct: Math.round((bien / de) * 1000) / 10, contestadas,
      versiones: [...new Set(casos.flatMap((c) => c.google.map((g) => g.modelVersion)).filter(Boolean))],
      errores: casos.filter((c) => c.error).map((c) => `${c.caso}: ${c.error}`), casos });
    // Con la clave mala, todos los modelos darían lo mismo: se para aquí y no se sigue llamando.
    if (casos.every((c) => c.error === 'gemini_bad_key')) { sinTestigo.push('la clave no vale (gemini_bad_key): parado'); break; }
  }

  console.log(`población: ${CASOS.length} casos × ${modelos.length} modelos · ${resultados.length} con testigo · modo ${simulado ? 'SIMULADO (sin red)' : 'REAL'}`);
  for (const r of resultados) {
    console.log(`\n${r.modelo}: ${r.nota} (${r.pct} %) · contestadas ${r.contestadas}/${CASOS.length} · versión ${r.versiones.join(', ') || '—'}`);
    for (const c of r.casos) {
      const fallos = Object.entries(c.juicio).filter(([, v]) => !v).map(([k]) => k);
      console.log(`  ${c.caso.padEnd(30)} ${c.bien}/${c.de} · ${c.ms} ms${c.error ? ` · ERROR ${c.error}` : ''}${fallos.length ? ` · falla: ${fallos.join(' | ')}` : ''}`);
    }
  }
  const salida = path.join(import.meta.dirname, `resultados-${simulado ? 'simulado' : 'real'}.json`);
  fs.writeFileSync(salida, JSON.stringify({ cuando: new Date().toISOString(), modo: simulado ? 'simulado' : 'real', casos: CASOS.map((c) => ({ id: c.id, dictado: c.dictado })), resultados }, null, 2) + '\n');
  console.log(`\nresultado en ${salida}`);

  const fallos = [];
  if (sinTestigo.length) fallos.push(`sin testigo (no corrieron): ${sinTestigo.join(' · ')}`);
  if (!resultados.some((r) => r.contestadas > 0)) fallos.push('ninguna petición llegó a un modelo: esto no mide la IA');
  if (simulado) {
    const p = resultados.find((r) => r.modelo === 'sim-perfecto');
    const m = resultados.find((r) => r.modelo === 'sim-malo');
    if (!p || p.pct !== 100) fallos.push(`CONTROL +: la respuesta perfecta saca ${p?.nota}, no el 100 %`);
    if (!m || m.casos.some((c) => c.bien === c.de)) fallos.push('CONTROL −: la respuesta mala aprueba algún caso entero: el juez no discrimina');
  }
  if (fallos.length) { console.error(`\n❌ ${fallos.join('\n❌ ')}`); process.exit(1); }
  if (simulado) console.log('✅ el juez distingue: perfecto 100 %, el malo suspende los 5 casos');
}

if (process.argv.includes('--hijo')) await hijo(); else padre();
