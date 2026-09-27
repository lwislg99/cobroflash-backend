// SCRUM-1175 (916a, PR-B) · Las dos firmas del parte, en su paso: título «Firmas» y una caja por
// firma con su aviso DENTRO.
//
// Lo que este PR NO hace, y este test lo fija:
//   · NO pinta «Sin las dos firmas el parte no se cierra.»: con UNA firma el parte ya es `firmado`
//     (`partes.routes.ts`), así que la frase afirmaría una regla que el producto no aplica.
//   · NO toca el camino sin conexión (SCRUM-890/919): la firma sigue saliendo por
//     `firmarConRedDeSeguridad` con los mismos tipos de cola y las mismas rutas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');

function pintar(parte) {
  const contenedor = { innerHTML: '' };
  const ctx = {
    console, window: null,
    document: { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, innerHTML: '' }) },
    Date, Array, Object, String, Number, JSON, Math,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(JS, 'utf8'), ctx, { filename: 'parteDetailView.js' });
  assert.equal(ctx.renderParte(contenedor, parte), true, '🔴 la vista se negó a pintar');
  assert.ok(contenedor.innerHTML.length > 1500, `🔴 CIEGO: pintó ${contenedor.innerHTML.length} caracteres`);
  return contenedor.innerHTML;
}

const BASE = Object.freeze({
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ bloque: 'mano_obra', unds: 2, descripcion: 'Revisión' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});

/** El HTML de la caja de esa firma (cliente | tecnico), o null. */
function caja(html, quien) {
  const m = html.match(new RegExp(`<div class="parte-firma-caja" data-parte-caja-firma="${quien}">([\\s\\S]*?)</div>`));
  return m ? m[1] : null;
}

test('SCRUM-1175b · el paso «Firmas» y una caja por firma, cada aviso en SU caja', () => {
  const html = pintar(BASE);
  assert.ok(html.includes('<h4 class="parte-firmas-titulo">Firmas</h4>'), '🔴 falta el título del paso');
  const cliente = caja(html, 'cliente');
  const tecnico = caja(html, 'tecnico');
  assert.ok(cliente && tecnico, '🔴 faltan las cajas de las dos firmas');
  assert.ok(cliente.includes('data-parte-firmar="1"') && cliente.includes('data-parte-falta-firma="cliente"'),
    '🔴 la caja del cliente no lleva su botón y su aviso');
  assert.ok(!cliente.includes('data-parte-falta-firma="tecnico"'), '🔴 el aviso del técnico cayó en la caja del cliente');
  assert.ok(tecnico.includes('data-parte-firmar-tecnico="1"') && tecnico.includes('data-parte-falta-firma="tecnico"'),
    '🔴 la caja del técnico no lleva su botón y su aviso');
});

test('SCRUM-1175b · firmadas las dos: cada caja dice quién firmó y no queda ningún «falta»', () => {
  const html = pintar({
    ...BASE, estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' },
    firmoElCliente: true, firmadoPorNombre: 'Ana', firmoElTecnico: true, firmadoTecnicoNombre: 'Israel',
  });
  assert.ok(caja(html, 'cliente').includes('Firmado por el cliente Ana'));
  assert.ok(caja(html, 'tecnico').includes('Firmado por el técnico Israel'));
  assert.ok(!html.includes('data-parte-falta-firma='), '🔴 pide una firma que ya está');
});

test('SCRUM-1175b · 🔴 «Sin las dos firmas el parte no se cierra.» NO se pinta en ningún estado', () => {
  const casos = [
    BASE,
    { ...BASE, estado: 'firmado', firmoElCliente: true, puedeEditarContenido: { ok: false, motivo: 'firmado' } },
    { ...BASE, estado: 'firmado', firmoElTecnico: true, puedeEditarContenido: { ok: false, motivo: 'firmado' } },
  ];
  for (const p of casos) {
    assert.ok(!/Sin las dos firmas/.test(pintar(p)),
      '🔴 se afirma una regla que el servidor no aplica: con UNA firma el parte ya es `firmado`.');
  }
});

test('SCRUM-1175b · 🔴 el camino sin conexión NO se toca: misma red de seguridad, mismos tipos y rutas', () => {
  const src = fs.readFileSync(JS, 'utf8');
  assert.match(src, /var firmar = o\.firmar \|\| window\.firmarConRedDeSeguridad;/,
    '🔴 la firma del parte ya no sale por firmarConRedDeSeguridad (la cola de SCRUM-890/919)');
  assert.match(src, /cliente: \{ tipo: 'parte', ruta: function \(id\) \{ return '\/admin\/partes\/' \+ id \+ '\/firmar'; \} \}/,
    '🔴 cambió el tipo de cola o la ruta de la firma del cliente');
  assert.match(src, /tecnico: \{ tipo: 'parte-tecnico', ruta: function \(id\) \{ return '\/admin\/partes\/' \+ id \+ '\/firmar-tecnico'; \} \}/,
    '🔴 cambió el tipo de cola o la ruta de la firma del técnico');
});
