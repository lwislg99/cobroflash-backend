// docs/master/evidencias/SCRUM-952/sonda-viabilidad.mjs — SCRUM-952 · PASO 0.
//
// Pregunta: ¿se puede medir la calidad de un presupuesto con OTRO modelo corriendo el
// `suggestQuoteLines` REAL de dist/ (mismo prompt, mismo esquema, mismo `mapearLineasSugeridas`),
// SIN tocar una línea de src/ y sin exportar nada?
//
// Sin red y sin clave: Google se simula con `globalThis.fetch` y la clave es falsa. Dos costuras
// que YA existen, ninguna creada para esto:
//   · el catálogo: `dist/core/db/prisma.js` usa `global.prisma` si existe → un doble con `findMany`;
//   · el modelo: `config.GEMINI_MODEL` se lee de `process.env` al cargar → un proceso por candidato.
//
// Uso (desde la raíz del árbol, con `npm run build` hecho): node docs/master/evidencias/SCRUM-952/sonda-viabilidad.mjs
import { createRequire } from 'node:module';
import path from 'node:path';

const ARBOL = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const require = createRequire(path.join(ARBOL, 'package.json'));

const CANDIDATO = 'gemini-3.8-flash';
process.env.GEMINI_API_KEY = 'clave-falsa-de-la-sonda';
process.env.GEMINI_MODEL = CANDIDATO;

const vistas = [];
const catalogo = [{ name: 'Cisterna completa', price: 95 }, { name: 'Mano de obra fontanería (hora)', price: 40 }];
globalThis.prisma = { product: { findMany: async (q) => { vistas.push(q.where); return catalogo; } } };

const pedidas = [];
globalThis.fetch = async (url, init) => {
  pedidas.push({ modelo: String(url).match(/\/models\/([^:]+):generateContent/)?.[1], cuerpo: JSON.parse(init.body) });
  const texto = JSON.stringify([{ concept: 'Cisterna completa', qty: 1, price: 95, tax: 0.21 },
    { concept: 'Mano de obra fontanería (hora)', qty: 2, price: 40, tax: 0.21 }]);
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }], modelVersion: 'fingido-001' }), { status: 200 });
};

const { suggestQuoteLines } = require('./dist/modules/ai/domain/ai.service.js');
const r = await suggestQuoteLines({ description: 'ponme cambiar la cisterna del váter y dos horas', merchantId: 777, country: 'ES', currency: 'EUR' });

// A21 · el testigo: si la cobaya no corrió, esto no es un resultado.
const fallos = [];
if (pedidas.length !== 1) fallos.push(`peticiones a Google: ${pedidas.length}, se esperaba 1`);
if (pedidas[0]?.modelo !== CANDIDATO) fallos.push(`modelo pedido ${pedidas[0]?.modelo}, se esperaba ${CANDIDATO}`);
if (vistas[0]?.merchantId !== 777) fallos.push('el catálogo no se pidió filtrado por merchantId');
if (!pedidas[0]?.cuerpo.contents[0].parts[0].text.includes('Cisterna completa: 95.00 EUR')) fallos.push('el catálogo doble no llegó al prompt');
if (!pedidas[0]?.cuerpo.systemInstruction.parts[0].text.startsWith('Eres un asistente especializado')) fallos.push('no es el prompt de presupuestos');
if (!pedidas[0]?.cuerpo.generationConfig.responseSchema) fallos.push('no viajó el esquema JSON');
if (r?.lineas?.length !== 2) fallos.push(`líneas mapeadas: ${r?.lineas?.length}`);

console.log(`población: 1 caso · ${pedidas.length} petición · modelo pedido ${pedidas[0]?.modelo}`);
console.log(`resultado: ${JSON.stringify(r)}`);
if (fallos.length) { console.error(`❌ la sonda NO sirve:\n  · ${fallos.join('\n  · ')}`); process.exit(1); }
console.log('✅ viable: suggestQuoteLines real, catálogo doble, modelo elegido por proceso, sin tocar src/');
process.exit(0);
