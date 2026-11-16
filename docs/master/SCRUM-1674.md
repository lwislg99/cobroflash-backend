# SCRUM-1674 · PILOTO-1 · El parte abierto desde un trabajo nace con la obra y el tipo del trabajo

**Medido contra:** `origin/main` = `76b285e6fd62b6f88d686352783a3ea8ea938576` · 2026-11-11T17:08:19Z (fecha de commit de esa punta) · **Rama:** `scrum-1674-parte-hereda-obra-y-tipo` · **Carril:** S1.

A9: comprobación → `tests/scrum1674-parte-hereda-obra-y-tipo.test.mjs`

## Origen y decisión

El parte que se abre desde un Trabajo nacía vacío: el técnico volvía a teclear la dirección de la obra y a
marcar el tipo de intervención, dos datos que el jefe ya había escrito en el Trabajo.

**Decisión del orquestador** (encargo a S1 del 11-nov-2026, bajo la delegación del fundador; texto literal:
«SÍ a copiar job.direccion → parte.obra y el TIPO de intervención al CREAR el parte, sin esquema»). Fundamento,
tal y como lo dio:

1. **DOC-12 literal** (`docs/master/SCRUM-602.md`, «El suelo, adoptado literal») veta DOS cosas: prerrellenar
   desde la dirección de FACTURACIÓN, y rellenar lo vacío (la sugerencia va sólo como placeholder). Esta copia
   no toca ninguna: la fuente es `Job.direccion`, la dirección de OBRA que tecleó el jefe; y si está vacía, el
   parte queda vacío.
2. **El albarán ya hereda exactamente igual** (`albaran.service.ts:558-570`, `jobDireccion` → `obra`),
   construido y en producción. Esto es consistencia, no política nueva.
3. La frase «la dirección de la obra nunca se prerrellena sola» de `SCRUM-1702.md` era paráfrasis del
   orquestador, más ancha que el registro: el registro manda. Se acota en el apéndice de `SCRUM-1702.md`.

**Fuera de este ticket:** «lo que hay que hacer» (el tercer elemento del título) depende de SCRUM-1662, aparcado
(c.21505: necesita columna nueva = decisión + A5). Por eso 1674 **no se cierra** con esta rama.

## Qué cambia

- `src/modules/jobs/app/routes/partes.routes.ts` · `POST /admin/partes`: con `jobId`, el parte nace con
  `obra = Job.direccion` (recortada; en blanco → `null`) y `tipo` = el `tipoIntervencion` del trabajo. Si el
  cuerpo trae `tipo`, manda el elegido. Se copia UNA vez, como los técnicos (SCRUM-818); después son campos
  del parte.
- `src/modules/jobs/domain/tipoParteDelTrabajo.ts` (nuevo): el Trabajo guarda el vocabulario en MAYÚSCULAS
  (`TIPOS_INTERVENCION`) y el parte en minúsculas (`TIPOS_PARTE`). Tabla `Record` explícita, no
  `toLowerCase()`: un valor fuera del vocabulario cae a `null`. Vive aparte porque `parteTrabajo.ts` es el
  sellador y no importa nada (guard de SCRUM-652, que lo cazó en la primera versión: arreglado el código).
- Sin esquema: `ParteTrabajo.obra`, `ParteTrabajo.tipo`, `Job.direccion` y `Job.tipoIntervencion` ya existen.

## Evidencias

- **Banco desechable propio** (Postgres 16 portátil, `127.0.0.1:55674`, base `yaqu_1674_test`, esquema por
  `prisma migrate diff --from-empty` con el CLI local: 33/33 tablas).
- **Rojo primero:** 7 fallos, todos por el motivo esperado (① obra no copiada ×2 y tipo no copiado · ③ tipo
  no copiado · ④ obra no copiada y tipo no copiado · ⑥ obra ausente al releer). ② (trabajo sin obra) y ⑤
  (parte suelto) ya pasaban: nacían vacíos.
- **Verde:** el test nuevo + 992, 652, 1093g, 818, 685b, 890 → 43/43 ✔. Los seis casos: ① con obra y tipo →
  los trae · ② sin nada → vacío · ③ obra de espacios → vacía, el tipo viaja · ④ el tipo elegido manda ·
  ⑤ parte suelto → vacío · ⑥ el parte guarda su copia (se relee por la ruta). En los casos ①②③⑤, la dirección
  de facturación y el sitio guardado del cliente NO aparecen en la respuesta ni en la fila (DOC-12).
- Declarado en `GATEADOS_DECLARADOS` (SCRUM-419): corre en el CI con banco.
- **En yaqu.app:** pendiente del merge (abrir un parte desde un trabajo con dirección y tipo, cuenta QA, y
  uno sin dirección).

## Apéndice · 11-nov-2026 · VERIFICADO en yaqu.app (regla 42)

- En main por **#3081** (`4d8043854`). Cuenta QA (merchant 46, QA en producción autorizado). Banco:
  `docs/master/evidencias/SCRUM-1674/prod/verificar.mjs` (escribe sólo en la cuenta QA, a 390).
- Se crean dos trabajos de prueba del cliente 86, que **sí tiene dirección de facturación**
  (`Calle Mayor 14, 3º B`): es el cebo de DOC-12. Los dos partes se abren con el botón real de la ficha del
  trabajo (`[data-abrir-parte]`), no con un POST a mano.
  - **A · trabajo #81** `[QA-1674] con obra y tipo`, dirección `"  Calle Obra QA 1674, 5º A  "` y tipo
    `MANTENIMIENTO` → **PT-2026-007 (id 15)**, borrador: `obra = "Calle Obra QA 1674, 5º A"` (recortada) y
    `tipo = "mantenimiento"`. La pantalla del parte enseña «Obra y referencia · Calle Obra QA 1674, 5º A» y
    «Tipo de intervención · Mantenimiento». Captura `parte-a-con-obra-y-tipo-390.png`.
  - **B · trabajo #82** `[QA-1674] sin obra ni tipo` → **PT-2026-008 (id 16)**, borrador: `obra = null`,
    `tipo = null`; en pantalla, los dos rótulos sin valor. Captura `parte-b-vacio-390.png`.
  - En ninguna de las dos respuestas aparece la dirección de facturación del cliente: **lo vacío se queda
    vacío y facturación no entra** (DOC-12).
- La aceptación de esta rama (obra y tipo) se cumple. El ticket **sigue sin cerrarse** por lo que ya decía el
  registro: «lo que hay que hacer» depende de SCRUM-1662.

### Medido de paso en el mismo recorrido (no es de esta rama)

- **SCRUM-1662 sigue pasando.** La descripción del trabajo A («QA SCRUM-1662: cambiar el termo…») no aparece
  en la ficha a la vista: está en el `textarea#job-notas-internas`, dentro de la línea plegada «Notas
  internas · Solo tú las ves» (`notas1662.mjs`, sólo lectura; capturas `ficha-trabajo-a-390.png` y
  `ficha-a-notas-internas-390.png`). El lado del operario **no se ha medido en pantalla** (`test-login` sólo
  abre cuentas de merchant); por el código, `GET /admin/jobs/:id` devuelve `notes` y `jobDetailView.js`
  pinta la MISMA línea con el mismo «Solo tú las ves» también para el técnico.
- **SCRUM-1670 sigue pasando.** En la ficha del trabajo A, «Tipo de trabajo» dice «Una obra o reforma de
  varios días» (el `tipoOperacion`), y el «Mantenimiento» elegido sólo se ve en el parte.
