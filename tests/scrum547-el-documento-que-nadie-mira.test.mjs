// tests/scrum547-el-documento-que-nadie-mira.test.mjs — SCRUM-547 (2ª vuelta)
//
// Sin gate: sólo lee ficheros del árbol. Ni BD, ni red, ni navegador.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// UN DOCUMENTO «PARA APROBAR» QUE NADIE ENLAZA NO ESPERA: SE PIERDE
//
// `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md` entró el **20-ago-2026** con los 51 textos del
// bloque F transcritos uno a uno, para que el fundador pudiera aprobarlos sin abrir código.
// Estaba completo y verificado — se comprobó punto de código a punto de código contra el HTML de
// hoy: los 51 aparecen exactos y no sobra ni falta ninguno.
//
// **Y siguió sin aprobarse 26 días**, porque no lo enlazaba nadie desde donde el fundador mira:
// ni `PENDIENTES_FUNDADOR.md` ni el máster lo nombraban.
//
// 🔒 El ticket se diagnosticó como «los textos están dentro del HTML». No era eso: llevaban casi
// un mes fuera del HTML. Lo que faltaba era el CAMINO hasta ellos.
//
// ── POR QUÉ UN GUARD Y NO SÓLO EL ENLACE ────────────────────────────────────────────────
// Porque no fue un caso. Medido el 16-sep-2026 sobre los 666 `.md` de `docs/`: **seis**
// documentos se declaran a la espera de una aprobación y **tres no estaban enlazados**. Poner el
// enlace que falta arregla uno; esto impide que el siguiente entre en silencio.
//
// El criterio y la lista viven en `_documentos-a-la-espera.mjs` — ver allí por qué.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PUERTAS, documentosALaEspera, textoDeLasPuertas, estaEnlazado,
  SIN_ENLAZAR_DECLARADOS, TOPE_SIN_ENLAZAR,
} from './_documentos-a-la-espera.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

/** Lo que el meta-guard de la casa EJECUTA contra este fichero (SCRUM-745). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'tests/_documentos-a-la-espera.mjs',
    de: "  'docs/CENSO_MICROCOPY_PENDIENTE.md': 'es un censo de trabajo interno, no una decisión del fundador',",
    a: "",
    cae: 'SCRUM-547 · 🔴 todo documento «para aprobar» está enlazado desde donde el fundador mira',
  },
  {
    fichero: 'tests/_documentos-a-la-espera.mjs',
    de: "  return puertas.includes(rel) || puertas.includes(path.basename(rel));",
    a: "  return true;",
    cae: 'SCRUM-547 · 🔴 la lista de «sin enlazar» está cerrada, y ninguna entrada sobra',
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un cero aquí es el criterio roto, no un árbol limpio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-547 · 🔴 SUELO: el criterio VE documentos a la espera, y las puertas existen', () => {
  const alaEspera = documentosALaEspera(RAIZ);
  assert.ok(alaEspera.length >= 4,
    `🔴 CIEGO: el criterio sólo ve ${alaEspera.length} documentos a la espera. Medido el `
    + '16-sep-2026 había seis. Si se ha desplomado, lo roto es el criterio — y entonces «ninguno '
    + 'sin enlazar» no significaría nada.');

  // Las dos señales tienen que estar VIVAS: si una no cazara a nadie, media comprobación sería
  // decorativa y nadie se enteraría.
  assert.ok(alaEspera.some((d) => d.porNombre), '🔴 la señal por NOMBRE no caza a nadie.');
  assert.ok(alaEspera.some((d) => d.porCuerpo), '🔴 la señal por CUERPO no caza a nadie.');

  for (const p of PUERTAS) {
    assert.ok(fs.existsSync(path.join(RAIZ, p)),
      `🔴 la puerta ${p} no existe: este guard estaría comprobando contra la nada.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL QUE DECIDE · un documento «para aprobar» sin enlace hace CAER la tanda
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-547 · 🔴 todo documento «para aprobar» está enlazado desde donde el fundador mira', () => {
  const puertas = textoDeLasPuertas(RAIZ);
  const huerfanos = documentosALaEspera(RAIZ)
    .filter((d) => !estaEnlazado(d.doc, puertas) && !(d.doc in SIN_ENLAZAR_DECLARADOS))
    .map((d) => `${d.doc}  [${d.porNombre ? 'nombre' : ''}${d.porNombre && d.porCuerpo ? '+' : ''}${d.porCuerpo ? 'cuerpo' : ''}]`);

  assert.deepEqual(huerfanos, [],
    '🔴 HAY DOCUMENTOS ESPERANDO UNA APROBACIÓN QUE NADIE ENLAZA:\n    '
    + huerfanos.join('\n    ') + '\n\n'
    + '  Un documento así no espera: se pierde. `MICROCOPY_BLOQUE_F_PARA_APROBAR.md` estuvo\n'
    + '  terminado y sin aprobar 26 días por esto exactamente, y el ticket se diagnosticó como\n'
    + '  otra cosa: «los textos están dentro del HTML», cuando llevaban un mes fuera.\n\n'
    + '  ARRÉGLALO ASÍ: enlázalo desde `docs/PENDIENTES_FUNDADOR.md` (o desde el máster) diciendo\n'
    + '  QUÉ hay que decidir y CÓMO contestar. Si de verdad no es una decisión del fundador,\n'
    + '  declárala en `SIN_ENLAZAR_DECLARADOS` con su motivo y sube el tope A MANO — que es el\n'
    + '  sitio donde se ve.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// ✅ POSITIVO · el que acaba de enlazarse pasa, y el enlace DICE QUÉ HACER
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-547 · ✅ POSITIVO: el documento del bloque F está enlazado, y no sólo nombrado', () => {
  const DOC = 'docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md';
  const pendientes = fs.readFileSync(path.join(RAIZ, 'docs/PENDIENTES_FUNDADOR.md'), 'utf8');
  assert.ok(pendientes.includes(path.basename(DOC)),
    `🔴 ${DOC} ha dejado de estar enlazado desde la lista del fundador.`);

  // 🔴 Y NO BASTA CON NOMBRARLO. Un nombre suelto en un índice de ficheros es lo que ya tenían
  // otros documentos, y no hizo que nadie los abriera: el enlace tiene que decir qué se decide.
  const bloque = pendientes.split('\n').filter((l) => l.includes('MICROCOPY_BLOQUE_F')).join(' ');
  assert.match(bloque, /aprob/i,
    '🔴 el enlace no dice que haya que APROBAR nada: así es una entrada de índice, no una tarea.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA LISTA DE EXENTOS, CERRADA — y en las dos direcciones
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-547 · 🔴 la lista de «sin enlazar» está cerrada, y ninguna entrada sobra', () => {
  const claves = Object.keys(SIN_ENLAZAR_DECLARADOS);
  assert.equal(claves.length, TOPE_SIN_ENLAZAR,
    `🔴 hay ${claves.length} declarados y el tope es ${TOPE_SIN_ENLAZAR}. Un tercero no se añade: `
    + 'se decide.');

  const puertas = textoDeLasPuertas(RAIZ);
  for (const c of claves) {
    assert.ok(fs.existsSync(path.join(RAIZ, c)),
      `🔴 la lista nombra un documento que ya no existe: ${c}`);
    // Las dos direcciones: que la excepción no quede huérfana y que NO SOBRE. Si alguien lo
    // enlazó, la excepción ya no hace falta y tiene que salir de aquí.
    assert.equal(estaEnlazado(c, puertas), false,
      `🔴 ${c} YA está enlazado: quita su excepción y baja el tope.`);
  }
});
