// tests/scrum1673b-albaran-remates-front.test.mjs — SCRUM-1673 (pantalla) + SCRUM-1712 ① (pantalla)
//
// Dos remates de la ficha del Trabajo, agrupados en una pieza (mismo fichero, mismo editor):
//
//   ⓐ SCRUM-1673 · el 409 `albaran_sin_lineas` de `POST /admin/albaranes/:id/emitir` (#3117) llega
//     SIN `message`. La pantalla pinta el texto FIRMADO en SCRUM-1673 c.21707:
//     «No se puede emitir un albarán sin líneas. Añade al menos una línea con lo que se ha hecho.»
//     En el CTA de la cabecera (nextAct `emitir`) y en «Entregar y enviar a firmar» de la hoja de
//     alta, que además corta ANTES de crear: si no, dejaba un borrador vacío con número reservado.
//
//   ⓑ SCRUM-1712 ① · desde #3123 el servidor rechaza (403) que el técnico valore o escriba precios.
//     La hoja ya no le pinta la casilla «Incluir precios en el albarán», ni las columnas precio+IVA,
//     ni el total orientativo, ni «Ocultar precios en el albarán». Cero textos nuevos.
//
// Por el CAMINO REAL: se monta `buildAlbEditor` en el banco de vistas con el rol de cada uno, y la
// función del texto se llama desde el `window` que lee la ficha. El control positivo es la jefa,
// con el MISMO albarán: sin él, «no se ve» podría ser un banco que no pinta nada.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VISTA = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobDetailView.js'), 'utf8');

const FIRMADO = 'No se puede emitir un albarán sin líneas. Añade al menos una línea con lo que se ha hecho.';
const CASILLA = 'Incluir precios en el albarán';
const OCULTAR = 'Ocultar precios en el albarán';

// Un VALORADO en borrador con una línea con precio: el caso donde hay dinero que enseñar.
const VALORADO = {
  id: 7, estado: 'borrador', modoValoracion: 'VALORADO', notas: '',
  lineas: [{ concepto: 'Grifo monomando', cantidad: 2, unidad: 'ud', precioUnitario: 85, tipoIva: 21 }],
};

function montar(rol, alb = VALORADO) {
  const banco = cargarDashboard(RAIZ, { datos: () => ({}) });
  assert.deepEqual(banco.fallos, [], '🔴 el dashboard no carga limpio: el banco mediría otra cosa');
  banco.ctx.appUserRole = rol;
  const box = banco.mk('div');
  banco.ctx.document.body.appendChild(box);
  banco.ctx.buildAlbEditor(box, JSON.parse(JSON.stringify(alb)), {}, { cur: 'EUR' });
  const nodos = todos(box);
  const texto = (n) => String(n.textContent || '');
  // Visible = ni él ni ningún ancestro dentro del box con `display:none`.
  const visible = (n) => {
    for (let x = n; x && x !== box; x = x.parentNode) if (x.style && x.style.display === 'none') return false;
    return true;
  };
  // El banco no suma los nodos de texto al `textContent` de una LABEL (medido: el control positivo
  // daba 0 con la casilla pintada). Se cuentan las CASILLAS: la de «ocultar» lleva su marca propia.
  const esOcultar = (n) => typeof n.getAttribute === 'function' && n.getAttribute('data-ocultar-precios') === '1';
  const casillas = nodos.filter((n) => n.tagName === 'INPUT' && n.type === 'checkbox');
  return {
    banco,
    casilla: casillas.filter((n) => !esOcultar(n) && visible(n)),
    ocultar: casillas.filter((n) => esOcultar(n) && visible(n)),
    precios: nodos.filter((n) => n.tagName === 'INPUT' && (n.placeholder === 'Precio ud.' || n.placeholder === 'IVA %')),
    preciosVisibles: nodos.filter((n) => n.tagName === 'INPUT'
      && (n.placeholder === 'Precio ud.' || n.placeholder === 'IVA %') && visible(n)),
    conceptos: nodos.filter((n) => n.tagName === 'INPUT' && n.placeholder === 'Concepto'),
    total: nodos.filter((n) => texto(n).includes('Total orientativo') && n.children.length === 0),
  };
}

test('SCRUM-1712 ① · control positivo: la jefa SÍ ve casilla, columnas de precio, total y «ocultar»', () => {
  const v = montar('admin');
  assert.equal(v.conceptos.length, 1, '🔴 el editor no pintó la línea: no hay nada que medir');
  assert.equal(v.casilla.length, 1, `🔴 la jefa no ve «${CASILLA}»`);
  assert.equal(v.preciosVisibles.length, 2, '🔴 la jefa no ve precio + IVA de la línea');
  assert.equal(v.total.length, 1, '🔴 la jefa no ve el total orientativo');
  assert.equal(v.ocultar.length, 1, `🔴 la jefa no ve «${OCULTAR}» en un VALORADO`);
});

