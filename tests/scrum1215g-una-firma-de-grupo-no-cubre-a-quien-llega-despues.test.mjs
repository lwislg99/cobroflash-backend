// SCRUM-1215g · UNA FIRMA DE GRUPO NO CUBRE A QUIEN LLEGA DESPUÉS.
//
// El censo de SCRUM-1157 (`scripts/_censo-convenio-microcopy.mjs`) dice qué texto del panel tiene
// firma. Cuando la firma es de GRUPO —en plural, contando («los doce rótulos»), en la cabecera del
// objeto, o la del objeto que contiene a la hoja— aprueba lo que CAE debajo, no lo que la firma
// vio. Medido el 13-oct-2026 sobre `quoteActionsRegistry.js` (origin/main 9358f02b), y es el caso
// que se copia aquí abajo LITERAL:
//
//   · tal cual: `btnCobrar` y `btnNuevoAlbaran` (entraron el 21-sep, SCRUM-984) salían APROBADO
//     bajo «los doce» del 17-ago, y `btnBorrar`, que sí estaba entre los doce, salía acusada;
//   · una hoja NUEVA puesta en el sitio de una firmada: APROBADO, y el trinquete en VERDE;
//   · una hoja nueva añadida arriba: APROBADO ella, y el rojo acusaba a una que sí estaba firmada;
//   · las mismas trece hojas con dos cambiadas de sitio: la firmada y la acusada se intercambian.
//
// La cura: cada hoja APROBADO dice si la firma es SUYA o le llega de un grupo, y el trinquete
// compara por IDENTIDAD las «por grupo» con «porGrupo» del JSON de declarados. Lo que entra sin
// estar nombrado sale NUEVA, con su nombre.
//
// Todo en memoria, con el censo de verdad: aquí no se escribe en el árbol (la CLI, en un temporal).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  RAIZ, DECLARADOS_JSON, censar, compararConDeclarados, leerDeclarados, queHacer,
  QUE_HACER_NUEVA_GRUPO, QUE_HACER_DESPLAZADA, QUE_HACER_SOBRA_GRUPO,
} from '../scripts/_censo-convenio-microcopy.mjs';

const CLI = path.join(RAIZ, 'scripts', '_censo-convenio-microcopy.mjs');
const REL = 'public/x.js';

// El caso, LITERAL como estaba en `quoteActionsRegistry.js` el 13-oct-2026. Se copia a propósito:
// el día que S2 ponga a cada rótulo su marca en su línea el árbol cambia, y este control tiene que
// seguir probando que el censo VE este patrón.
const LOS_DOCE_13OCT = `// ── RÓTULOS · REGLA 30: NINGUNO ESTÁ APROBADO ────────────────────────────────────────────────
//
// 17-ago-2026: el fundador APROBÓ los doce rótulos, así que se quitaron las marcas y
// \`MARCA_MICROCOPY\` se BORRA — dejarla sin consumidores es dejar a mano lo que alguien reenchufa.
const QUOTE_ACTION_ROTULOS = {
  btnEnviarAprobacion: 'Enviar a aprobación',
  btnEnviar:           'Enviar al cliente',
  btnAprobar:          'Aprobar',
  btnRecordar:         'Enviar recordatorio',
  btnCobrar:           'Cobrar ahora',
  btnDuplicar:         'Duplicar',
  btnPdf:              'Descargar PDF',
  btnEditarLineas:     'Editar líneas',
  btnWhatsApp:         'Enviar por WhatsApp',
  btnNuevoAlbaran:     'Nuevo albarán',
  btnVerCliente:       'Ver cliente',
  btnMarcarRechazado:  'Marcar como rechazado',
  btnBorrar:           'Borrar',
};
`;
const AMBIGUOS = {
  [`${REL} · QUOTE_ACTION_ROTULOS (cabecera)`]: { clase: 'APROBADO', motivo: 'manda la firma del 17-ago (control del test)' },
};
const L_APROBAR = "  btnAprobar:          'Aprobar',\n";
const L_COBRAR = "  btnCobrar:           'Cobrar ahora',\n";
const L_RECHAZADO = "  btnMarcarRechazado:  'Marcar como rechazado',\n";
const L_BORRAR = "  btnBorrar:           'Borrar',\n";
const L_NUEVA = "  btnInventado:        'Texto que nadie ha firmado',\n";
const ABRE = 'const QUOTE_ACTION_ROTULOS = {\n';

const id = (clave) => `${REL} · QUOTE_ACTION_ROTULOS.${clave}`;

