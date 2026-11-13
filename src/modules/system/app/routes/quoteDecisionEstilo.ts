// src/modules/system/app/routes/quoteDecisionEstilo.ts — SCRUM-1646d (CSP paso 2, `style-src 'self'`)
//
// EL CSS DE LA PÁGINA PÚBLICA DE FIRMA DEL PRESUPUESTO, FUERA DEL HTML.
//
// Hasta SCRUM-1646d la página llevaba TRES `<style>` en línea —el de `renderPage`, el de las opciones
// (`TIER_CSS`, en el cuerpo) y el del color de marca (`brandOverrideCss`)— y una veintena de `style=`
// en el marcado de sus seis caras. Con `style-src 'self'` APLICADA (SCRUM-1637, paso 3) el navegador no
// pinta ninguno y la página del cliente sale desnuda (lo midió SCRUM-1723 en las de pago).
//
// ⚠️ CERO CAMBIOS VISIBLES (superficie pública, la del piloto): las reglas son las MISMAS, copiadas por
// programa del fuente anterior, y las hojas van en el MISMO orden de la cascada (base → marca →
// opciones). Lo único nuevo son las reglas del final de la base: los `style=` que llevaba el marcado,
// copiados tal cual, cada uno a una regla por id o por una clase que sólo casa ese elemento.
//
// LA HOJA DE MARCA ES DINÁMICA: lleva el color del negocio. No se interpola en el HTML ni en una hoja
// constante: la sirve una ruta (`/pay/quote/css/marca/<rrggbb>`) que valida el color con el MISMO filtro
// de antes (`^#[0-9a-fA-F]{6}$`). Un color que no pasa no pinta enlace (como antes, no pintaba `<style>`)
// y la ruta contesta 404 sin cuerpo: nada que no sean seis hexadecimales llega nunca al CSS.
//
// Lo que el guion cambia con `el.style.x = …` (CSSOM) NO lo bloquea `style-src`: eso sigue igual
// (`quoteDecisionNavegador.ts` ya enseña con `'block'`, no con `''`).
//
// Huella `?v=` = sha1 del contenido (SCRUM-274): `immutable` sólo con la huella buena; si no, `no-cache`.
import { huellaDeContenido, CACHE_CON_HUELLA } from '../../../../core/http/huellaEstaticos';

