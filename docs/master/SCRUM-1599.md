# SCRUM-1599 · cuatro tests gateados en ROJO contra la base de pruebas, y nadie lo ve

## J6 · SCRUM-1599a · los cuatro, clasificados: los cuatro son (a), test desfasado

**Medido contra:** `origin/main` = `a08813ddf313a8475722bb62e9b1b08039c60ebe` · 2026-10-23T20:09:22Z (hora de GitHub al soltar el último turno; sesión J6 `jv-j6ax` en el árbol `jv-j6ar`, por encargo del orquestador `cobroflash-backend-62`. Al escribir, `main` ya era `b6dd5d1a8d64abd0bf835141e8d9bac6d5d2055f`: 49 ficheros cambiados, 0 en `src/` y 0 en los cuatro tests o en sus ayudantes)

A9: aviso → cicatriz J6 «Busqué en `dist/` el texto TypeScript de una llamada importada y dio 0 en los dos commits del bisect, cuando el compilado la escribe `(0, mod.fn)(…)`: un cero así se lee como que el gate no está» — no se pudo comprobar: lo cazó un segundo marcador que sí daba 2 en el commit y 0 en el padre; ningún instrumento de la casa avisa de que un patrón de `src/` no casa en `dist/`

Sólo se MIDE: ningún cambio en `src/` ni en una aserción. Base `yaqu_dev_javier` (`DATABASE_URL_TESTS`, la del
carril; ninguna de producción), con el turno tomado de 20:00:14Z a ~20:06:30Z y de ~20:07Z a 20:09:22Z, y el entorno
del hijo QA (`QA_DB_TEST=1`, `WHATSAPP_DRY_RUN=1`). Cada commit, en un worktree desechable con `dist/` de
`tsc --noCheck` (≈ 28 s) y **el fichero de test de SU commit**. Canario: 17 s por pasada, 0 `# SKIP`.

### ① La tabla

| test | qué afirma (fichero:línea) | qué contesta hoy | cae desde | padre → commit | sonda: UNA variable | veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| `scrum178-emision-manual` | `tests/scrum178-emision-manual.test.mjs:93`: `POST /admin/quotes/:id/invoice-manual` emite (201) para un merchant ES con NIF **sin** `INVOICING_ES_ENABLED` | 409 `facturacion_no_disponible` (gate de `quotesAdmin.routes.ts:582`) | `b8e3f81a6` SCRUM-1027 (22-sep, «flag OFF deja de generar CUALQUIER documento») | `e8f636bf9`: 2/2 ok, documento `J-20261023-SN2V (JUST)` → `b8e3f81a6`: 1/2, el 409 | `flags: { INVOICING_ES_ENABLED: true }` en el merchant → 2/2 ok, `F260001 (F1)`, VeriFactu true | **(a)** |
| `scrum814-carrera-del-tramo.gated` | `:179`, `:239`, `:300`: dos tramos emitidos (201) para un merchant ES **sin** el flag | 409 `facturacion_no_disponible` en las cinco peticiones (`quotesAdmin.routes.ts:259`) | `b8e3f81a6` SCRUM-1027 | `e8f636bf9`: 3/3 ok → `b8e3f81a6`: 0/3, el 409 | el mismo flag en los tres merchants → 3/3 ok | **(a)** |
| `scrum85-pay-routes-token` | `tests/scrum85-pay-routes-token.test.mjs:66`: la página `/pay/invoice/:token` lleva el enlace `/pay/card/<token>`, para un merchant **sin** Stripe Connect | sin enlace de tarjeta: `hasCard = cardChargeMode(m) !== 'refuse'` (`payInvoice.routes.ts:74`) | `6491b4288` SCRUM-893 (17-sep, «la página ofrece sólo lo que ese merchant puede cobrar hoy») | `2546280154`: 1/1 ok → `6491b4288`: 0/1, la misma aserción | `PAYMENTS_CONNECT_ENABLED` + `connectStatus: 'active'` + `stripeAccountId` en el merchant A → 1/1 ok (`/pay/card` da 501: no hay clave de Stripe en el árbol; no se llamó a Stripe) | **(a)** — reglas 18/23, **no** la 24 |
| `scrum17-recapitulativa` | `tests/scrum17-recapitulativa.test.mjs:176`: el número de la factura consolidada casa `/^\d{4}-/`, con el merchant **con** el flag ON | `'F260001'` | `ba1cd2d55` SCRUM-780 (7-sep, «el formato F260001 en la factura — por CORTE de fecha») | `9c989bf0e`: 12/12 ok → `ba1cd2d55`: 11/12, la misma aserción con `actual: 'F260001'` | la regex a `/^F\d{6}$/` → 12/12 ok (el resto del caso, IVA mixto, anti-doble, tenancy, verde) | **(a)** — formato de serie, **no** la regla 24 |

Recuento por fichero: los que pasan más los que caen suman el total declarado en las 16 pasadas (p. ej. hoy: 1+1=2,
0+3=3, 0+1=1, 11+1=12), y `# skipped 0` en todas. Detalle: `evidencias/SCRUM-1599/bisect-1599a.salida.txt` (padre,
commit y `main`) y `evidencias/SCRUM-1599/sonda-1599a.salida.txt` (las cinco líneas cambiadas y su resultado).

