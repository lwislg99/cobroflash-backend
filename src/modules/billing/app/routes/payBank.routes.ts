// src/modules/billing/app/routes/payBank.routes.ts
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
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
  if (!charge) return res.status(404).send(documentNotFoundHtml());

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
          <button class="copy-btn" data-label="Copiar CLABE" onclick="copyText('${esc(clabe)}', this)">Copiar CLABE</button>
        </div>
      </div>`;
  } else if (iban) {
    accountSection = `
      <div class="account-row">
        <span class="account-label">IBAN</span>
        <div class="account-value-row">
          <span class="account-value" id="account-num">${esc(iban)}</span>
          <button class="copy-btn" data-label="Copiar IBAN" onclick="copyText('${esc(iban)}', this)">Copiar IBAN</button>
        </div>
      </div>`;
  } else {
    accountSection = `
      <div class="account-row not-configured">
        <span style="color:#6b756f;font-size:.9rem">ℹ️ El profesional aún no ha configurado su cuenta bancaria.</span>
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
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    :root{
      --brand:#16a34a;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;
      --bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6;
    }
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;background:var(--bg);color:var(--body);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.12);padding:2rem;max-width:480px;width:100%}
    h2{margin:0 0 .25rem;font-size:1.3rem;font-weight:700;letter-spacing:-.01em;color:var(--ink);text-wrap:balance}
    .subtitle{color:var(--muted);font-size:.9rem;margin:0 0 1.5rem;line-height:1.5}
    .amount-box{background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:12px;padding:1.1rem;text-align:center;margin-bottom:1.5rem}
    .amount-box .amount{font-size:2rem;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
    .amount-box .concept{color:var(--muted);font-size:.85rem;margin-top:.3rem}
    .section{margin-bottom:1.25rem}
    .section-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.5rem}
    .account-row{background:var(--slate-50);border:1px solid var(--border);border-radius:10px;padding:.75rem 1rem;margin-bottom:.5rem}
    .account-label{font-size:.75rem;color:var(--muted);display:block;margin-bottom:.2rem}
    .account-value-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem}
    .account-value{font-size:.95rem;font-weight:700;color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em}
    .copy-btn{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:.3rem .75rem;font-size:.75rem;font-weight:600;cursor:pointer;color:var(--ink);flex-shrink:0;transition:background .15s,border-color .15s}
    .copy-btn:hover{background:var(--slate-50);border-color:#cdd2cb}
    .copy-btn:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.28)}
    .copy-btn.copied{background:var(--brand-tint);border-color:#bbf7d0;color:var(--brand)}
    .ref-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:.75rem 1rem}
    .ref-label{font-size:.75rem;color:#92400e;font-weight:600}
    .ref-value-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:.2rem}
    .ref-value{font-size:1rem;font-weight:700;color:#92400e;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .warning{font-size:.8rem;color:#78350f;margin-top:.4rem}
    .steps{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.5rem}
    .steps li{font-size:.85rem;color:var(--body);display:flex;gap:.5rem;align-items:flex-start;line-height:1.45}
    .steps li::before{content:attr(data-n);background:var(--brand);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;margin-top:.1rem}
    .dev-sim{margin-top:1.5rem;padding-top:1.25rem;border-top:1px dashed var(--border)}
    .btn-sim{background:var(--ink);color:#fff;border:none;border-radius:999px;padding:.6rem 1.25rem;cursor:pointer;font-size:.9rem;font-weight:600;font-family:inherit}
    .footer{margin-top:1.5rem;text-align:center;font-size:.75rem;color:var(--muted)}
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
          <button class="copy-btn" data-label="Copiar referencia" onclick="copyText('${esc(reference)}', this)">Copiar referencia</button>
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
      <p style="font-size:.8rem;color:#6b756f;margin:0 0 .5rem">🔧 Entorno de desarrollo</p>
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
        setTimeout(() => { btn.textContent = btn.dataset.label || 'Copiar'; btn.classList.remove('copied'); }, 2000);
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
        setTimeout(() => { btn.textContent = btn.dataset.label || 'Copiar'; btn.classList.remove('copied'); }, 2000);
      });
    }
  </script>
</body>
</html>`);
});

export default router;
