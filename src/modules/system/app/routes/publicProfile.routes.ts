// src/modules/system/app/routes/publicProfile.routes.ts — PERFIL-1 (A14.1, EXT3)
// Página pública /p/:slug del merchant (master Parte R). Flag PUBLIC_PROFILE_ENABLED
// merchant opt-in, OFF por defecto: sin flag (o slug inexistente) → 404 digno A6.5.
// PÚBLICO: nombre comercial, logo, gremio, zonas (chips), años de experiencia,
// "Pedir presupuesto por WhatsApp" (wa.me del PRO), link de reseñas Google y footer
// "Hecho con YaQu" → ?src=profile|qr (loop de atribución V0-3).
// NUNCA público: precios, clientes, volumen, email, NIF, dirección exacta.
import { Router, Request, Response } from 'express';
import { prisma } from '../../../../core/db/prisma';
import { esc } from '../../../../core/utils/utils';
import { isFlagEnabled } from '../../../../core/flags';
import { notFoundPageHtml } from '../../../../core/http/publicNotFound';
import { BASE_URL, config } from '../../../../core/config/env';

const publicProfileRouter = Router();

const TRADE_LABELS: Record<string, string> = {
  electricista: 'Electricista',
  fontanero: 'Fontanero',
  reformista: 'Reformista',
  pintor: 'Pintor',
  cerrajero: 'Cerrajero',
  climatizacion: 'Climatización',
};

function zonesOf(profileZones: unknown): string[] {
  if (!Array.isArray(profileZones)) return [];
  return profileZones
    .filter((z): z is string => typeof z === 'string' && z.trim().length > 0)
    .map((z) => z.trim())
    .slice(0, 12);
}