test('SCRUM-1712 ① · el técnico NO ve casilla, columnas de precio, total ni «ocultar» (mismo albarán)', () => {
  const v = montar('tecnico');
  assert.equal(v.conceptos.length, 1, '🔴 el editor no pintó la línea: el «no se ve» sería un banco vacío');
  assert.equal(v.precios.length, 2, '🔴 las columnas ni se crean: el control de visibilidad mediría nada');
  assert.equal(v.casilla.length, 0, `🔴 el técnico ve «${CASILLA}»: marcarla es un 403 seguro (#3123)`);
  assert.equal(v.preciosVisibles.length, 0, '🔴 el técnico ve precio/IVA de la línea');
  assert.equal(v.total.length, 0, '🔴 el técnico ve el total orientativo');
  assert.equal(v.ocultar.length, 0, `🔴 el técnico ve «${OCULTAR}» (y su nota «…puedes facturarlo»)`);
});

test('SCRUM-1712 ① · el técnico en un borrador SIN_VALORAR tampoco recibe el rótulo de «modo congelado»', () => {
  const v = montar('tecnico', { ...VALORADO, modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'Visita', cantidad: 1, unidad: 'ud' }] });
  assert.equal(v.conceptos.length, 1, '🔴 el editor no pintó la línea');
  const congelado = todos(v.banco.ctx.document.body).filter((n) => String(n.textContent || '').includes('modo congelado tras emitir'));
  assert.equal(congelado.length, 0, '🔴 un borrador del técnico dice «modo congelado tras emitir»: mentira en borrador');
  // Control positivo: el mismo técnico, con el albarán YA emitido, sí lo lee (el banco lo pinta).
  const e = montar('tecnico', { ...VALORADO, estado: 'emitido', modoValoracion: 'SIN_VALORAR', lineas: [{ concepto: 'Visita', cantidad: 1, unidad: 'ud' }] });
  const enEmitido = todos(e.banco.ctx.document.body).filter((n) => String(n.textContent || '').includes('modo congelado tras emitir'));
  assert.ok(enEmitido.length > 0, '🔴 ESCÁNER CIEGO: ni en emitido veo «modo congelado tras emitir»');
});

test('SCRUM-1673 · el 409 albaran_sin_lineas se traduce al texto firmado (c.21707), y sólo ése', () => {
  const { ctx, fallos } = cargarDashboard(RAIZ, { datos: () => ({}) });
  assert.deepEqual(fallos, []);
  assert.equal(typeof ctx.errorDeEmitirSinLineas, 'function', '🔴 la ficha no alcanza la traducción por window');
  assert.equal(ctx.errorDeEmitirSinLineas({ error: 'albaran_sin_lineas' }), FIRMADO);
  assert.equal(ctx.errorDeEmitirSinLineas({ error: 'albaran_locked' }), null, '🔴 traduce errores que no son el suyo');
  assert.equal(ctx.errorDeEmitirSinLineas(undefined), null);
});

// ── El cableado en los dos sitios que emiten desde la ficha, por AST (no se monta la ficha entera) ──
function funcionQueContiene(fuente, marca) {
  const sf = ts.createSourceFile('v.js', fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let mejor = null;
  const busca = (n) => {
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.getText(sf).includes(marca)) {
      if (!mejor || n.getText(sf).length < mejor.length) mejor = n.getText(sf);
    }
    ts.forEachChild(n, busca);
  };
  busca(sf);
  return mejor;
}

test('SCRUM-1673 · el CTA de la cabecera pasa el error por la traducción antes del rótulo genérico', () => {
  const fallo = funcionQueContiene(VISTA, "'No se pudo completar la acción'");
  assert.ok(fallo, '🔴 ESCÁNER CIEGO: no encuentro `falloDelCta`');
  const iTrad = fallo.indexOf('errorDeEmitirSinLineas');
  assert.ok(iTrad > 0, '🔴 `falloDelCta` no consulta `errorDeEmitirSinLineas`: el 409 sale con el rótulo genérico');
  assert.ok(iTrad < fallo.indexOf('mensajeDeFallo'), '🔴 el rótulo genérico gana a la traducción');
});

test('SCRUM-1673 · «Entregar y enviar a firmar» corta sin líneas ANTES del alta, y la hoja pinta el texto', () => {
  const entregar = funcionQueContiene(VISTA, '/enviar-para-firmar`');
  assert.ok(entregar && entregar.includes('crearAlbaran(cuerpo)'), '🔴 ESCÁNER CIEGO: no encuentro `onEntregarYFirmar`');
  const iCorte = entregar.search(/if \(!lineas\.length\)[\s\S]{0,200}albaran_sin_lineas[\s\S]{0,80}throw/);
  assert.ok(iCorte > 0, '🔴 sin el corte, «Entregar» crea un borrador vacío con número y luego el 409');
  assert.ok(iCorte < entregar.indexOf('crearAlbaran(cuerpo)'), '🔴 el corte va DESPUÉS del alta: el número ya se quemó');
  const hoja = funcionQueContiene(VISTA, "'No se pudo completar la entrega.'");
  assert.ok(hoja, '🔴 ESCÁNER CIEGO: no encuentro el catch de la hoja');
  assert.ok(hoja.indexOf('errorDeEmitirSinLineas') > 0
    && hoja.indexOf('errorDeEmitirSinLineas') < hoja.indexOf('mensajeParaPersona'),
  '🔴 el catch de la hoja no pinta el texto firmado antes del genérico');
});
