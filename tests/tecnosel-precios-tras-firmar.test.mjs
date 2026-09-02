// tests/tecnosel-precios-tras-firmar.test.mjs — sprint Tecnosel, fila 5
//
// UN PARTE FIRMADO SE TIENE QUE PODER VALORAR. HOY NO SE PODÍA POR NINGUNA VÍA.
//
// ── EL DEFECTO, MEDIDO ANTES DE TOCAR (certificación del sprint) ──────────────────────────
// `puedeEditarPrecios` existía, decía lo correcto —en `firmado` deja— y **no cerraba ninguna
// escritura**: sólo se calculaba y se devolvía (`partes.routes.ts:121`). El único `PATCH` se
// cerraba con `puedeEditarContenido` para la PETICIÓN ENTERA, y en `firmado` eso es `false`:
//
//     parte firmado + PATCH que sólo toca precios  →  409 `parte_locked`
//
// Resultado: el técnico firmaba en la obra sin importes —que es el diseño— y **el jefe no podía
// ponerlos nunca**. Sin valorar no se cobra. Era el agujero más caro del sprint.
//
// ── LO QUE SE VIGILA AHORA ────────────────────────────────────────────────────────────────
// Que el permiso se decida **POR CAMPO** y no por petición, con los dos grupos que fijó el
// fundador: contenido → `puedeEditarContenido`; precios → `puedeEditarPrecios`. Y que una
// petición MIXTA sobre un parte firmado se rechace ENTERA, nombrando el campo que la tumbó.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';
import {
  ESTADOS_PARTE,
  permisoDeCampos,
  puedeEditarContenido,
  puedeEditarPrecios,
} from '../dist/modules/jobs/domain/parteTrabajo.js';

// 🔴 LOS CAMPOS VAN LITERALES, NO DERIVADOS DEL MÓDULO QUE SE PRUEBA. Al derivarlos, mover
// `obra` del grupo de contenido al de precios habría hecho que este test SIGUIERA a la
// constante en silencio y aprobara el cambio. Escritos a mano, el cambio cae aquí. (Y así el
// módulo no necesita exportar sus dos listas: su consumidor real está dentro.)
const CONTENIDO = ['obra', 'referencia', 'entrada', 'salida', 'notas', 'tipo',
  'desplazamientos', 'kilometros', 'tecnicos', 'lineas'];
const PRECIOS = ['precios'];

const RAIZ = path.resolve(import.meta.dirname, '..');
const RUTAS = 'src/modules/jobs/app/routes/partes.routes.ts';
const leer = (p) => {
  try {
    return fs.readFileSync(path.join(RAIZ, p), 'utf8');
  } catch (e) {
    assert.fail(`🔴 no se pudo leer ${p} (${e && e.code ? e.code : e}). «No está» y «no supe mirar» son el mismo verde.`);
  }
};

// ── SUELO, PRIMERO ────────────────────────────────────────────────────────────────────────

test('tecnosel/5 · 🔴 SUELO: los dos grupos de campos NO están vacíos', () => {
  // Si una lista llegara vacía, todo lo de abajo pasaría sin comprobar nada: un permiso sobre cero
  // campos siempre da que sí.
  assert.ok(CONTENIDO.length > 0, '🔴 el grupo de CONTENIDO está vacío: nada que vigilar.');
  assert.ok(PRECIOS.length > 0, '🔴 el grupo de PRECIOS está vacío: nada que vigilar.');
  assert.ok(ESTADOS_PARTE.includes('firmado') && ESTADOS_PARTE.includes('facturado'),
    '🔴 no encuentro los estados que deciden: el resto del fichero no mide nada.');
});

// ── EL ROJO QUE DECIDE ────────────────────────────────────────────────────────────────────

test('tecnosel/5 · 🔴 parte FIRMADO + sólo precios → SE APLICA', () => {
  // Éste es el ticket entero. Hoy daba 409 y el parte se quedaba sin poder valorar.
  const r = permisoDeCampos('firmado', ['precios']);
  assert.equal(r.ok, true,
    '🔴 UN PARTE FIRMADO SIGUE SIN PODERSE VALORAR.\n\n'
    + '  El técnico firma en la obra SIN importes —eso es el diseño— y el jefe los pone después.\n'
    + '  Si esto se cierra, el parte llega firmado y sin valorar, y NADIE PUEDE COBRARLO.');

  // Y el candado que lo permite es el suyo, no otro: en `firmado`, contenido NO y precios SÍ.
  assert.equal(puedeEditarContenido('firmado').ok, false);
  assert.equal(puedeEditarPrecios('firmado').ok, true);
});

// ── LOS TRES CONTROLES NEGATIVOS ──────────────────────────────────────────────────────────

