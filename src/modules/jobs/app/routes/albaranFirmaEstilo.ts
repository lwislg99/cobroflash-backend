// src/modules/jobs/app/routes/albaranFirmaEstilo.ts — SCRUM-1646 + SCRUM-1723 (CSP paso 2, `style-src 'self'`)
//
// EL CSS DE LA PÁGINA PÚBLICA DE FIRMA DEL PARTE, FUERA DEL HTML.
//
// Hasta aquí vivía en un `<style>` en línea de `albaranPublic.routes.ts` (y dos `style=` sueltos en el
// marcado). Con `style-src 'self'` APLICADA (SCRUM-1637, paso 3) el navegador no pinta ninguno de los
// dos y la página sale desnuda: lo midió SCRUM-1723 en las páginas de pago, y aquí pasaba lo mismo.
//
// ⚠️ CERO CAMBIOS VISIBLES (superficie pública): las reglas son las MISMAS, en el MISMO orden y en el
// mismo sitio de la cascada (justo detrás de `/fonts/inter.css`). Lo único nuevo son las dos reglas
// por id del final, que son los dos `style=` que había en el marcado, copiados tal cual.
//
// Lo que el guion cambia con `el.style.x = …` (CSSOM) NO lo bloquea `style-src`: eso sigue igual.
//
// Mismo patrón que el guion (`albaranFirmaNavegador.ts`): cadena CONSTANTE, servida por el router del
// parte (`public/**` es del carril S2) con huella (`?v=` = sha1 del contenido, SCRUM-274).
import { huellaDeContenido, CACHE_CON_HUELLA } from '../../../../core/http/huellaEstaticos';

