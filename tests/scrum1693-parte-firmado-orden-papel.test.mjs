// SCRUM-1693 (X4 de la ③ de SCRUM-1686) · EL PARTE FIRMADO SE LEE EN EL ORDEN DE UN PAPEL.
//
// Anomalía d de SCRUM-1686 (captura `evidencias/SCRUM-1658/capturas/22-parte-firmado-1280.txt:31-45`):
// en un parte FIRMADO, «Datos del parte» salía DEBAJO de las firmas que cierran el documento.
// Firmado (D1-D3, SCRUM-1686 c.21461) y propuesto en §SCRUM-1686b: cabecera → datos del parte →
// horas → líneas → firmas AL FINAL → «Volver al trabajo».
//
// 🔴 El BORRADOR no cambia: allí manda lo que se apunta (SCRUM-1175 PR-C), y lo fija
// `tests/scrum1175c-datos-del-parte-plegados.test.mjs`. Aquí se repite como CONTROL, para que este
// fichero no se pueda poner en verde moviendo los datos arriba en los dos estados.
// Sin texto nuevo: sólo cambia el orden.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BORRADOR = Object.freeze({
  id: 5, numero: 'PT-2026-005', clienteNombre: 'Cliente de pruebas', jobId: 77,
  fecha: '2026-11-10T08:00:00.000Z', obra: 'Calle Mayor 14', referencia: null,
  entrada: '09:10', salida: '11:40', desplazamientos: 1, kilometros: 8,
  tecnicos: ['Operario'], tipo: 'reparacion_asistencia',
  lineas: [
    { bloque: 'mano_obra', unds: 2.5, descripcion: 'Cambio de latiguillos' },
    { bloque: 'materiales', unds: 2, descripcion: 'Latiguillo 40 cm' },
  ],
  notas: null, estado: 'borrador',
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
});
const FIRMADO = Object.freeze({
  ...BORRADOR, estado: 'firmado', firmoElCliente: true, firmoElTecnico: true,
  puedeEditarContenido: { ok: false, motivo: 'firmado' },
});

const attr = (n, a) => (n.getAttribute ? n.getAttribute(a) : null);
const clases = (n) => String(attr(n, 'class') || '').split(/\s+/);

function posiciones(parte) {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  assert.equal(b.ctx.renderParte(c, parte), true, '🔴 SUELO: la vista se negó a pintar');
  const n = todos(c);
  const donde = (pred, nombre) => {
    const i = n.findIndex(pred);
    assert.ok(i >= 0, `🔴 SUELO: no encuentro «${nombre}» en el parte ${parte.estado}`);
    return i;
  };
  return {
    cabecera: donde((x) => x.tagName === 'HEADER', 'la cabecera'),
    datos: donde((x) => attr(x, 'data-parte-datos-del-parte'), 'Datos del parte'),
    horas: donde((x) => clases(x).includes('parte-horas'), 'las horas'),
    manoObra: donde((x) => attr(x, 'data-parte-bloque') === 'mano_obra', 'mano de obra'),
    materiales: donde((x) => attr(x, 'data-parte-bloque') === 'materiales', 'materiales'),
    firmas: donde((x) => attr(x, 'data-parte-firmas'), 'las firmas'),
    salida: parte.estado === 'borrador' ? null : donde((x) => attr(x, 'data-parte-salida'), 'Volver al trabajo'),
  };
}

test('SCRUM-1686 X4 · 🔴 parte FIRMADO: cabecera → datos → horas → líneas → firmas → salida', () => {
  const p = posiciones(FIRMADO);
  const orden = [['cabecera', p.cabecera], ['datos del parte', p.datos], ['horas', p.horas],
    ['mano de obra', p.manoObra], ['materiales', p.materiales], ['firmas', p.firmas], ['volver al trabajo', p.salida]];
  for (let i = 1; i < orden.length; i++) {
    assert.ok(orden[i - 1][1] < orden[i][1],
      `🔴 en el parte firmado «${orden[i - 1][0]}» no va antes que «${orden[i][0]}»`);
  }
});

test('SCRUM-1686 X4 · CONTROL: el BORRADOR sigue con los datos plegados al final, tras las firmas', () => {
  const p = posiciones(BORRADOR);
  assert.ok(p.horas < p.manoObra && p.manoObra < p.firmas, '🔴 el borrador ha perdido su orden de trabajo');
  assert.ok(p.datos > p.firmas, '🔴 el borrador ha subido los datos del parte: eso no lo pide X4');
});

test('SCRUM-1686 X4 · los datos del parte firmado no pierden ninguno al moverse', () => {
  const b = cargarDashboard(RAIZ);
  const c = b.mk('div');
  b.ctx.renderParte(c, FIRMADO);
  const datos = todos(c).filter((x) => attr(x, 'data-parte-dato')).map((x) => attr(x, 'data-parte-dato'));
  assert.deepEqual([...datos].sort(),
    ['desplazamientos', 'entrada', 'kilometros', 'notas', 'obra', 'referencia', 'salida', 'tecnicos'],
    '🔴 el parte firmado ha perdido un dato');
});
