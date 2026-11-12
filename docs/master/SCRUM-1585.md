# SCRUM-1585 · M de SCRUM-1102: el modo de emisión mira el SII en cada emisión

**Medido contra:** `origin/main` = `f1c0ff3094c004ea7b99ffe2f1d13a21213c5ad1` · 2026-10-23T14:40:59Z (cabecera `Date:` de GitHub; la rama salió de `9a9518c2e` y lleva `main` mergeado)

A9: aviso → cicatriz J1 «Para arreglar tres tests edité `tests/_banco-emision-con-estado.mjs` sin pasar antes `carriles.mjs de`: es de S3, del otro equipo; lo vi por el aviso del carril y lo deshice, y el dato lo pone cada test al reiniciar» — no se pudo comprobar: la cerradura de carril avisa y no para (SCRUM-1506), y los hooks no son de este puesto

Sesión `jv-j1ar` (puesto J1), 23-oct-2026, por encargo del orquestador `cobroflash-backend-62`.
**GO de regla 40 del fundador en SCRUM-1585 c.20531**: D0 «Sí, ahora» (la comprobación en el camino de
emisión, sin sellado ni XML); D1 el texto que ve el profesional NO se construye hasta la firma, y el
servidor puede ir antes con su código de error; D2 el dato del SII OBLIGATORIO en cada consulta que
alimente la emisión; D4 la foral fuera hasta el asesor (SCRUM-1264). Diseño: J6f, anexo 1102g §⑤-§⑦
de `SCRUM-1102.md`.

## 🔴 Estado: construido en local, NO empujado

Con el campo obligatorio, `tsc` deja **6 llamadas de ficheros de S1** (equipo de Luis) sin compilar:
`albaranes.routes.ts` ×3, `jobs.routes.ts` ×1 y `app.ts` ×2 (el `select` de `merchantParaModo`), más la
landing (`quoteDecisionLanding.routes.ts`), que llama con `as any` y que el compilador no caza. Van en
**SCRUM-1594** (`equipo-luis`, `area-s1`), que bloquea a éste. Decisión del orquestador (opción 1 de
SCRUM-1585 c.20534): éste se empuja **después**; si entrara antes, el obligatorio cae en `tsc`.

## ① Qué entra

- `emission.service.ts` · `MerchantLike.llevaLibrosPorSii: boolean | null`, **obligatorio**.
  `isDemoMerchant` pasa a pedir sólo `MerchantIdentidad` (id, email): sus llamadores no necesitan el SII.
- `motivoSiiSinEmision(m)` · `sii_declarado` («Sí») o `sii_no_consta` (NULL, o la columna ausente) para
  un español no demo con `INVOICING_ES_ENABLED` encendido; `null` en el resto. `=== false`, no `!== true`
  (1102g §⑦.1). Los dos códigos son los de W (SCRUM-1102h): un hecho, un nombre. La rama del demo va
  antes (el demo tiene la columna en «No consta»). Sin rama de país: el flag tiene ámbito de país y
  fuera de España ya sale apagado (la mutación que la quitaba salió muda, y por eso se quitó).
- `getEmissionMode` · con el flag encendido, `fiscal` sólo si `motivoSiiSinEmision` es `null`; si no,
  `receipt`. Todo lo que cuelga del modo se comporta como con el flag apagado (regla 24).
- `allocateInvoiceNumber` (`invoiceNumber.service.ts`) · la columna en su `select`, y el rechazo del
  modo `receipt` lleva `motivoSiiSinEmision(m) ?? 'invoicing_es_disabled'`. **Candado movido por GO
  c.20531**: el hash de `tests/scrum291-series-huecos.test.mjs` se actualiza con su entrada, como en
  SCRUM-735, 1216b y 825. Rojo visto con el hash viejo («esperado 4ff5… leído 0651…») y verde con el nuevo.
- `select` con la columna, sin otro cambio: `invoicesAdmin.routes.ts` (J1), `lifecycle.service.ts` ×3 y
  `weeklyDigest.service.ts` (J3, cruce declarado en el commit), `whatsappIncoming.routes.ts` (J2, ídem).

## ② Qué NO entra

- Ninguna pantalla ni texto que vea el profesional. La propuesta D1 (A y B) está en SCRUM-1585 c.20534;
  la lleva el orquestador al fundador.
- Las rutas no distinguen todavía el motivo: devuelven el error que ya daban en `receipt`. El código
  propio sale del embudo y de `motivoSiiSinEmision`, que es lo que la pantalla firmada leerá.
