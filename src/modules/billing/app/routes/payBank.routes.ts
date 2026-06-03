// src/modules/billing/app/routes/payBank.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';

const router = Router();

router.get('/bank/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).send('ID inválido');

  const charge = await prisma.charge.findUnique({
    where: { id },
    include: { merchant: true },
  });
  if (!charge) return res.status(404).send('Cobro no encontrado');

  const merchant = charge.merchant as any;
  const country  = merchant?.country || 'ES';
  const iban     = merchant?.iban  || null;
  const clabe    = merchant?.clabe || null;

  // Construir la sección de datos de cuenta según país
  let accountSection = '';
  if (country === 'MX' && clabe) {
    accountSection = `
      <div class="account-row">
        <span class="account-label">CLABE interbancaria</span>
        <div class="account-value-row">
          <span class="account-value" id="account-num">${esc(clabe)}</span>
          <button class="copy-btn" onclick="copyText('${esc(clabe)}', this)">Copiar</button>
        </div>
      </div>`;
  } else if (iban) {
    accountSection = `
      <div class="account-row">
        <span class="account-label">IBAN</span>
        <div class="account-value-row">
          <span class="account-value" id="account-num">${esc(iban)}</span>
          <button class="copy-btn" onclick="copyText('${esc(iban)}', this)">Copiar</button>
        </div>
      </div>`;
  } else {
    accountSection = `
      <div class="account-row not-configured">
        <span style="color:#9ca3af;font-size:.9rem">ℹ️ El profesional aún no ha configurado su cuenta bancaria.</span>
      </div>`;
  }

  const reference = charge.reference || `REF-${charge.id}`;
  const isDev = process.env.NODE_ENV !== 'production';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Pagar por transferencia — YaQu</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f9fafb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:2rem;max-width:480px;width:100%}
    h2{margin:0 0 .25rem;font-size:1.3rem;color:#111}
    .subtitle{color:#6b7280;font-size:.9rem;margin:0 0 1.5rem}
    .amount-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:1rem;text-align:center;margin-bottom:1.5rem}
    .amount-box .amount{font-size:1.8rem;font-weight:700;color:#16a34a}
    .amount-box .concept{color:#6b7280;font-size:.85rem;margin-top:.25rem}
    .section{margin-bottom:1.25rem}
    .section-title{font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:.5rem}
    .account-row{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.75rem 1rem;margin-bottom:.5rem}
    .account-label{font-size:.75rem;color:#64748b;display:block;margin-bottom:.2rem}
    .account-value-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
    .account-value{font-size:.95rem;font-weight:600;color:#0f172a;font-family:monospace;letter-spacing:.02em}
    .copy-btn{background:#e2e8f0;border:none;border-radius:6px;padding:.25rem .6rem;font-size:.75rem;cursor:pointer;color:#334155;flex-shrink:0;transition:background .15s}
    .copy-btn:hover{background:#cbd5e1}
    .copy-btn.copied{background:#dcfce7;color:#16a34a}
    .ref-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.75rem 1rem}
    .ref-label{font-size:.75rem;color:#92400e;font-weight:600}
    .ref-value-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:.2rem}
    .ref-value{font-size:1rem;font-weight:700;color:#92400e;font-family:monospace}
    .warning{font-size:.8rem;color:#78350f;margin-top:.4rem}
    .steps{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.4rem}
    .steps li{font-size:.85rem;color:#374151;display:flex;gap:.5rem;align-items:flex-start}
    .steps li::before{content:attr(data-n);background:#22c55e;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;margin-top:.1rem}
    .dev-sim{margin-top:1.5rem;padding-top:1.25rem;border-top:1px dashed #e5e7eb}
    .btn-sim{background:#111;color:#fff;border:none;border-radius:8px;padding:.6rem 1.25rem;cursor:pointer;font-size:.9rem}
    .footer{margin-top:1.5rem;text-align:center;font-size:.75rem;color:#9ca3af}
  </style>
</head>
<body>
  <div class="card">
    <h2>Pago por transferencia bancaria</h2>
    <p class="subtitle">Realiza la transferencia con los datos indicados y el concepto exacto.</p>

    <div class="amount-box">
      <div class="amount">${esc(Number(charge.amount).toFixed(2))} ${esc(charge.currency)}</div>
      <div class="concept">${esc(charge.concept)}</div>
    </div>

    <div class="section">
      <div class="section-title">${country === 'MX' ? 'Cuenta destino (México)' : 'Cuenta destino'}</div>
      ${accountSection}
    </div>

    <div class="section">
      <div class="section-title">Concepto / Referencia <span style="color:#ef4444">★ obligatorio</span></div>
      <div class="ref-box">
        <div class="ref-label">Pon este concepto exacto en tu transferencia</div>
        <div class="ref-value-row">
          <span class="ref-value" id="ref-num">${esc(reference)}</span>
          <button class="copy-btn" onclick="copyText('${esc(reference)}', this)">Copiar</button>
        </div>
        <div class="warning">⚠️ Sin este concepto no podemos identificar tu pago.</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cómo pagar</div>
      <ol class="steps">
        <li data-n="1">Abre la app de tu banco o accede a banca online.</li>
        <li data-n="2">Haz una transferencia por <strong>${esc(Number(charge.amount).toFixed(2))} ${esc(charge.currency)}</strong>${iban ? ` al IBAN ${esc(iban)}` : clabe ? ` a la CLABE ${esc(clabe)}` : ''}.</li>
        <li data-n="3">En el concepto escribe exactamente: <strong>${esc(reference)}</strong></li>
        <li data-n="4">Recibirás confirmación cuando se procese el pago.</li>
      </ol>
    </div>

    ${isDev ? `
    <div class="dev-sim">
      <p style="font-size:.8rem;color:#9ca3af;margin:0 0 .5rem">🔧 Entorno de desarrollo</p>
      <form method="post" action="${BASE_URL}/dev/sim/pay/${id}">
        <button type="submit" class="btn-sim">Simular pago confirmado</button>
      </form>
    </div>` : ''}

    <div class="footer">YaQu · Pago seguro por transferencia bancaria</div>
  </div>

  <script>
    function copyText(text, btn) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '¡Copiado!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
      }).catch(() => {
        // fallback
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        btn.textContent = '¡Copiado!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
      });
    }
  </script>
</body>
</html>`);
});

export default router;