/** El fuente con `viejo` cambiado por `nuevo`. Si no cambia nada, la mutación no existió: cae. */
function mutar(fuente, viejo, nuevo) {
  assert.ok(fuente.includes(viejo), `🔴 CIEGO: la mutación no encuentra ${JSON.stringify(viejo)}`);
  const out = fuente.replace(viejo, nuevo);
  assert.notEqual(out, fuente, '🔴 CIEGO: la mutación no cambió nada');
  return out;
}

function censarCaso(fuente, ambiguos = AMBIGUOS) {
  const r = censar({ textos: new Map([[REL, fuente]]), ambiguos });
  assert.equal(r.estado, 'OK', '🔴 CIEGO: ' + JSON.stringify(r.ciegos));
  return r;
}

/** Lo declarado el día de la foto: lo que el censo da HOY sobre el caso sin mutar. */
function declaradosDe(r) {
  return {
    acusadas: Object.fromEntries(r.acusadas.map((h) => [h.id, { clase: h.clase, n: h.n, motivo: 'foto del test' }])),
    porGrupo: Object.fromEntries(r.porGrupo.map((h) => [h.id, h.n])),
  };
}

const fila = (h) => `${h.id.split(' · ')[1]}|${h.clase}|${h.porGrupo ? 'grupo' : h.desplazada ? 'desplazada' : 'acusada'}`;

const BASE = censarCaso(LOS_DOCE_13OCT);
const FOTO = declaradosDe(BASE);

test('SCRUM-1215g · BASE: el caso sin mutar da doce por grupo y una acusada, y el trinquete sale verde', () => {
  assert.equal(BASE.poblacion.hojas, 13, '🔴 SUELO: el caso tiene trece hojas');
  assert.equal(BASE.porGrupo.length, 12, 'las doce que caen bajo «los doce»');
  assert.deepEqual(BASE.acusadas.map((h) => h.id), [id('btnBorrar')]);
  // Las dos que la firma NO vio están entre las doce: es lo que el censo no sabe, y por eso existe
  // «porGrupoSinVer» en el JSON de verdad.
  assert.ok(BASE.porGrupo.some((h) => h.id === id('btnCobrar')) && BASE.porGrupo.some((h) => h.id === id('btnNuevoAlbaran')));
  assert.deepEqual(compararConDeclarados(BASE, FOTO), { nuevas: [], sobran: [] });
});

test('SCRUM-1215g · una hoja NUEVA en el sitio de una firmada sale en ROJO con su nombre (antes: APROBADO y verde)', () => {
  const r = censarCaso(mutar(LOS_DOCE_13OCT, L_APROBAR, L_NUEVA));
  // El censo la sigue leyendo APROBADO —lee comentarios, no fechas—: quien la caza es el trinquete.
  assert.equal(r.hojas.find((h) => h.id === id('btnInventado')).clase, 'APROBADO');
  const { nuevas, sobran } = compararConDeclarados(r, FOTO);
  assert.deepEqual(nuevas.map(fila), ['QUOTE_ACTION_ROTULOS.btnInventado|APROBADO|grupo']);
  assert.deepEqual(sobran.map(fila), ['QUOTE_ACTION_ROTULOS.btnAprobar|APROBADO|grupo']);
  assert.equal(queHacer(nuevas[0], 'nuevas'), QUE_HACER_NUEVA_GRUPO);
  assert.equal(queHacer(sobran[0], 'sobran'), QUE_HACER_SOBRA_GRUPO);
});

test('SCRUM-1215g · una hoja nueva añadida ARRIBA: se nombra a la intrusa, y a la que empuja se le dice que mire antes', () => {
  const r = censarCaso(mutar(LOS_DOCE_13OCT, ABRE, ABRE + L_NUEVA));
  const { nuevas, sobran } = compararConDeclarados(r, FOTO);
  assert.deepEqual(nuevas.map(fila).sort(), [
    'QUOTE_ACTION_ROTULOS.btnInventado|APROBADO|grupo',
    'QUOTE_ACTION_ROTULOS.btnMarcarRechazado|SIN_COMENTARIO|desplazada',
  ]);
  assert.deepEqual(sobran.map(fila), ['QUOTE_ACTION_ROTULOS.btnMarcarRechazado|APROBADO|grupo']);
  const empujada = nuevas.find((h) => h.desplazada);
  assert.equal(queHacer(empujada, 'nuevas'), QUE_HACER_DESPLAZADA);
});

