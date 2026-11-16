// src/modules/billing/app/routes/pagoEstilo.ts — SCRUM-1723 (CSP paso 3, `style-src 'self'`; parte J2)
//
// EL CSS DE LAS PÁGINAS DE PAGO (`/pay/bank`, `/pay/bizum`, `/pay/invoice`, y desde SCRUM-1723c los
// errores de `/pay/card` y las páginas de `/pay/mp`), FUERA DEL HTML.
//
// Hasta aquí vivía en un `<style>` en línea de cada página, más algún `style=` suelto en el marcado.
// Con `style-src 'self'` APLICADA (SCRUM-1637) el navegador no pinta ninguno de los dos y las tres
// páginas salen desnudas: lo midió jv-j2bu en navegador real (SCRUM-1647 c.21665).
//
// ⚠️ CERO CAMBIOS VISIBLES (superficie pública): cada hoja es el `<style>` de SU página, copiado tal
// cual (mismas reglas, mismo orden) y servido en el mismo sitio de la cascada (la `<link>` ocupa el
// hueco del `<style>`). Lo único añadido son las reglas del final de cada hoja: los `style=` del
// marcado, pasados a una clase con las mismas declaraciones.
//
// POR QUÉ UNA HOJA POR PÁGINA Y NO UNA SOLA: las tres definen `body`, `.card` o `.copy-btn` de forma
// distinta; juntarlas cambiaría la cascada. Una sola RUTA (`GET /pay/css/pago.css`, la única línea
// firmada en SCRUM-1723 c.21719) y la página por `?p=`, de un conjunto CERRADO: otra cosa es 404.
//
// Mismo patrón que el guion (`pagoNavegador.ts`, SCRUM-1647): cadenas CONSTANTES, servidas por el
// router de pago (`public/**` es del carril S2), con huella (`?v=`, SCRUM-274).
import { huellaDeContenido, CACHE_CON_HUELLA } from '../../../../core/http/huellaEstaticos';

// SCRUM-1723c · tarjeta y Mercado Pago (las otras dos de las cinco firmadas en c.21719).
//   · `tarjeta`: las dos páginas de error de `/pay/card/:token` no llevaban `<style>`, sólo 8 `style=`
//     (4 por página, los mismos 4 en las dos); pasan a 4 clases con las mismas declaraciones.
//   · `mp-aviso`: el `<style>` de `avisoMpHtml` (503 y 502 de `/pay/mp/:token`), tal cual.
//   · `mp-<estado>`: el `<style>` del resultado de `/pay/mp/:token/result` llevaba `${esc(s.color)}`
//     según el estado, de un conjunto CERRADO de cuatro (approved, rejected, pending, expired). Una
//     hoja por estado, con el color ya escrito: la plantilla es la misma y sólo cambia el color.
export type EstadoDeResultadoMp = 'approved' | 'rejected' | 'pending' | 'expired';

export type PaginaDePago =
  | 'banco' | 'bizum' | 'factura' | 'tarjeta' | 'mp-aviso' | `mp-${EstadoDeResultadoMp}`;

// Los cuatro colores de `statusMap` en `payMp.routes.ts`, copiados de allí. Si allí cambia uno, el
// test de SCRUM-1723 lo caza: pide que la hoja del estado lleve el color que la página pinta en su emoji.
const COLOR_DE_RESULTADO_MP: Readonly<Record<EstadoDeResultadoMp, string>> = {
  approved: '#16a34a',
  rejected: '#dc2626',
  pending: '#d97706',
  expired: '#6b756f',
};

/** El `<style>` del resultado de Mercado Pago, tal cual, con `${esc(s.color)}` ya resuelto. */
function cssDeResultadoMp(color: string): string {
  return `    :root{--ink:#0f1c17;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.12);padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center}
    .emoji{font-size:3rem;margin-bottom:1rem}
    h1{margin:0 0 .5rem;font-size:1.4rem;font-weight:700;letter-spacing:-.01em;color:${color};text-wrap:balance}
    p{color:var(--muted);margin:.5rem 0;line-height:1.5}
    .amount{font-size:1.3rem;font-weight:800;color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:1rem 0}
    .badge{display:inline-block;padding:.25rem .75rem;border-radius:999px;font-size:.75rem;font-weight:700;letter-spacing:.04em;background:${color}1a;color:${color};margin-bottom:1rem}
    .footer{margin-top:2rem;font-size:.75rem;color:var(--muted)}
    /* SCRUM-1723 · los atributos style= que llevaba el marcado, copiados tal cual a una clase. */
    .pago-mp-concepto{font-size:.85rem;font-weight:400;color:#6b756f}
  `;
}

