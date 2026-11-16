// src/modules/billing/app/routes/payBank.routes.ts
// SCRUM-90: identificado por Charge.receiptToken (patrón SCRUM-74/85), NO por el
// chargeId autoincremental — mismo token compartido con /recibo, /pay/card, /pay/bizum
// y /pay/invoice. Esta ruta es la MÁS sensible de las cinco: expone el IBAN/CLABE del
// PROFESIONAL (no solo datos del cliente final) — enumerable habilitaba recolectar
// cuentas bancarias de todos los merchants (riesgo de fraude por "cambio de cuenta").
import { Router } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { documentNotFoundHtml } from '../../../../core/http/publicNotFound';
import { comercioSuprimido } from '../../domain/comercioSuprimido'; // SCRUM-1573b
// SCRUM-150: `formatMoneyEs` es el formateador de dinero de la casa. Esta página pintaba
// `toFixed(2)` + código de divisa (`300.00 EUR`) mientras el selector de /pay/invoice —la
// pantalla ANTERIOR del mismo pago— mostraba `300,00 €`: el cliente veía el mismo importe con
// dos formatos en dos pasos seguidos. Es cambio de PRESENTACIÓN: no toca el importe, ni el XML
// fiscal ni los CSV, donde el punto decimal SÍ es obligatorio (nota de SCRUM-86/145).
import { esc, formatMoneyEs } from '../../../../core/utils/utils';
import { BASE_URL } from '../../../../core/config/env';
// SCRUM-1647 (CSP paso 2): los botones de copiar ya no llevan `onclick` ni la página `<script>` en línea.
import { etiquetaGuionDePago } from './pagoNavegador';
import { etiquetaEstiloDePago } from './pagoEstilo'; // SCRUM-1723 (style-src 'self')

const router = Router();

router.get('/bank/:token', async (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const token = req.params.token;

  const charge = await prisma.charge.findUnique({
    where: { receiptToken: token },
    include: { merchant: true },
  });
  if (!charge) return res.status(404).send(documentNotFoundHtml());
  if (comercioSuprimido(charge.merchant)) return res.status(404).send(documentNotFoundHtml()); // SCRUM-1573b
  const id = charge.id;

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
          <button class="copy-btn" data-label="Copiar CLABE" data-copy="${esc(clabe)}">Copiar CLABE</button>
        </div>
      </div>`;
  } else if (iban) {
    accountSection = `
      <div class="account-row">
        <span class="account-label">IBAN</span>
        <div class="account-value-row">
          <span class="account-value" id="account-num">${esc(iban)}</span>
          <button class="copy-btn" data-label="Copiar IBAN" data-copy="${esc(iban)}">Copiar IBAN</button>
        </div>
      </div>`;
  } else {
    accountSection = `
      <div class="account-row not-configured">
        <span class="pago-sin-cuenta">ℹ️ El profesional aún no ha configurado su cuenta bancaria.</span>
      </div>`;
  }

  const reference = charge.reference || `REF-${charge.id}`;
  const isDev = process.env.NODE_ENV !== 'production';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="es">
<head>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/><!-- SCRUM-184: sin esto el navegador pide /favicon.ico y se lleva un 404 -->
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Pagar por transferencia — YaQu</title>
  <link rel="stylesheet" href="/fonts/inter.css"/>
  ${etiquetaGuionDePago('banco')}
  ${etiquetaEstiloDePago('banco')}
</head>
<body>
  <div class="card">
    <h2>Pago por transferencia bancaria</h2>
    <p class="subtitle">Realiza la transferencia con los datos indicados y el concepto exacto.</p>

    <div class="amount-box">
      <div class="amount">${esc(formatMoneyEs(charge.amount, charge.currency))}</div>
      <div class="concept">${esc(charge.concept)}</div>
    </div>

    <div class="section">
      <div class="section-title">${country === 'MX' ? 'Cuenta destino (México)' : 'Cuenta destino'}</div>
      ${accountSection}
    </div>

    <div class="section">
      <div class="section-title">Concepto / Referencia <span class="pago-obligatorio">★ obligatorio</span></div>
      <div class="ref-box">
        <div class="ref-label">Pon este concepto exacto en tu transferencia</div>
        <div class="ref-value-row">
          <span class="ref-value" id="ref-num">${esc(reference)}</span>
          <button class="copy-btn" data-label="Copiar referencia" data-copy="${esc(reference)}">Copiar referencia</button>
        </div>
        <div class="warning">⚠️ Sin este concepto no podemos identificar tu pago.</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Cómo pagar</div>
      <ol class="steps">
        <li data-n="1">Abre la app de tu banco o accede a banca online.</li>
        <li data-n="2">Haz una transferencia por <strong>${esc(formatMoneyEs(charge.amount, charge.currency))}</strong>${iban ? ` al IBAN ${esc(iban)}` : clabe ? ` a la CLABE ${esc(clabe)}` : ''}.</li>
        <li data-n="3">En el concepto escribe exactamente: <strong>${esc(reference)}</strong></li>
        <li data-n="4">Recibirás confirmación cuando se procese el pago.</li>
      </ol>
    </div>

    ${isDev ? `
    <div class="dev-sim">
      <p class="pago-dev-aviso">🔧 Entorno de desarrollo</p>
      <form method="post" action="${BASE_URL}/dev/sim/pay/${id}">
        <button type="submit" class="btn-sim">Simular pago confirmado</button>
      </form>
    </div>` : ''}

    <div class="footer">YaQu · Pago seguro por transferencia bancaria</div>
  </div>

</body>
</html>`);
});

export default router;
