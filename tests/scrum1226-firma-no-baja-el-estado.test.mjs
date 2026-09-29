// tests/scrum1226-firma-no-baja-el-estado.test.mjs — SCRUM-1226
//
// 🔴 UNA FIRMA SUBE EL ESTADO DEL PARTE, NUNCA LO BAJA.
//
// `POST /admin/partes/:id/firmar` y `/firmar-tecnico` escribían `estado: 'firmado'` sin mirar el
// estado que había. Los candados son por RANURA (SCRUM-653), así que la segunda firma se acepta
// después de la primera: un parte en `facturado` con una ranura libre volvía a `firmado` al firmar
// esa ranura. Y `firmado` NO cierra los precios (`puedeEditarPrecios` solo cierra en `facturado`):
// **se reabrían los precios de un parte ya facturado.**
//
// Hoy nada en `src/` pone un parte en `facturado`, pero el estado está en `ESTADOS_PARTE` (Parte L)
// y es el que cierra los precios: el día que se construya facturar el parte, esto se activa solo.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Las RUTAS de verdad (`dist/…/partes.routes.js`), con la base doblada por `_envio-doblado.mjs`,
// como SCRUM-889b. Se mide el VIAJE: firmar y luego intentar valorar por el `PATCH` real. Que el
// estado siga en `facturado` es la mitad; que el `PATCH` de precios siga dando 409 es el daño.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';

const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));

const PARTE_ID = 1226;
const JOB_ID = 12260;
const TECNICO = 12261;
const TRAZO = 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(20);
const YA = '2026-09-20T10:00:00.000Z';

/** Un parte con líneas valoradas, en `estado`, con las firmas que se digan ya puestas. */
function parteGuardado({ estado, cliente, tecnico }) {
  return {
    id: PARTE_ID, merchantId: MERCHANT, jobId: JOB_ID, customerId: null,
    numero: 'PT-2026-1226', fecha: '2026-09-20T08:00:00.000Z', obra: 'C/ Mayor 3', referencia: null,
    entrada: '09:00', salida: '11:00', desplazamientos: null, kilometros: null, tecnicos: [],
    tipo: 'reparacion_asistencia',
    lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 2, descripcion: 'Hora de oficial', precioUnitario: 30, tipoIva: 0.21 }],
    notas: null, estado,
    firmadoAt: cliente ? YA : null, firmadoPorNombre: cliente ? 'Ana Prueba' : null,
    firmadoPorCalidad: cliente ? 'el_propio_cliente' : null, signatureUrl: cliente ? TRAZO : null,
    firmadoTecnicoAt: tecnico ? YA : null, firmadoTecnicoNombre: tecnico ? 'Técnico Prueba' : null,
    signatureTecnicoUrl: tecnico ? TRAZO : null,
    contenidoHash: cliente || tecnico ? 'huella-previa' : null, contenidoVersion: cliente || tecnico ? 2 : null,
  };
}

