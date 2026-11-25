// src/modules/billing/app/routes/reciboPortalEstilo.ts — SCRUM-1756b (CSP paso 3 · restos; filas de J2)
//
// EL CSS DEL RECIBO PÚBLICO (`/recibo/:token`) Y DEL PORTAL DEL CLIENTE (`/cliente/:token`), FUERA DEL HTML.
//
// Es la receta de SCRUM-1723 (`pagoEstilo.ts`): con `style-src 'self'` APLICADA el navegador no pinta
// un `<style>` en línea ni un `style=`. Cada hoja es el `<style>` de su sitio, COPIADO TAL CUAL por
// `docs/master/evidencias/SCRUM-1756/generar.mjs.txt` (aborta ante `${` o comilla grave), y la
// `<link>` ocupa el hueco del `<style>`, que es el mismo sitio de la cascada. Lo único añadido son las
// reglas del final de cada hoja: los `style=` del marcado, pasados a una clase con las mismas declaraciones.
//
//   · `recibo`: el `<style>` de la cabecera del recibo, más sus 9 `style=` (7 de ellos solo salen fuera
//     de producción: simulación y eventos de desarrollo).
//   · `recibo-valoracion`: el `<style>` del bloque de valoración (solo con el cobro pagado); su `<link>`
//     va dentro del bloque, donde estaba, así que se carga DESPUÉS de la hoja del recibo, como antes.
//   · `portal`: el `<style>` del portal, más sus 8 `style=`. La etiqueta de estado pintaba sus dos colores
//     con `${c.bg}`/`${c.fg}` de un mapa CERRADO: el mapa se muda aquí y sale una clase por estado, con
//     el gris de antes para un estado que el mapa no conoce.
//
// Se sirven por la MISMA ruta que las de pago (`GET /pay/css/pago.css?p=<hoja>&v=<huella>`, declarada en
// SCRUM-1723 c.21719): un recurso constante, sin datos. Ninguna ruta nueva.
//
// ⚠️ Los `<script>` en línea de estas dos páginas NO están aquí: son el paso 2 (SCRUM-1756, filas nuevas).

export type HojaDeReciboOPortal = 'recibo' | 'recibo-valoracion' | 'portal';

// El mapa de `customerPortal.routes.ts` (`STATUS_COLOR`), mudado tal cual.
const COLOR_DE_ETIQUETA_DEL_PORTAL: Readonly<Record<string, { bg: string; fg: string }>> = {
  accepted: { bg: '#dcfce7', fg: '#166534' },
  paid:     { bg: '#dcfce7', fg: '#166534' },
  sent:     { bg: '#dbeafe', fg: '#1d4ed8' },
  pending:  { bg: '#fef3c7', fg: '#92400e' },
  rejected: { bg: '#fee2e2', fg: '#991b1b' },
  expired:  { bg: '#f1f2ee', fg: '#4b554f' },
  draft:    { bg: '#f1f2ee', fg: '#4b554f' },
};
// El gris con el que se pintaba un estado que el mapa no conoce.
const COLOR_DE_ETIQUETA_DESCONOCIDA = { bg: '#f1f2ee', fg: '#4b554f' };

/** La clase de color de la etiqueta de estado del portal. Del conjunto cerrado; si no, la gris. */
export function claseDeEtiquetaDelPortal(status: string): string {
  return Object.prototype.hasOwnProperty.call(COLOR_DE_ETIQUETA_DEL_PORTAL, status) ? `portal-pill-${status}` : 'portal-pill-otro';
}

const REGLAS_DE_ETIQUETA = [
  ...Object.entries(COLOR_DE_ETIQUETA_DEL_PORTAL).map(([s, c]) => `  .portal-pill-${s}{background:${c.bg};color:${c.fg}}`),
  `  .portal-pill-otro{background:${COLOR_DE_ETIQUETA_DESCONOCIDA.bg};color:${COLOR_DE_ETIQUETA_DESCONOCIDA.fg}}`,
].join('\n');

