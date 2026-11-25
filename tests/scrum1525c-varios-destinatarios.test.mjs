// SCRUM-1525c · `BACKUP_EMAIL_DESTINO` admite VARIAS direcciones, separadas por comas.
//
// Por qué: el fundador quiere que el correo del respaldo llegue a dos personas. El respaldo pasa la
// variable tal cual al transportador (`respaldo-programado.mjs`), y el de Resend la mandaba como
// `to: [to]`: con «a, b» Resend recibía UNA dirección inválida y no llegaba NADA — ni el respaldo
// ni el aviso de que había fallado. El camino SMTP (nodemailer) ya aceptaba la lista con comas.
//
// Qué se ata aquí:
//   · por Resend, «a, b» sale como DOS destinatarios (recortados, sin piezas vacías);
//   · un array se respeta tal cual;
//   · con UNA dirección el cuerpo sale byte a byte igual que antes (el control negativo: el aviso
//     de SCRUM-1109 usa el mismo transportador con una sola dirección);
//   · `validarCorreo` trata una lista con alguna pieza vacía o sin `@` como «falta
//     BACKUP_EMAIL_DESTINO», para que nunca se intente mandar a una dirección rota.
//
// Sin red: la petición se inyecta, como en los tests de 1109 y 1525b. Solo direcciones de
// `example.com`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearTransportadorResend } from '../scripts/aviso-programado-acreditacion-invoicing-es.mjs';
import { validarCorreo } from '../scripts/respaldo-programado.mjs';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'scripts/aviso-programado-acreditacion-invoicing-es.mjs',
    de: 'to: destinatariosDe(to),',
    a: 'to: [to],',
    cae: 'SCRUM-1525c · por Resend, «a, b» sale como DOS destinatarios',
  },
  {
    fichero: 'scripts/respaldo-programado.mjs',
    de: 'if (!destinosValidos(env.BACKUP_EMAIL_DESTINO))',
    a: 'if (!env.BACKUP_EMAIL_DESTINO)',
    cae: 'SCRUM-1525c · una lista con una pieza vacía o sin arroba cuenta como «falta BACKUP_EMAIL_DESTINO»',
  },
];

/** Un transportador de Resend que no sale a la red: guarda el cuerpo CRUDO de cada petición. */
function resendDePrueba() {
  const cuerpos = [];
  const tr = crearTransportadorResend('clave-de-prueba', {
    peticion: async (url, opciones) => { cuerpos.push(opciones.body); return { ok: true, status: 200, text: async () => '{}' }; },
  });
  return { tr, cuerpos };
}

test('SCRUM-1525c · por Resend, «a, b» sale como DOS destinatarios, recortados y sin piezas vacías', async () => {
  const { tr, cuerpos } = resendDePrueba();
  await tr.sendMail({ from: 'yaqu@example.com', to: 'a@example.com, b@example.com', subject: 'S', text: 'T' });
  await tr.sendMail({ from: 'yaqu@example.com', to: ' a@example.com ,b@example.com, ', subject: 'S', text: 'T' });
  assert.equal(cuerpos.length, 2, 'tenían que salir dos peticiones');
  for (const c of cuerpos) assert.deepEqual(JSON.parse(c).to, ['a@example.com', 'b@example.com']);
});

test('SCRUM-1525c · por Resend, un array de destinatarios se respeta tal cual', async () => {
  const { tr, cuerpos } = resendDePrueba();
  await tr.sendMail({ from: 'yaqu@example.com', to: ['a@example.com', 'b@example.com'], subject: 'S', text: 'T' });
  assert.deepEqual(JSON.parse(cuerpos[0]).to, ['a@example.com', 'b@example.com']);
});

test('SCRUM-1525c · con UNA dirección el cuerpo sale byte a byte igual que antes (el aviso de 1109 no cambia)', async () => {
  const { tr, cuerpos } = resendDePrueba();
  await tr.sendMail({ from: 'yaqu@example.com', to: 'a@example.com', subject: 'S', text: 'T' });
  // Lo que mandaba el transportador antes de 1525c, escrito a mano: `to: [to]`.
  assert.equal(cuerpos[0], JSON.stringify({ from: 'yaqu@example.com', to: ['a@example.com'], subject: 'S', text: 'T' }));
});

test('SCRUM-1525c · una lista bien formada de una o varias direcciones vale como destino', () => {
  for (const destino of ['a@example.com', 'a@example.com,b@example.com', ' a@example.com , b@example.com ']) {
    const r = validarCorreo({ RESEND_API_KEY: 'x', BACKUP_EMAIL_DESTINO: destino });
    assert.equal(r.ok, true, `«${destino}» tenía que valer: ${JSON.stringify(r.faltan)}`);
  }
});

test('SCRUM-1525c · una lista con una pieza vacía o sin arroba cuenta como «falta BACKUP_EMAIL_DESTINO»', () => {
  const rotas = ['a@example.com,', ',a@example.com', 'a@example.com, ,b@example.com', 'a@example.com, sin-arroba', 'sin-arroba', ' ', ''];
  for (const destino of rotas) {
    const r = validarCorreo({ RESEND_API_KEY: 'x', BACKUP_EMAIL_DESTINO: destino });
    assert.equal(r.ok, false, `«${destino}» no tenía que valer`);
    assert.deepEqual(r.faltan, ['BACKUP_EMAIL_DESTINO'], `«${destino}»`);
  }
});