- La foral (D4). El camino E de 1102g §④ (país desde Configuración). Las dos lecturas directas del flag
  en `exports.routes.ts` (contenedor S1), que siguen sin mirar el SII (1102g §⑤).
- D3 (lo ya facturado por quien entra en el SII encendido): pregunta del asesor, SCRUM-1264.

## ③ Cómo se midió

- `tests/scrum1585-sii-en-cada-emision.test.mjs`: 15 casos, 15 pasan.
- Mutaciones sobre `dist/` (la del tipo, sobre `src/` con copia y restaurada; diff comprobado): 6, las 6
  cazadas, y en cada pasada caen + pasan = 15. M1 (el modo de `main`) es el rojo primero: 5 caídas.
- `tsc --noEmit`: base 17 errores (cliente de Prisma compartido: `activityKind`, `archivedAt`); con el
  cambio quedan esos 17 + los 6 de S1, y ninguno más.
- 99 ficheros que nombran el modo o el flag, uno a uno en la rama y sobre un árbol de `main`: 22 que en
  `main` pasan caían aquí (61 casos, y suman los 61 del lote). Su doble de merchant con el flag encendido
  no traía la columna. Contrato nuevo: `llevaLibrosPorSii: false` (las aserciones no cambian), y los tres
  que usan el banco de S3 lo ponen al reiniciar. Re-medido: 24 ficheros, 217 pasan, 0 caen.

## ④ Mis errores

- Edité el banco de S3 sin mirar su carril (la línea A9 de arriba). Deshecho antes del commit.
- Mi primera versión de `motivoSiiSinEmision` llevaba una rama de país que nada podía cazar: guarda
  redundante con el ámbito del flag. La quitó la mutación muda, no yo.

## ⑤ Sin medir

Ninguna base. La tanda completa. El CI (no hay empujón). Lo que haga S1 en SCRUM-1594.

## SCRUM-1585b · retomada: STOP por el guard de versión del SIF

**Medido contra:** `origin/main` = `06ad4f1bd53d25b701cd11ae42791db753329ceb` · 2026-10-30T17:18:36Z

A9: comprobación → `tests/scrum523d-version-del-sif.test.mjs`

Sesión `jv-j1dl` (puesto J1). Medición y decisión pendiente en Jira, SCRUM-1585 c.21284. No hay empujón.