/** La hoja de `renderPage` (todas las caras), tal cual, más los `style=` del marcado al final. */
export const PRESUPUESTO_FIRMA_CSS = `
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased; font-feature-settings: "cv11","ss01";
      margin: 0; padding: 16px; background: #f6f7f5; color: #3f4a45; min-height: 100vh; }
    .card { max-width: 460px; margin: 24px auto; background: #fff; border: 1px solid #e7e9e5; border-radius: 18px;
      padding: 26px 24px; box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 18px 40px -16px rgba(16,24,40,.16); }
    .merchant-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .merchant-logo { max-height: 48px; max-width: 120px; object-fit: contain; border-radius: 8px; }
    .merchant-name { font-weight: 700; font-size: 16px; color: #0f1c17; }
    .merchant-sub { font-size: 13px; color: #6b756f; }
    h1 { font-size: 19px; margin: 0 0 4px; color: #0f1c17; letter-spacing: -.01em; text-align: center; }
    h1 + .quote-meta { text-align: center; }
    .quote-meta { font-size: 13px; color: #6b756f; margin-bottom: 16px; }
    /* Total como héroe (estilo Recibo de confianza) */
    .amount-hero { text-align: center; padding: 16px 0 18px; margin: 16px 0;
      border-top: 1px solid #e7e9e5; border-bottom: 1px solid #e7e9e5; }
    .amount-hero-label { font-size: .72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: #6b756f; margin-bottom: .5rem; }
    .amount-hero-value { font-size: 2.4rem; font-weight: 800; color: #0f1c17; line-height: 1;
      letter-spacing: -.025em; font-variant-numeric: tabular-nums; }
    /* Bloque de confianza */
    .trust { margin-top: 14px; text-align: center; }
    .trust-main { display: inline-flex; align-items: center; gap: .4rem; font-size: .8rem; font-weight: 600; color: #3f4a45; }
    .trust .lock { width: 13px; height: 13px; vertical-align: -1px; }
    /* P2-5: table-layout fixed + anchos para que el Total nunca se recorte en 390px */
    .lines-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 14px; margin-bottom: 12px; }
    .lines-table th { text-align: left; padding: 4px 6px; color: #6b756f; font-size: 12px;
      border-bottom: 1px solid #e7e9e5; }
    .lines-table td { padding: 6px 6px; border-bottom: 1px solid #f1f2ee; }
    .lines-table td:first-child { overflow-wrap: break-word; }
    .lines-table th:nth-child(2), .lines-table td:nth-child(2) { width: 44px; text-align: right; }
    .lines-table th:nth-child(3), .lines-table td:nth-child(3) { width: 100px; text-align: right;
      white-space: nowrap; font-variant-numeric: tabular-nums; }
    @media (max-width: 420px) { .lines-table { font-size: 13px; }
      .lines-table th:nth-child(3), .lines-table td:nth-child(3) { width: 92px; } }
    .total-row { display: flex; justify-content: space-between; font-weight: 800; color: #0f1c17;
      font-size: 20px; margin: 12px 0 20px; padding-top: 10px; border-top: 2px solid #e7e9e5;
      font-variant-numeric: tabular-nums; }
    /* PC-B: desglose de IVA (base + cuota por tipo) coherente con el Total */
    .totals-block { margin: 4px 0 0; }
    .totals-row { display: flex; justify-content: space-between; align-items: baseline;
      font-size: 14px; color: #6b756f; padding: 3px 6px; font-variant-numeric: tabular-nums; }
    .totals-row span:last-child { color: #3f4a45; font-weight: 600; }
    .terms-badge { display: inline-block; font-size: 12px; padding: 3px 10px;
      border-radius: 999px; background: #eff6ff; color: #1d4ed8; margin-bottom: 16px;
      /* SCRUM-888g: la píldora lleva los nombres de tramo del profesional; uno sin espacios no desborda */
      max-width: 100%; overflow-wrap: anywhere; }
    /* V8/N1: política de señal junto a las condiciones (solo cuando hay señal 50/50) */
    .senal-policy { text-align: center; font-size: 12px; color: #6b756f; margin: 0 0 12px; }
    .divider { border: none; border-top: 1px solid #e7e9e5; margin: 16px 0; }
    /* SCRUM-1279: los textos del documento, antes de la firma. El texto es del profesional: se
       respetan sus saltos de línea y una palabra larga no desborda en 360 px. Las cláusulas van en
       una caja con tope de alto: abiertas y legibles, pero sin alejar la firma una pantalla entera. */
    .doc-texto { font-size: 13px; color: #3f4a45; white-space: pre-line; overflow-wrap: anywhere; margin: 0 0 12px; }
    .doc-bloque { margin: 12px 0; }
    .doc-titulo { font-size: 12px; font-weight: 700; color: #0f1c17; text-transform: uppercase;
      letter-spacing: .04em; margin-bottom: 4px; overflow-wrap: anywhere; }
    .doc-clausulas { max-height: 45vh; overflow-y: auto; margin: 12px 0 16px; padding: 12px;
      border: 1px solid #e7e9e5; border-radius: 12px; background: #f6f7f5; }
    .doc-clausula + .doc-clausula { margin-top: 10px; }
    .doc-clausulas .doc-texto { margin: 0; font-size: 12px; }
    /* Firma */
    .sig-label { font-size: 13px; font-weight: 600; color: #333c37; margin-bottom: 6px; display: block; }
    .sig-sub { font-size: 12px; color: #6b756f; margin-bottom: 8px; }
    .sig-wrapper { border: 2px solid #cdd2cb; border-radius: 10px; background: #f7f8f6;
      position: relative; overflow: hidden; margin-bottom: 8px; }
    .sig-wrapper.has-sig { border-color: #22c55e; background: #fff; }
    #sig-canvas { display: block; width: 100%; height: 150px; cursor: crosshair; touch-action: none; }
    .sig-actions { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
    .btn-clear { font-size: 13px; padding: 6px 12px; border-radius: 8px;
      border: 1px solid #e7e9e5; background: #fff; cursor: pointer; color: #6b756f; }
    .btn-clear:hover { background: #f1f2ee; }
    .sig-placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      color: #cdd2cb; font-size: 14px; pointer-events: none; user-select: none; white-space: nowrap; }
    .checkbox-fallback { display: flex; align-items: center; gap: 8px; font-size: 13px;
      color: #6b756f; margin-bottom: 16px; }
    /* Botones */
    .btn-accept { width: 100%; padding: 15px; font-size: 16px; font-weight: 700;
      background: #16a34a; color: #fff; border: none; border-radius: 14px; cursor: pointer;
      min-height: 52px; margin-top: 4px; box-shadow: 0 4px 14px -2px rgba(22,163,74,.35);
      transition: background .15s, transform .08s, box-shadow .15s; }
    .btn-accept:hover { background: #15803d; }
    .btn-accept:active { background: #15803d; transform: translateY(1px); }
    .btn-accept:disabled { opacity: .5; cursor: default; }
    .btn-reject { width: 100%; padding: 14px; font-size: 16px; font-weight: 700;
      background: #dc2626; color: #fff; border: none; border-radius: 12px; cursor: pointer;
      min-height: 52px; margin-top: 4px; }
    .btn-reject:active { background: #b91c1c; }
    .status-ok { background: #ecfdf5; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-ok strong { color: #166534; }
    .status-error { background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .status-error strong { color: #991b1b; }
    small { font-size: 12px; color: #6b756f; display: block; text-align: center; margin-top: 12px; }
    select, textarea { width: 100%; font-size: 15px; padding: 10px 12px;
      border-radius: 10px; border: 1px solid #cdd2cb; margin-bottom: 12px; }
    textarea { min-height: 80px; resize: vertical; }
    /* FRONT1-6 — landing cliente premium */
    .merchant-hero { text-align: center; padding: 8px 0 18px; }
    .merchant-hero .merchant-logo { max-height: 64px; max-width: 180px; margin-bottom: 10px; }
    .merchant-hero .merchant-name { font-size: 22px; font-weight: 800; color: #0f1c17; }
    .merchant-hero .merchant-sub { font-size: 13px; color: #6b756f; margin-top: 2px; }
    .merchant-avatar { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 10px;
      background: linear-gradient(135deg,#22c55e,#22d3ee); color: #052e16; font-weight: 800;
      font-size: 26px; display: flex; align-items: center; justify-content: center; }
    .line-icon { display: inline-block; width: 22px; text-align: center; margin-right: 4px; }
    .validity-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
      background: #fffbeb; color: #b45309; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
    .btn-share { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 12px; font-size: 15px; font-weight: 700; background: #25D366; color: #fff;
      border: none; border-radius: 12px; cursor: pointer; text-decoration: none; margin-top: 10px; }
    /* PC-A: "Tengo una duda" → WhatsApp del PRO. Secundario (no verde) para respetar la
       Regla de Una Sola Voz: el unico CTA primario es "Firmar y aceptar". */
    .btn-duda { display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; min-height: 48px; padding: 12px; margin-top: 14px; font-size: 14px;
      font-weight: 600; color: #0f1c17; background: #fff; border: 1px solid #e7e9e5;
      border-radius: 12px; text-decoration: none; }
    .btn-duda:hover { background: #f6f7f5; }
    .success-check { width: 72px; height: 72px; border-radius: 50%; background: #16a34a; color: #fff;
      font-size: 40px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
      animation: pop .4s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes pop { from { transform: scale(0); } to { transform: scale(1); } }
    .confetti-piece { position: fixed; top: -12px; width: 9px; height: 9px; z-index: 9999;
      border-radius: 1px; animation: confetti-fall linear forwards; }
    @keyframes confetti-fall { to { transform: translateY(105vh) rotate(540deg); opacity: 1; } }
    /* AB6: anillo de Foco accesible (DESIGN.md "Foco") en todo elemento enfocado por teclado */
    :focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(34,197,94,.30); }
    /* AB6: respetar prefers-reduced-motion — sin confeti, sin pop, sin transiciones */
    @media (prefers-reduced-motion: reduce) {
      .success-check { animation: none; }
      .confetti-piece { display: none; animation: none; }
      .btn-accept { transition: none; }
    }
    /* SCRUM-1646d · los \`style=\` que llevaba el marcado, copiados tal cual. Por id o por una clase que
       sólo lleva ese elemento. El guion los enseña con \`el.style.display = 'block'\` (CSSOM). */
    #tier-cards { display:flex;flex-direction:column;gap:12px;margin-bottom:20px }
    #tier-confirm { display:none }
    #tier-confirm p { font-size:14px;color:#333c37;margin-bottom:12px }
    #btn-accept-wrapper.oculto-hasta-elegir { display:none }
    #sig-error { color:#dc2626;font-size:13px;margin-top:8px;display:none }
    .centrado { text-align:center }
    .condiciones-wrap { text-align:center;margin-bottom:4px }
    .btn-pedir-nuevo { display:inline-block;margin-top:14px;background:#16a34a;color:#fff;font-weight:700;padding:12px 22px;border-radius:999px;text-decoration:none }
    .enlace-rechazar { display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#6b756f;text-decoration:underline }
    .rechazo-titulo { font-size:16px;font-weight:700;color:#0f1c17;margin:0 0 4px;text-align:center }
    .rechazo-sub { font-size:13px;color:#6b756f;margin:0 0 16px;text-align:center }
    .rechazo-label { font-size:13px;font-weight:600;color:#333c37;display:block;margin-bottom:5px }
    .enlace-volver { display:block;text-align:center;margin-top:16px;font-size:13.5px;color:#15803d;font-weight:600;text-decoration:none }
`;

