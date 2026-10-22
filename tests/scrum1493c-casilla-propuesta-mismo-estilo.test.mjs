// tests/scrum1493c-casilla-propuesta-mismo-estilo.test.mjs — SCRUM-1493c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA CASILLA DE LA DESCRIPCIÓN, EN LA PROPUESTA DEL DICTADO, CON EL MISMO ESTILO QUE LAS LÍNEAS YA
// GUARDADAS.
//
// Nombrado sin ticket en SCRUM-1493 c.19818/19819 (15-oct-2026, visto de paso al probar el 409
// simulado): «en la propuesta, la casilla de la descripción sale como una caja estrecha de borde
// fino, distinta de las casillas de las líneas guardadas que hay justo debajo». Causa: el `<input
// type="text" data-propuesta-desc>` de `pintarLineaPropuesta` no llevaba NINGUNA clase — sólo el
// estilo inline `flex:1;min-width:160px;font-size:14px` — así que heredaba el borde y la altura
// por defecto del navegador. Las líneas ya guardadas usan `.parte-linea-desc` (`styles.css`, de
// S2: min-height 44px, padding 8px 10px, borde de 1,5px con el color de los tokens).
//
// Arreglo: reusar esa MISMA clase desde `parteDetailView.js` (S4), sin tocar `styles.css` ni crear
// clase nueva — mismo patrón de reuso cross-carril que `job-toolbar-btn-44` en SCRUM-786d. El
// `font-size:14px` inline se queda: no era parte de la queja.
//
// Se mide el VIAJE completo (dictar → «Ordenar en líneas» → propuesta en pantalla), con el mismo
// montaje de SCRUM-1266/1302C/1493: `cargarDashboard` + un `datos(url, opts)` que contesta el POST
// de `/dictado` y el GET de la ficha.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, todos } from './_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASE = 'parte-linea-desc';

const PARTE = {
  id: 7, numero: 'PT-2026-001', clienteNombre: 'Comunidad Los Olivos',
  fecha: '2026-09-02T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: 'REF-778',
  entrada: '09:15', salida: '12:45', desplazamientos: 1, kilometros: 12.5,
  tecnicos: ['Israel'], tipo: 'mantenimiento',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Desplazamiento a obra' }],
  notas: '', estado: 'borrador', firmoElCliente: false, firmoElTecnico: false,
  puedeEditarContenido: { ok: true, motivo: null }, puedeEditarPrecios: { ok: true, motivo: null },
};

const PROPUESTA = {
  propuesta: {
    vacia: false,
    mano_obra: [{ unds: 1, descripcion: 'Purga del circuito' }],
    materiales: [{ unds: 1, descripcion: 'Detector' }],
    sinBloque: [],
    datosRetirados: [],
  },
  avisos: { cantidadesRetiradas: 'Falta la cantidad', datosRetirados: 'AVISO', sin_lineas_reconocidas: 'x' },
};

function montar() {
  const datos = (url, opts = {}) => {
    const u = String(url);
    const metodo = String(opts.method || 'GET').toUpperCase();
    if (metodo === 'POST' && /\/admin\/partes\/7\/dictado$/.test(u)) return PROPUESTA;
    if (/\/admin\/partes\/7$/.test(u)) return PARTE;
    return {};
  };
  return cargarDashboard(RAIZ, { datos });
}

const esperar = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

async function hastaLaPropuesta() {
  const banco = montar();
  const contenedor = banco.mk('div');
  banco.ctx.document.body.appendChild(contenedor);
  assert.equal(await banco.ctx.window.renderParteDetailView(contenedor, 7), true,
    '🔴 CIEGO: la ficha del parte no se pintó en el banco');
  const campo = contenedor.querySelector('[data-dictado-texto]');
  assert.ok(campo, '🔴 CIEGO: no está el campo del dictado');
  campo.value = 'He purgado el circuito y cambiado el detector';
  const ordenar = contenedor.querySelector('[data-dictado-ordenar]');
  assert.ok(ordenar && ordenar.click() > 0, '🔴 «Ordenar en líneas» no tiene a nadie escuchando');
  await esperar();
  return contenedor;
}

test('SCRUM-1493c · SUELO: la propuesta del dictado pinta sus líneas, con la casilla de descripción', async () => {
  const contenedor = await hastaLaPropuesta();
  const campos = todos(contenedor).filter((n) => n.getAttribute && n.getAttribute('data-propuesta-desc') === '1');
  assert.equal(campos.length, 2, `🔴 CIEGO: ${campos.length} casillas de descripción en la propuesta (eran 2).`);
});

test('SCRUM-1493c · cada casilla de descripción de la propuesta lleva la clase de las líneas ya guardadas', async () => {
  const contenedor = await hastaLaPropuesta();
  const campos = todos(contenedor).filter((n) => n.getAttribute && n.getAttribute('data-propuesta-desc') === '1');
  for (const c of campos) {
    assert.match(c.className, new RegExp(`\\b${CLASE}\\b`), `🔴 «${c.getAttribute('value')}» sigue sin la clase: "${c.className}".`);
  }
});

test('SCRUM-1493c · la casilla de UNIDADES de la propuesta NO se toca (la queja era sólo de la descripción)', async () => {
  const contenedor = await hastaLaPropuesta();
  const unds = todos(contenedor).filter((n) => n.getAttribute && n.getAttribute('data-propuesta-unds') === '1');
  assert.ok(unds.length >= 1, '🔴 CIEGO: no hay casillas de unidades en la propuesta.');
  for (const u of unds) assert.equal(u.className, '', `🔴 la casilla de unidades cambió de clase sin que se pidiera: "${u.className}".`);
});

test('SCRUM-1493c · la regla ya existe en `styles.css` (no se toca; es de S2) con su min-height de 44px', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(path.join(RAIZ, 'public/dashboard/css/styles.css'), 'utf8');
  assert.match(css, /\.parte-linea-unds,\s*\n\.parte-linea-desc\s*\{[^}]*min-height:\s*44px;/,
    '🔴 falta la regla de la casilla de línea (se esperaba ya existente, de SCRUM-1287).');
});
