// tests/scrum908c6-barrido-tamrelleno.test.mjs — SCRUM-908c-6 · J6 (calidad y seguridad)
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// DIAGNÓSTICO, NO GUARD. Mide la pregunta que § 908c-2 ⑥ / § 908c-4 ⑤ dejaron sin contestar: por
// qué el hijo fabricado con `node:test` + `--test-force-exit` necesita escribir MÁS DEL DOBLE de
// la capacidadBase medida (`tests/scrum908c-la-cola-que-se-pierde.test.mjs`) para perder algo al
// salir, cuando el hijo PELADO de la sonda de CAPACIDAD pierde en cuanto ve cola.
//
// 🔴 ESTE FICHERO NO ES PERMANENTE. Vive en esta rama para que el CI de Linux corra el barrido;
// antes de pedir el merge se saca del árbol (GO del orquestador, 21-sep-2026: «un minuto y pico
// añadido para siempre al check obligatorio de los dos equipos» no se deja puesto). Lo que
// permanece es el resultado, anexado a docs/master/SCRUM-908.md.
//
// 🔴 DECLARADO ANTES DE CORRER (condición del GO, 21-sep-2026): con N=4 repeticiones por punto y
// una tasa ya medida del 12-35 %,
//   · un punto con 0/4 NO demuestra que ese tamaño no pierda — es el resultado más probable
//     incluso si SÍ pierde alguna vez ahí (techo Wilson de 0/4 ≈ 49 %);
//   · un punto con 4/4 SÍ dice algo, pero de UN solo entorno (las repeticiones son re-corridas
//     del MISMO commit: aíslan la varianza del runner, no la de otro árbol);
//   · esto da la FORMA GRUESA de la curva (monótona creciente vs. plana), NUNCA un umbral exacto.
//   · si sale PLANA (pierde o no pierde sin relación aparente con el tamaño), eso es un hallazgo
//     mayor por sí mismo: significaría que el tamaño no es la variable que decide, y la pregunta
//     pasa de «cuánto hace falta» a «qué otra cosa lo decide» (candidato: timing/scheduling, no
//     volumen — ver § 908c-5 y el comentario 16185 de Jira, `salioDuranteLaPausa` distinto entre
//     el hijo pelado y el fabricado con el MISMO tamaño).
//   · la conclusión se escribe como «la curva sugiere X, con este techo de resolución y esta N»,
//     nunca como «el umbral es X».
//
// SIN GATE en Windows: `capacidadBase` sale null (escritura síncrona) y los cuatro puntos del
// barrido colapsan al mismo `tamRelleno` mínimo — es el comportamiento correcto de esa
// plataforma (§ 908c: 0 de 91 en Windows), no un caso mal medido. El barrido real solo ocurre en
// el CI de Linux.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const RELLENO = 'RELLENO-908c6';
const NOMBRADO = 'NOMBRADO-908c6';
const COLA = ['COLA-908c6-1', 'COLA-908c6-2', 'COLA-908c6-3'];
const TODOS = [RELLENO, NOMBRADO, ...COLA];

const PASO_CAPACIDAD = 4096;
const TECHO_CAPACIDAD = 2 * 1024 * 1024;
const RATIO_BYTES_POR_RELLENO = 9; // medido en scrum908c-la-cola-que-se-pierde.test.mjs
const TAM_RELLENO_MIN = 11000;
const PAUSA_MS = 2000;

// ── EL BARRIDO, DECLARADO ANTES DE CORRER ───────────────────────────────────────────────────
const MULTIPLICADORES = [1.0, 1.5, 2.0, 3.0];
const REPES_POR_PUNTO = 4;