test('SCRUM-1215g · las MISMAS trece hojas con dos cambiadas de sitio: el rojo dice que el reparto ha cambiado', () => {
  let f = mutar(LOS_DOCE_13OCT, L_BORRAR, '');
  f = mutar(f, L_COBRAR, L_BORRAR);
  f = mutar(f, L_RECHAZADO, L_RECHAZADO + L_COBRAR);
  const r = censarCaso(f);
  assert.equal(r.poblacion.hojas, 13, 'ni una hoja más ni una menos');
  const { nuevas, sobran } = compararConDeclarados(r, FOTO);
  assert.deepEqual(nuevas.map(fila).sort(), [
    'QUOTE_ACTION_ROTULOS.btnBorrar|APROBADO|grupo',
    'QUOTE_ACTION_ROTULOS.btnCobrar|SIN_COMENTARIO|desplazada',
  ]);
  assert.deepEqual(sobran.map(fila).sort(), [
    'QUOTE_ACTION_ROTULOS.btnBorrar|SIN_COMENTARIO|acusada',
    'QUOTE_ACTION_ROTULOS.btnCobrar|APROBADO|grupo',
  ]);
});

test('SCRUM-1215g · firma en plural SIN cuenta: lo que entra debajo tampoco pasa callado', () => {
  const dos = "// Textos APROBADOS por el fundador el 4-sep-2026 (control del test).\nconst T = {\n  uno: 'Primero',\n  dos: 'Segundo',\n};\n";
  const base = censarCaso(dos, {});
  const foto = declaradosDe(base);
  assert.deepEqual(base.porGrupo.map((h) => h.id), [`${REL} · T.dos`, `${REL} · T.uno`]);
  assert.deepEqual(compararConDeclarados(base, foto), { nuevas: [], sobran: [] });
  const r = censarCaso(mutar(dos, "  dos: 'Segundo',\n", "  dos: 'Segundo',\n  nueva: 'Texto que nadie ha firmado',\n"), {});
  assert.deepEqual(r.acusadas, [], 'el censo la da por APROBADA: sin la lista, esto era un verde');
  assert.deepEqual(compararConDeclarados(r, foto).nuevas.map(fila), ['T.nueva|APROBADO|grupo']);
});

test('SCRUM-1215g · la firma PROPIA no es de grupo: en su línea, o en singular encima; lo anidado sí lo es', () => {
  const fuente = [
    '// Los dos textos están APROBADOS por el fundador (control del test).',
    'const T = {',
    "  a: 'A',",
    "  b: 'B', // APROBADO por el fundador (control del test)",
    '  // APROBADO por el fundador (control del test)',
    "  c: 'C',",
    "  d: 'D',",
    '  // APROBADO por el fundador (control del test)',
    "  e: { e1: 'E1', e2: 'E2' },",
    "  f: 'F',",
    '};',
    '',
  ].join('\n');
  const r = censarCaso(fuente, {});
  const clases = Object.fromEntries(r.hojas.map((h) => [h.id.split(' · ')[1], h.clase]));
  // La cuenta («los dos») gasta sus huecos en `a` y en `b`, aunque `b` lleve la suya en su línea:
  // por eso `d` sale acusada. Es lo que el censo hacía ya, y acusar de más es la dirección segura.
  assert.deepEqual(clases, {
    'T.a': 'APROBADO', 'T.b': 'APROBADO', 'T.c': 'APROBADO', 'T.d': 'SIN_COMENTARIO',
    'T.e.e1': 'APROBADO', 'T.e.e2': 'APROBADO', 'T.f': 'SIN_COMENTARIO',
  });
  // De las cinco aprobadas, sólo `b` (en su línea) y `c` (singular encima) llevan firma PROPIA.
  assert.deepEqual(r.porGrupo.map((h) => h.id.split(' · ')[1]), ['T.a', 'T.e.e1', 'T.e.e2']);
  // Y una hoja nueva DENTRO del objeto firmado en singular también se nombra.
  const foto = declaradosDe(r);
  const r2 = censarCaso(mutar(fuente, "e2: 'E2' }", "e2: 'E2', e3: 'Texto que nadie ha firmado' }"), {});
  assert.deepEqual(compararConDeclarados(r2, foto).nuevas.map(fila), ['T.e.e3|APROBADO|grupo']);
});

test('SCRUM-1215g · un JSON SIN «porGrupo» no es «no hay ninguna»: las da todas por nuevas', () => {
  const { nuevas } = compararConDeclarados(BASE, { acusadas: FOTO.acusadas });
  assert.equal(nuevas.length, 12);
  assert.ok(nuevas.every((h) => h.porGrupo));
});