export const ALBARAN_FIRMA_CSS = `
  *,*::before,*::after{box-sizing:border-box}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;
    margin:0;padding:16px;background:#f6f7f5;color:#3f4a45;min-height:100vh}
  .card{max-width:460px;margin:24px auto;background:#fff;border:1px solid #e7e9e5;border-radius:18px;
    padding:26px 24px;box-shadow:0 1px 2px rgba(16,24,40,.04),0 18px 40px -16px rgba(16,24,40,.16)}
  .merchant-hero{text-align:center;padding:4px 0 16px}
  .merchant-logo{max-height:56px;max-width:160px;object-fit:contain;margin-bottom:8px}
  .merchant-avatar{width:60px;height:60px;border-radius:50%;margin:0 auto 8px;
    background:linear-gradient(135deg,#22c55e,#22d3ee);color:#052e16;font-weight:800;font-size:24px;
    display:flex;align-items:center;justify-content:center}
  .merchant-name{font-size:20px;font-weight:800;color:#0f1c17}
  h1{font-size:19px;margin:0 0 4px;color:#0f1c17;text-align:center}
  .meta{font-size:13px;color:#6b756f;text-align:center;margin-bottom:16px}
  .lines-table{width:100%;border-collapse:collapse;font-size:14px;margin:12px 0}
  .lines-table th{text-align:left;padding:4px 6px;color:#6b756f;font-size:12px;border-bottom:1px solid #e7e9e5}
  .lines-table td{padding:6px 6px;border-bottom:1px solid #f1f2ee}
  .lines-table th:nth-child(2),.lines-table td:nth-child(2),
  .lines-table th:nth-child(3),.lines-table td:nth-child(3){text-align:right;white-space:nowrap}
  /* SCRUM-468 · columnas de importe y totales del albarán VALORADO. Solo casan con marcado que
     el SIN_VALORAR NO genera (.num / .totales), así que esa pantalla no cambia ni un píxel.
     Cero colores nuevos: los tres son los que ya usa este mismo fichero. */
  .lines-table th.num,.lines-table td.num{text-align:right;white-space:nowrap}
  .totales{text-align:right;margin-top:-4px}
  .totales p{margin:2px 0}
  .totales .base{font-size:14px;color:#3f4a45}
  .totales .total{font-size:18px;font-weight:800;color:#0f1c17}
  .totales .leyenda{font-size:11px;color:#8b948e;line-height:1.45;margin-top:6px}
  .divider{border:none;border-top:1px solid #e7e9e5;margin:16px 0}
  .sig-label{font-size:13px;font-weight:600;color:#333c37;margin-bottom:6px;display:block}
  .sig-sub{font-size:12px;color:#6b756f;margin-bottom:8px}
  .sig-wrapper{border:2px solid #cdd2cb;border-radius:10px;background:#f7f8f6;position:relative;overflow:hidden;margin-bottom:8px}
  .sig-wrapper.has-sig{border-color:#22c55e;background:#fff}
  #sig-canvas{display:block;width:100%;height:150px;cursor:crosshair;touch-action:none}
  .sig-placeholder{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#cdd2cb;
    font-size:14px;pointer-events:none;user-select:none}
  .sig-actions{display:flex;gap:8px;margin-bottom:16px;align-items:center}
  /* SCRUM-300: los dos campos de FIRMADO POR. El NOMBRE es OBLIGATORIO y viene precargado con el
     del cliente —quien tiene el móvil en la mano suele ser él—, así que el camino normal no
     añade toques: trazo y botón. La CALIDAD viene SIN marcar y es opcional.
     ⚠️ El nombre precargado se BORRA si se declara que firmó otra persona. */
  .firmante-campo{margin-bottom:10px}
  .firmante-campo label{display:block;font-size:13px;font-weight:600;color:#333c37;margin-bottom:4px}
  .firmante-campo input,.firmante-campo select{width:100%;padding:11px 12px;font-size:15px;font-family:inherit;
    color:#0f1c17;background:#fff;border:1px solid #cdd2cb;border-radius:10px;min-height:44px}
  .btn-clear{font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid #e7e9e5;background:#fff;cursor:pointer;color:#6b756f}
  .btn-accept{width:100%;padding:15px;font-size:16px;font-weight:700;background:#16a34a;color:#fff;border:none;
    border-radius:14px;cursor:pointer;min-height:52px;box-shadow:0 4px 14px -2px rgba(22,163,74,.35)}
  .btn-accept:active{background:#15803d;transform:translateY(1px)}
  .btn-accept:disabled{opacity:.5;cursor:default}
  /* SCRUM-967b: el enlace al portal tras firmar es un <a>, con la misma cara que el botón primario. */
  a.btn-portal{display:block;box-sizing:border-box;margin-top:16px;text-align:center;text-decoration:none;line-height:22px}
  .status-ok{background:#ecfdf5;border-radius:12px;padding:16px;text-align:center}
  /* SCRUM-361 (H6): el albarán cambió mientras esta página estaba abierta. Hermana de .status-ok
     y NO de un error: mismo radio, mismo padding, mismo centrado — solo cambia el tono. Que no
     parezca un fallo del programa es condición del texto aprobado, y el color es parte del texto. */
  .status-aviso{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;
    text-align:center;color:#3f4a45;font-size:15px;line-height:1.45}
  .status-ok strong{color:#166534}
  .success-check{width:72px;height:72px;border-radius:50%;background:#16a34a;color:#fff;font-size:40px;
    display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
  small{font-size:12px;color:#6b756f;display:block;text-align:center;margin-top:12px}
  .privacy-note{font-size:11px;color:#8b948e;text-align:left;line-height:1.5;margin-top:10px}
  .privacy-note a{color:#8b948e;text-decoration:underline}
  :focus-visible{outline:none;box-shadow:0 0 0 3px rgba(34,197,94,.30)}
  /* SCRUM-1723 · los dos \`style=\` que llevaba el marcado, copiados tal cual. Por id: nada más los
     casa. El guion los enseña con \`el.style.display = 'block'\` (CSSOM, que la CSP no bloquea). */
  #firmante-otro-wrap{display:none}
  #sig-error{color:#dc2626;font-size:13px;margin-top:8px;display:none}
`;

/** Huella del CSS: cambia si y sólo si cambia el contenido. */
export const HUELLA_FIRMA_CSS = huellaDeContenido(ALBARAN_FIRMA_CSS);

/** El `href` que pinta la página. Relativo al propio servidor: `style-src 'self'`. */
export const HREF_FIRMA_CSS = `/albaran/css/firma.css?v=${HUELLA_FIRMA_CSS}`;

/** `Cache-Control` según la huella pedida: `immutable` sólo si cuadra; si no, revalidar siempre. */
export function cacheDelEstilo(pedida: unknown): string {
  return pedida === HUELLA_FIRMA_CSS ? CACHE_CON_HUELLA : 'no-cache';
}
