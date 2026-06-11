// Página "no encontrado" DIGNA para superficies públicas del cliente final.
// Master Parte N3: diseño digno SIEMPRE, jamás texto/JSON crudo; copy oficial:
// "Este enlace no corresponde a ningún documento activo."
// La usan las landings de pago/recibo y la de decisión cuando el id no existe.

export function documentNotFoundHtml(): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex"/>
  <title>Documento no disponible — YaQu</title>
  <style>
    body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#f6f7f5;color:#0f1c17;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border:1px solid #e7e9e5;border-radius:16px;max-width:420px;width:100%;
          padding:36px 28px;text-align:center;box-shadow:0 4px 12px -2px rgba(16,24,40,.08)}
    .icon{font-size:40px;line-height:1;margin-bottom:14px}
    h1{font-size:18px;margin:0 0 8px}
    p{font-size:14px;color:#6b756f;margin:0;line-height:1.5}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📄</div>
    <h1>Este enlace no corresponde a ningún documento activo.</h1>
    <p>Si esperabas un presupuesto o un cobro, pide al profesional que te reenvíe el enlace.</p>
  </div>
</body>
</html>`;
}