### ② Qué separa (a) de (b), y no por parecido

- **Bisect:** cada uno pasa en el padre y cae en el commit con el MISMO error que hoy. Los cuatro commits son cambios
  de producto DELIBERADOS, con su motivo escrito: SCRUM-1027 cita la regla 24 (enmienda SCRUM-612c) y un GO de
  Javier; SCRUM-893 arregla un bucle de cobro (tarjeta ofrecida a quien da 409); SCRUM-780 cita la firma del
  fundador del formato `F<AA><NNNN>` (`invoiceNumber.service.ts:197`; esa firma la leo en el código, no en Jira).
- **Sonda de una variable:** con el test de `main` intacto salvo la variable sospechosa, los cuatro pasan ENTEROS.
  Si el producto estuviera roto por otro sitio, la sonda seguiría en rojo. Control negativo: los mismos ficheros sin
  la variable, en el mismo `dist/`, caen (columna «hoy»).
- **Un hermano ya adaptado:** el propio commit de SCRUM-1027 tocó `tests/scrum814-carrera-de-tramos-postgres.test.mjs`
  y le puso `FISCAL_ON` (`:100`, `:157`). El gemelo `.gated` y `scrum178` se quedaron fuera: sólo corren con
  `QA_DB_TEST` y su CI los salta.
- **Una rama muerta en `scrum178`:** su rama `isReceiptNumber` (`:110`) espera un justificante `J-…`, y desde
  SCRUM-1027 no se genera ninguno (`invoiceNumber.service.ts:75`, «Ya NO se generan»).

**Corrección a la clasificación provisional del ticket:** `scrum85` y `scrum17` **no** son la regla 24. El primero es
la regla 18/23 (tarjeta sólo con Connect); el segundo, el formato de serie de SCRUM-780 con la facturación ENCENDIDA.

### ③ Lo que NO se ha hecho, ni medido

- Ningún arreglo: decidir qué test se adapta y cómo es del fundador (abajo) y del carril dueño (J1 para 178, 814 y
  17; J2 para 85). La sonda NO es una propuesta de diff: es un instrumento.
- El aviso de «test gateado N días en rojo» (③ del ticket) no se ha tocado.
- No se ha bisecado con `git bisect` paso a paso: el candidato salió de `git log -S` sobre el gate, y se confirmó con
  la pareja padre/commit. Que no haya OTRO commit intermedio que también lo tumbe no está medido; lo que sí está
  medido es que el padre pasa y el commit cae.
- 1 pasada por punto, no 3: los cuatro rojos de hoy son los mismos tres veces en 1218f.
- La sonda de `scrum178` con el flag ON selló una factura (`F260001`, VeriFactu true) en la base del carril; el
  fixture borra el merchant al acabar, como en cada pasada de este test.
- De paso, confieso dos tropiezos: el grep del texto TypeScript en `dist/` (la línea A9) y un `sed` sobre la regex de
  `scrum17` que no se aplicó y no dio error; lo cazó `git diff --stat` (3 ficheros, no 4) y se hizo con el editor.

### ④ Las preguntas para el fundador (una por test (a))

1. **`scrum178`:** con la facturación ES apagada, `invoice-manual` da 409 por diseño (SCRUM-1027). ¿Se le pone al
   merchant del test `INVOICING_ES_ENABLED` ON, como ya se hizo con su hermano `scrum814-…-postgres`, y se quita la
   rama del justificante, que ya no puede darse? ¿O quieres además un caso que afirme el 409 con el flag OFF?
2. **`scrum814-carrera-del-tramo.gated`:** la misma pregunta: ¿flag ON en sus tres merchants (`FISCAL_ON`, como el
   gemelo), sin tocar ninguna aserción?
3. **`scrum85`:** sin Connect, la página de pago ya no ofrece tarjeta (SCRUM-893, reglas 18/23). ¿Se le da Connect
   activo al merchant A del test para que siga probando el IDOR de `/pay/card`, o la parte de `/pay/card` se separa
   en un caso propio con un merchant con Connect?
4. **`scrum17`:** ¿la factura consolidada usa el mismo formato `F<AA><NNNN>` que firmaste en SCRUM-780? Si es que sí,
   la aserción pasa de `/^\d{4}-/` a `/^F\d{6}$/`, que es MÁS estricta, no más laxa.

## J2 · SCRUM-1599c · scrum85 con Connect activo en el merchant A, como decidió el fundador

**Medido contra:** `origin/main` = `2c45bf589aeae007eb12ed388b3e0f4d2d8d98ed` · 2026-10-23T20:59:34Z (hora de GitHub al acabar las pasadas; sesión J2 `jv-j2ay` en su propio árbol `jv-j2ay`, por encargo del orquestador `cobroflash-backend-62`)

A9: comprobación → `.claude/hooks/guard-dangerous.sh`

(El fallo: para la mutación y para restaurar el fichero intenté primero truncar un test con `>` y después un
`git checkout --` sobre un cambio sin commitear; el hook paró los dos, y se hizo con el editor y con
`git show HEAD:<fichero>` a un temporal. Mi primera línea `A9:` llevaba esta explicación detrás de la ruta y
`scrum1294` la tumbó en local, antes del empujón.)

