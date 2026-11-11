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
