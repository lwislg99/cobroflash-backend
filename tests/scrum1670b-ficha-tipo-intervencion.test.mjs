// tests/scrum1670b-ficha-tipo-intervencion.test.mjs — SCRUM-1670 · mitad de FRONT (S2)
//
// Sin gate: monta la ficha del Trabajo en el banco de vistas con la red doblada. Ni BD, ni red real.
//
// S1 (#3199) hace que el GET del Trabajo devuelva `tipoIntervencion` (SCRUM-651: avería,
// mantenimiento, instalación), que se guardaba al crear y no volvía nunca. La ficha lo pinta como
// una línea de SOLO LECTURA en «El trabajo».
//
// 🔴 NO ES `tipoOperacion` (SCRUM-1670 c.21989). Aquél es la bandera fiscal que ya se pinta como
// «Tipo de trabajo» y se edita con sus dos tarjetas; éste es la clase de trabajo que eligió el
// profesional. Los DOS conviven: ninguno sustituye, tapa ni recoloca al otro.
//
// Sin dato no hay línea (cero textos nuevos: ni «Sin especificar» ni el valor en bruto).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Lo que manda `/admin/me`, sacado de SU FUENTE (src/modules/jobs/domain/tipoIntervencion.ts, vía
// dist) y no copiado: una segunda lista del vocabulario la caza scrum651, y con razón.
const { tiposIntervencionParaUI } = createRequire(import.meta.url)('../dist/modules/jobs/domain/tipoIntervencion.js');
const VOCABULARIO = tiposIntervencionParaUI();
const rotuloDe = (valor) => {
  const t = VOCABULARIO.find((x) => x.valor === valor);
  assert.ok(t, `🔴 SUELO: el vocabulario de la fuente ya no tiene «${valor}»`);
  return t.rotulo;
};

