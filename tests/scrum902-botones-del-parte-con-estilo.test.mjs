// tests/scrum902-botones-del-parte-con-estilo.test.mjs — SCRUM-902
//
// EL BOTÓN «FIRMA DEL TÉCNICO» SALÍA COMO BOTÓN NATIVO (gris, borde de sistema) A 390 PX.
//
// Medido (17-sep-2026, staging y banco local): los botones del parte NO llevan `class`; los estiliza
// `styles.css` por ATRIBUTO desde SCRUM-720 (`[data-parte-firmar]`, `[data-dictado-ordenar]`…). El del
// técnico se pinta con `data-parte-firmar-tecnico`, que es OTRO atributo: `[data-parte-firmar]` no casa
// con él, así que ninguna regla le llega.
//
// El guard no mira ese botón por su nombre: pinta el parte con el dashboard entero y exige que TODO
// botón sin clase tenga al menos un selector por atributo en `styles.css`. Así cae también el próximo
// botón que alguien añada con un `data-` nuevo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // sin comentarios: un selector citado en un comentario no estiliza nada

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-16T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
  entrada: null, salida: null, desplazamientos: null, kilometros: null, tecnicos: [],
  tipo: 'reparacion_asistencia', notas: null, estado: 'borrador',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión de caldera' }],
  firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null },
  puedeEditarPrecios: { ok: true, motivo: null },
};

function red(parte) {
  const resp = (status, data) => ({
    ok: status < 300, status, statusText: String(status), headers: { get: () => 'application/json' },
    json: async () => data, blob: async () => ({}), text: async () => JSON.stringify(data),
  });
  return {
    fetch: async () => resp(200, parte),
    navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } },
  };
}

/** Los botones SIN clase del parte pintado, con sus atributos `data-*`. */
async function botonesSinClase(parte) {
  const banco = cargarDashboard(RAIZ, { red: red(parte) });
  const r = await pintarVista(banco, 'renderParteDetailView', parte.id);
  assert.ok(!r.error, `🔴 SUELO: el parte no se ha pintado: ${r.error && r.error.message}`);
  return todos(r.contenedor)
    .filter((n) => n.tagName === 'BUTTON' && !String(n.className || '').trim())
    .map((n) => Object.keys(n._attrs || {}).filter((k) => k.startsWith('data-')));
}

/** ¿Hay en `styles.css` un selector exactamente `[atributo]` (no `[atributo-otra-cosa]`)? */
const tieneRegla = (atributo) => new RegExp(`\\[${atributo.replace(/[-]/g, '\\-')}(?:[~|^$*]?=[^\\]]*)?\\](?![\\w-])`).test(CSS);

test('SCRUM-902 · SUELO: el banco ve los botones sin clase del parte y reconoce uno que SÍ tiene estilo', async () => {
  const botones = await botonesSinClase(PARTE);
  assert.ok(botones.some((attrs) => attrs.includes('data-parte-firmar')),
    '🔴 SUELO: no veo el botón de firmar del cliente; el «no tiene regla» de abajo no probaría nada. ' + JSON.stringify(botones));
  assert.equal(tieneRegla('data-parte-firmar'), true, '🔴 SUELO: el lector del CSS no reconoce la regla que sí existe');
  assert.equal(tieneRegla('data-parte-firmar-otra'), false, '🔴 SUELO: el lector del CSS da por buena una regla que no existe');
});

test('SCRUM-902 · 🔴 todo botón sin clase del parte tiene una regla en styles.css (ninguno sale nativo)', async () => {
  for (const parte of [PARTE, { ...PARTE, firmoElCliente: true, firmadoPorNombre: 'Ana Ruiz' }]) {
    const botones = await botonesSinClase(parte);
    const nativos = botones.filter((attrs) => !attrs.some(tieneRegla));
    assert.deepEqual(nativos, [],
      `🔴 estos botones del parte no tienen ni clase ni regla por atributo: salen como botón nativo del navegador.\n` +
      `  ${JSON.stringify(nativos)}`);
  }
});

test('SCRUM-902 · 🔴 «Firma del técnico» llega a 44 px en móvil y NO compite con la primaria verde', () => {
  const bloques = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1], cuerpo: m[2] }));
  const suyos = bloques.filter((b) => /\[data-parte-firmar-tecnico\](?![\w-])/.test(b.sel));
  assert.ok(suyos.some((b) => /min-height:\s*44px/.test(b.cuerpo)), '🔴 ninguna regla le da los 44 px de AB6');
  assert.ok(!suyos.some((b) => /background:\s*var\(--brand\)/.test(b.cuerpo)),
    '🔴 el botón del técnico lleva el verde de marca: dos primarias verdes en la misma pantalla (Regla de Una Sola Voz)');
});
