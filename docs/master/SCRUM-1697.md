# SCRUM-1697 · PILOTO-1 · Parte: «Visita n de m» en la cabecera

**Medido contra:** `origin/main` = `32cb2f04a1a3fd2763682ab3569ce549245561bb` · 2026-11-11T19:04:59Z (fecha de commit de esa punta, #3088) · **Rama:** `scrum-1697b-visita-en-el-servidor` · **Carril:** S1.

## Apéndice (b) · 11-nov-2026 · S1 · `visitaN`/`visitaM` salen del SERVIDOR, en el GET del parte

A9: comprobación → `tests/scrum1697b-visita-en-el-servidor.test.mjs`

**Por qué.** La pantalla del parte (S4, PR #3085, rama `scrum-1697-visita-n-de-m`) calculaba la visita pidiendo
`GET /admin/jobs/:id` entero desde `parteDetailView`, una lectura del trabajo desde una vista que no es la suya
(guard de SCRUM-366). Además, el técnico que abre el parte no tiene por qué poder leer la ficha del trabajo.
Encargo del orquestador a S1 (cola del 11-nov): que el número lo dé el servidor en el GET del parte.

**La regla es M2 del máster, no una decisión de aquí** (Parte L, SCRUM-1686, `073c67ade`): «Visita {n} de {m}»
cuenta los partes del trabajo por `fecha` y, a igual fecha, por `numero`; `m` = todos los partes del trabajo,
también los borradores. (Mi traspaso decía «por creación»: mandaba el máster.)

### Qué cambia

- `src/modules/jobs/domain/visitaDelParte.ts` (nuevo, puro): ordena por `fecha` y después por `numero` en
  orden **numérico** (`Intl.Collator('es', { numeric: true })`: «PT-2026-9» antes que «PT-2026-10»; por texto
  iría al revés), con `id` de desempate. Devuelve `{ visitaN, visitaM }`. Falla cerrado: un parte que no está
  en la lista → `null`, nunca un número inventado.
- `src/modules/jobs/app/routes/partes.routes.ts` · `GET /admin/partes/:id`: la respuesta de siempre más
  `visitaN` y `visitaM`.
  - Parte con trabajo → los partes del trabajo **del mismo merchant** (`jobId` es columna suelta, sin
    relación; sin el filtro, un parte de otra cuenta con el mismo número de trabajo sumaría).
  - Parte suelto → `null` / `null`.
  - Uno solo en el trabajo → `1` / `1`. **Que no se pinte con uno solo (N4: «con varios») lo decide la
    pantalla**: el servidor dice el hecho.
  - La lectura del recuento lleva **su propia puerta por rol** (`seesOnlyOwnJobs` + `esSuyoElTrabajo`, en
    código). Lo cazó el guard de SCRUM-992 en la primera versión, que se apoyaba en que `findParte` ya lo había
    comprobado; arreglado el código, no el guard (regla 41).
- Sin esquema y sin texto nuevo: el literal N4 (`PARTE_TEXTOS.visitaDeLas`) es de la pantalla y ya está firmado.

### Contrato para la pantalla (S4)

`GET /admin/partes/:id` → `{ …parte, visitaN: number | null, visitaM: number | null }`. Con esto,
`parteVisita.js` no necesita pedir `/admin/jobs/:id`: pinta si `visitaM >= 2`.

### Evidencias

- **Banco desechable** (Postgres 16 portátil, `127.0.0.1:55674`, base `yaqu_1674_test`).
- **Rojo primero:** la regla, `ERR_MODULE_NOT_FOUND`; la ruta, 6 fallos, todos porque los campos no
  venían. Los controles pasaban: el técnico asignado abre el parte (200, ya con #3088 en main).
- **Verde:** el test nuevo (regla + ruta: ① 1/3, 2/3 y 3/3 con el borrador contando, sin que sume el parte
  del otro merchant · ② 1 de 1 · ③ suelto `null` · ④ el técnico asignado recibe su 2 de 3) + vecinos con
  banco: 992, 1674, 1379, 1078, 1671, 652d, 890, 1093g, 1390b, 370*, 366* → **63/63**.
- Declarado en `GATEADOS_DECLARADOS` (SCRUM-419).
- **En yaqu.app:** tras el merge, `GET /admin/partes/:id` de PT-2026-004 y PT-2026-006 (trabajo #77 de la
  cuenta QA, dos partes) con `node scripts/qa/sesion-panel.mjs get`.
# SCRUM-1697 · PARTES · «Visita {n} de {m}» en la cabecera del parte (PILOTO-1)

**Medido contra:** `origin/main` = `ba6fe36b628f4c97dede14d18270ccc84cd4316b` · 2026-11-11T18:16:32Z

**Skill UI:** cargada (`yaqu-premium-ui`), **después** de escribir el cambio y antes de cerrarlo: se
revisó contra AB6 al cargarla. Sin componente, clase, token ni estilo nuevos (un `<span>` dentro del
`h3` del número, que hereda su estilo). Capturas antes/después a 390 abajo.

A9: comprobación → `tests/scrum1697-visita-n-de-m.test.mjs`

## Origen y firma

T4 de la ③ de SCRUM-1686 (D2 firmada, c.21461). **Regla:** M2 del máster, entrada por `073c67ade`
(#3066, GO c.21479): un trabajo, varios partes, uno por visita; «la visita ES su parte». «Visita {n}
de {m}» cuenta los partes del trabajo por `fecha` y, a igual fecha, por `numero`; `m` = todos los
partes del trabajo, también los borradores. **Texto FIRMADO:** N4 de la tanda N1-N13 de SCRUM-1686
(c.21471 según el máster), «Visita {n} de {m}», en la cabecera del parte, con varios en el trabajo.

## Qué cambia

`public/dashboard/js/parteDetailView.js` (carril S4):

- `TEXTOS.visitaDeLas = 'Visita {n} de {m}'` (N4, literal).
- `visitaDelParte(parteId, partes)`: ordena por fecha y número y devuelve `{ n, m }`; `null` con menos
  de dos partes (N4 es «con varios») o si el parte no está en la lista.
- `pintarVisita(contenedor, parte, pedir)`: lee `GET /admin/jobs/:jobId` (trae `partes[]` desde
  SCRUM-1671, también para el técnico: `TECNICO_ALLOWED`, «Detalle de SU trabajo») y pone
  «· Visita n de m» tras el número, en el mismo `h3`. **Falla cerrado:** sin trabajo, sin lista o con
  la lectura caída, la cabecera se queda sin número. No se espera: el parte se puede usar ya.
- El separador «·» es el de la maqueta firmada en SCRUM-1686 («PT-2026-005 · Visita 2 de 3»).

## Comprobación

- Rojo primero: 5/5 en rojo antes del cambio, 5/5 en verde después.
- yaqu.app con la cuenta QA, `parteDetailView.js` servido desde el árbol
  (`evidencias/SCRUM-1697/capturar.mjs`, sólo lectura). Trabajo #77, con dos partes:
  - antes: `PT-2026-006` · `antes-pt006-390.png`
  - después: `PT-2026-006 · Visita 2 de 2` (`despues-pt006-390.png`) y `PT-2026-004 · Visita 1 de 2`
    (`despues-pt004-390.png`). Cabe en una línea a 390.

## Pendiente

- Verlo en yaqu.app tras el merge (regla 42), en los dos partes del trabajo #77.
