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
