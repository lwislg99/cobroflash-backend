# SCRUM-1190 · «Presupuesto adicional» sobre un Trabajo: lo que hay del lado SERVIDOR

**Medido contra:** `origin/main` = `d09323e92bf1302dd052d1d90ef46a2e4db928bc` · 2026-10-15T16:21:43Z
Sesión 1 (servidor · importes · dinero). Encargo del orquestador: «haz tu mitad de servidor y dime
qué le queda a la pantalla (S2)», con la orden de comprobar antes la premisa.

## La premisa, contra el repositorio

El ticket (27-sep) dice que `POST /quote/create` acepta `job_id` y que **ningún botón lo manda**.
Eso dejó de ser cierto **en parte** dos días después:

| pieza | estado en `main` | dónde se ve |
|---|---|---|
| `job_id` al crear, con control de TENENCIA (404 `job_not_found`) | construido (SCRUM-195 r3) | `src/modules/quotes/app/routes/quotes.routes.ts:173-186` · `tests/scrum195-pertenencia-por-job.test.mjs` |
| el editor lo MANDA, desde la ficha del Trabajo | construido **sólo para el PRIMER presupuesto** (SCRUM-1274, `9698f56b1`, 29-sep): el hueco «Hacer presupuesto» sale cuando el Trabajo NO tiene presupuesto | `public/dashboard/js/jobDetailView.js:301-307` · `quotesView.js:36-39` y `:5794` · `tests/scrum1274-presupuesto-desde-el-trabajo.test.mjs` |
| aceptar un presupuesto con `jobId` NO crea un segundo Trabajo | construido (SCRUM-195 r1) | `src/modules/jobs/domain/job.service.ts:72-76` |
| aceptar un ADICIONAL **suma** su importe a `Job.totalAceptado` | construido (SCRUM-1370) | `job.service.ts:74` (`escribirTotalAceptado`) · `tests/scrum1370-total-aceptado-es-la-suma.test.mjs` · `tests/scrum1370b-por-la-ruta-y-en-el-informe.test.mjs` («un ADICIONAL aceptado por la ruta se SUMA al original ya aceptado») |
| `Quote.esAdicional` (el ROL: original o adicional) | **la columna existe** (lote único de `docs/MIGRATIONS_PENDING.md:662`, aplicado en staging y producción el 10-ago; en el esquema desde el 12-ago, `schema.prisma:576`) y **NADIE la escribe**: 0 escritores en `src/` | `grep esAdicional src/` → sólo un comentario y la lista de campos que copia una revisión (`revision.ts:283`) |

Tanda de esas cinco piezas, corrida hoy en este árbol: **48 tests · 48 pass · 0 fail · 0 skipped**
(`scrum1370`, `scrum1370b`, `scrum195-pertenencia-por-job`, `scrum195-loop-adicional`, `scrum1274`).

## Conclusión: la mitad de servidor YA ESTÁ, y no se construye nada nuevo

Un presupuesto adicional que llegue con `job_id` sobre un Trabajo que ya tiene uno se engancha a
ese Trabajo, al aceptarlo no fabrica otro, y su importe se suma. Eso es todo lo que el dinero
necesita. **No he añadido un campo de entrada nuevo** (p. ej. `es_adicional` en el cuerpo): sin
nadie que lo mande sería otra pieza «construida y sin consumir», que es justo lo que el censo de
SCRUM-1185 cuenta, y además decidir quién pone el rol es una decisión, no una deducción.

**Lo que le queda, por dueño:**

1. **Pantalla (S2):** un gesto «presupuesto adicional» en la ficha de un Trabajo que **ya tiene**
   presupuesto. El camino existe y se reutiliza tal cual: `renderAppView('quotes-new', { template:
   { deTrabajo: { jobId, customerId } } })`, como hace el hueco de `jobDetailView.js:304-306`.
   Hoy ese hueco sólo sale sin presupuesto, así que con uno ya aceptado no hay por dónde.
2. **Texto del botón:** firma (regla 39). No hay literal propuesto aquí: lo propone quien pinte.
3. **Decisión (jefe), sólo si se quiere enseñar o tratar distinto al adicional:** quién escribe
   `Quote.esAdicional`. El candidato natural es el propio gesto (explícito), nunca deducirlo después
   de `jobId` — desde 1274 un `jobId` con valor ya no significa «adicional». Hasta que se decida, el
   envío con la ventana cerrada sigue siendo un parámetro (`sinPlantilla`) y no una regla.

## De paso (mi carril, arreglado en el momento)

Dos comentarios de `src/` decían cosas que ya no son verdad, en el camino del dinero:

- `quotes.routes.ts:226`: «null = presupuesto normal; con valor = adicional». Falso desde 1274.
- `sendQuote.service.ts:32`: «`Quote.esAdicional` es schema del fundador y está PENDIENTE». La
  columna existe desde el 10-ago.

**Sólo comentarios, demostrado:** el fuente de `origin/main` y el de esta rama, transpilados con
`removeComments`, dan el MISMO JS (`quotes.routes`: 26.180 → 26.180 B; `sendQuote.service`: 4.361 →
4.361 B), y el control positivo —añadir una línea `export`— sí lo cambia en los dos. El `dist` con
comentarios sí crece (53.661 → 53.946 y 7.013 → 7.179 B): `tsc` los conserva, así que comparar el
`dist` a pelo NO prueba nada aquí.

A9: sin fallo que generalice — atribuí la columna a SCRUM-293 por el commit que la metió en el esquema, y era del lote único del 10-ago; lo cacé leyendo `MIGRATIONS_PENDING.md` antes de empujar, que es la regla de siempre (la fuente, no el asunto de un commit).
