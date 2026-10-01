// SCRUM-1318 · `POST /admin/team/:id/resend` DICE SI EL CORREO SALIÓ — medido por EFECTO y SIN BASE.
//
// La lista de aparcadas de `sendEndpointDeclarations.ts` decía de esta ruta: «responde {ok:true}
// SIEMPRE, sin campo `sent`». SCRUM-131 lo arregló y la ficha se quedó puesta. Antes de moverla a
// la lista de declaradas hay que VER el contrato, no leerlo: declarar un `sent` que la ruta no
// devuelve sería mentir en el fichero que existe para que no se mienta.
//
// POR QUÉ HACE FALTA ESTE FICHERO HABIENDO `scrum131-resend-honesto`: aquél levanta la app contra
// una base y va gateado por `QA_DB_TEST`, así que en la tanda normal SALTA. Su verde ahí no dice
// nada de esta ruta. Éste corre siempre.
//
// QUÉ SE DOBLA Y QUÉ NO. Se dobla la base y el emisor de correo (`integrations/enviarCorreo`), que
// es el último eslabón. NO se dobla nada de lo que se mide: la ruta, `resendInvite` e
// `inviteTeamMember` son el código de producción. El fallo se provoca abajo del todo —el proveedor
// contesta que no salió— y tiene que llegar hasta el cuerpo de la respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));

const M = 4318;
const MIEMBRO = 1318;

const estado = { miembro: null, correo: null, enviados: [], invitaciones: [] };

function nuevoCaso({ status = 'invited', correo = { enviado: true } } = {}) {
  estado.miembro = { id: MIEMBRO, merchantId: M, name: 'Operaria de prueba', email: 'operaria@example.invalid', status, role: 'tecnico' };
  estado.correo = correo;
  estado.enviados = [];
  estado.invitaciones = [];
}

const doble = dobleDeLaBase({
  'teamMember.findFirst': (a) => (a?.where?.id === estado.miembro.id && a?.where?.merchantId === estado.miembro.merchantId ? { ...estado.miembro } : null),
  'merchant.findUnique': () => ({ id: M, name: 'Reformas de prueba' }),
  'authSession.create': (a) => { estado.invitaciones.push(a?.data); return { id: 1, ...a?.data }; },
});

const fPrisma = rutaDe('dist/core/db/prisma.js');
requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };

// El emisor único de correo. Devuelve lo que el caso diga, con la forma de `ResultadoCorreo`.
const fCorreo = rutaDe('dist/integrations/enviarCorreo.js');
const sinUso = (nombre) => () => { throw new Error(`🔴 el doble de enviarCorreo no imita \`${nombre}\` y alguien lo ha llamado`); };
requiere.cache[fCorreo] = {
  id: fCorreo, filename: fCorreo, loaded: true,
  exports: {
    enviarCorreo: async (c) => { estado.enviados.push(c); return { ...estado.correo }; },
    enviarPorResend: sinUso('enviarPorResend'),
    resultadoSinDestino: sinUso('resultadoSinDestino'),
  },
};

const { config } = requiere(rutaDe('dist/core/config/env.js'));
const m = requiere(rutaDe('dist/modules/team/app/routes/team.routes.js'));
const router = m.default || m;
const capa = router.stack.find((l) => l.route?.path === '/:id/resend' && l.route.methods.post);
assert.ok(capa, '🔴 CIEGO: no encuentro POST /:id/resend en team.routes');
const resendH = capa.route.stack.at(-1).handle;

/**
 * Llama a la ruta real. `conProveedor` decide si hay correo configurado: se cambia en el objeto
 * `config` de ESTE proceso (una cadena de relleno, no una clave) y se restaura. Silencia la
 * consola durante la llamada: sin proveedor, el código imprime el enlace de invitación.
 */
