# SCRUM-1670 · P0 · El tipo de intervención elegido al crear no se ve en ningún sitio — mitad SERVIDOR

**Medido contra:** `origin/main` = `e5145bc54e9709de09ac362a6d6c4d156bb32ac4` · 2026-11-17T16:58:41Z (fecha de commit de esa punta) · **Rama:** `scrum-1670-tipo-intervencion-viaja` · **Carril:** S1.
A9: comprobación → `tests/scrum1670-tipo-intervencion-viaja.test.mjs`

## La pregunta del encargo: ¿lo GUARDA y no lo devuelve, o lo PIERDE?

**Lo guarda y no lo devuelve.** Tres mediciones, de la más barata a la más cara:

1. **Esquema:** la columna existe — `Job.tipoIntervencion String? @map("tipo_intervencion")` (SCRUM-651). Sin
   esquema nuevo, sin A5/ALTER.
2. **Código:** `POST /admin/jobs` crea con `filaDeTrabajoDirecto` (`src/modules/jobs/domain/trabajoDirecto.ts`),
   que escribe `tipoIntervencion`. Las tres respuestas (POST, la lista `GET /admin/jobs` y la ficha
   `GET /admin/jobs/:id`) salen de `serializeJob`, que **no tenía la clave**. La proyección por rol
   (`trabajoParaElRol`) copia con `...trabajo`, así que no quitaba nada: no le llegaba.
3. **Banco desechable** (Postgres propio en loopback, base `yaqu_1670_test`, esquema por `migrate diff --from-empty`):
   en el rojo, la aserción «la fila GUARDA el tipo» **pasó** y las seis de «la respuesta lo DEVUELVE» fallaron.
   Corrobora lo de producción del 11-nov (`docs/master/SCRUM-1674.md`): el parte abierto desde el trabajo #81,
   creado por POST con `MANTENIMIENTO`, heredó «mantenimiento» leyéndolo de esa fila.

## El arreglo

Una clave en `serializeJob` (`src/modules/jobs/app/routes/jobs.routes.ts`):
`tipoIntervencion: job.tipoIntervencion ?? null`. Aditivo; `null` = no consta, sin valor por defecto. Al ser el
serializador común, llega a las tres respuestas a la vez. La proyección por rol queda intacta: el tipo no es
dinero ni nota interna, así que el operario lo ve (es lo que hereda su parte, SCRUM-1674).

Sin textos (regla 39): no se añade ningún rótulo; la pantalla es de S4.

## La otra mitad del síntoma — MI LECTURA, para S4

«Tipo de trabajo: Una obra o reforma de varios días» en la ficha del #84 **no es el tipo de intervención**: es el
rótulo de `tipoOperacion = 'TRABAJO_UNICO'` (la bandera fiscal de SCRUM-66, valor por defecto de todo trabajo) en
`public/dashboard/js/jobDetailView.js:1431`. Por eso «enseña otro tipo»: son dos campos distintos con un nombre
parecido. Pintar `tipoIntervencion` en la ficha y en la tarjeta, y decidir cómo convive con ese rótulo, es de S4
(y el rótulo, texto: regla 39).

## Pruebas

- **Rojo primero** (sin el arreglo, banco desechable): 6 fallos, todos por el motivo esperado — ① POST y ficha sin
  el tipo · ② POST y ficha sin `null` (clave ausente) · ③ lista sin el tipo y sin `null`. La fila guardaba el tipo.
- **Verde:** el nuevo + 1674, 651, 816 → 37/37 ✔ con `LIBRO_PG_URL` al banco desechable.
- Control ② sin tipo → `null` en fila y respuestas; control ④ un valor fuera del vocabulario → 400 (SCRUM-651).
- Proyección por rol: test sin banco — el técnico ve el tipo y sigue sin ver notas ni dinero.
- **En yaqu.app:** pendiente del merge (crear un trabajo con tipo en la cuenta QA y leer `tipoIntervencion` en la
  respuesta del POST y en `GET /admin/jobs/:id`).
