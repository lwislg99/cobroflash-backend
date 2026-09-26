# SCRUM-988 · La pantalla de revisiones, enchufada en la ficha del presupuesto

**Medido contra:** `origin/main` = `942e90d1f84dd6d7fcf5fa92aad48f36758c2d87` · 2026-09-26T12:05:00Z
**Rama:** `scrum-988-revisiones-en-detalle`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).

## PASO 0 (26-sep-2026)

- `pintarRevisiones` / `cablearCrearRevision` / `quoteRevisiones` en `public/`: solo su definición,
  el `<script>` de `index.html` y el `SHELL` de `sw.js`. **Cero llamadores.** Control positivo:
  `quotesDetailView.js` sí contiene «revisi» (el aviso de mantenimiento): la búsqueda no está ciega.
- Servidor vivo: el detalle sirve `revisiones` y `vigenteId` (`quoteAdmin.ts`);
  `POST /admin/quotes/:id/revisiones` es `requireRole('admin')` (igualdad exacta de rol).

## Decisiones (orquestador cobroflash-backend-06, 26-sep-2026)

1. SCRUM-688 está «Finalizada» y sin etiqueta de equipo: no había nadie a quien esperar.
2. Dónde: sección «Revisiones» al pie de la ficha del presupuesto, solo con rótulos YA firmados.
3. Quién/cuándo: la ve quien ve el presupuesto, en todos los estados; «Crear revisión» solo `admin`.

## Qué se construyó

- `quotesDetailView.js`: sección `data-seccion-revisiones` al final de la ficha, con su título
  (`REVISIONES_TEXTOS.titulo`, firmado). Llama a `pintarRevisiones(…, { sinTitulo: true })`. Si el
  rol no es `admin`, se retira el botón «Crear revisión»; si lo es, `cablearCrearRevision` y, al
  crearse, se navega a la revisión NUEVA (`quotes-detail`, id devuelto). La anterior no se toca:
  crear una revisión genera un presupuesto nuevo sobre la vigente (`crearRevisionDeQuote`).
- `quoteRevisiones.js`:
  - **Defecto destapado al enchufarla:** el enlace «Ver» apuntaba a `#/presupuestos/<id>`, un hash
    que el router no atiende (`viewFromHash` parte `#quotes-detail/<id>`). Corregido.
  - Opción aditiva `sinTitulo` para no pintar un segundo «Revisiones» debajo del de la sección.
    Sin la opción, igual que antes.
- Ni un texto nuevo: todo lo visible son los ocho rótulos firmados (3-sep y 16-sep).

## Verificado

- `tests/scrum988-revisiones-en-la-ficha.test.mjs`, sobre la ficha MONTADA en el banco: 5/5 verde;
  **5/5 rojo** con `quotesDetailView.js` y `quoteRevisiones.js` de main. Mutación aislada (solo el
  enlace «Ver» devuelto a `#/presupuestos/`): cae exactamente el test del enlace, 1/5.
- Suelo: 21 ficheros que nombran estas piezas (incl. `scrum655c`, `scrum984`, `scrum628`, `scrum820`)
  → 211/211.
- Pendiente: medir en `yaqu.app` tras el despliegue (sección visible, «Ver» navega, crear como admin).
- Riesgo anotado, no tocado: si el POST falla, la pieza enseña el `message` del servidor tal cual
  (comportamiento firmado de SCRUM-688); no se ha auditado que todos esos mensajes estén en castellano.