function entornoBase(extra) {
  const env = { ...extra };
  for (const k of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME']) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  return env;
}

function cuerpoDelCapacidad() {
  return [
    "import fs from 'node:fs';",
    `const PASO = Buffer.alloc(${PASO_CAPACIDAD}, 67);`,
    `const TECHO = ${TECHO_CAPACIDAD};`,
    'let escrito = 0;',
    'let cola = 0;',
    'while (escrito < TECHO) {',
    '  process.stdout.write(PASO);',
    '  escrito += PASO.length;',
    '  cola = process.stdout.writableLength;',
    '  if (cola > 0) break;',
    '}',
    'const MARCA = process.env.J6_908C6_MARCA_CAP;',
    "fs.writeFileSync(MARCA, JSON.stringify({ escrito, cola }));",
    'process.exit();',
    '',
  ].join('\n');
}

function cuerpoDelHijo(tamRelleno) {
  return [
    "import test from 'node:test';",
    "import fs from 'node:fs';",
    'const MARCA = process.env.J6_908C6_MARCA;',
    "if (MARCA) process.on('exit', () => {",
    '  try { fs.writeFileSync(MARCA, JSON.stringify({ colaAlSalir: process.stdout.writableLength })); } catch {}',
    '});',
    `test(${JSON.stringify(RELLENO)}, () => { throw new Error('r'.repeat(${tamRelleno})); });`,
    `test(${JSON.stringify(NOMBRADO)}, () => { throw new Error('el nombrado'); });`,
    ...COLA.map((c) => `test(${JSON.stringify(c)}, () => {});`),
    '',
  ].join('\n');
}

function entornoDelHijo(marca) {
  return entornoBase({ NODE_TEST_CONTEXT: 'child-v8', J6_908C6_MARCA: marca });
}

function pararSinLeer(marca, ms) {
  const celda = new Int32Array(new SharedArrayBuffer(4));
  const hasta = Date.now() + ms;
  while (Date.now() < hasta) {
    if (fs.existsSync(marca)) return true;
    Atomics.wait(celda, 0, 0, 10);
  }
  return fs.existsSync(marca);
}

function correrConPadreParado(hijo, marca) {
  const c = spawn(process.execPath, ['--test-force-exit', hijo],
    { env: entornoDelHijo(marca), stdio: ['pipe', 'pipe', 'pipe'] });
  const trozos = [];
  c.stdout.on('data', (d) => trozos.push(d));
  const salioDuranteLaPausa = pararSinLeer(marca, PAUSA_MS);
  return new Promise((ok, ko) => {
    c.on('error', ko);
    c.on('close', (code) => {
      let colaAlSalir = null;
      try { colaAlSalir = JSON.parse(fs.readFileSync(marca, 'utf8')).colaAlSalir; } catch {}
      const bytes = Buffer.concat(trozos).length;
      ok({ bytes, code, salioDuranteLaPausa, colaAlSalir });
    });
  });
}

async function correrCapacidad() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-908c6-cap-${process.pid}-`));
  try {
    const hijo = path.join(dir, 'capacidad-908c6.mjs');
    fs.writeFileSync(hijo, cuerpoDelCapacidad());
    const marca = path.join(dir, 'marca-capacidad.json');
    const c = spawn(process.execPath, [hijo],
      { env: entornoBase({ J6_908C6_MARCA_CAP: marca }), stdio: ['ignore', 'pipe', 'pipe'] });
    let recibido = 0;
    c.stdout.on('data', (d) => { recibido += d.length; });
    pararSinLeer(marca, PAUSA_MS);
    return await new Promise((ok, ko) => {
      c.on('error', ko);
      c.on('close', () => {
        let medido = null;
        try { medido = JSON.parse(fs.readFileSync(marca, 'utf8')); } catch {}
        ok({ recibido, medido });
      });
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function tamRellenoPara(mult, capacidadBase) {
  if (capacidadBase === null) return TAM_RELLENO_MIN;
  return Math.max(TAM_RELLENO_MIN, Math.ceil((capacidadBase * mult) / RATIO_BYTES_POR_RELLENO));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// Una sola pasada, compartida entre los tests: el barrido entero se mide UNA vez.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const barrido = (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `yaqu-908c6-${process.pid}-`));
  try {
    const capacidad = await correrCapacidad();
    const colaCap = capacidad.medido?.cola ?? 0;
    const capacidadBase = colaCap > 0 ? capacidad.recibido : null;

    console.log(`# SCRUM-908c6 · node=${process.version} pausa=${PAUSA_MS}ms capacidadBase=${capacidadBase} `
      + `multiplicadores=[${MULTIPLICADORES.join(',')}] repesPorPunto=${REPES_POR_PUNTO}`);

    const puntos = [];
    for (const mult of MULTIPLICADORES) {
      const tamRelleno = tamRellenoPara(mult, capacidadBase);
      const medidas = [];
      for (let rep = 1; rep <= REPES_POR_PUNTO; rep++) {
        const hijo = path.join(dir, `hijo-908c6-${mult}-${rep}.mjs`);
        fs.writeFileSync(hijo, cuerpoDelHijo(tamRelleno));
        const marca = path.join(dir, `marca-${mult}-${rep}.json`);
        const r = await correrConPadreParado(hijo, marca);
        medidas.push(r);
        console.log(`# BARRIDO mult=${mult} rep=${rep}/${REPES_POR_PUNTO} tamRelleno=${tamRelleno} `
          + `bytes=${r.bytes} code=${r.code} salioDuranteLaPausa=${r.salioDuranteLaPausa} `
          + `colaAlSalir=${r.colaAlSalir}`);
      }
      const conCola = medidas.filter((m) => (m.colaAlSalir ?? 0) > 0).length;
      console.log(`# BARRIDO RESUMEN mult=${mult} tamRelleno=${tamRelleno} → ${conCola}/${REPES_POR_PUNTO} con colaAlSalir>0`);
      puntos.push({ mult, tamRelleno, medidas, conCola });
    }

    const totalConCola = puntos.reduce((a, p) => a + p.conCola, 0);
    const totalMedidas = puntos.length * REPES_POR_PUNTO;
    console.log(`# SCRUM-908c6 · POBLACIÓN: ${totalMedidas} medidas sobre ${puntos.length} puntos. `
      + `${totalConCola}/${totalMedidas} con colaAlSalir>0 en total.`);

    return { capacidad, capacidadBase, puntos, totalConCola, totalMedidas };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})();