export const PAGO_CSS: Readonly<Record<PaginaDePago, string>> = {
  tarjeta: `    /* SCRUM-1723 · los atributos style= que llevaban las dos páginas de error, copiados tal cual a una clase. */
    .pago-tarjeta-cuerpo{font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:48px auto;padding:0 20px;text-align:center;color:#0f1c17}
    .pago-tarjeta-titulo{font-size:20px;margin:0 0 8px}
    .pago-tarjeta-texto{color:#6b756f;font-size:14px;line-height:1.5;margin:0 0 16px}
    .pago-tarjeta-enlace{display:inline-block;color:#15803d;font-weight:600;text-decoration:none}
  `,
  'mp-aviso': `    :root{--ink:#0f1c17;--muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";margin:0;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.12);padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center}
    .emoji{font-size:3rem;margin-bottom:1rem}
    h1{margin:0;font-size:1.15rem;font-weight:600;line-height:1.45;color:var(--ink);text-wrap:balance}
  `,
  'mp-approved': cssDeResultadoMp(COLOR_DE_RESULTADO_MP.approved),
  'mp-rejected': cssDeResultadoMp(COLOR_DE_RESULTADO_MP.rejected),
  'mp-pending': cssDeResultadoMp(COLOR_DE_RESULTADO_MP.pending),
  'mp-expired': cssDeResultadoMp(COLOR_DE_RESULTADO_MP.expired),
  banco: `    :root{
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
    /* SCRUM-150: a 390px el IBAN (24 caracteres sin puntos de corte) no cabe junto al boton.
       En un flex el item no baja de su contenido (min-width:auto), asi que empujaba el boton
       FUERA de la tarjeta y el body scrolleaba en horizontal (prohibido por AB6). Se permite
       partir la cadena y que el boton caiga a su linea si hace falta. */
    .account-value-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap}
    .account-value{font-size:.95rem;font-weight:700;color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em;min-width:0;overflow-wrap:anywhere}
    /* SCRUM-150: copiar el IBAN es LA accion de esta pantalla y se hace con el pulgar;
       DESIGN.md pide targets >=44px. Estaba en ~28px de alto. */
    .copy-btn{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:.5rem 1rem;min-height:44px;font-size:.8rem;font-weight:600;cursor:pointer;color:var(--ink);flex-shrink:0;transition:background .15s,border-color .15s}
    .copy-btn:hover{background:var(--slate-50);border-color:#cdd2cb}
    .copy-btn:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.28)}
    .copy-btn.copied{background:var(--brand-tint);border-color:#bbf7d0;color:var(--brand)}
    .ref-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:.75rem 1rem}
    .ref-label{font-size:.75rem;color:#92400e;font-weight:600}
    .ref-value-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:.2rem;flex-wrap:wrap}
    .ref-value{font-size:1rem;font-weight:700;color:#92400e;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    .warning{font-size:.8rem;color:#78350f;margin-top:.4rem}
    .steps{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.5rem}
    .steps li{font-size:.85rem;color:var(--body);display:flex;gap:.5rem;align-items:flex-start;line-height:1.45;overflow-wrap:anywhere}
    .steps li::before{content:attr(data-n);background:var(--brand);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0;margin-top:.1rem}
    .dev-sim{margin-top:1.5rem;padding-top:1.25rem;border-top:1px dashed var(--border)}
    .btn-sim{background:var(--ink);color:#fff;border:none;border-radius:999px;padding:.6rem 1.25rem;cursor:pointer;font-size:.9rem;font-weight:600;font-family:inherit}
    .footer{margin-top:1.5rem;text-align:center;font-size:.75rem;color:var(--muted)}
    /* AB6: anillo de Foco accesible (DESIGN.md) en todo elemento enfocado por teclado */
    :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
    /* SCRUM-1723 · los atributos style= que llevaba el marcado, copiados tal cual a una clase. */
    .pago-sin-cuenta{color:#6b756f;font-size:.9rem}
    .pago-obligatorio{color:#ef4444}
    .pago-dev-aviso{font-size:.8rem;color:#6b756f;margin:0 0 .5rem}
  `,
  bizum: `    :root{--brand:#16a34a;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;--muted:#6b756f;
      --bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";
      margin:0;background:var(--bg);color:var(--body);min-height:100vh;display:flex;
      align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:18px;
      box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -16px rgba(16,24,40,.16);
      padding:1.75rem 1.5rem;max-width:420px;width:100%}
    .biz{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.55rem;margin-bottom:1.1rem}
    .logo-mark{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#22d3ee);
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#052e16}
    .logo-img{max-height:44px;max-width:130px;object-fit:contain}
    .biz-name{font-size:.9rem;font-weight:600;color:var(--ink)}
    h1{font-size:1.05rem;color:var(--ink);text-align:center;margin:0 0 1rem}
    .row{display:flex;align-items:center;justify-content:space-between;gap:.6rem;
      border:1px solid var(--border);border-radius:12px;padding:.8rem .9rem;margin-bottom:.6rem}
    .row-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .row-value{font-size:1rem;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;word-break:break-all}
    .copy-btn{flex-shrink:0;border:1px solid var(--border);background:var(--surface);color:var(--ink);
      font:inherit;font-size:.78rem;font-weight:600;border-radius:999px;padding:.45rem .8rem;cursor:pointer;min-height:36px}
    .copy-btn:hover{background:var(--bg)}
    .steps{font-size:.82rem;color:var(--body);line-height:1.6;margin:1rem 0;padding-left:1.2rem}
    .cta{display:block;width:100%;border:0;border-radius:999px;background:var(--brand);color:#fff;
      font:inherit;font-weight:700;font-size:1rem;padding:.95rem 1rem;cursor:pointer;min-height:52px}
    .cta:hover{background:#15803d}
    .cta[disabled]{opacity:.6;cursor:default}
    .note{margin-top:.9rem;text-align:center;font-size:.78rem;color:var(--muted);line-height:1.5}
    .claimed{background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:12px;padding:1rem;
      text-align:center;font-size:.9rem;color:#166534;font-weight:600;line-height:1.5}
    .back{display:block;text-align:center;margin-top:14px;font-size:.82rem;color:var(--muted)}
    :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
    /* SCRUM-1723 · los atributos style= que llevaba el marcado, copiados tal cual a una clase. */
    .row-value.row-value-concepto{font-size:.85rem}
  `,
  factura: `    :root{--brand:#16a34a;--brand-bright:#22c55e;--brand-tint:#ecfdf5;--ink:#0f1c17;--body:#3f4a45;
      --muted:#6b756f;--bg:#f6f7f5;--surface:#fff;--border:#e7e9e5;--slate-50:#f7f8f6;}
    *{box-sizing:border-box}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;font-feature-settings:"cv11","ss01";
      margin:0;background:var(--bg);color:var(--body);min-height:100vh;display:flex;
      align-items:center;justify-content:center;padding:1rem;-webkit-font-smoothing:antialiased}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:18px;
      box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -16px rgba(16,24,40,.16);
      padding:1.75rem 1.5rem;max-width:420px;width:100%}

    /* Identidad del negocio */
    .biz{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.55rem;margin-bottom:1.25rem}
    .logo-mark{width:44px;height:44px;border-radius:50%;
      background:linear-gradient(135deg,var(--brand-bright),#22d3ee);
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#052e16}
    .logo-img{max-height:44px;max-width:130px;object-fit:contain}
    .biz-name{font-size:.9rem;font-weight:600;color:var(--ink)}

    /* Importe */
    .amount-wrap{text-align:center;padding:1.1rem 0 1.25rem;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
    .amount-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:.45rem}
    .amount{font-size:2.3rem;font-weight:800;color:var(--ink);letter-spacing:-.025em;line-height:1;font-variant-numeric:tabular-nums}
    .subline{font-size:.83rem;color:var(--muted);margin-top:.5rem;line-height:1.4}

    /* Métodos — tarjetas IGUALES (patrón Stripe Checkout): el énfasis lo da
       el orden + chip "Recomendado", no un botón macizo. Hover con borde de
       marca y elevación suave; active hunde 1px. */
    .methods-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:1.25rem 0 .7rem}
    .method{display:flex;align-items:center;gap:.85rem;width:100%;padding:.95rem 1rem;border-radius:14px;
      text-decoration:none;margin-bottom:.6rem;min-height:64px;background:var(--surface);color:var(--ink);
      border:1px solid var(--border);transition:border-color .15s,box-shadow .15s,transform .1s}
    .method:hover{border-color:var(--brand);box-shadow:0 4px 12px -2px rgba(16,24,40,.08),0 2px 6px -2px rgba(16,24,40,.05)}
    .method:active{transform:translateY(1px)}
    .method-ico{font-size:1.45rem;flex-shrink:0;width:30px;text-align:center}
    .method-txt{flex:1;min-width:0}
    /* A6.6 P2: block — como spans inline el título y el subtítulo fluían juntos
       y a 390px envolvían a mitad de frase ("Pagar con tarjeta Visa · …") */
    .method-title{display:block;font-weight:700;font-size:.98rem;line-height:1.2}
    .method-sub{display:block;font-size:.76rem;color:var(--muted);margin-top:.12rem}
    /* El chip va DEBAJO del texto (dentro de .method-txt): así el título nunca
       se estruja en móviles estrechos (a 360px "Pagar con tarjeta" salía en 3
       líneas cuando el chip competía por el ancho a la derecha). */
    .method-chip{display:inline-block;margin-top:.35rem;font-size:.66rem;font-weight:700;letter-spacing:.03em;color:#166534;
      background:var(--brand-tint);border:1px solid #bbf7d0;border-radius:999px;padding:.18rem .55rem;text-transform:uppercase}
    .chev{font-size:1.25rem;opacity:.55;flex-shrink:0}
    @media (prefers-reduced-motion: reduce){.method{transition:none}.method:active{transform:none}}

    /* Confianza */
    .trust{margin-top:1.4rem;text-align:center}
    .trust-main{display:inline-flex;align-items:center;gap:.4rem;font-size:.8rem;font-weight:600;color:var(--body)}
    .trust-sub{font-size:.72rem;color:var(--muted);margin-top:.3rem}
    .lock{width:13px;height:13px;display:inline-block;vertical-align:-1px}
    /* AB6: anillo de Foco accesible (DESIGN.md) en todo elemento enfocado por teclado */
    :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
    /* SCRUM-1723 · los atributos style= que llevaba el marcado, copiados tal cual a una clase. */
    .pago-sin-metodos{text-align:center;font-size:.85rem;color:var(--muted);padding:.8rem 0;line-height:1.5}
  `,
};