test('tecnosel/5 · 🔴 CONTROL NEGATIVO 1: firmado + contenido → 409 nombrando el campo', () => {
  for (const campo of CONTENIDO) {
    const r = permisoDeCampos('firmado', [campo]);
    assert.equal(r.ok, false, `🔴 se deja editar «${campo}» en un parte FIRMADO. Lo firmado no cambia.`);
    assert.equal(r.campo, campo,
      '🔴 el rechazo no dice QUÉ campo lo tumbó. Sin el nombre, quien lo recibe no sabe si quitar '
      + 'un campo o rendirse.');
    assert.equal(r.grupo, 'contenido');
    assert.ok(r.motivo && r.motivo.length > 0, '🔴 el rechazo llega sin motivo.');
  }
});

test('tecnosel/5 · 🔴 CONTROL NEGATIVO 2: FACTURADO + precios → 409 (regla 29)', () => {
  const r = permisoDeCampos('facturado', ['precios']);
  assert.equal(r.ok, false,
    '🔴 SE DEJAN TOCAR LOS PRECIOS DE UN PARTE YA FACTURADO. Los precios se cierran al facturar: '
    + 'cambiarlos después movería el importe de un documento que ya se emitió (regla 29).');
  assert.equal(r.grupo, 'precios');
  assert.equal(r.campo, 'precios');
  // Y en facturado no se puede NADA: ni contenido ni precios.
  assert.equal(permisoDeCampos('facturado', ['obra']).ok, false);
});

test('tecnosel/5 · 🔴 CONTROL NEGATIVO 3: petición MIXTA sobre firmado → rechazada ENTERA', () => {
  // El campo de precios va PRIMERO en la lista a propósito: si el permiso se cortara en el primer
  // campo permitido en vez de recorrerlos todos, esto pasaría y la petición se aplicaría a medias.
  const r = permisoDeCampos('firmado', ['precios', 'obra']);
  assert.equal(r.ok, false,
    '🔴 UNA PETICIÓN MIXTA SOBRE UN PARTE FIRMADO NO SE RECHAZA.\n\n'
    + '  Se aplicaría a medias: los precios sí y el contenido no. El documento quedaría en un estado\n'
    + '  que nadie pidió, y quien la mandó creyendo que fue entera no se enteraría.');
  assert.equal(r.campo, 'obra', '🔴 el rechazo tiene que nombrar el campo que lo impide, no otro.');
  assert.equal(r.grupo, 'contenido');
});

test('tecnosel/5 · 🔴 y en BORRADOR se puede todo: el control positivo del otro extremo', () => {
  for (const campo of [...CONTENIDO, ...PRECIOS]) {
    assert.equal(permisoDeCampos('borrador', [campo]).ok, true,
      `🔴 no se deja tocar «${campo}» en un BORRADOR. Entonces el parte no se puede ni escribir.`);
  }
});

// ── QUE LA RUTA LO USE, Y QUE NO APLIQUE NADA SI ALGO LO IMPIDE ───────────────────────────

test('tecnosel/5 · 🔴 la ruta decide POR CAMPO, y responde ANTES de construir el cambio', () => {
  const src = soloEjecutable(leer(RUTAS));
  assert.match(src, /const permiso = permisoDeCampos\(parte\.estado as EstadoParte, pedidos\)/,
    '🔴 el PATCH ha vuelto a decidir por PETICIÓN. Con eso, un parte firmado devuelve 409 hasta a '
    + 'una petición que sólo toca precios — que es el agujero que este trabajo cierra.');

  // 🔴 EL ORDEN IMPORTA Y POR ESO SE MIDE: si el permiso se comprobara DESPUÉS de construir `data`,
  // una petición mixta podría escribir parte de lo pedido antes de rechazarse.
  const iPermiso = src.indexOf('permisoDeCampos(');
  const iData = src.indexOf('const data: any = {}');
  assert.ok(iPermiso > 0 && iData > 0, '🔴 no encuentro las dos marcas: el instrumento no vale.');
  assert.ok(iPermiso < iData,
    '🔴 EL PERMISO SE COMPRUEBA DESPUÉS DE EMPEZAR A CONSTRUIR EL CAMBIO. Una petición mixta podría '
    + 'aplicarse a medias antes de que nadie la rechace.');

  assert.match(src, /campo: permiso\.campo/,
    '🔴 el 409 ha dejado de decir QUÉ campo lo tumbó.');
});

test('tecnosel/5 · el móvil del técnico sigue SIN ver un importe', () => {
  // 🔴 EL CONTROL QUE NO PUEDE CAER NUNCA. `serializeParteParaElTecnico` está escrito campo a campo
  // a propósito para que el dinero no cruce el cable al móvil. Este trabajo NO lo toca, y aquí se
  // comprueba que sigue siendo el que contesta al PATCH.
  const src = soloEjecutable(leer(RUTAS));
  assert.match(src, /return res\.json\(serializeParteParaElTecnico\(updated\)\)/,
    '🔴 el PATCH ha dejado de responder con el serializador del técnico. Si ahora devuelve otra '
    + 'cosa, hay que demostrar que el dinero no viaja — y este trabajo no toca ese serializador.');
});