test('SCRUM-1215g · dos elementos de un array con la misma identidad: la lista guarda CUÁNTOS, y uno más se ve', () => {
  const dos = "// Textos APROBADOS por el fundador (control del test).\nconst T = { filas: [{ rotulo: 'Uno' }, { rotulo: 'Dos' }] };\n";
  const base = censarCaso(dos, {});
  assert.deepEqual(base.porGrupo, [{ id: `${REL} · T.filas[].rotulo`, n: 2 }]);
  const r = censarCaso(mutar(dos, "{ rotulo: 'Dos' }", "{ rotulo: 'Dos' }, { rotulo: 'Texto que nadie ha firmado' }"), {});
  const { nuevas } = compararConDeclarados(r, declaradosDe(base));
  assert.deepEqual(nuevas, [{ id: `${REL} · T.filas[].rotulo`, clase: 'APROBADO', n: 3, porGrupo: true }]);
});

// ── el árbol real ───────────────────────────────────────────────────────────────────────────────
test('SCRUM-1215g · árbol real: la lista «porGrupo» es exactamente lo que el censo aprueba por grupo, y se prueba FALLANDO', () => {
  const r = censar();
  assert.equal(r.estado, 'OK', '🔴 CIEGO: ' + JSON.stringify(r.ciegos));
  const decl = leerDeclarados();
  const lista = decl.porGrupo || {};
  assert.ok(r.porGrupo.length > 0, '🔴 SUELO: el censo no ve NINGUNA hoja aprobada por grupo en public/: o ya no queda ninguna (y sobra este test), o ha dejado de verlas');
  assert.deepEqual(compararConDeclarados(r, decl), { nuevas: [], sobran: [] }, 'BASE: sin mutar tiene que salir verde');
  for (const [k, n] of Object.entries(lista)) assert.ok(Number.isInteger(n) && n > 0, `«porGrupo» · ${k}: su valor es cuántas hojas (entero > 0), no ${JSON.stringify(n)}`);
  // Mutando lo DECLARADO (no el fuente: así no depende de qué objeto siga firmado en grupo mañana).
  const [quitada] = Object.keys(lista);
  const sinUna = { ...decl, porGrupo: Object.fromEntries(Object.entries(lista).filter(([k]) => k !== quitada)) };
  assert.deepEqual(compararConDeclarados(r, sinUna).nuevas, [{ id: quitada, clase: 'APROBADO', n: lista[quitada], porGrupo: true }]);
  const conOtra = { ...decl, porGrupo: { ...lista, 'public/no-existe.js · NADA.nada': 1 } };
  assert.deepEqual(compararConDeclarados(r, conOtra).sobran, [{ id: 'public/no-existe.js · NADA.nada', clase: 'APROBADO', n: 1, porGrupo: true }]);
});

test('SCRUM-1215g · «porGrupoSinVer»: cada una sigue en «porGrupo» y dice por qué se sabe que la firma no la vio', () => {
  const decl = leerDeclarados();
  const sinVer = decl.porGrupoSinVer || {};
  for (const [k, motivo] of Object.entries(sinVer)) {
    assert.ok(typeof motivo === 'string' && motivo.length > 40, `«porGrupoSinVer» · ${k}: sin motivo`);
    assert.ok(Object.hasOwn(decl.porGrupo || {}, k),
      `«porGrupoSinVer» · ${k} ya no está en «porGrupo» (lleva su marca en su línea, o se borró): quítala también de aquí`);
  }
});

test('SCRUM-1215g · la CLI: verde con la foto, y ROJO nombrando a la intrusa', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scrum1215g-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.mkdirSync(path.join(tmp, 'public'));
    const foto = { ambiguos: AMBIGUOS, acusadas: FOTO.acusadas, retiradas: [], porGrupo: FOTO.porGrupo };
    fs.writeFileSync(path.join(tmp, DECLARADOS_JSON), JSON.stringify(foto));
    fs.writeFileSync(path.join(tmp, 'public', 'x.js'), LOS_DOCE_13OCT);
    const base = spawnSync(process.execPath, [CLI, '--raiz', tmp], { encoding: 'utf8' });
    assert.equal(base.status, 0, 'BASE: con la foto, la CLI sale 0\n' + base.stdout + base.stderr);
    assert.match(base.stdout, /por firma de GRUPO \(no en su línea\): 12/);
    fs.writeFileSync(path.join(tmp, 'public', 'x.js'), mutar(LOS_DOCE_13OCT, L_APROBAR, L_NUEVA));
    const rojo = spawnSync(process.execPath, [CLI, '--raiz', tmp], { encoding: 'utf8' });
    assert.equal(rojo.status, 1, 'una hoja nueva en el sitio de una firmada: la CLI sale 1');
    assert.match(rojo.stdout, /NUEVA {2}public\/x\.js · QUOTE_ACTION_ROTULOS\.btnInventado {2}\[APROBADA POR GRUPO sin nombrar\]/);
    assert.match(rojo.stdout, /SOBRA {2}public\/x\.js · QUOTE_ACTION_ROTULOS\.btnAprobar {2}\[de «porGrupo»\]/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
