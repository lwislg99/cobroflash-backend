// src/modules/messaging/domain/merchantNotifications.ts
// Notificaciones por email al merchant: pago recibido, presupuesto aceptado.
// Usa Resend si hay API key configurada; si no, nodemailer/SMTP.
import axios from 'axios';
import { createMailer } from '../../../integrations/mailer';
import { config } from '../../../core/config/env';
import { constanciaDeEnvio, constanciaDeFallo, type Constancia } from './constanciaCorreo'; // SCRUM-475

// SCRUM-475: aquí vive el aviso de COBRO al profesional, que es el que se tragaba su fallo sin
// una línea (`.catch(() => {})` en `psp.routes.ts`). La respuesta ya no se tira, y el camino sin
// SMTP —que no envía nada— deja de parecerse a un envío bueno.
async function sendEmail(to: string, subject: string, html: string): Promise<Constancia> {
  if (!to || !to.includes('@')) return constanciaDeFallo({ message: 'destinatario sin email' });

  if (config.RESEND_API_KEY) {
    const respuesta = await axios.post(
      'https://api.resend.com/emails',
      { from: config.EMAIL_FROM, to: [to], subject, html },
      {
        headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 10_000,
      },
    );
    return constanciaDeEnvio(respuesta);
  }

  if (config.SMTP_URL) {
    const mailer = createMailer();
    await mailer.sendMail({ from: config.EMAIL_FROM, to, subject, html });
    return constanciaDeEnvio(null);
  }
  return constanciaDeFallo({ message: 'sin RESEND_API_KEY ni SMTP_URL: no se envió' });
}

// ── Pago recibido ──────────────────────────────────────────────────────────
export async function sendMerchantPaymentEmail(params: {
  merchantEmail: string;
  merchantName: string;
  customerName: string;
  amount: string;
  currency: string;
  invoiceNumber?: string | null;
}): Promise<void> {
  const { merchantEmail, merchantName, customerName, amount, currency, invoiceNumber } = params;

  const subject = `💰 Pago recibido: ${amount} ${currency} de ${customerName}`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#22c55e;font-weight:800;font-size:18px">YaQu</span>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a">💰 ¡Pago recibido!</h2>
    <p style="color:#475569;margin:0 0 20px;font-size:15px">
      <strong>${customerName}</strong> ha realizado un pago.
    </p>
    <div style="background:#fff;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#64748b;font-size:13px">Importe</span>
        <span style="font-weight:800;font-size:18px;color:#16a34a">${amount} ${currency}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#64748b;font-size:13px">Cliente</span>
        <span style="font-weight:600;font-size:14px">${customerName}</span>
      </div>
      ${invoiceNumber ? `<div style="display:flex;justify-content:space-between">
        <span style="color:#64748b;font-size:13px">Factura</span>
        <span style="font-weight:600;font-size:14px">${invoiceNumber}</span>
      </div>` : ''}
    </div>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Este email fue enviado a ${merchantName}.<br/>
      Para desactivarlo ve a <strong>YaQu → Configuración → Notificaciones</strong>.
    </p>
  </div>
</div>`;

  await sendEmail(merchantEmail, subject, html).catch((e) =>
    console.error('[merchantNotifications] Error enviando email pago:', e?.message)
  );
}

// ── Presupuesto aceptado ───────────────────────────────────────────────────
export async function sendMerchantQuoteAcceptedEmail(params: {
  merchantEmail: string;
  merchantName: string;
  customerName: string;
  quoteId: number;
  total: string;
  currency: string;
}): Promise<void> {
  const { merchantEmail, merchantName, customerName, quoteId, total, currency } = params;

  const subject = `✅ Presupuesto #${quoteId} aceptado por ${customerName}`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#22c55e;font-weight:800;font-size:18px">YaQu</span>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a">✅ Presupuesto aceptado</h2>
    <p style="color:#475569;margin:0 0 20px;font-size:15px">
      <strong>${customerName}</strong> ha aceptado el presupuesto <strong>#${quoteId}</strong>.
    </p>
    <div style="background:#fff;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#64748b;font-size:13px">Presupuesto</span>
        <span style="font-weight:600;font-size:14px">#${quoteId}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#64748b;font-size:13px">Cliente</span>
        <span style="font-weight:600;font-size:14px">${customerName}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:#64748b;font-size:13px">Total</span>
        <span style="font-weight:800;font-size:18px;color:#16a34a">${total} ${currency}</span>
      </div>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0 0 4px">
      El cliente ha firmado digitalmente el presupuesto. Ya puedes emitir la factura.
    </p>
    <p style="color:#94a3b8;font-size:12px;margin:0">
      Para desactivarlo ve a <strong>YaQu → Configuración → Notificaciones</strong>.
    </p>
  </div>
</div>`;

  await sendEmail(merchantEmail, subject, html).catch((e) =>
    console.error('[merchantNotifications] Error enviando email aceptación:', e?.message)
  );
}

// ── ENT-2: un admin aprobó el presupuesto → avisar al técnico que lo creó ──
export async function sendTechQuoteApprovedEmail(params: {
  techEmail: string;
  techName: string;
  quoteId: number;
  customerName: string;
  total: string;
  currency: string;
}): Promise<void> {
  const { techEmail, techName, quoteId, customerName, total, currency } = params;
  if (!techEmail) return;

  const subject = `✅ Tu presupuesto #${quoteId} fue aprobado`;
  const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
  <div style="background:#0f172a;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#22c55e;font-weight:800;font-size:18px">YaQu</span>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a">✅ Presupuesto aprobado</h2>
    <p style="color:#475569;margin:0 0 20px;font-size:15px">
      Hola ${techName || ''} 👋 Un administrador ha aprobado tu presupuesto <strong>#${quoteId}</strong>. Ya puedes enviárselo al cliente.
    </p>
    <div style="background:#fff;border-radius:10px;padding:16px 18px;border:1px solid #e2e8f0;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#64748b;font-size:13px">Presupuesto</span>
        <span style="font-weight:600;font-size:14px">#${quoteId}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#64748b;font-size:13px">Cliente</span>
        <span style="font-weight:600;font-size:14px">${customerName}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:#64748b;font-size:13px">Total</span>
        <span style="font-weight:800;font-size:18px;color:#16a34a">${total} ${currency}</span>
      </div>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">
      Entra en <strong>YaQu → Presupuestos</strong> y pulsa "Enviar por WhatsApp".
    </p>
  </div>
</div>`;

  await sendEmail(techEmail, subject, html).catch((e) =>
    console.error('[merchantNotifications] Error email aprobación técnico:', e?.message)
  );
}