**Decisión que se aplica:** SCRUM-1599 c.20650 ② (respuesta literal «Connect activo en el test»), sobre la medición
de c.20647. Sólo el test: 0 líneas de `src/`, 0 aserciones tocadas.

### ⓪ La alta del árbol (SCRUM-1218 c.20665)

`scripts/_clave-vs-destino.mjs` gana UNA entrada, `'jv-j2ay': 'yaqu_dev_javier'`, y `tests/scrum383-clave-vs-destino.test.mjs`
la declara en su lista exacta, con un caso que exige la misma base que `cobroflash-backend` (la forma de 1218e).

- `node scripts/comprobar-claves-bd.mjs`, sin tubería: `rc=1` («DATABASE_URL_TESTS NO SE PUEDE COMPROBAR») antes,
  `rc=0` después.
- Control de no declarado, llamando a `comprobarClaveVsDestino`: `jv-j6ap` y `jv-j6ba` siguen saliendo
  `worktree_no_declarado`; `jv-j2ay` y `jv-j6ar` salen `cuadra`.
- `scrum383`: 14/14 con la alta; quitando sólo la línea del módulo, 13/14.

### ① Lo que cambia en `tests/scrum85-pay-routes-token.test.mjs`

- El merchant A nace con `connectStatus: 'active'`, `stripeAccountId: 'acct_QAS85'` y
  `flags: { PAYMENTS_CONNECT_ENABLED: true }`: la misma forma que usan `scrum893` y `scrum923`. Con eso
  `cardChargeMode` deja de dar `'refuse'` y `/pay/invoice/:token` vuelve a enlazar `/pay/card/<token>`.
- `STRIPE_SECRET_KEY` se vacía antes de cargar `dist/` (dotenv no pisa una variable que ya existe): la cuenta
  conectada es ficticia y `/pay/card` no puede llamar a Stripe, haya o no clave en el `.env`. Contesta 501.
- Un comentario que decía «este fixture ES un merchant real sin Connect» se corrige; la aserción de al lado, no.

### ② Con el turno (base del carril `yaqu_dev_javier`, de 20:56:13Z a ~21:00Z, `QA_DB_TEST=1 WHATSAPP_DRY_RUN=1`)

| pasada | casos | ok | not ok | SKIP |
|---|---|---|---|---|
| ANTES (el fichero de main) | 1 | 0 | 1 («el link a /pay/card debe llevar el TOKEN») | 0 |
| DESPUÉS, 3 pasadas | 1 | 1 | 0 | 0 |
| MUTACIÓN: el merchant A sin `...CONNECT_ACTIVO` | 1 | 0 | 1 (el mismo error que el ANTES) | 0 |

En las tres pasadas del DESPUÉS, `/pay/card/<token>` da 501 (diagnóstico SCRUM-119, «Stripe ausente») y el id
numérico da 404: el IDOR sigue probado. Evidencia: `docs/master/evidencias/SCRUM-1599/{antes,despues,mutacion}-1599c.salida.txt`.

### ③ Sin medir

- La rama 303 del test (redirect a Stripe Checkout): con la clave vacía no se ejerce, ni antes de este cambio se
  ejercía en esta base.
- Que vaciar la clave impida la llamada con una clave PRESENTE en el `.env`: en este árbol no hay ninguna (0 líneas
  `STRIPE*`, con 1 de `DATABASE_URL_TESTS` como positivo); se apoya en leer `loadEnv.ts`, que llama a
  `dotenv.config()` sin `override`.
