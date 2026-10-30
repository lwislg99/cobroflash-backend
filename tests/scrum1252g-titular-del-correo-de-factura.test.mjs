// tests/scrum1252g-titular-del-correo-de-factura.test.mjs — SCRUM-1252 (y SCRUM-1604, el mismo defecto)
//
// El titular del correo que lleva la factura decía «Tu factura está listo». La concordancia la
// firmó el fundador (SCRUM-1252 c.20683, punto ②): con la factura, «Tu factura está lista»;
// con el justificante, en masculino, no cambia nada; ningún otro texto se toca.
//
// ── EL BANCO, Y QUÉ NO SE DOBLA ──────────────────────────────────────────────────────────────
// El de scrum1235: se dobla la BASE, la EMISIÓN (`dist/lib/invoicing.js`: el PDF ya está en disco,
// así que no se sella nada) y la RED (`axios.post`: nada sale de la máquina). **No se dobla**
// `sendInvoiceEmail` ni `renderEmailLayout`: lo que se lee es el HTML que llegaría a Resend.
//
// ⛔ Ni una clave real. Ni un byte de red. Ninguna base.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { dobleDeLaBase } from './_envio-doblado.mjs';
import { temporal } from './_temporal.mjs';

// ANTES de cargar `dist/`: `config` se congela al importarse.
process.env.RESEND_API_KEY = 're_test_1252g_no_sale';

const RAIZ = path.resolve(import.meta.dirname, '..');
const requiere = createRequire(import.meta.url);
const rutaDe = (r) => requiere.resolve(path.join(RAIZ, r));
const axios = requiere('axios'); // la instancia CJS: la MISMA que carga dist

const DIR = temporal('yaqu-1252g-');
const PDF = path.join(DIR, 'f.pdf');
fs.writeFileSync(PDF, '%PDF-1.4\n%laboratorio 1252g\n');

/** Manda el correo del documento `numero` por el camino real y devuelve lo que llegaría a Resend. */
async function correoDe(numero) {
  const factura = { id: 7100, merchantId: 4243, customerId: 56, number: numero, status: 'issued', pdfUrl: '/x.pdf' };
  const doble = dobleDeLaBase({
    'invoice.findUnique': () => ({ ...factura }),
    'emailMessage.create': (a) => ({ id: 1, createdAt: new Date(), ...a.data }),
  });
  const fPrisma = rutaDe('dist/core/db/prisma.js');
  requiere.cache[fPrisma] = { id: fPrisma, filename: fPrisma, loaded: true, exports: { prisma: doble } };
  const fInv = rutaDe('dist/lib/invoicing.js');
  requiere.cache[fInv] = {
    id: fInv, filename: fInv, loaded: true,
    exports: { ensureInvoicePdf: async () => ({ diskPath: PDF, pdfUrl: '/x.pdf' }) },
  };

  const enviados = [];
  axios.post = async (url, cuerpo) => {
    if (!String(url).includes('api.resend.com')) throw new Error(`🔴 el banco no esperaba un POST a ${url}`);
    enviados.push(cuerpo);
    return { data: { id: `re_${enviados.length}` } };
  };

  for (const m of [
    'dist/core/config/env.js',
    'dist/modules/messaging/domain/registroDeEnvios.js',
    'dist/integrations/enviarCorreo.js',
    'dist/modules/messaging/domain/email.service.js',
  ]) { try { delete requiere.cache[rutaDe(m)]; } catch { /* aún no existe */ } }

  const { sendInvoiceEmail } = requiere(rutaDe('dist/modules/messaging/domain/email.service.js'));
  const r = await sendInvoiceEmail({ invoiceId: factura.id, toEmail: 'cliente@ejemplo.invalid', prisma: doble });
  assert.ok(r?.ok, 'el envío tenía que salir por el doble de Resend');
  assert.equal(enviados.length, 1, '🔴 CIEGO: el doble de Resend no ha recibido el correo');
  return enviados[0];
}

test('SCRUM-1252 ② · el correo de una FACTURA titula «Tu factura está lista»', async () => {
  const c = await correoDe('F260001');
  assert.match(c.html, /Tu factura está lista/, '🔴 el titular de la factura no concuerda (firma: SCRUM-1252 c.20683 ②)');
  assert.doesNotMatch(c.html, /Tu factura está listo/, '🔴 sigue saliendo «Tu factura está listo»');
  // Fuera de la firma, nada más cambia: el asunto sigue igual.
  assert.equal(c.subject, 'Tu factura F260001');
});

test('SCRUM-1252 ② · CONTROL: el JUSTIFICANTE, en masculino, no cambia', async () => {
  const c = await correoDe('J-2026-0001');
  assert.match(c.html, /Tu justificante de cobro está listo/, '🔴 el titular del justificante ha cambiado y no estaba firmado');
  assert.doesNotMatch(c.html, /factura/i, '🔴 el correo del justificante dice «factura» (reglas 24/26)');
  assert.equal(c.subject, 'Tu justificante de cobro J-2026-0001');
});