const HUELLAS = Object.fromEntries(
  (Object.keys(PAGO_CSS) as PaginaDePago[]).map((p) => [p, huellaDeContenido(PAGO_CSS[p])]),
) as Readonly<Record<PaginaDePago, string>>;

/** La hoja del resultado de Mercado Pago para un estado; uno fuera del conjunto cae a `pending`, como `statusMap`. */
export function estiloDeResultadoMp(estado: string): PaginaDePago {
  return Object.prototype.hasOwnProperty.call(COLOR_DE_RESULTADO_MP, estado)
    ? (`mp-${estado}` as PaginaDePago)
    : 'mp-pending';
}

/** Ruta de la hoja dentro del router montado en `/pay`. */
export const RUTA_PAGO_CSS = '/css/pago.css';

/** La página pedida, sólo si es una de las del conjunto cerrado; si no, `null`. */
export function paginaDeEstilo(pedida: unknown): PaginaDePago | null {
  return typeof pedida === 'string' && Object.prototype.hasOwnProperty.call(PAGO_CSS, pedida)
    ? (pedida as PaginaDePago)
    : null;
}

/** `Cache-Control` según la huella pedida: `immutable` sólo si cuadra; si no, revalidar siempre. */
export function cacheDelEstiloDePago(pagina: PaginaDePago, pedida: unknown): string {
  return pedida === HUELLAS[pagina] ? CACHE_CON_HUELLA : 'no-cache';
}

/** El `href` de la hoja. Relativo al propio servidor: `style-src 'self'`. */
export function hrefEstiloDePago(pagina: PaginaDePago): string {
  return `/pay${RUTA_PAGO_CSS}?p=${pagina}&v=${HUELLAS[pagina]}`;
}

/** La etiqueta que ocupa el hueco del `<style>`. `pagina` es una constante del servidor, nunca un dato. */
export function etiquetaEstiloDePago(pagina: PaginaDePago): string {
  return `<link rel="stylesheet" href="${hrefEstiloDePago(pagina).replace('&', '&amp;')}"/>`;
}