function manejador(router, metodo, ruta) {
  const capa = router.stack.find((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
  assert.ok(capa, `🔴 CIEGO: no encuentro ${metodo.toUpperCase()} ${ruta} en el router de partes`);
  const pila = capa.route.stack;
  return pila[pila.length - 1].handle;
}

function banco(inicial) {
  const fila = parteGuardado(inicial);
  const escrituras = [];
  inyectarBase({
    'parteTrabajo.findFirst': ({ where }) =>
      (where.id === fila.id && where.merchantId === MERCHANT ? copia(fila) : null),
    'job.findFirst': ({ where }) =>
      (where.id === JOB_ID && where.merchantId === MERCHANT
        ? { operarioId: TECNICO, assignedUserId: null, assignees: [] }
        : null),
    'parteTrabajo.update': ({ where, data }) => {
      assert.equal(where.id, fila.id);
      escrituras.push(copia(data));
      Object.assign(fila, copia(data));
      return copia(fila);
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const llamar = (metodo, ruta) => async ({ body, rol }) => {
    const h = manejador(router, metodo, ruta);
    const r = { status: 200, data: undefined };
    const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
    await h({ params: { id: String(PARTE_ID) }, body, merchantId: MERCHANT, userRole: rol, teamMemberId: rol === 'tecnico' ? TECNICO : null }, res);
    return r;
  };
  return {
    fila,
    escrituras,
    firmaCliente: () => llamar('post', '/:id/firmar')({
      rol: 'admin',
      body: { signatureData: TRAZO, firmadoPorNombre: 'Ana Prueba', firmadoPorCalidad: 'el_propio_cliente' },
    }),
    firmaTecnico: () => llamar('post', '/:id/firmar-tecnico')({
      rol: 'tecnico', body: { signatureData: TRAZO, firmadoTecnicoNombre: 'Técnico Prueba' },
    }),
    oficina: () => llamar('get', '/:id/oficina')({ rol: 'admin' }),
    valora: () => llamar('patch', '/:id')({ rol: 'admin', body: { precios: [{ indice: 0, id: 'l1', precioUnitario: 1 }] } }),
  };
}

// ── LOS DOS CASOS DEL DEFECTO ──────────────────────────────────────────────────────────────

const CASOS = [
  { nombre: 'firma el CLIENTE sobre un parte facturado que solo firmó el técnico', inicial: { estado: 'facturado', tecnico: true }, firma: 'firmaCliente', columna: 'signatureUrl' },
  { nombre: 'firma el TÉCNICO sobre un parte facturado que solo firmó el cliente', inicial: { estado: 'facturado', cliente: true }, firma: 'firmaTecnico', columna: 'signatureTecnicoUrl' },
];

for (const c of CASOS) {
  test(`🔴 SCRUM-1226 · ${c.nombre}: sigue en «facturado» y los precios siguen cerrados`, async () => {
    const b = banco(c.inicial);

    // SUELO: el parte de partida es el que el test dice (facturado, precios cerrados).
    const antes = await b.oficina();
    assert.equal(antes.status, 200, `🔴 CIEGO: el GET de oficina no responde (${antes.status})`);
    assert.equal(antes.data.puedeEditarPrecios.ok, false, '🔴 CIEGO: el parte de partida no tiene los precios cerrados');

    const r = await b[c.firma]();
    assert.equal(r.status, 200, `la firma se rechazó: ${JSON.stringify(r.data)}`);
    assert.equal(b.escrituras.length, 1, 'SUELO: la firma no llegó a escribir');

    // (2) La firma SE GUARDA: la segunda firma es un dato válido y se conserva.
    assert.equal(b.fila[c.columna], TRAZO, '🔴 la segunda firma no se guardó');

    // (1) El estado NO BAJA.
    assert.equal(b.fila.estado, 'facturado', '🔴 la firma devolvió un parte FACTURADO a «firmado»');

    // (3) Y el daño que eso causaba: los precios siguen cerrados, medido por el PATCH de verdad.
    const despues = await b.oficina();
    assert.equal(despues.data.puedeEditarPrecios.ok, false, '🔴 la firma REABRIÓ los precios de un parte facturado');
    const v = await b.valora();
    assert.equal(v.status, 409, `🔴 se pudieron cambiar los precios de un parte facturado tras la firma (${v.status})`);
    assert.equal(b.fila.lineas[0].precioUnitario, 30, '🔴 el precio de un parte facturado cambió');
  });
}

// ── CONTROLES: lo de siempre sigue igual ───────────────────────────────────────────────────

test('SCRUM-1226 · control: la PRIMERA firma sigue llevando un borrador a «firmado» (las dos rutas)', async () => {
  const c = banco({ estado: 'borrador' });
  assert.equal((await c.firmaCliente()).status, 200);
  assert.equal(c.fila.estado, 'firmado', '🔴 firmar el cliente ya no cierra el borrador');

  const t = banco({ estado: 'borrador' });
  assert.equal((await t.firmaTecnico()).status, 200);
  assert.equal(t.fila.estado, 'firmado', '🔴 firmar el técnico ya no cierra el borrador');
});

test('SCRUM-1226 · control: la segunda firma sobre un parte «firmado» lo deja en «firmado» y los precios abiertos', async () => {
  const b = banco({ estado: 'firmado', tecnico: true });
  assert.equal((await b.firmaCliente()).status, 200);
  assert.equal(b.fila.estado, 'firmado');
  assert.equal((await b.oficina()).data.puedeEditarPrecios.ok, true,
    '🔴 firmar cerró los precios de un parte solo firmado: la oficina ya no podría valorarlo');
});
