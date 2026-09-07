#!/usr/bin/env node
// scripts/censo-eventos-de-pasarela.mjs — SCRUM-815
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// ¿DÓNDE SE REGISTRA HOY QUE UN EVENTO DE PASARELA YA SE PROCESÓ?
//
// La pregunta del encargo, y el orden importa: **si existe a medias, eso vale más que una tabla
// nueva** — se completa en vez de inventarse (precedente SCRUM-729, donde `Invoice` ya congelaba
// siete campos y sólo faltaba aplicarlo al cliente).
//
// 🔴 CENSO POR IDENTIDAD, NO POR SUBCADENA. Se parsea `schema.prisma` en modelos y campos y se
// pregunta por el NOMBRE COMPLETO de cada uno. Buscar «event» con `grep` casaría `eventos` dentro
// de `eventosDeAgenda`, `prevent`, `eventual`… y esta semana comparar por subcadena ha mordido
// cuatro veces en este repo. Aquí lo que decide es el identificador entero.
//
// ⛔ No toca nada: lee `schema.prisma` y las rutas. Ni una clave, ni una conexión.
// ═════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** `schema.prisma` en modelos con sus campos. Un parser de llaves, no un regex sobre el todo. */
export function modelosDelEsquema(texto) {
  const modelos = [];
  const re = /^\s*model\s+(\w+)\s*\{/gm;
  let m;
  while ((m = re.exec(texto))) {
    const abre = texto.indexOf('{', m.index);
    let prof = 1; let i = abre + 1;
    while (i < texto.length && prof > 0) {
      if (texto[i] === '{') prof++;
      else if (texto[i] === '}') prof--;
      i++;
    }
    const cuerpo = texto.slice(abre + 1, i - 1);
    const campos = [];
    for (const linea of cuerpo.split('\n')) {
      const l = linea.trim();
      if (!l || l.startsWith('//') || l.startsWith('@@')) continue;
      const c = /^(\w+)\s+(\S+)/.exec(l);
      if (c) campos.push({ nombre: c[1], tipo: c[2] });
    }
    modelos.push({ nombre: m[1], campos, cuerpo });
  }
  return modelos;
}

/** Un identificador se parte en sus palabras: `stripeEventId` → stripe · event · id. */
const palabras = (id) => id
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ')
  .toLowerCase().split(/\s+/).filter(Boolean);

const PASARELA = new Set(['stripe', 'psp', 'webhook', 'mercadopago', 'mp', 'pasarela', 'gateway']);
const EVENTO = new Set(['event', 'evento', 'eventid', 'notification', 'callback', 'hook']);
const PROCESO = new Set(['processed', 'procesado', 'handled', 'seen', 'visto', 'aplicado',
  'applied', 'idempotency', 'idempotencia', 'dedupe']);

const esquema = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
const modelos = modelosDelEsquema(esquema);

console.log('════════ SUELO ════════');
console.log(`  modelos leídos de schema.prisma: ${modelos.length}`);
const totalCampos = modelos.reduce((a, m) => a + m.campos.length, 0);
console.log(`  campos leídos: ${totalCampos}`);
if (modelos.length < 20 || totalCampos < 200) {
  console.error('🔴 CIEGO: el parser no está leyendo el esquema. Con esta población, «no existe '
    + 'ninguna tabla de eventos» significaría «no he mirado», que es la conclusión cara.');
  process.exit(2);
}
// Control positivo del parser: modelos que SABEMOS que existen.
for (const n of ['Merchant', 'Invoice']) {
  if (!modelos.some((m) => m.nombre === n)) {
    console.error(`🔴 CIEGO: el parser no encuentra el modelo \`${n}\`, que existe. No vale.`);
    process.exit(2);
  }
}
console.log('  control positivo del parser: encuentra `Merchant` e `Invoice` ✅');

console.log('\n════════ ① MODELOS CUYO NOMBRE HABLA DE PASARELA O DE EVENTO ════════');
const porNombre = modelos.filter((m) => {
  const p = palabras(m.nombre);
  return p.some((x) => PASARELA.has(x)) || p.some((x) => EVENTO.has(x));
});
if (!porNombre.length) console.log('  (ninguno)');
for (const m of porNombre) console.log(`  ${m.nombre}  (${m.campos.length} campos)`);

console.log('\n════════ ② CAMPOS QUE GUARDAN UN ID DE PASARELA O UNA MARCA DE PROCESADO ════════');
const filas = [];
for (const m of modelos) {
  for (const c of m.campos) {
    const p = palabras(c.nombre);
    const dePasarela = p.some((x) => PASARELA.has(x));
    const deEvento = p.some((x) => EVENTO.has(x));
    const deProceso = p.some((x) => PROCESO.has(x));
    if (dePasarela || deEvento || deProceso) {
      filas.push({ modelo: m.nombre, campo: c.nombre, tipo: c.tipo, dePasarela, deEvento, deProceso });
    }
  }
}
for (const f of filas) {
  const et = [f.dePasarela && 'pasarela', f.deEvento && 'evento', f.deProceso && 'procesado']
    .filter(Boolean).join('+');
  console.log(`  ${(f.modelo + '.' + f.campo).padEnd(42)} ${f.tipo.padEnd(14)} ${et}`);
}
console.log(`  ── ${filas.length} campo(s)`);

console.log('\n════════ ③ ¿HAY ALGUNA CLAVE ÚNICA SOBRE ESOS CAMPOS? ════════');
// Sin `@unique`/`@@unique` no hay idempotencia posible: dos procesos pueden insertar la misma
// marca a la vez y los dos creerse los primeros.
for (const m of modelos) {
  const suyos = filas.filter((f) => f.modelo === m.nombre);
  if (!suyos.length) continue;
  for (const f of suyos) {
    const linea = m.cuerpo.split('\n').find((l) => new RegExp(`^\\s*${f.campo}\\s`).test(l)) || '';
    const unico = /@unique/.test(linea);
    const enCompuesta = new RegExp(`@@unique\\([^)]*\\b${f.campo}\\b`).test(m.cuerpo);
    console.log(`  ${(m.nombre + '.' + f.campo).padEnd(42)} @unique:${unico ? 'SÍ' : 'no '}  @@unique:${enCompuesta ? 'SÍ' : 'no'}`);
  }
}

console.log('\n════════ ④ QUIÉN GUARDA HOY UN `event.id` DE STRIPE ════════');
// Lo que de verdad importa: ¿el id del evento llega a la base en algún sitio?
const src = [];
(function anda(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) anda(p);
    else if (/\.ts$/.test(e.name)) src.push(p);
  }
})(path.join(RAIZ, 'src'));
console.log(`  ficheros .ts barridos: ${src.length}`);
let conEventId = 0;
for (const p of src) {
  const t = fs.readFileSync(p, 'utf8');
  if (!/\bevent\.id\b/.test(t)) continue;
  conEventId++;
  const rel = path.relative(RAIZ, p).replace(/\\/g, '/');
  for (const [i, l] of t.split('\n').entries()) {
    if (/\bevent\.id\b/.test(l)) console.log(`    ${rel}:${i + 1}  ${l.trim().slice(0, 96)}`);
  }
}
if (!conEventId) console.log('  🔴 NINGÚN fichero de `src/` menciona `event.id`: o no se usa, o no sé mirar.');