// ── Comprobaciones de CORDURA del instrumento — nunca afirman nada sobre colaAlSalir ───────
// (eso es justo lo que este fichero está midiendo, no lo que exige).

test('SCRUM-908c6 · 🔴 CIEGO: la sonda de CAPACIDAD deja su marca', async () => {
  const { capacidad } = await barrido;
  assert.ok(capacidad.medido, '🔴 CIEGO: la sonda de CAPACIDAD no dejó su marca.');
  assert.ok(capacidad.medido.escrito > 0, '🔴 CIEGO: la sonda no llegó a escribir nada.');
});

test('SCRUM-908c6 · 🔴 CIEGO: cada medida del barrido dejó su marca de salida y llegó algo por la tubería', async () => {
  const { puntos } = await barrido;
  for (const p of puntos) {
    for (const [i, m] of p.medidas.entries()) {
      assert.ok(m.colaAlSalir !== null,
        `🔴 CIEGO: mult=${p.mult} rep=${i + 1} no dejó marca de salida.`);
      assert.ok(m.bytes > 0, `🔴 CIEGO: mult=${p.mult} rep=${i + 1} no llegó nada por la tubería.`);
    }
  }
});

test('SCRUM-908c6 · el barrido cubrió los cuatro puntos declarados, con sus cuatro repeticiones cada uno', async () => {
  const { puntos, totalMedidas } = await barrido;
  assert.deepEqual(puntos.map((p) => p.mult), MULTIPLICADORES);
  assert.equal(totalMedidas, MULTIPLICADORES.length * REPES_POR_PUNTO);
  for (const p of puntos) assert.equal(p.medidas.length, REPES_POR_PUNTO);
});