- La tanda gateada entera: el turno se usó fichero a fichero, como en 1218e/f.
- Este tramo y el de 1599b (#2784) se añaden los dos al final de este fichero: el que entre segundo tiene que
  mezclar `origin/main` y conservar los dos.
## J1 · SCRUM-1599b · scrum178, scrum814.gated y scrum17, al día con lo que decidió el fundador

**Medido contra:** `origin/main` = `b6dd5d1a8d64abd0bf835141e8d9bac6d5d2055f` · 2026-10-23T20:29:13Z (hora de GitHub al soltar el turno; sesión J1 `jv-j1ax` en el árbol `jv-j6ar`, por encargo del orquestador `cobroflash-backend-62`. Al escribir, `main` ya era `5d7ed59e0c6d6b313c2303d9498bb6c125299430`: entró 1599a (sólo docs) y SCRUM-1598, que toca `invoicesAdmin.routes.ts` —el marcado masivo de pagadas—, fuera de las tres rutas que miden estos tests: `invoice-manual`, `/:id/invoice` y la consolidación)

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: en el PASO 0 busqué el PR de 1599a con `gh pr list --search "1599 in:title"`, dio `[]` y el título del PR sí lleva «SCRUM-1599a»; lo cazó el positivo (la rama existía en `ls-remote`) y `--head <rama>` dio #2775. Una búsqueda de `gh` no pasa por ningún guard del repositorio

**Decisión que se aplica:** SCRUM-1599 c.20650 (respuestas literales «Flag ON + caso del 409» y «Sí, F<AA><NNNN>»), sobre
la medición de c.20647. `scrum85` es de J2 y no entra aquí. Sólo tests: 0 líneas de `src/`, 0 del camino de emisión.

### ① Lo que cambia, test por test

| test | cambio | ¿se relaja alguna aserción? |
|---|---|---|
| `tests/scrum178-emision-manual.test.mjs` | su merchant ES lleva `FISCAL_ON` (`flags.INVOICING_ES_ENABLED = true`, la forma del hermano `scrum814-carrera-de-tramos-postgres`) | no: el dato de partida |
| ídem | fuera el `if (isReceiptNumber(…))` con la rama del justificante `J-…`: con el flag ON la rama fiscal es OBLIGATORIA, y se añade `isReceiptNumber(number) === false` | no: se ENDURECE (antes un `J-` pasaba por la otra rama) |
| ídem | caso NUEVO: merchant ES con NIF y `FISCAL_OFF` explícito → `invoice-manual` da 409 `facturacion_no_disponible` y deja 0 filas en `Invoice` | nuevo |
| `tests/scrum814-carrera-del-tramo.gated.test.mjs` | `FISCAL_ON` en sus tres merchants | no: 0 aserciones tocadas |
| `tests/scrum17-recapitulativa.test.mjs` | `:176`: `/^\d{4}-/` → `/^F\d{6}$/` | no: se ENDURECE (casa `F260001`; no casa `2026-0001`, `J-260001`, `F2600011` ni `F26001`) |

El OFF del caso nuevo va **explícito** en la columna, no «ausente»: `isFlagEnabled` (`src/core/flags.ts:83`) da
prioridad a la columna sobre el env, así que el caso no depende de cómo esté el `INVOICING_ES_ENABLED` del entorno.

### ② Antes y después, con el turno

Base del carril `yaqu_dev_javier` (`DATABASE_URL_TESTS`; `comprobar-claves-bd.mjs` rc=0, ninguna clave de producción),
turno tomado 20:25:58Z y soltado ~20:29Z, `QA_DB_TEST=1 WHATSAPP_DRY_RUN=1`, `dist/` de `tsc --noCheck` sobre la base
de arriba. Los tres ficheros en una pasada; canario: 35 s.

| pasada | casos | ok | not ok | SKIP | salida |
|---|---|---|---|---|---|
| ANTES (los tres ficheros de `origin/main`) | 17 | 12 | 5 | 0 | `docs/master/evidencias/SCRUM-1599/antes-1599b.salida.txt` |
| DESPUÉS | 18 | 18 | 0 | 0 | `docs/master/evidencias/SCRUM-1599/despues-1599b.salida.txt` |
| MUTACIÓN: el merchant del caso nuevo, de `FISCAL_OFF` a `FISCAL_ON` | 3 | 2 | 1 | 0 | `docs/master/evidencias/SCRUM-1599/mutacion-1599b.salida.txt` |

- ANTES cae lo mismo que en c.20647: `scrum17` 11/12 (`'F260001'`), `scrum178` 1/2 (409 donde esperaba 201) y
  `scrum814.gated` 0/3 (0 facturas donde esperaba 2; 409 donde esperaba 201). 12 + 5 = 17.
- DESPUÉS, `scrum178` emite `F260001` (F1, VeriFactu true) en la base del carril; el fixture borra el merchant al acabar.
- La mutación cae donde debe: 409 esperado, 201 recibido. La de «quitar el OFF» a secas NO se usó a propósito: sin la
  columna decide el env, que en esta base está apagado, y el caso seguiría verde — sería una mutación muda.

### ③ Guards

Los de suite (237, 976, 824 ×3, 836, 419, 702, 700, 719, 1415, 113, 262, 745, 757, 765): 16 ficheros, 155 casos,
155 ok, 0 not ok, 0 SKIP, sin `QA_DB_TEST`.

### ④ Lo que NO se ha hecho, ni medido

- `scrum85` (J2) y el ③ de 1599 (aviso de un gateado N días en rojo, J6/S5): fuera de este tramo.
- Una pasada por punto, no tres.
- El DESPUÉS se midió sobre `b6dd5d1a8`, no sobre `5d7ed59e0`: lo que entró entre medias no toca estas rutas (arriba),
  pero no lo he corrido.

## J6 · SCRUM-1599d · el ③: medir quién ve un gateado en rojo, y tres diseños para el aviso

**Medido contra:** `origin/main` = `09f51b1c7db6f6a8f7b6532a03c30a4809b48e86` · 2026-10-23T22:32:06Z (hora de GitHub al escribir la salida de la sonda; sesión J6 `jv-j6bg` en su árbol `jv-j6bg`, por encargo del orquestador `cobroflash-backend-62`. La sonda dinámica va sobre `a7855fd70`, el commit del último CI verde de main)

A9: aviso → cicatriz J6 «Lancé cuatro pasadas de una sonda nueva encadenadas sin cronometrar antes UNA, y el arnés las mandó a segundo plano en un encargo que las prohibía: la misma que en SCRUM-1218f, dos tandas después» — no se pudo comprobar: ningún hook multiplica pasadas por duración antes de lanzar, y la cicatriz de SCRUM-1218f, que dice lo mismo, no lo impidió

Sólo se MIDE y se PROPONE: 0 líneas de `src/`, de `tests/` o de `.github/`. Sin base, sin turno: todo sale de `git`
y del log de CI. Sonda: `evidencias/SCRUM-1599/sonda-1599d.mjs`; su salida, `evidencias/SCRUM-1599/sonda-1599d.salida.txt`.
(El encargo decía `evidencias/scrum1599/`; la carpeta que ya existe es `SCRUM-1599/` y va ahí.)

### ① Qué está gateado, y por qué variable

Dos sondas independientes que tienen que casar (A3):

- **Estática**: el motivo literal de cada `skip: !X && '…'` de los `tests/*.test.mjs` de la ref, leídos con `git show`.
- **Dinámica**: los casos `﹣ … # motivo` del log del job «build + tests» del último CI verde de main (run 40023657436,
  job 120656131758, 1.983.145 B). Cada caso saltado por `QA_DB_TEST` se busca por su título en los ficheros.

| motivo del salto nombra | ficheros (estática, main de hoy) | ¿corre en CI? |
|---|---|---|
| `QA_DB_TEST` solo | 48 (46 de verdad + 2 meta-tests que enseñan el literal: `scrum419`, `scrum754`) | **NO** — 83 casos saltados en CI, en 46 ficheros |
| `QA_DB_TEST` o `LIBRO_PG_URL` | 20 | sí, con el banco desechable del runner (`ci.yml:236`) |
| `LIBRO_PG_URL` solo | 20 | sí, ídem |
| `A55_DB_TEST` o `LIBRO_PG_URL` (`a55-window-quote`) | 1 | sí, ídem (SCRUM-876f) |
| `BOT_SUITE_TEST` o `LIBRO_PG_URL` (`bot-suite`) | 1 | sí, ídem |
| sin literal pero leen `process.env.<gate>` | 2 | sin clasificar |

- Población: 1.491 ficheros `.test.mjs` hoy (1.485 en `a7855fd70`); los números de gateados son iguales en los dos.
- Del log: `tests 12427 = pass 12338 + skipped 89`, y 89 líneas de salto leídas. De esos 89, **83** son `QA_DB_TEST`;
  los otros 6 no son de base (4 de Windows, 1 de la hora de GitHub, 1 `TRAMOS_PG_URL`, que corre en otro paso).
- Cruce: los 46 ficheros de la dinámica están TODOS en la estática; la estática tiene 2 más, los dos meta-tests.
  Los 83 casos casan con un fichero; 0 sin casar.
- Controles SEMBRADOS: una línea de log fabricada con el título de un caso que encontró la estática tiene que casar
  con su fichero (casa); una con un título inventado no puede casar (no casa).
- Mutaciones: sin el positivo sembrado, la sonda sale **CIEGO** (rc=2); con el log cortado a 50.000 B, **CIEGO** (rc=2).

**La población que NADIE ve son esos 46 ficheros / 83 casos.** Los cuatro de este ticket estaban dentro (scrum17,
178, 814.gated y 85). Lo que corre con `LIBRO_PG_URL`, `A55` o `BOT_SUITE` sí lo ve el check obligatorio en cada PR.

### ② Quién los corre, cuándo, y qué rastro deja

- **CI no**, por decisión del fundador del 27-jul-2026: la base de staging no entra en GitHub Actions
  (`scripts/_evidencia-tanda.mjs`, cabecera; `ci.yml:13`).
- **`npm run test:staging:gated`** (`scripts/staging-gated.mjs`) los corre a mano, con el turno. Al acabar escribe
  el recibo de SCRUM-161, `.claude/evidencia-tanda.json`, que está en `.gitignore` y vive en el árbol donde se corrió.
- **Quién exige el recibo:** sólo `/yaqu-release-check` (`.claude/skills/yaqu-release-check/SKILL.md:19`). Ningún
  hook ni ningún job.
- **Recibos en esta máquina:** 1 en 369 árboles (el checkout compartido más los 368 de `.claude/worktrees/`).
  Es del **4-sep-2026 a las 22:46:26Z**, sobre `8fec4abe7`. Y su bloque QA, el de estos 46, sale **`null`**: el
  hijo duró 2.700.065 ms contra un límite de 2.700.000 y no llegó a dar resultado.
- **El recibo no guarda resultado por fichero**, sólo por hijo (`a55`, `bot`, `scrum180`, `qa`).

**¿Hay rastro con fecha de la última vez que cada uno salió verde?** No. En esta máquina, la última tanda gateada
con recibo es de hace 49 días, y no terminó el bloque de estos 46. Lo que sí hay son corridas FICHERO A FICHERO con
turno, apuntadas a mano en registros (SCRUM-1218e/f, 1599a/b/c). No las he barrido.

### ③ Cuánto tiempo estuvieron en rojo sin que nadie lo viera

Inicio: el `merged_at` del PR que metió en main el commit que los tumbó (bisect de 1599a). Fin: el `merged_at` del
arreglo. «Visto»: la creación de este ticket, 2026-10-23T19:51:56Z. Horas de GitHub (`gh api …/commits/<sha>/pulls`,
`gh pr view`), no fechas de commit.

| test | lo tumbó | entró en main | arreglo | días en rojo | días sin verse |
|---|---|---|---|---|---|
| `scrum17` | `ba1cd2d55` SCRUM-780 | #1154 · 2026-09-07T21:00:42Z | #2784 · 2026-10-23T21:11:11Z | **46,0** | 45,95 |
| `scrum85` | `6491b4288` SCRUM-893 | #1421 · 2026-09-17T13:19:26Z | #2789 · 2026-10-23T21:30:54Z | **36,3** | 36,27 |
| `scrum178`, `scrum814.gated` | `b8e3f81a6` SCRUM-1027 | #1608 · 2026-09-22T08:42:54Z | #2784 · 2026-10-23T21:11:11Z | **31,5** | 31,46 |

Los tres arranques caen DESPUÉS del único recibo de la máquina (4-sep). Ninguna tanda gateada con recibo los vio
caer.

### ④ Tres diseños para el aviso

Ninguno se ha construido. Carriles leídos con `node scripts/carriles.mjs de <ruta>`.

**B · Que dejen de estar fuera de CI: migrarlos al banco desechable.** *(recomendado)*

- **Qué hace:** cada uno de los 46 aprende a correr también con `LIBRO_PG_URL`, como los 20 que ya lo hacen (forma
  `CON_BANCO` de SCRUM-876f: `a55`, `bot-suite`). Entonces CI los corre en cada PR, y un rojo bloquea el merge el
  mismo día. Ya no hay que contar días. (Los lotes de SCRUM-1218 son OTRA cosa: cambian `fetch` por un ayudante
  `http`; `tests/pdfs.test.mjs`, migrado en 1218g, sigue gateado sólo por `QA_DB_TEST`. Corregido en c.20714.)
- **Qué toca:** `tests/**`, que según `carriles.mjs` está «sin fila en §3: nadie lo reclama». Nada de `.github/`,
  porque `ci.yml` ya levanta el banco.
- **Coste:** SIN MEDIR. Que todos se puedan migrar tampoco está medido: alguno puede necesitar staging de verdad, y
  ése se queda para A.
- **Que no se quede mudo:** un trinquete en `npm test` con la sonda estática de aquí. Cuenta EXACTA de ficheros
  «sólo `QA_DB_TEST`» (46): si sube o baja, cae y pide una decisión (A10). Su positivo se siembra con un fichero
  fabricado con un `skip` de `QA_DB_TEST` en un temporal. Sin él, el trinquete tiene que decir CIEGO.

**A · Recibo por fichero y aviso en el latido.** *(para lo que no se pueda migrar)*

- **Qué hace:** el runner guarda, para cada fichero, la fecha y el veredicto de su última pasada. El latido dice
  «`<fichero>` · N días sin verde» y «la última tanda gateada fue hace N días».
- **Qué toca:** `scripts/staging-gated.mjs` y `scripts/_evidencia-tanda.mjs`. Hoy están SIN CERRADURA, y su fila
  nace en el mismo PR (`dos-equipos.md:172`), con el área de J6. Y `scripts/equipo/latido.mjs`, que es de **S5**
  (`dos-equipos.md:166`): o lo hace S5, o se declara la excepción.
- **Coste:** un PR mediano en un fichero de 42.903 B que toma el turno. Ningún coste fijo.
- **Límite medido:** sólo avisa si alguien corre la tanda, y en esta máquina eso no pasa desde el 4-sep. Pero
  «hace 49 días» es ya un aviso, así que no se queda mudo. Es local: lo ve sólo la máquina que corrió.
- **Que no se quede mudo:** el latido imprime su población («recibos leídos: n · ficheros con fecha: m»). Con 0
  recibos dice CIEGO, no verde. Con un recibo fabricado de N+1 días tiene que avisar, y si se le quita, CIEGO.

**C · El recibo, publicado en GitHub, con un vigía programado.**

- **Qué hace:** al acabar, la tanda publica su recibo (con el desglose de A) en un Issue fijo. Un workflow programado
  avisa cuando el último recibo, o un fichero, pasa de N días. Es la forma de `vigia-de-main.yml`.
- **Qué toca:** un workflow nuevo, que es de **S5** (`dos-equipos.md:167`), más el paso de publicar en el runner.
- **Coste:** un workflow y un canal nuevo hacia fuera. Es lo único de los tres que ven los dos equipos.
- **Que no se quede mudo:** el vigía comenta en CADA pasada, también en verde, con la edad del último recibo. Sin
  recibo, comenta CIEGO. Hasta su primera pasada, CIEGO, como dice `vigia-de-main.yml:36`.

Sin medir en los tres: cuánto alarga el job de CI meter 83 casos más (B), y qué ve la máquina del otro equipo (A, C).

### ⑤ Preguntas para el fundador (✅/❌)

1. **B.** ¿Los 46 ficheros que sólo corren con `QA_DB_TEST` pasan, por lotes, al banco desechable que CI ya levanta,
   con un trinquete que no deje cambiar el 46 sin decisión? ✅/❌
2. **A.** ¿Para los que no se puedan migrar, el runner guarda fecha y veredicto POR FICHERO, y el latido dice «N días
   sin verde»? ✅/❌ (toca `latido.mjs`, de S5)
3. **C.** ¿El recibo de cada tanda gateada se publica en un Issue de GitHub, y un vigía programado de S5 avisa a los
   N días? ✅/❌ (workflow nuevo y canal hacia fuera)
4. **Umbral, sólo si A o C.** ¿El aviso dice SIEMPRE la edad de cada fichero, sin umbral? ✅ = sin umbral · ❌ = con
   umbral fijo, y entonces cuál. («Una ventana fija es una tolerancia disfrazada», A10.)

### ⑥ Lo que NO se ha hecho, ni medido

- Ningún diseño construido; ningún workflow tocado.
- El rastro de corridas fichero a fichero en los registros `docs/master/` no se ha barrido: puede haber pasadas
  verdes con fecha de algunos de los 46.
- La otra máquina (equipo de Luis): sus recibos no se ven desde aquí.
- Los 2 ficheros «sin literal pero leen `process.env.<gate>`» no se han abierto.
- La sonda casa títulos por sus 40 primeros caracteres: dos casos con el mismo arranque en ficheros distintos
  contarían en los dos. Hoy no ha pasado (83 casos → 46 ficheros, 0 sin casar), pero no lo impide.
- De paso, confieso dos cosas. La primera pasada de `carriles.mjs` la lancé con la ruta mal
  (`scripts/equipo/carriles.mjs`). Y la tirada que escribía la salida se fue a segundo plano: la línea A9.

## J6 · SCRUM-1599f · primer lote del diseño B: cuatro gateados al banco desechable, y el trinquete de los 42

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:14:50Z (hora de GitHub; sesión J6 `jv-j6bh` en su árbol `jv-j6bh`, por encargo del orquestador `cobroflash-backend-95`. El código se midió en `07e604d3125a7d4172eaec0f458393cc594a3b93` y después se mezcló `origin/main`)

A9: aviso → cicatriz J6 «Crucé el umbral de aviso de contexto sin medirme en el cruce: medí al arrancar y no volví a medir hasta después de un barrido ancho.» — no se pudo comprobar: me pasó otra vez en esta tanda (114k tras Jira, 234k al acabar los guards), y el contexto lo lee la propia sesión en su jsonl; ningún hook de este árbol la para al cruzar

Lo decidió el fundador en c.20715 ①: los 46 pasan por lotes al banco desechable, primero un lote pequeño para medir el
coste. 0 líneas de `src/`, de `.github/` o del camino de emisión; 0 aserciones tocadas (regla 41). Salida:
`evidencias/SCRUM-1599/lote-1599f.salida.txt`.

### ① Cómo se eligió el lote (por programa, no a ojo)

Sobre los 46 de §1599d ①, cinco banderas leídas con `git show origin/main:<fichero>`: merchant fijo (`MERCHANT_ID = 1`,
el demo), HTTP o app levantada (`fetch`, `listen`, `spawn`), camino de emisión o fiscal (`verifactu`, `invoicing/`,
`emitir`, `sellar`…), carrera o concurrencia (`Promise.all`, `carrera`) y si ya tiene banco. «Sencillo» = ninguna de
las cuatro primeras. Salen 7; se toman los 4 más pequeños, y el quinto se aparta con motivo:

| fichero | casos que pasan a correr en CI | qué vigila en la base |
|---|---|---|
| `scrum109-expense-teammember` | 2 | el autor del gasto queda escrito (y `null` para el propietario) |
| `scrum106-trabajos-fecha` | 1 (el otro ya corría sin base) | `trabajos.csv` filtra por fecha de ejecución |
| `scrum104-clientes-referenciados` | 1 | `clientes.csv` del paquete = los referenciados, ni más ni menos |
| `scrum135-gasto-tenencia` | 4 | un gasto no apunta a la cotización ni al proveedor de otro merchant |
| **total** | **8 de los 83** | |

- **`scrum116` NO se migra:** `sendInvoicePaymentReminders()` recorre TODAS las facturas de la base (lo dice su
  cabecera), y el banco de CI lo comparten los ficheros que corren a la vez: escribiría sobre filas de otros tests.
  Leído en el código, no intentado. Queda declarado en el trinquete con ese motivo.
- La forma es la de SCRUM-876e/g: `import { URL_BANCO } from './_banco-libro.mjs'` justo detrás de `_staging-db.mjs`,
  `ENABLED = QA_DB_TEST === '1' || URL_BANCO !== ''`, y el motivo del salto nombra las dos variables. Staging no se
  afloja: con `QA_DB_TEST=1` el módulo ni lee `LIBRO_PG_URL` (lo fija `scrum876e`).
- `scrum419` los declara en su inventario: 75 → 83 tests de banco.
- Carril: `node scripts/carriles.mjs de tests/<f>` para los cinco ANTES de tocarlos: «sin fila en §3: nadie lo
  reclama». Control positivo: `scripts/equipo/latido.mjs` → S5.

### ② Antes, después y mutación (banco LOCAL)

No hay Postgres en la máquina: PGlite 0.5 con `pglite-socket` en `127.0.0.1:55611`, base `yaqu_libro_test`, esquema de
`prisma migrate diff --from-empty` (33 tablas, una por modelo). Canario: `scrum13-cobrado` (ya migrado) 1/1.

| pasada | casos | pasan | caen | saltan |
|---|---|---|---|---|
| ANTES (los 4 de main, con `LIBRO_PG_URL` puesta) | 9 | 1 | 0 | **8** |
| DESPUÉS | 9 | **9** | 0 | 0 |
| MUTACIÓN en `dist/` (no en `src/`): `assertRefsOwned` sin `merchantId` en la búsqueda de la cotización · scrum135 | 4 | 2 | **2** (los dos de cotización ajena) | 0 |

- Los 8 del ANTES son los mismos 8 que salta CI según la sonda dinámica de §1599d.
- **Dos fallos del INSTRUMENTO, no de los tests, que el CI no tiene.** `pglite-socket` admite UNA conexión por
  defecto y el pool de Prisma abre varias («Can't reach database server» a mitad): se sube a 64. Y PGlite es una
  sola sesión de backend, así que los `prepared statement "s0"` del proceso anterior chocan con el siguiente
  (42P05): el banco se reinicia antes de cada fichero. En CI es un Postgres 16 de verdad.

### ③ El trinquete: `tests/scrum1599f-los-que-solo-ve-staging.test.mjs`

- **Población:** los ficheros con un `skip` que nombra `QA_DB_TEST` y SIN segundo destino (ni importan
  `_banco-libro.mjs` ni leen `process.env.LIBRO_PG_URL`), las dos cosas por AST. Sale **42** sobre los 1.492 ficheros
  `tests/*.test.mjs` del árbol fusionado (contados con `ls`, el nuevo incluido), y casa CONJUNTO a conjunto con la lista dinámica de CI de §1599d menos estos cuatro: dos sondas que no
  comparten algoritmo. Los 2 meta-tests (`scrum419`, `scrum754`) no entran porque leen la variable.
- **Se compara el conjunto**, en las dos direcciones: un fichero que entra o uno que sale sin migrar lo tumban,
  nombrándolo.
- **Positivo sembrado:** un gateado fabricado en el propio test va con el árbol; si el extractor no lo ve, el
  censo dice CIEGO y no compara. Un caso permanente lo comprueba: sin el sembrado, CIEGO. Un gemelo con la forma
  migrada NO entra, y un comentario que nombra el banco no cuenta como migración.
- **Rojos vistos** (cada uno con su `git diff --numstat` al lado, restaurados con `git restore --source=HEAD`):
  - devolver `scrum109` a su forma de main → «ENTRAN: scrum109»;
  - quitar `scrum58` de la lista → «ENTRAN: scrum58»;
  - declarar `scrum13-cobrado`, ya migrado → «SALEN: scrum13-cobrado».

### ④ Coste: lo medido y lo que queda

- **Local (PGlite, un fichero cada vez):** 0,49 + 1,44 + 1,94 + 0,92 = **4,8 s** para los 4, más ~1 s de arranque del
  banco por fichero. No predice CI: allí es otro motor y la tanda corre en paralelo.
- **En CI:** SIN MEDIR al escribir esto. Sale del obligatorio de este PR comparado con un run de main de la misma
  hora, y va en el comentario de Jira, no aquí.
- **Los 42 que quedan**, por las mismas banderas:

| grupo | ficheros | lectura (sin medir) |
|---|---|---|
| sencillos | 3 · `scrum593d`, `scrum574`, y `scrum116` apartado | 1 lote; 116 probablemente se queda en staging (A) |
| HTTP o app, sin emisión ni carrera | 17 | hay precedente en el banco (`scrum72`, `albaran`, 876e/g): 3-4 lotes |
| emisión o fiscal, sin carrera | 10 | piden el flag ES en sus merchants (`FISCAL_ON`, como 1599b); 2 lotes |
| carrera o concurrencia | 12 | el riesgo alto: `scrum814` ya está medido que se ahoga en la tanda paralela (`ci.yml`, SCRUM-871) y corre en paso aparte |

  Estimación: **unos 8-9 lotes más** de 4-5 ficheros, y un resto de carrera que puede no dejarse meter en la tanda
  paralela. Es una lectura de banderas, no una medición: un fichero «sencillo» puede no serlo.

### ⑤ Lo que NO se ha hecho, ni medido

- El tiempo en CI (arriba). Una pasada por punto, no tres.
- Staging: no he corrido los cuatro con `QA_DB_TEST=1` (sin turno pedido). Su destino de staging no cambia de código.
- La tanda entera en local: NO CORRIDA (diez sesiones a la vez). Guards dirigidos: 22 ficheros (237, 976, 824 ×3,
  836, 702, 700, 719, 1415, 876e, 876f, 113, 740, 812, 850, 850b, 1185, 411, 723, 419 y 1599f) = 206 casos, 206 pasan,
  0 caen, 0 saltan.
- De paso, confieso: para la primera inyección escribí `git show … > tests/scrum109…` y `guard-dangerous` lo paró
  (truncaba un fichero vigilado); se hizo con `git restore --source=origin/main`.
