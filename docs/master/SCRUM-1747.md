# SCRUM-1747 — el `firmaToken` llega al operario, y la página pública enseña precios: CONFIRMADO

**Medido contra:** `origin/main` = `a3510f52b208b060e755c81e0c8cc1accc299672` · 2026-11-17T08:01:00Z

S1 · rama `scrum-1747-sonda-firma-token-operario` · **solo confirmación, no arreglo** (encargo del
orquestador, 17-nov-2026). La decisión de qué hacer es de PRODUCTO y la lleva el orquestador al fundador.

## Lo medido (por comportamiento, banco desechable)

Sonda: `docs/evidencias/scrum1747/sonda-firma-token-operario.mjs` (banco Postgres loopback, base
`yaqu_1744_test`, la sonda exige `*_test` antes de tocar nada). Sesión real de OPERARIO (rol `tecnico`,
`/auth/verify` → cookie) y de admin. Albarán VALORADO, `emitido`, con `firmaToken`, del Trabajo asignado
al operario; precio unitario 987,65.

| pregunta | resultado |
|---|---|
| A · `GET /admin/albaranes/:id` con sesión de operario | **200 y trae `firmaToken`**: el mismo del albarán (`albaranes.routes.ts:969`; `albaranParaElRol` no lo quita) |
| — en la ficha, ¿ve el operario el precio? | no (`precioUnitario` recortado por SCRUM-1707) |
| B · `GET /albaran/<ese token>` (pública, sin sesión) | **200 y enseña el precio «987,65»** |
| control · el admin recibe el mismo token | sí (200) |
| control · el concepto de la línea sale en la página | sí |
| control · con `ocultarPreciosEnDocumento=true`, la página NO enseña el precio | sí: no lo enseña |

Es decir: el recorte de SCRUM-1707 en la ficha se rodea abriendo el enlace de firma, que el operario
tiene en la mano. Salvo que el albarán lleve `ocultarPreciosEnDocumento`.

## La disyuntiva (leída en código, NO medida en navegador)

- El front USA ese token: `public/dashboard/js/albaranDetailView.js:710` (`ofrecerCopiarEnlaceDeFirma`,
  barra `waFallbackBar`). Se pinta solo tras un «Enviar para firmar» FALLIDO (`:732`, `:735`).
- El operario PUEDE enviar para firmar: `POST /admin/albaranes/:id/enviar-para-firmar` está en
  `TECNICO_ALLOWED` (`src/core/http/adminRouteDeclarations.ts:187`). O sea, hoy la barra le sirve.
- Quitarle el token al operario le apaga «copiar enlace de firma» cuando falla el WhatsApp en obra.
- Recortar la página pública «para ese camino» no se puede: la página no sabe quién la abre.

→ Qué se prefiere (¿puede el operario pasar el enlace de firma al cliente?) lo decide el FUNDADOR.
Aquí se PARA.

A9: sin fallo que generalice — medición de un encargo de solo confirmar, con sus controles en verde a la primera.
