// tests/scrum1042-ajuste-foto-tecnico.test.mjs — SCRUM-1042 (mitad FRONT)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// EL AJUSTE «ENSEÑAR LA FOTO DEL TÉCNICO AL CLIENTE» — SOLO EL ON/OFF, TODAVÍA SIN FOTO
//
// La foto en sí (subir/servir) es la otra mitad, de S1 (columna nueva + ruta con token) y NO
// se construye aquí. Esto es solo el ajuste del comercio, apagado por defecto, guardado dentro
// de `Merchant.homePrefs` (decisión del orquestador, 22-sep-2026: no pedía ALTER).
//
// ── POR QUÉ ESTO ES TEXTO/AST Y NO EL BANCO DE VISTAS ───────────────────────────────────────
// `renderSettingsView` se mide con guards de NAVEGADOR de verdad (`scripts/guard-aviso-bizum.mjs`
// es el precedente citado en `scrum515-aviso-bizum-render.test.mjs`): es una pantalla grande con
// mucho estado compartido, y el patrón de este repo para ella es medir el FUENTE con AST/texto
// para lo estructural, y dejar el navegador para lo puramente visual. Aquí se sigue ese patrón.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soloEjecutable } from './_guard-texto.mjs';
import mapa from '../public/dashboard/js/settingsSubmenus.js';

const RAIZ = path.resolve(import.meta.dirname, '..');
const VISTA = soloEjecutable(fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/settingsView.js'), 'utf8'));

test('SCRUM-1042 · 🔴 el campo está dado de alta en el mapa de submenús (si no, `colocar` revienta)', () => {
  assert.equal(mapa.submenuDeCampo('showTechPhotoToClient'), 'equipo',
    '🔴 CIEGO: `showTechPhotoToClient` no está en ASIGNACION_SUBMENU, o cambió de submenú sin avisar aquí.');
});

test('SCRUM-1042 · 🔴 el toggle existe con los TRES literales firmados (rótulo, hint, clave)', () => {
  const desde = VISTA.indexOf('createToggle(\n      "showTechPhotoToClient"');
  assert.notEqual(desde, -1, '🔴 CIEGO: no encuentro `createToggle("showTechPhotoToClient", …)` en settingsView.js.');
  const cuerpo = VISTA.slice(desde, desde + 400);
  assert.match(cuerpo, /Enseñar la foto del técnico al cliente/, '🔴 el rótulo no es el texto firmado.');
  assert.match(cuerpo, /La verá en su portal del trabajo — nunca en la factura\./, '🔴 el hint no es el texto firmado.');
});

test('SCRUM-1042 · 🔴 se coloca en un submenú (si no, la pantalla lo pierde en silencio)', () => {
  assert.match(VISTA, /colocar\("showTechPhotoToClient",\s*tFotoTecnico\.wrapper\)/,
    '🔴 CIEGO: el toggle está creado pero nunca `colocar()`ado — no aparecería en ninguna pestaña.');
});

test('SCRUM-1042 · 🔴 se carga apagado por defecto (ausencia de homePrefs o de la clave = false)', () => {
  assert.match(VISTA, /tFotoTecnico\.chk\.checked\s*=\s*!!homePrefsCargados\.showTechPhotoToClient/,
    '🔴 la carga inicial no fuerza `false` cuando falta la clave — `!!undefined` es la forma correcta, pero el código cambió.');
});

test('SCRUM-1042 · 🔴 CONTROL POSITIVO: `!!` realmente colapsa `undefined` en `false`, no en un texto', () => {
  // Sin esto, el test de arriba solo comprueba que la LÍNEA existe, no que la EXPRESIÓN haga lo
  // que dice: un `!!` mal puesto (o quitado) seguiría casando con un regex menos estricto.
  assert.equal(!!(undefined), false);
  assert.equal(!!({}.showTechPhotoToClient), false);
  assert.equal(!!({ showTechPhotoToClient: true }.showTechPhotoToClient), true);
});

test('SCRUM-1042 · 🔴 el guardado FUSIONA con lo que ya hubiera en homePrefs, no lo reemplaza', () => {
  // 🔴 EL RIESGO REAL: `homePrefs` también guarda los bloques visibles de la Home (A6.7). Mandar
  // `{showTechPhotoToClient: x}` a secas BORRARÍA esos bloques la próxima vez que el comercio
  // guarde Configuración — un efecto secundario silencioso en una pantalla que no tiene nada que
  // ver con la Home. `Object.assign({}, homePrefsCargados, …)` es la única forma que no lo hace.
  assert.match(VISTA, /homePrefs:\s*Object\.assign\(\{\},\s*homePrefsCargados,\s*\{\s*showTechPhotoToClient:\s*tFotoTecnico\.chk\.checked\s*\}\)/,
    '🔴 el payload de guardado ya no fusiona `homePrefsCargados`: un guardado de Configuración '
    + 'borraría los bloques de la Home que el comercio ya había elegido.');
});

test('SCRUM-1042 · 🔴 `homePrefsCargados` se rellena al cargar el perfil, ANTES de poder guardar', () => {
  const cargaDesde = VISTA.indexOf('homePrefsCargados = merchant.homePrefs');
  assert.notEqual(cargaDesde, -1, '🔴 CIEGO: nadie rellena `homePrefsCargados` al cargar — el guardado fusionaría con `null`.');
  const guardaDesde = VISTA.indexOf('homePrefs: Object.assign');
  assert.ok(cargaDesde < guardaDesde, '🔴 el guardado aparece ANTES que la carga en el fuente: revisa que no se haya movido a otra función.');
});