publicProfileRouter.get('/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').trim().toLowerCase();
  const merchant = slug
    ? await prisma.merchant.findUnique({
        where: { slug },
        select: {
          id: true, name: true, logoUrl: true, trade: true, profileZones: true,
          profileYears: true, whatsappPhone: true, googleReviewUrl: true,
          country: true, brandColor: true, status: true, flags: true,
        },
      })
    : null;

  const flagsJson = (merchant?.flags as Record<string, unknown> | null | undefined) ?? null;
  const visible =
    !!merchant &&
    merchant.status === 'active' &&
    isFlagEnabled('PUBLIC_PROFILE_ENABLED', {
      merchant: { id: merchant.id, country: merchant.country, flags: flagsJson },
    });
  if (!merchant || !visible) {
    return res.status(404).type('html').send(notFoundPageHtml());
  }

  // Loop V0-3: quien llega por QR arrastra su origen hasta el footer → registro
  // con acquisitionSource='qr'; el resto de visitas del perfil → 'profile'.
  const src = req.query.src === 'qr' ? 'qr' : 'profile';

  const name = merchant.name || 'Profesional';
  const tradeLabel = merchant.trade ? TRADE_LABELS[merchant.trade] ?? null : null;
  const zones = zonesOf(merchant.profileZones);
  const years = typeof merchant.profileYears === 'number' && merchant.profileYears > 0
    ? merchant.profileYears : null;
  let waDigits = (merchant.whatsappPhone || '').replace(/\D/g, '');
  // wa.me exige formato internacional: un móvil español guardado "a pelo"
  // (9 dígitos, 6/7) gana el 34 delante en vez de generar un enlace roto.
  if (waDigits.length === 9 && /^[67]/.test(waDigits) &&
      (merchant.country || 'ES').toUpperCase() === 'ES') {
    waDigits = `34${waDigits}`;
  }
  // Feature (fundador): el botón abre el BOT de YaQu (número compartido) con el
  // merchant en el texto (via su slug) → el bot crea el cliente en ESE merchant y
  // arranca la solicitud. Si no hay WHATSAPP_BOT_PHONE configurado, cae al WhatsApp
  // del pro (comportamiento anterior).
  const botDigits = config.WHATSAPP_BOT_PHONE;
  const waHref = botDigits
    ? `https://wa.me/${botDigits}?text=${encodeURIComponent(`Hola, quiero pedir un presupuesto a ${name}. yaqu.app/p/${slug}`)}`
    : (waDigits
        ? `https://wa.me/${waDigits}?text=${encodeURIComponent('Hola, quiero pedir un presupuesto')}`
        : null);
  const reviewUrl = merchant.googleReviewUrl || null;
  const initial = name.trim().charAt(0).toUpperCase() || 'Y';
  const brand = merchant.brandColor && /^#[0-9a-fA-F]{6}$/.test(merchant.brandColor)
    ? merchant.brandColor : null;

  const subParts = [tradeLabel, years ? `${years} años de experiencia` : null].filter(Boolean);

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="theme-color" content="#16a34a"/>
  <meta property="og:title" content="${esc(name)}"/>
  <title>${esc(name)} · YaQu</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased; font-feature-settings: "cv11","ss01";
      margin: 0; padding: 16px; background: #f6f7f5; color: #3f4a45; min-height: 100vh; }
    .card { max-width: 460px; margin: 24px auto; background: #fff; border: 1px solid #e7e9e5;
      border-radius: 18px; padding: 30px 24px 24px; text-align: center;
      box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 18px 40px -16px rgba(16,24,40,.16); }
    .avatar { width: 76px; height: 76px; border-radius: 50%; margin: 0 auto 14px;
      background: ${brand ? esc(brand) : 'linear-gradient(135deg,#22c55e,#22d3ee)'};
      color: ${brand ? '#fff' : '#052e16'}; font-weight: 800; font-size: 30px;
      display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .avatar img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
    h1 { font-size: 23px; margin: 0 0 4px; color: #0f1c17; letter-spacing: -.01em; }
    .sub { font-size: 14px; color: #6b756f; margin: 0 0 16px; }
    .zones { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 0 0 18px; }
    .zone { font-size: 13px; padding: 5px 12px; border-radius: 999px;
      background: #f6f7f5; border: 1px solid #e7e9e5; color: #3f4a45; }
    .cta { display: flex; align-items: center; justify-content: center; gap: 10px;
      width: 100%; min-height: 52px; padding: 15px; margin-top: 6px; font-size: 16px;
      font-weight: 700; background: #16a34a; color: #fff; border: none; border-radius: 14px;
      text-decoration: none; box-shadow: 0 4px 14px -2px rgba(22,163,74,.35);
      transition: background .15s, transform .08s; }
    .cta:hover { background: #15803d; }
    .cta:active { transform: translateY(1px); }
    .cta:focus-visible, .reviews:focus-visible, .made:focus-visible {
      outline: 3px solid #86efac; outline-offset: 2px; }
    .cta svg { width: 20px; height: 20px; flex: none; }
    .reviews { display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; min-height: 48px; padding: 12px; margin-top: 12px; font-size: 14px;
      font-weight: 600; color: #0f1c17; background: #fff; border: 1px solid #e7e9e5;
      border-radius: 12px; text-decoration: none; }
    .reviews:hover { background: #f6f7f5; }
    .made { display: inline-flex; align-items: center; gap: 6px; margin-top: 22px;
      font-size: 12.5px; color: #6b756f; text-decoration: none; }
    .made strong { color: #0f1c17; font-weight: 800; }
    .made:hover strong { color: #16a34a; }
    @media (prefers-reduced-motion: reduce) { .cta { transition: none; } }
  </style>
</head>
<body>
  <main class="card">
    <div class="avatar">${
      merchant.logoUrl ? `<img src="${esc(merchant.logoUrl)}" alt="${esc(name)}"/>` : esc(initial)
    }</div>
    <h1>${esc(name)}</h1>
    ${subParts.length ? `<p class="sub">${esc(subParts.join(' · '))}</p>` : ''}
    ${zones.length ? `<div class="zones">${zones.map((z) => `<span class="zone">${esc(z)}</span>`).join('')}</div>` : ''}
    ${waHref ? `<a class="cta" href="${esc(waHref)}">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.1-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.9.9-1.2 2.2-.4 3.8a12 12 0 0 0 4.6 4.6c1.8.9 2.7 1 3.6.7.6-.2 1.5-.7 1.7-1.3.2-.6.2-1.1.1-1.2 0 0-.2-.1-.6-.2Z"/></svg>
      Pedir presupuesto por WhatsApp</a>` : ''}
    ${reviewUrl ? `<a class="reviews" href="${esc(reviewUrl)}" rel="noopener" target="_blank">⭐ Ver reseñas en Google</a>` : ''}
    <div><a class="made" href="${esc(`${BASE_URL}/?src=${src}`)}">Hecho con <strong>YaQu</strong></a></div>
  </main>
</body>
</html>`;

  return res.status(200).type('html').send(html);
});

export default publicProfileRouter;