- SCRUM-1594 está en `main` (`1c2acd5b0`, #2983). Merge de `main` hecho (934 commits). `tsc -p .`: salida 0.
- 🔴 `scrum523d` entró en `main` el 26-oct, después del GO c.20531, y cae con M: nombra
  `emission.service.ts` e `invoiceNumber.service.ts`. Pide subir `VERIFACTU_VERSION` con declaración
  firmada (V2 de SCRUM-523 c.20878) o que el fundador decida otra cosa para M. El GO de M no lo cubre.
- Dirigida: 146 ficheros de 1.571, 1.255 casos, 1.220 pasan, 2 caen, 33 saltados. El otro rojo es
  `scrum719` (veredicto de mudez caducado por dos tests de esta rama).
- Falta tras la decisión: huellas o versión, `censo:mudez`, las mutaciones en el catálogo
  (`MUTACIONES_QUE_ME_TUMBAN` + `aplicarUna`), re-anclar y un empujón.
- Sin medir: ninguna base, el CI y la suite entera local.

## SCRUM-1585c · la opción B, construida: M entra en la 1.0.0

**Medido contra:** `origin/main` = `3527028a3388de64c5e2429cb0d19d665e768473` · 2026-10-30T17:34:43Z

A9: aviso → cicatriz J1 «Edité 12 tests ajenos antes de leer entero `carriles.mjs de`, que había cortado con `cut`: uno era de S1 y los otros 11 no tenían dueño escrito, y su veredicto remitía a una etiqueta de Jira que no miré» — no se pudo comprobar: la cerradura de carril avisa y no para (SCRUM-1506), y los hooks no son de este puesto

Sesión `jv-j1dl` (puesto J1), con la decisión del fundador en SCRUM-1585 c.21290 (opción B).

- `scrum523d`: el guard no cambia. Se recongelan `emission.service.ts` e `invoiceNumber.service.ts` con lo
  que imprime, y el comentario de la lista cita c.21290. Ningún otro fichero del camino se mueve.
- `motivoSiiSinEmision` y los dos códigos: `ERROR_SII_*` pierden el `export` porque `scrum411` los da por
  huérfanos. El caso «los códigos de M son los de W» compara ahora la salida de M: con literales, su
  mutación salió muda, y fue el catálogo quien lo cazó.
- `MUTACIONES_QUE_ME_TUMBAN`: 10 en el test, 10 vivas con `aplicarUna`, sobre la última versión del código.
  La primera es el rojo primero: el modo de antes de M.
- `censo:mudez -- --escribir`: 125 fichas, 2 medidas ahora, 2 VIVO.
- Tests con el flag encendido y el SII sin contestar: 38 de 1.730 ficheros `.mjs` encienden el flag por
  literal; 22 ya llevan la columna y 16 no. De esos 16, 12 crean un merchant real en una base, con NULL: M
  los dejaría en `sii_no_consta`. A 11 se les pone `llevaLibrosPorSii: false`, el contrato de 1585. Sus
  tickets no llevan etiqueta de área: no consta el dueño, y el cruce va declarado en el commit.
- 🔴 `tests/scrum974-firmado-sin-facturar-en-el-lunes.test.mjs` es de S1 (SCRUM-974: `area-s1`). Corre en
  el job `test` de CI con `LIBRO_PG_URL`, y sin esa línea caería al entrar M (leído en el código, no corrido).
- Dirigida: 525 ficheros de 1.572, 4.902 casos, 4.863 pasan, 7 caen, 32 sin contar. Tres ficheros eran de
  esta rama (`scrum411`, `scrum1415`, `scrum189`) y ya pasan; `scrum1298b` y `scrum351` no los toca y
  siguen en rojo aquí: sin mirar en `main`.
- Sin medir: ninguna base; esos 12 tests NO se han corrido en local; la suite entera local; el CI.

## SCRUM-1585d · al día con main, la excepción de scrum974 declarada, un empujón

**Medido contra:** `origin/main` = `c8e590cb0dff46a8d5a58da13426ed7739d3771b` · 2026-11-10T17:30:02Z (cabecera `Date:` de GitHub)

A9: aviso → cicatriz J1 «Imprimí `EXIT=$?` detrás de `git merge … | tail`, y salió 0 con el merge en conflicto: era el código del `tail`; lo vi por el texto CONFLICT, no por el código» — no se pudo comprobar: lo impediría un hook sobre la orden, y los hooks no son de este puesto

Sesión `jv-j1dl` (puesto J1), relevo del 10-nov, con la excepción de carril firmada por el fundador en
SCRUM-1585 c.21397.

- Dos merges de `main` (`5986d520a` y `c8e590cb0`), sin rebase ni force. Único conflicto:
  `docs/equipo/cicatrices/J1.md`, resuelto sin perder líneas (33 = 29 comunes + 2 de la rama + 2 de main;
  0 marcadores; cada línea de las dos puntas está en el resultado).
- Lo que entró desde el 30-oct y toca esta zona: `facturaSuelta.ts` (SCRUM-1051d, no llama al modo) y
  `scrum113` (SCRUM-1644). Ni `emission.service.ts`, ni `invoiceNumber.service.ts`, ni `productor.ts`, ni
  `scrum523d`, ni `scrum974`. Las dos huellas de c.21290 siguen cuadrando: no se recongela nada.
- Excepción de c.21397: fila nueva en `docs/equipo/dos-equipos.md` §3.4 (ruta, J1, motivo, SCRUM-1585) y
  `.claude/carriles.json` regenerado. La línea 60 de `scrum974` ya iba en la rama desde 1585c; es lo único
  que la rama cambia de ese fichero.
- Build con tipos (`tsc -p .`): salida 0. Cliente de Prisma: coincide con el esquema.
- Dirigida (`tests-que-cubren --lanzar`, 4 tramos sobre `5986d520a` + la rama): 530 de 1.581 ficheros,
  4.931 casos, 4.896 pasan, 3 caen. Los 3 son `scrum1298b` (2) y `scrum351` (1), y caen igual en un árbol
  limpio de `origin/main` @ `5986d520a` en esta máquina (15 casos, 12 pasan, 3 caen): no son de la rama.
- Sueltos sobre el segundo merge, con este tramo ya commiteado: `scrum237`, `scrum976`, `scrum1387`,
  `scrum1295`, `scrum267`, `scrum273`, `scrum1294`, `scrum1572`, `scrum719`, `scrum622`, `scrum113`,
  `scrum523d`, `scrum974`, `scrum1585`, `scrum921c`, `scrum811c` y `scrum1659`: 17 ficheros, 196 casos,
  195 pasan, 0 caen, 1 saltado (`scrum974`, sin `LIBRO_PG_URL`).
- Sin medir: ninguna base; `scrum974` y los 11 de 1585c NO se han corrido en local (piden el banco de CI);
  la suite entera local: NO CORRIDA; el CI, hasta leer el obligatorio de este empujón.

