// src/modules/system/app/routes/quoteDecisionLanding.routes.ts
import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

type DecisionApiError = {
  message?: string;
  error?: string;
};

const quoteDecisionLandingRouter = Router();

// Usamos la misma base pública que ya tienes en .env
// Si no existe, caemos en localhost.
const BASE_API_URL =
  process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

// --- Helpers de HTML muy sencillos ---

function renderHtmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        margin: 0;
        padding: 1.5rem;
        background: #f5f5f5;
      }
      .card {
        max-width: 480px;
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      }
      h1 {
        font-size: 1.25rem;
        margin-bottom: 0.75rem;
      }
      p {
        line-height: 1.5;
        margin-bottom: 0.75rem;
      }
      form {
        margin-top: 1rem;
      }
      label {
        font-weight: 500;
        display: block;
        margin-bottom: 0.25rem;
      }
      select,
      textarea,
      button {
        width: 100%;
        font-size: 1rem;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        border: 1px solid #d0d0d0;
        box-sizing: border-box;
      }
      textarea {
        min-height: 90px;
        resize: vertical;
      }
      button {
        margin-top: 0.75rem;
        background: #2563eb;
        color: #fff;
        border: none;
        cursor: pointer;
        font-weight: 600;
      }
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .status-ok {
        background: #ecfdf3;
        border-radius: 8px;
        padding: 0.75rem 0.9rem;
        font-size: 0.95rem;
        margin-bottom: 0.5rem;
      }
      .status-error {
        background: #fef2f2;
        border-radius: 8px;
        padding: 0.75rem 0.9rem;
        font-size: 0.95rem;
        margin-bottom: 0.5rem;
      }
      small {
        font-size: 0.8rem;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="card">
      ${body}
    </div>
  </body>
</html>`;
}

// --- ACEPTAR PRESUPUESTO ---

// GET /pay/quote/:id/accept
quoteDecisionLandingRouter.get(
  '/quote/:id/accept',
  (req: Request, res: Response) => {
    const quoteId = req.params.id;

    const html = renderHtmlPage(
      'Aceptar presupuesto',
      `
        <h1>Confirmar aceptación</h1>
        <p>
          Vas a aceptar el presupuesto <strong>#${quoteId}</strong>.
        </p>
        <p>
          Al aceptar, el proveedor podrá continuar con el trabajo y se generará la factura correspondiente.
        </p>
        <form method="post">
          <button type="submit">Sí, aceptar presupuesto</button>
          <p><small>Si no has solicitado este presupuesto, puedes simplemente cerrar esta página.</small></p>
        </form>
      `
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
);

// POST /pay/quote/:id/accept
quoteDecisionLandingRouter.post(
  '/quote/:id/accept',
  async (req: Request, res: Response) => {
    const quoteId = req.params.id;

    try {
      const apiUrl = `${BASE_API_URL}/quote/${encodeURIComponent(
        quoteId
      )}/decision`;

      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // IMPORTANTE: aquí no inventamos campos.
        // Usamos el contrato que ya funcionaba:
        // { decision: 'accept', comment?: string }
        body: JSON.stringify({
          decision: 'accept',
          comment: 'Aceptado desde WhatsApp',
        }),
      });

      const json = (await apiResponse.json().catch(() => null)) as
      | DecisionApiError
      | null;
    
    if (!apiResponse.ok) {
      const errorBody = json as DecisionApiError | null;
    
      const msg =
        (errorBody?.message ||
          errorBody?.error ||
          `Error ${apiResponse.status} al procesar la decisión`);
    
      const htmlError = renderHtmlPage(
        'Error al aceptar presupuesto',
        `
          <div class="status-error">
            <strong>No se ha podido aceptar el presupuesto.</strong><br />
            ${msg}
          </div>
          <p>Si el problema persiste, contacta con tu proveedor.</p>
        `
      );
    
      res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(htmlError);
    }
    

      const htmlOk = renderHtmlPage(
        'Presupuesto aceptado',
        `
          <div class="status-ok">
            <strong>¡Gracias!</strong><br />
            Hemos registrado la aceptación del presupuesto <strong>#${quoteId}</strong>.
          </div>
          <p>El proveedor te informará de los siguientes pasos.</p>
        `
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlOk);
    } catch (error) {
      const htmlError = renderHtmlPage(
        'Error al aceptar presupuesto',
        `
          <div class="status-error">
            <strong>Ha ocurrido un error inesperado.</strong>
          </div>
          <p>Por favor, vuelve a intentarlo más tarde o contacta con tu proveedor.</p>
        `
      );
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlError);
    }
  }
);

// --- RECHAZAR PRESUPUESTO ---

// GET /pay/quote/:id/reject
quoteDecisionLandingRouter.get(
  '/quote/:id/reject',
  (req: Request, res: Response) => {
    const quoteId = req.params.id;

    const html = renderHtmlPage(
      'Rechazar presupuesto',
      `
        <h1>Rechazar presupuesto</h1>
        <p>
          Vas a rechazar el presupuesto <strong>#${quoteId}</strong>.
        </p>
        <p>Opcionalmente, puedes indicar el motivo:</p>
        <form method="post">
          <label for="reason">Motivo principal</label>
          <select id="reason" name="reason">
            <option value="">Selecciona una opción</option>
            <option value="price">El precio es demasiado alto</option>
            <option value="another_provider">He elegido otro proveedor</option>
            <option value="no_longer_needed">Ya no necesito el servicio</option>
            <option value="other">Otro motivo</option>
          </select>

          <label for="comment" style="margin-top:0.75rem;">Comentario (opcional)</label>
          <textarea id="comment" name="comment" placeholder="Cuéntanos algo más si quieres..."></textarea>

          <button type="submit">Enviar rechazo</button>
        </form>
      `
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
);

// POST /pay/quote/:id/reject
quoteDecisionLandingRouter.post(
  '/quote/:id/reject',
  async (req: Request, res: Response) => {
    const quoteId = req.params.id;
    const { reason, comment } = req.body || {};

    const finalComment =
      (reason ? `Motivo: ${reason}. ` : '') +
      (comment ? String(comment) : '').trim();

    try {
      const apiUrl = `${BASE_API_URL}/quote/${encodeURIComponent(
        quoteId
      )}/decision`;

      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision: 'reject',
          comment: finalComment || 'Rechazado desde WhatsApp',
        }),
      });

      const json = (await apiResponse.json().catch(() => null)) as
  | DecisionApiError
  | null;

if (!apiResponse.ok) {
  const errorBody = json as DecisionApiError | null;

  const msg =
    (errorBody?.message ||
      errorBody?.error ||
      `Error ${apiResponse.status} al procesar la decisión`);

  const htmlError = renderHtmlPage(
    'Error al rechazar presupuesto',
    `
      <div class="status-error">
        <strong>No se ha podido registrar el rechazo.</strong><br />
        ${msg}
      </div>
      <p>Si el problema persiste, contacta con tu proveedor.</p>
    `
  );

  res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(htmlError);
}


      const htmlOk = renderHtmlPage(
        'Presupuesto rechazado',
        `
          <div class="status-ok">
            <strong>Gracias por tu respuesta.</strong><br />
            Hemos registrado el rechazo del presupuesto <strong>#${quoteId}</strong>.
          </div>
        `
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlOk);
    } catch (error) {
      const htmlError = renderHtmlPage(
        'Error al rechazar presupuesto',
        `
          <div class="status-error">
            <strong>Ha ocurrido un error inesperado.</strong>
          </div>
          <p>Por favor, vuelve a intentarlo más tarde o contacta con tu proveedor.</p>
        `
      );
      res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlError);
    }
  }
);

export { quoteDecisionLandingRouter };
