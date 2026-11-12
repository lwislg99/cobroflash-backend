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

## Apéndice (b) · 11-nov-2026 · S1 · `visitaN`/`visitaM` salen del SERVIDOR, en el GET del parte

**Medido contra:** `origin/main` = `acac25dbac0dbb870f6dbda9f240df3664326c2d` · 2026-11-12T08:03:59Z (fecha de commit de esa punta, #3069) · **Rama:** `scrum-1697b-visita-en-el-servidor` · **Carril:** S1.

> **Juntado a mano el 12-nov (S1).** Las dos ramas crearon este registro (S4 en #3085, S1 en #3094) y la
> unión de git (`merge=union`) los pegó en el merge del bot `f3ef2b22f`, el de S1 delante y sin separación;
> lo cazó `tests/scrum1572-registro-creado-por-dos-ramas.test.mjs`. Aquí van los dos enteros, sin quitar
> una línea de ninguno: primero el de S4, que entró antes en `main`; después este apéndice. El ancla de
> este apéndice se re-midió contra la punta de `main` traída a la rama (antes: `32cb2f04a`, donde se
> midió el 63/63 con banco); contra esta punta, el «build + tests (con banco desechable)» del CI.

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

## Apéndice (c) · 12-nov-2026 · S4 · la pantalla lee la visita del parte y deja de pedir el trabajo

**Medido contra:** `origin/main` = `6cf6a8176b985a1e5f9b39c5a74319665dec91f0` · 2026-11-12T08:22:13Z (fecha de commit de esa punta, el merge de #3094) · **Rama:** `scrum-1697c-pantalla-lee-visita-del-parte` · **Carril:** S4.

A9: comprobación → `tests/scrum1697-visita-n-de-m.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, 12-nov). No cambia nada que se vea: la cabecera dice lo mismo, con el mismo texto firmado (N4) y en el mismo hueco `[data-parte-visita]`.

**Por qué.** Lo pide el contrato del apéndice (b): con `visitaN`/`visitaM` en `GET /admin/partes/:id`, `parteVisita.js` ya no necesita `GET /admin/jobs/:id`. Encargo del orquestador del 12-nov: «cuando #3094 entre, parteVisita.js pasa a leer parte.visitaN/visitaM y deja de pedir /admin/jobs/:id».

### Qué cambia
- `public/dashboard/js/parteVisita.js`: deja de contar en el cliente y de pedir el trabajo. `visitaDelParte(parte)` comprueba lo que manda el servidor y `pintarVisita(contenedor, parte)` lo pinta. Lo único que decide la pantalla es lo que el apéndice (b) le deja: con uno solo no se dice nada (N4 es «con varios»), porque el servidor dice el hecho, 1 de 1. Falla cerrado: sin los dos números, con uno que no sea un entero positivo o con n > m, la cabecera se queda sin número.
- `public/dashboard/js/parteDetailView.js`: la llamada ya no pasa `pedir`, y el comentario dice de dónde sale el dato.
- `tests/scrum1697-visita-n-de-m.test.mjs`: el orden por fecha y número se iba del cliente, así que sus casos salen de aquí; ese orden lo fija ahora `scrum1697b-visita-en-el-servidor.test.mjs`. Quedan ① se pinta «· Visita 3 de 4» y **no se pide nada**, ② 1 de 1 no se dice y 1 de 2 sí, ③ siete entradas basura sin número y sin peticiones.

### Comprobación
- **Rojo primero** con el `parteVisita.js` de la (b), es decir el de antes: 3 de 4 en rojo. ① pidió `/admin/jobs/77`, ② no pintó «1 de 2» y ③ hizo peticiones. Queda en verde el del texto literal, que no cambia.
- **Verde:** 4/4.
- **Vecinos:** los 60 ficheros que nombran `parteDetailView`/`parteVisita`/SCRUM-366, más `scrum1697b`, sobre `6cf6a8176`: **510 tests, 0 fallos y 1 salto**. El salto es el ② de 1697b, gateado por `QA_DB_TEST`/`LIBRO_PG_URL`.
- **Dato de la máquina, no atribuido:** antes de traer main, `scrum1266b` («corregir y quitar OTRA línea con ×») salió en rojo 1 vez en la tanda de vecinos y 1-2 de 3 a mano, mientras la máquina corría otras cosas. El test enfrenta un `setTimeout` de 15 ms con un `dormir(80)`. Con la máquina en calma, **8/8 en verde sin mi cambio y 8/8 con él**. Se deja escrito por si vuelve a salir en el CI.
- **Pendiente:** verlo en yaqu.app tras el merge, en PT-2026-004 y PT-2026-006 del trabajo #77 (dos partes → «Visita 1 de 2» y «Visita 2 de 2»), comprobando además que la ficha del parte ya no pide `/admin/jobs/77`.