/** La hoja de las opciones (`TIER_CSS`), tal cual. Sólo la enlaza la cara de firmar. */
export const PRESUPUESTO_OPCIONES_CSS = `
  .tier-card { border: 2px solid #e7e9e5; border-radius: 14px; padding: 16px; position: relative; background: #fff; }
  .tier-recommended { border-color: #22c55e; background: #f0fdf4; }
  .tier-badge { position: absolute; top: -10px; left: 16px; background: #22c55e; color: #052e16;
    font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; }
  .tier-header { margin-bottom: 10px; }
  .tier-label { font-weight: 700; font-size: 16px; display: block; }
  .tier-desc { font-size: 13px; color: #6b756f; }
  .tier-lines { font-size: 13px; color: #333c37; margin-bottom: 10px; }
  .tier-line { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f1f2ee; }
  .tier-total { font-size: 22px; font-weight: 800; color: #0f1c17; margin: 10px 0 0; }
  .tier-vat-note { font-size: 11px; color: #6b756f; margin: 0 0 12px; }
  .btn-tier { width: 100%; padding: 12px; font-size: 15px; font-weight: 700; border: none;
    border-radius: 10px; cursor: pointer; background: #22c55e; color: #052e16; min-height: 48px; }
  .tier-recommended .btn-tier { background: #16a34a; color: #fff; }
  .tier-card.selected { border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.2); }
`;