async function reenviar({ conProveedor, id = MIEMBRO }) {
  const antes = { RESEND_API_KEY: config.RESEND_API_KEY, SMTP_URL: config.SMTP_URL };
  const consola = { log: console.log, warn: console.warn, error: console.error };
  Object.assign(config, { RESEND_API_KEY: conProveedor ? 'relleno-de-test' : '', SMTP_URL: '' });
  console.log = console.warn = console.error = () => {};
  const r = { statusCode: 200, cuerpo: null };
  const res = { status(c) { r.statusCode = c; return res; }, json(x) { r.cuerpo = x; return res; } };
  try {
    await resendH({ merchantId: M, userRole: 'admin', params: { id: String(id) }, body: {}, headers: {} }, res, (e) => { if (e) throw e; });
    return r;
  } finally {
    Object.assign(console, consola);
    Object.assign(config, antes);
  }
}

// ── CONTROL POSITIVO: CUANDO SALE, DICE QUE SALIÓ ────────────────────────────────────────

test('SCRUM-1318 · ✅ CONTROL POSITIVO: el correo sale → 200 con `sent: true`', async () => {
  nuevoCaso({ correo: { enviado: true } });
  const r = await reenviar({ conProveedor: true });
  assert.equal(estado.enviados.length, 1, '🔴 MUDO: no se llegó a llamar al emisor de correo');
  assert.equal(estado.enviados[0].to, estado.miembro.email);
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.cuerpo, { ok: true, sent: true });
});

// ── EL HECHO: CUANDO NO SALE, EL CUERPO LO DICE ──────────────────────────────────────────

test('SCRUM-1318 · 🔴 el proveedor contesta que el correo NO salió → `sent: false` y el motivo, en la raíz del cuerpo', async () => {
  nuevoCaso({ correo: { enviado: false, motivo: 'proveedor_caido' } });
  const r = await reenviar({ conProveedor: true });

  assert.equal(estado.enviados.length, 1, '🔴 MUDO: no se llegó a llamar al emisor de correo, así que no se ha medido su fallo');
  assert.equal(estado.invitaciones.length, 1, 'la invitación SÍ se regeneró: lo que falla es la entrega');
  assert.equal(r.statusCode, 200, 'se mantiene el 200 a propósito (SCRUM-131)');
  assert.equal(r.cuerpo?.sent, false,
    '🔴 LA RUTA DICE QUE EL CORREO SALIÓ Y NO SALIÓ. El administrador lee «invitación reenviada» y la '
    + `persona no recibe nada. Cuerpo: ${JSON.stringify(r.cuerpo)}`);
  assert.equal(r.cuerpo.error, 'email_send_failed', 'y lleva el motivo, legible por máquina');
  assert.equal(typeof r.cuerpo.message, 'string');
  assert.ok(r.cuerpo.message.length > 0, 'y un texto para la persona');
  assert.equal(r.cuerpo.ok, true, 'el contrato de sendOutcome: `ok` habla de la petición, `sent` de la entrega');
});

test('SCRUM-1318 · 🔴 sin proveedor de correo configurado → `sent: false` con `not_configured`, sin llamar al emisor', async () => {
  nuevoCaso({ correo: { enviado: true } });
  const r = await reenviar({ conProveedor: false });

  assert.equal(estado.invitaciones.length, 1, '🔴 MUDO: no se llegó a regenerar la invitación');
  assert.equal(estado.enviados.length, 0, 'sin proveedor no se intenta el envío');
  assert.equal(r.statusCode, 200);
  assert.equal(r.cuerpo?.sent, false,
    `🔴 sin proveedor el correo no va a ninguna parte y la ruta dice que salió. Cuerpo: ${JSON.stringify(r.cuerpo)}`);
  assert.equal(r.cuerpo.error, 'not_configured');
});

// ── LO QUE NO ES UN ENVÍO FALLIDO SIGUE SIENDO UN ERROR ──────────────────────────────────

test('SCRUM-1318 · un miembro que no existe o está suspendido NO se disfraza de envío: 404 y 409, sin `sent`', async () => {
  nuevoCaso();
  const noExiste = await reenviar({ conProveedor: true, id: MIEMBRO + 1 });
  assert.equal(noExiste.statusCode, 404);
  assert.equal('sent' in noExiste.cuerpo, false);

  nuevoCaso({ status: 'suspended' });
  const suspendido = await reenviar({ conProveedor: true });
  assert.equal(suspendido.statusCode, 409);
  assert.equal(suspendido.cuerpo.error, 'member_suspended');
  assert.equal(estado.invitaciones.length, 0, 'a un suspendido no se le regenera la invitación');
});