const linea = (n) => (n.dataset && n.dataset.linea) || (n.getAttribute && n.getAttribute('data-linea')) || null;
const clase = (n) => String((n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || '');
const conClase = (raiz, c) => todos(raiz).find((x) => clase(x).split(/\s+/).includes(c));

async function ficha(rol, extra, vocabulario = VOCABULARIO) {
  const job = Object.assign({
    id: 42, status: 'en_curso', createdAt: '2026-09-01T09:00:00Z', titulo: 'Reparación caldera',
    customer: { id: 5, name: 'Cliente Uno 1670' },
    asignados: [], operario: null, albaranes: [], gastos: [], notes: null,
    quote: { currency: 'EUR', total: 500 }, direccion: null, invoices: [],
    tipoOperacion: 'OPERACIONES_SUELTAS', tipoIntervencion: 'MANTENIMIENTO',
  }, extra || {});
  const banco = cargarDashboard(RAIZ);
  banco.ctx.apiRequest = async (u) => {
    const url = String(u);
    if (/\/admin\/team/.test(url)) return [];
    if (/\/admin\/merchant/.test(url)) return { name: 'Taller' };
    if (/\/admin\/partes/.test(url)) return { partes: [] };
    if (/gastos/.test(url)) return [];
    return job;
  };
  banco.ctx.appUserRole = rol;
  banco.ctx.appTiposIntervencion = vocabulario;
  const r = await pintarVista(banco, 'renderJobDetailView');
  assert.equal(r.error, null, `🔴 SUELO: la ficha no monta con rol ${rol} (${r.error && r.error.message})`);
  const n = todos(r.contenedor);
  const dets = n.filter((x) => linea(x));
  const lineas = dets.map(linea);
  assert.ok(lineas.includes('gastos'), `🔴 CIEGO: con rol ${rol} no se pintó «El trabajo» (líneas: ${JSON.stringify(lineas)})`);
  const de = (clave) => {
    const d = dets.find((x) => linea(x) === clave);
    if (!d) return null;
    const rot = conClase(d, 'detail-plega-rotulo');
    const val = conClase(d, 'detail-plega-valor');
    return {
      rotulo: String((rot && rot.textContent) || ''),
      valor: String((val && val.textContent) || ''),
      fija: clase(d).split(/\s+/).includes('detail-plega--fija'),
      cuerpo: !!conClase(d, 'detail-plega-cuerpo'),
    };
  };
  return { lineas, de };
}

test('SCRUM-1670b · 🔴 el jefe ve «Tipo de intervención» con el rótulo que manda el servidor', async () => {
  const f = await ficha('admin');
  const l = f.de('intervencion');
  assert.ok(l, `🔴 no hay línea de tipo de intervención: ${JSON.stringify(f.lineas)}`);
  assert.equal(l.rotulo, 'Tipo de intervención');
  assert.equal(l.valor, rotuloDe('MANTENIMIENTO'));
});

test('SCRUM-1670b · 🔴 el operario también la ve (no es dinero)', async () => {
  const l = (await ficha('tecnico', { tipoIntervencion: 'INSTALACION' })).de('intervencion');
  assert.ok(l, '🔴 al operario no se le pinta el tipo de intervención');
  assert.equal(l.valor, rotuloDe('INSTALACION'));
});

test('SCRUM-1670b · es de SOLO LECTURA: la línea no se abre (sin textos de guardado sin firmar)', async () => {
  const l = (await ficha('admin')).de('intervencion');
  assert.ok(l && l.fija && !l.cuerpo, `🔴 la línea se puede abrir: ${JSON.stringify(l)}`);
});

test('SCRUM-1670b · 🔴 CONVIVEN: «Tipo de trabajo» (tipoOperacion) sigue igual, y la nueva va justo debajo', async () => {
  const f = await ficha('admin');
  const t = f.de('tipo');
  assert.ok(t, '🔴 desapareció la línea de tipoOperacion');
  assert.equal(t.rotulo, 'Tipo de trabajo');
  // OPERACIONES_SUELTAS → su tarjeta; el tipo de intervención NO lo pisa.
  assert.equal(t.valor, 'Varios avisos o visitas sueltas');
  assert.equal(f.lineas.indexOf('intervencion'), f.lineas.indexOf('tipo') + 1,
    `🔴 orden inesperado: ${JSON.stringify(f.lineas)}`);
});

test('SCRUM-1670b · sin tipo de intervención NO hay línea', async () => {
  for (const v of [null, undefined, '']) {
    const f = await ficha('admin', { tipoIntervencion: v });
    assert.ok(!f.lineas.includes('intervencion'), `🔴 con ${JSON.stringify(v)} se pinta una línea: ${JSON.stringify(f.lineas)}`);
    assert.ok(f.lineas.includes('tipo'), '🔴 CONTROL: la línea de tipoOperacion se perdió');
  }
});

test('SCRUM-1670b · 🔴 un valor que no está en el vocabulario recibido NO se pinta en bruto', async () => {
  const fuera = await ficha('admin', { tipoIntervencion: 'LIMPIEZA' });
  assert.ok(!fuera.lineas.includes('intervencion'), '🔴 se pintó un valor que el servidor no nombra');
  // Sin vocabulario (no llegó `/admin/me`) tampoco se inventa el rótulo con el valor de la enum.
  const ciego = await ficha('admin', { tipoIntervencion: 'MANTENIMIENTO' }, []);
  assert.ok(!ciego.lineas.includes('intervencion'), '🔴 sin vocabulario se pintó el valor en bruto');
});

test('SCRUM-1670b · el rótulo es el MISMO literal del alta (no es un texto nuevo)', () => {
  const alta = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobNuevoModal.js'), 'utf8');
  assert.ok(alta.includes('<label for="tn-tipo">Tipo de intervención</label>'),
    '🔴 el alta ya no rotula así su campo: el rótulo de la ficha se queda sin procedencia');
  const plegable = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/jobTrabajoPlegable.js'), 'utf8');
  assert.ok(/const ROTULO_TIPO_INTERVENCION = 'Tipo de intervención';/.test(plegable),
    '🔴 la ficha no toma el rótulo de su constante');
  // Y ninguna lista del vocabulario en el navegador (fuente única: el servidor).
  const copiados = VOCABULARIO.filter((t) => plegable.includes(t.valor)).map((t) => t.valor);
  assert.deepEqual(copiados, [], '🔴 el vocabulario se copió al navegador');
});
