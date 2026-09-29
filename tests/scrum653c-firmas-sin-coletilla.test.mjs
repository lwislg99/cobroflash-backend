// SCRUM-653 (28-sep) · Los avisos de firma, sin «para cerrar el parte», y el aviso de que la
// primera firma congela lo apuntado. Firma por delegación del fundador: SCRUM-653 c.17354, opción B.
//
// Lo que fija, contra lo PINTADO (no contra el fuente):
//   · «Falta la firma del cliente.» / «Falta la firma del técnico.», cada uno en su caja.
//   · La coletilla «para cerrar el parte» no se pinta en NINGÚN estado: con UNA firma el parte ya
//     es `firmado` (`partes.routes.ts`), así que afirmaba una regla que el producto no aplica.
//   · «Con la primera firma, lo apuntado queda fijo.» SOLO mientras no ha firmado nadie; con una
//     firma, de cualquiera de los dos, desaparece.
//   · Y lo que ese texto AFIRMA se comprueba en el dominio: `puedeEditarContenido` solo abre en
//     `borrador`. Si alguien lo abre en `firmado`, el texto miente y este test cae.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = path.resolve(import.meta.dirname, '..');
const JS = path.join(RAIZ, 'public', 'dashboard', 'js', 'parteDetailView.js');
const { puedeEditarContenido, puedeEditarPrecios } = await import('../dist/modules/jobs/domain/parteTrabajo.js');

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
const FIRMADO = { estado: 'firmado', puedeEditarContenido: { ok: false, motivo: 'firmado' } };

const FIJO = 'Con la primera firma, lo apuntado queda fijo.';

function caja(html, quien) {
  const m = html.match(new RegExp(`<div class="parte-firma-caja" data-parte-caja-firma="${quien}"[^>]*>([\\s\\S]*?)</div>`));
  return m ? m[1] : null;
}

test('SCRUM-653c · nadie ha firmado: los dos «falta» sin coletilla y el aviso de que queda fijo', () => {
  const html = pintar(BASE);
  assert.ok(caja(html, 'cliente').includes('Falta la firma del cliente.</p>'), '🔴 el aviso del cliente no es el firmado');
  assert.ok(caja(html, 'tecnico').includes('Falta la firma del técnico.</p>'), '🔴 el aviso del técnico no es el firmado');
  assert.ok(html.includes('data-parte-primera-firma-fija="1"') && html.includes(FIJO),
    '🔴 falta el aviso de que la primera firma congela lo apuntado');
});

test('SCRUM-653c · con UNA firma, de cualquiera de los dos, el aviso de «queda fijo» desaparece', () => {
  const soloTecnico = pintar({ ...BASE, ...FIRMADO, firmoElTecnico: true, firmadoTecnicoNombre: 'Israel' });
  assert.ok(!soloTecnico.includes(FIJO), '🔴 avisa de algo que ya ha pasado (firmó el técnico)');
  assert.ok(caja(soloTecnico, 'cliente').includes('Falta la firma del cliente.</p>'), '🔴 no dice cuál falta');

  const soloCliente = pintar({ ...BASE, ...FIRMADO, firmoElCliente: true, firmadoPorNombre: 'Ana' });
  assert.ok(!soloCliente.includes(FIJO), '🔴 avisa de algo que ya ha pasado (firmó el cliente)');
  assert.ok(caja(soloCliente, 'tecnico').includes('Falta la firma del técnico.</p>'), '🔴 no dice cuál falta');
});

test('SCRUM-653c · 🔴 «para cerrar el parte» no se pinta en ningún estado', () => {
  // RESPALDO (SCRUM-237): el token es REAL, sale del registro de microcopy que lo tachó. Sin esto,
  // una frase mal copiada daría un «no aparece» verde para siempre.
  const registro = fs.readFileSync(path.join(RAIZ, 'docs', 'microcopy', '2026-09-04-SCRUM-653-las-dos-firmas.md'), 'utf8');
  const COLETILLA = 'para cerrar el parte';
  assert.ok(registro.includes(`~~Falta la firma del cliente ${COLETILLA}.~~`), '🔴 CIEGO: la coletilla no es la real');
  for (const parte of [
    BASE,
    { ...BASE, ...FIRMADO, firmoElTecnico: true },
    { ...BASE, ...FIRMADO, firmoElCliente: true },
  ]) {
    assert.ok(!pintar(parte).includes(COLETILLA), '🔴 vuelve a prometer que falta una firma para cerrar');
  }
});

test('SCRUM-653c · lo que el texto AFIRMA: el contenido solo se edita en borrador; los precios no se nombran', () => {
  assert.equal(puedeEditarContenido('borrador').ok, true, '🔴 CIEGO: ni el borrador se deja editar');
  assert.equal(puedeEditarContenido('firmado').ok, false, '🔴 «queda fijo» miente: un parte firmado se edita');
  assert.equal(puedeEditarContenido('facturado').ok, false, '🔴 «queda fijo» miente: un parte facturado se edita');
  // Por eso el texto NO habla de precios: tras firmar siguen abiertos.
  assert.equal(puedeEditarPrecios('firmado').ok, true);
  assert.ok(!/precio|importe/i.test(FIJO));
});