/** El filtro de antes, en un sitio: el color de marca se usa sólo si es `#rrggbb`. */
export const COLOR_DE_MARCA_VALIDO = /^#[0-9a-fA-F]{6}$/;

/**
 * La hoja de marca para un color YA VALIDADO. Las reglas son las de `brandOverrideCss`, tal cual:
 * el color del negocio va en ACENTOS, NUNCA en el botón primario (P1-1).
 */
export function cssDeMarca(brandColor: string): string {
  return `
    .merchant-avatar { background: ${brandColor} !important; color: #fff !important; }
    .tier-recommended, .tier-card.selected { border-color: ${brandColor} !important; }
    .tier-badge { background: ${brandColor} !important; color: #fff !important; }
    .success-check { background: ${brandColor} !important; }
    .total-row { border-top-color: ${brandColor} !important; }
    a { color: ${brandColor}; }
`;
}

export const HUELLA_PRESUPUESTO_FIRMA_CSS = huellaDeContenido(PRESUPUESTO_FIRMA_CSS);
export const HUELLA_PRESUPUESTO_OPCIONES_CSS = huellaDeContenido(PRESUPUESTO_OPCIONES_CSS);
/** La huella de la hoja de marca es la de su PLANTILLA: el color ya va en la ruta. */
export const HUELLA_PRESUPUESTO_MARCA_CSS = huellaDeContenido(cssDeMarca('#000000'));

/** Los `href` que pinta la página. Relativos al propio servidor: `style-src 'self'`. */
export const HREF_PRESUPUESTO_FIRMA_CSS = `/pay/quote/css/firma.css?v=${HUELLA_PRESUPUESTO_FIRMA_CSS}`;
export const HREF_PRESUPUESTO_OPCIONES_CSS = `/pay/quote/css/opciones.css?v=${HUELLA_PRESUPUESTO_OPCIONES_CSS}`;

/** El `href` de la hoja de marca, o `null` si el color no pasa el filtro (entonces no hay enlace). */
export function hrefDeLaHojaDeMarca(brandColor?: string | null): string | null {
  if (!brandColor || !COLOR_DE_MARCA_VALIDO.test(brandColor)) return null;
  return `/pay/quote/css/marca/${brandColor.slice(1)}?v=${HUELLA_PRESUPUESTO_MARCA_CSS}`;
}

/** El color de la ruta (`rrggbb`, sin `#`) → `#rrggbb`, o `null` si no pasa el MISMO filtro. */
export function colorDeLaRuta(enLaRuta: unknown): string | null {
  const color = typeof enLaRuta === 'string' ? `#${enLaRuta}` : '';
  return COLOR_DE_MARCA_VALIDO.test(color) ? color : null;
}

/** `Cache-Control` según la huella pedida: `immutable` sólo si cuadra; si no, revalidar siempre. */
export function cacheDeLaHoja(pedida: unknown, buena: string): string {
  return pedida === buena ? CACHE_CON_HUELLA : 'no-cache';
}