export const RECIBO_PORTAL_CSS: Readonly<Record<HojaDeReciboOPortal, string>> = {
  recibo: `  :root{--brand:#16a34a;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;padding:2rem 1rem;background:var(--bg);color:var(--body);-webkit-font-smoothing:antialiased}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.5rem;max-width:720px;margin:0 auto;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.10)}
  h2{color:var(--ink);letter-spacing:-.01em}
  .row{display:flex;gap:1rem;flex-wrap:wrap}
  .row > div{flex:1 1 240px}
  .row b{color:var(--ink);font-variant-numeric:tabular-nums}
  small{color:var(--muted)}
  ul{padding-left:1.1rem;color:var(--body)}
  a{color:#15803d} /* A9.4 AB6: 4,55:1 — var(--brand) fallaba AA en texto normal */
  .pay-btn{display:inline-block;padding:.7rem 1.1rem;border-radius:12px;text-decoration:none;font-weight:700;font-size:.92rem;text-align:center}
  .pay-btn-primary{background:var(--brand);color:#fff}
  .pay-btn-secondary{background:var(--surface);color:var(--ink);border:1px solid var(--border)}
  /* Banners de estado/aviso — tokens DESIGN.md (semánticos), sin hex inline sueltos */
  .note{padding:.6rem .8rem;border-radius:12px;margin:.75rem 0;font-size:.9rem;line-height:1.45;border:1px solid}
  .note b{font-weight:700}
  .note-ok{background:var(--brand-tint);border-color:#bbf7d0;color:#166534}
  .note-warn{background:#fff7ed;border-color:#fed7aa;color:#b45309}
  .note-danger{background:#fef2f2;border-color:#fecaca;color:#991b1b}
  .note-muted{background:var(--slate-50);border-color:var(--border);color:var(--body)}
  .note-info{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
  .doc-link{margin:.5rem 0}
  .email-form{margin-top:.5rem}
  .btn-email{background:var(--brand);color:#fff;padding:.5rem 1rem;border-radius:999px;border:none;cursor:pointer;font-weight:600;font-family:inherit}
  .btn-email:hover{background:#15803d}
  .biz{text-align:center;font-size:.88rem;font-weight:600;color:var(--ink);margin-bottom:.25rem}
  .status-hero{text-align:center;padding:.5rem 0 1.1rem;border-bottom:1px solid var(--border);margin-bottom:1rem}
  .status-icon{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;margin:.4rem auto .6rem}
  .status-icon.paid{background:#ecfdf5;color:#15803d}
  /* A6.2: celebración post-pago — check que "aterriza" + onda expansiva, CSS puro */
  .status-icon.celebrate{position:relative;animation:rcheck .5s cubic-bezier(.34,1.56,.64,1) both}
  .status-icon.celebrate::after{content:"";position:absolute;inset:-4px;border-radius:50%;
    border:2px solid #22c55e;opacity:0;animation:rring .9s ease-out .25s}
  @keyframes rcheck{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes rring{0%{transform:scale(.8);opacity:.8}100%{transform:scale(1.9);opacity:0}}
  @media (prefers-reduced-motion: reduce){.status-icon.celebrate{animation:none}.status-icon.celebrate::after{display:none}}
  .status-icon.pending{background:#fffbeb;color:#b45309}
  .status-icon.failed{background:#fef2f2;color:#dc2626}
  .status-icon.expired{background:var(--slate-50);color:var(--muted)}
  .status-title{font-size:1.05rem;font-weight:700;color:var(--ink)}
  .status-amount{font-size:2rem;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:.35rem}
  .status-sub{font-size:.85rem;color:var(--muted);margin-top:.35rem}
  .status-meta{font-size:.82rem;color:var(--muted);font-weight:600;margin-top:.5rem;font-variant-numeric:tabular-nums}
  .pay-stack{display:flex;flex-direction:column;gap:.5rem;margin:1rem 0}
  /* AB6: anillo de Foco accesible (DESIGN.md) en todo elemento enfocado por teclado */
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
  /* SCRUM-1756b · los atributos style= que llevaba el marcado, copiados tal cual a una clase. */
  .recibo-dev-simulacion{margin-top:1rem}
  .recibo-dev-formulario{margin-top:.5rem}
  .recibo-dev-boton-pago{background:#2563eb;color:#fff;padding:.4rem .8rem;border-radius:.4rem;border:none;cursor:pointer}
  .recibo-dev-fila{display:flex;gap:.5rem;margin-top:.5rem}
  .recibo-dev-boton-fallo{background:#dc2626;color:#fff;padding:.35rem .7rem;border-radius:.4rem;border:none;cursor:pointer}
  .recibo-dev-boton-caducidad{background:#6b7280;color:#fff;padding:.35rem .7rem;border-radius:.4rem;border:none;cursor:pointer}
  .recibo-dev-separador{margin:1.25rem 0;border:none;border-top:1px solid var(--border)}
  .recibo-dev-eventos{margin-top:.4rem}
  .recibo-pie{margin-top:1rem;text-align:center}
`,
  'recibo-valoracion': `    .fb{border-top:1px solid var(--border);margin-top:1.1rem;padding-top:1rem;text-align:center}
    .fb-title{font-weight:700;color:var(--ink);font-size:.98rem;margin-bottom:.55rem}
    .fb-stars{display:flex;justify-content:center;gap:.35rem;font-size:1.9rem;margin-bottom:.6rem}
    .fb-stars button{background:none;border:none;cursor:pointer;font-size:inherit;line-height:1;filter:grayscale(1);opacity:.45;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:filter .12s,opacity .12s,transform .12s} /* A9.4 AB6: target 44px */
    .fb-stars button.on{filter:none;opacity:1;transform:scale(1.08)}
    .fb textarea{width:100%;max-width:420px;border:1px solid var(--border);border-radius:12px;padding:.6rem .8rem;font:inherit;font-size:.88rem;color:var(--ink);resize:vertical;min-height:56px}
    .fb-send{margin-top:.6rem;background:var(--surface);color:var(--ink);border:1px solid var(--border);border-radius:999px;padding:.55rem 1.2rem;font:inherit;font-weight:600;cursor:pointer}
    .fb-send:hover{background:var(--slate-50)}
    .fb-google{margin-top:.9rem}
    .fb-hint{font-size:.82rem;color:var(--muted);margin-top:.5rem}
    .fb-or{font-size:.82rem;color:var(--muted);margin:1.15rem 0 .55rem;border-top:1px solid var(--border);padding-top:.9rem}
    .fb-gstars{display:flex;justify-content:center;gap:.15rem;margin:.5rem 0 .35rem}
    .fb-gstars a{font-size:2.35rem;line-height:1;text-decoration:none;color:#f5b301;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;transition:transform .12s,color .12s}
    .fb-gstars a:hover,.fb-gstars a:focus{transform:scale(1.18);color:#e0a800;outline:none}
    @media (prefers-reduced-motion: reduce){.fb-stars button{transition:none;transform:none}}
`,
  portal: `  :root{
    --brand:#16a34a;--brand-bright:#22c55e;--brand-tint:#ecfdf5;
    --ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;
    --bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6;--slate-100:#f1f2ee;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter',system-ui,-apple-system,sans-serif; font-feature-settings:"cv11","ss01";
    background: var(--bg); color: var(--body); min-height: 100vh; -webkit-font-smoothing: antialiased; }

  /* Header */
  .pf-header { background: var(--ink); padding: 14px 20px;
    display: flex; align-items: center; gap: 12px; }
  .pf-logo { max-height: 38px; max-width: 90px; object-fit: contain; border-radius: 6px; }
  .pf-brand { color: #fff; font-weight: 700; font-size: 15px; line-height: 1.3; }
  .pf-brand-sub { color: rgba(255,255,255,.6); font-size: 12px; font-weight: 400; }

  /* Container */
  .pf-main { max-width: 600px; margin: 0 auto; padding: 20px 14px 60px; }

  /* Greeting */
  .pf-greeting { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); margin: 20px 0 4px; }
  .pf-greeting-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }

  /* Section */
  .pf-section { margin-bottom: 28px; }
  .pf-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .08em; color: var(--muted); margin-bottom: 10px; padding-left: 2px; }

  /* Card */
  .pf-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 0;
    box-shadow: 0 1px 2px rgba(16,24,40,.04); margin-bottom: 10px; overflow: hidden; }
  .pf-card-body { padding: 14px 16px; }
  .pf-card-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .pf-card-title { font-weight: 700; font-size: 14.5px; color: var(--ink); margin-bottom: 3px; }
  .pf-card-meta { font-size: 12.5px; color: var(--muted); }
  .pf-card-amount { font-weight: 800; font-size: 17px; color: var(--ink); margin-bottom: 5px; text-align: right; font-variant-numeric: tabular-nums; }

  /* Buttons */
  .pf-btn { display: block; width: 100%; padding: 12px 14px; border-radius: 12px;
    font-size: 14px; font-weight: 700; text-align: center; text-decoration: none;
    border: none; cursor: pointer; transition: opacity .15s, background .15s; }
  .pf-btn:active { opacity: .85; }
  .pf-btn-pay { background: var(--brand); color: #fff; margin-bottom: 6px; }
  .pf-btn-pdf { background: var(--surface); color: var(--ink); border: 1px solid var(--border); margin-bottom: 6px; }
  .pf-btn-mp  { background: #009ee3; color: #fff; margin-bottom: 6px; }
  .pf-btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border);
    font-size: 13px; padding: 8px 14px; }

  /* Lines expandibles */
  .pf-lines { border-top: 1px solid var(--slate-100); }
  .pf-lines-toggle { width: 100%; background: none; border: none; padding: 9px 16px;
    font-size: 12.5px; color: var(--muted); cursor: pointer; text-align: left;
    display: flex; align-items: center; gap: 6px; font-family: inherit; }
  .pf-lines-toggle:hover { background: var(--slate-50); }
  .pf-lines-body { display: none; padding: 0 16px 12px; }
  .pf-lines-body.open { display: block; }
  .pf-line-row { display: flex; justify-content: space-between; gap: 8px;
    font-size: 12.5px; padding: 5px 0; border-bottom: 1px solid var(--slate-100); }
  .pf-line-row:last-child { border-bottom: none; }
  .pf-line-concept { color: var(--body); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-line-amount { font-weight: 600; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
  /* SCRUM-1786g · «Total del apartado»: misma fila, en negrita y con raya encima (como el PDF) */
  .pf-apartado-total { border-top: 1px solid var(--border); }
  .pf-apartado-total-concepto { color: var(--ink); font-weight: 600; flex: 1; min-width: 0; text-align: right; }
  .pf-apartado-total-importe { font-weight: 700; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }

  /* Request form */
  .pf-request-btn { background: linear-gradient(135deg,var(--brand-bright),var(--brand));
    color: #fff; border: none; width: 100%; padding: 14px;
    border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px rgba(22,163,74,.28); font-family: inherit; }
  .pf-request-form { display: none; background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
    padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .pf-request-form.open { display: block; }
  .pf-request-label { font-size: 13px; font-weight: 600; color: var(--body); display: block; margin-bottom: 6px; }
  .pf-request-textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border);
    border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical;
    min-height: 100px; color: var(--ink); }
  .pf-request-textarea:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(34,197,94,.22); }
  .pf-request-submit { background: var(--brand); color: #fff; border: none; width: 100%;
    padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 700;
    cursor: pointer; margin-top: 10px; font-family: inherit; }
  .pf-request-cancel { background: none; border: none; color: var(--muted); font-size: 13px;
    cursor: pointer; margin-top: 8px; width: 100%; font-family: inherit; }
  .pf-success { background: var(--brand-tint); border: 1px solid #bbf7d0; border-radius: 12px;
    padding: 14px; color: #15803d; font-size: 14px; text-align: center; font-weight: 600; }

  /* Empty */
  .pf-empty { color: var(--muted); font-size: 14px; text-align: center; padding: 20px 0; }

  /* Footer */
  .pf-footer { text-align: center; font-size: 12px; color: var(--muted); margin-top: 40px; }

  /* Contact */
  .pf-contact-row { display: flex; gap: 10px; }
  .pf-wa-btn { flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 8px; background: #25d366; color: #fff; border-radius: 12px; padding: 12px;
    text-decoration: none; font-weight: 700; font-size: 13.5px; }
  /* SCRUM-1756b · los atributos style= que llevaba el marcado, copiados tal cual a una clase. */
  .portal-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
${REGLAS_DE_ETIQUETA}
  .portal-pie-enlace{color:inherit;font-weight:700;text-decoration:none}
  .portal-enlace-no-valido{padding:60px 20px;text-align:center;color:#6b756f;font-size:15px}
  .portal-inicial{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#22c55e,#22d3ee);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#052e16}
  .portal-acciones{margin-top:12px}
  .portal-sin-margen-inferior{margin-bottom:0}
  .portal-oculto{display:none}
`,
};
