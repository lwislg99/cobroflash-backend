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
## J6 · SCRUM-1599g · diseño A, nuestra mitad: fecha y veredicto de cada fichero en el recibo de la tanda gateada

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:12:36Z (hora de GitHub al mezclar `origin/main` en la rama; sesión J6 `jv-j6bi` en su árbol `jv-j6bi`, por encargo del orquestador `cobroflash-backend-95`. Sin base y sin turno: la tanda gateada de verdad NO se ha corrido)

A9: comprobación → `tests/scrum258-nota-por-sesion.test.mjs`

Decisión del fundador: c.20715 ② («A: Sí, y a Luis lo suyo»). El aviso en `scripts/equipo/latido.mjs` es de S5 y aquí
no se toca.

### ① Qué se ha construido

- **El reporter.** `scripts/_evidencia-tanda.mjs` gana un `export default`: un reporter de `node:test` que cuenta, por
  fichero, los casos que pasan, caen y se saltan (el `file` de cada evento), y escribe UNA línea JSON al terminar. Un
  `todo` no cuenta. Veredicto del fichero: `rojo` si cae alguno, `verde` si pasa alguno, `saltado` si no pasa ninguno
  — **un fichero saltado no es verde**.
- **El runner.** `scripts/staging-gated.mjs` lanza cada hijo con dos reporters: el `spec` a stdout, como antes (de su
  resumen sale `parseCuenta`; desde node 24 era el de por defecto, y con un segundo reporter hay que nombrarlo o
  desaparece), y el nuevo a un fichero dentro de un directorio de `mkdtemp`, fuera del árbol. Un hijo abortado por
  tiempo, o con la salida vacía o cortada, no aporta veredictos: sus ficheros conservan los de antes, y se dice cuáles.
- **El recibo** gana `porFichero`: `{ "<fichero>": { veredicto, veredictoEn, ultimoVerdeEn } }`. Se lee el recibo
  anterior antes de pisarlo y se fusiona: lo que corrió ahora pisa su entrada, lo que no corrió se queda, y **un rojo
  no borra la fecha del último verde**. En AUTOTEST el historial se copia sin tocar. Todo lo que el recibo ya escribía
  sigue igual, y `validarEvidencia` decide lo mismo con o sin el campo nuevo (caso propio en el test).
- **`diasSinVerde({ texto, ahoraMs, ficheros?, umbralDias? })`**, pura. `CIEGO` sin recibo, con un JSON ilegible o con
  un recibo sin `porFichero` (el del 4-sep es así). Si no, `OK` con su `poblacion` y, por fichero, `verde` ·
  `sin-verde` (con `dias` desde el último verde) · `nunca-verde` · `saltado` · `CIEGO` (está en `ficheros` y el recibo
  no lo nombra). `avisa` sólo se calcula si llega `umbralDias`: el número no está decidido (la pregunta ④ de c.20713
  no tiene respuesta en c.20715), y sin umbral la edad se da igual.

### ② La llamada que haría falta en `latido.mjs` (S5), para el mensaje a Luis

```js
import { readFileSync } from 'node:fs';
import { RUTA_RECIBO, diasSinVerde } from '../_evidencia-tanda.mjs';

let texto = null;
try { texto = readFileSync(RUTA_RECIBO, 'utf8'); } catch { texto = null; } // sin recibo → CIEGO
const r = diasSinVerde({ texto, ahoraMs: Date.now() /* , ficheros: [...], umbralDias: N */ });
// r.estado === 'CIEGO' → r.motivo · si no: r.poblacion, r.ficheros[i].{fichero, estado, dias}, r.avisos
```

`RUTA_RECIBO` es relativa a la raíz del árbol desde el que corre el latido. `ficheros` (los gateados de hoy) y
`umbralDias` son decisión de S5 y del fundador.

### ③ Comprobaciones

| qué | resultado |
|---|---|
| test nuevo, código nuevo | 9/9 · 0 SKIP |
| ROJO primero: el test nuevo contra `scripts/` de `main` (copia de `git archive HEAD` en un temporal) | cae: `does not provide an export named 'claveDeFichero'` |
| recibo fabricado de N+1 días con umbral N | avisa; N días no avisa; el borde sale del umbral, no de un literal |
| sin recibo (`null`, `''`, espacios), JSON roto, recibo con la forma del 4-sep, desglose vacío | CIEGO |
| positivo sembrado: el fichero está en `ficheros` y se quita del recibo | CIEGO (y avisa), no verde |
| el reporter de verdad, cargado por `node --test` con el `spec` al lado, sobre 4 ficheros fabricados | verde · rojo · saltado · rojo (el que no carga), y `ℹ tests 4` sigue en stdout |
| scrum161 y sus vecinos del recibo (199, 239, 265 ×2, 182, 188, 249, 197, 1308, 1480f) y los de suite | ver ④ |

**Mutaciones**, con el código quieto y una base de 9/9 sin mutar (en una copia temporal, no en el árbol): las cinco
VIVAS, y cada una tumba SU caso (pasan + caen = 9 en las cinco):

| mutación | cae |
|---|---|
| M1 · `fusionarPorFichero` olvida el último verde | el de fusionar |
| M2 · el borde pasa de `>` a `>=` | el de N+1 días |
| M3 · un fichero que el recibo no nombra cuenta como verde | el del positivo sembrado |
| M4 · el runner sin `--test-reporter=spec` | el del runner |
| M5 · el reporter cuenta un salto como pase | el del reporter (×2) |

M1 y M2 van declaradas en `MUTACIONES_QUE_ME_TUMBAN` del test nuevo.

### ④ Guards

Sobre el árbol antes de mezclar (`25ad5d43b`), con `dist/` de `tsc --noCheck`: los del recibo, los de suite (237,
976, 824, 836, 419, 702, 700, 719, 1415) y 258. Pasada final sobre el árbol fusionado con `0e86dada4`, `dist/`
reconstruido, con el registro escrito y los de registro (267, 273, 1294, 921c, 1572): **27 ficheros · 278 casos =
278 pass · 0 fail · 0 SKIP**. Suite entera local: NO CORRIDA (hoy hay 10 sesiones; hace de tanda el obligatorio).

- **De paso, un rojo mío:** la primera versión escribía la salida del reporter en una ruta fija del temporal
  (`yaqu-por-fichero-<pid>-<clave>.json`). `scrum258` la cazó dentro de `guards:entrada` (scrum976): una ruta fija la
  comparte toda la máquina. Pasa a `mkdtemp`, y el directorio se borra en el evento `exit`, que también corre con los
  `process.exit` de antes del turno. De ahí la línea A9.
- `scrum836` cayó al principio por las tres anclas de `scrum608` en `dist/`: el árbol no traía `dist/`. Con `dist/`
  construido, verde. No era de este diff.

### ⑤ Lo que NO se ha hecho

- **La fila de carril de los dos scripts NO nace en este PR**, aunque el encargo lo pedía. `carriles.mjs` dice
  SIN CERRADURA, pero los dos están en la foto de deuda del 9-oct (`docs/master/evidencias/SCRUM-1480/sin-fila-9oct.txt`,
  líneas 39 y 205 de 225): no son ficheros nuevos, así que «Cómo nace la fila» no aplica. Darles fila es editar la
  tabla de `docs/equipo/dos-equipos.md`, que es de la S0, y bajar `quedan` en `scripts/_sin-fila-declarados.json`, cuyo
  `leeme` dice que el equipo de Javier no edita esa tabla. Lo decide el orquestador con la S0.
- El nombre del encargo, `scripts/test-staging-gated.mjs`, **no existe**: el runner es `scripts/staging-gated.mjs`
  (el que nombra c.20715). `carriles.mjs` contestó «SIN CERRADURA» también por el que no existe: contesta por patrón.
- La tanda gateada de verdad no ha corrido: el recibo real con `porFichero` está SIN VER. Lo que sí corrió de verdad
  es el reporter, en un `node --test` hijo sobre ficheros fabricados.
- El tamaño del recibo con ~1.500 ficheros en `porFichero`: sin medir.
- `latido.mjs`, sin tocar (S5).

## J6 · SCRUM-1599h · segundo lote del diseño B: siete gateados más al banco desechable, y el trinquete de 42 a 35

**Medido contra:** `origin/main` = `67f0c66833f8996399e79abff0a9f4e5c90217b4` · 2026-10-24T15:14:50Z (hora de GitHub; sesión J6 `jv-j6bs` en su árbol `jv-j6bs`, por encargo del orquestador `cobroflash-backend-95`. El código se midió sobre `1b3395ecc` y después se mezcló `origin/main`, que no toca ningún fichero de este lote)

A9: aviso → cicatriz J6 «Crucé el umbral de aviso de contexto sin medirme en el cruce: medí al arrancar y no volví a medir hasta después de un barrido ancho.» — no se pudo comprobar: me pasó otra vez, la tercera en J6 (110k tras Jira, ~226k al acabar las mutaciones, sin medir entre medias), y el contexto lo lee la propia sesión en su jsonl; ningún hook de este árbol la para al cruzar

Lo decidió el fundador en c.20715 ①, con la cifra del lote 1 delante (c.20762: por debajo del ruido entre runs, n=1).
0 líneas de `src/`, de `.github/` o del camino de emisión; 0 aserciones tocadas (regla 41). Salida:
`evidencias/SCRUM-1599/lote-1599h.salida.txt`; banderas: `evidencias/SCRUM-1599/banderas-1599h.mjs`; banco:
`evidencias/SCRUM-1599/banco-1599h.mjs.txt`.

### ① El lote, por programa y con el criterio de §1599f ①

El guion de banderas de 1599f no se subió, así que se reescribió con los patrones que nombra §1599f ① y se **calibró**:
sobre `0e86dada` (el commit de antes del lote 1) da exactamente los mismos 7 «sencillos» (104, 106, 109, 135, 116,
593d, 574). Sobre los 42 de hoy: 3 sencillos (116 apartado, 593d, 574) y **18** «solo-H» (sólo HTTP o app levantada,
sin merchant fijo, emisión ni carrera); §1599f ④ decía 17 por su lectura, y la diferencia no la he cuadrado. El lote
son los dos sencillos que quedan más los seis «solo-H» más pequeños:

| fichero | casos que pasan a correr en CI | qué vigila en la base |
|---|---|---|
| `scrum593d-viaje-completo-del-texto` | 4 | los textos del documento se guardan, se releen y salen en el PDF |
| `scrum131-resend-honesto` | 1 | reenviar la invitación dice `sent:false` si el correo no sale, y no pierde la fila |
| `webhooks-idempotencia` | 1 (los otros 2 ya corrían sin base) | un `payment.confirmed` duplicado en `/webhooks/psp` no re-paga |
| `scrum57-operario-propagacion` | 1 | el operario llega al trabajo, al cobro y a los albaranes del detalle |
| `scrum22-operario-readpath` | 1 | el serializador expone el operario en lista y detalle, con tenencia |
| `scrum51-job-sin-quote` | 1 | el detalle de un trabajo sin presupuesto incluye sus albaranes |
| `scrum58-jobs-n1` | 1 | la lista de trabajos no crece en consultas con el número de filas |
| **total** | **10** | |

- **`scrum574` NO se migra**, y esta vez está MEDIDO, no leído: su caso «CONTRA POSTGRES: tras la migración, cada
  cliente sigue siendo el mismo» compara los clientes de una base real ya migrada con el PASO 0 de `railway` y
  `yaqu_dev_javier`. En el banco vacío cae con «⛔ NO SUPE MIRAR: cero clientes», que es su suelo y está bien que
  caiga. Vuelve a su forma de main y queda declarado en el trinquete con ese motivo.
- La forma es la de 1599f (y 876e/g): `_banco-libro.mjs` justo detrás de `_staging-db.mjs`, `QA_DB_TEST` **o**
  `LIBRO_PG_URL`, y el motivo del salto nombra las dos. La sustitución la hizo un guion que exige el recuento EXACTO
  de cada cambio por fichero (import 1, gate 1, saltos N); `git diff --numstat` lo confirma.
- `scrum419` los declara: 83 → 93 tests de banco.
- Carril, ANTES de tocarlos: `node scripts/carriles.mjs de tests/<f>` para los ocho, «sin fila en §3: nadie lo
  reclama». Control positivo: `scripts/equipo/latido.mjs` → S5.

### ② Antes, después y mutación (banco LOCAL)

PGlite 0.5.8 + pglite-socket 0.2.11 (`maxConnections: 64`) en loopback, base `yaqu_libro_test`, esquema de
`prisma migrate diff --from-empty` (33 `CREATE TABLE`, 33 `model`), PGlite NUEVO por fichero: los dos arreglos de
instrumento de §1599f ②. Canario cronometrado antes de nada: `scrum109` 2/2 en 10 s.

| pasada | ficheros | casos | pasan | caen | saltan |
|---|---|---|---|---|---|
| ANTES (los 8 candidatos de main, con `LIBRO_PG_URL`) | 8 | 20 | 8 | 0 | **12** |
| DESPUÉS (los 8 migrados) | 8 | 21 (20 + la línea de fichero del aborto de webhooks) | 19 | **2** | 0 |
| el lote (7, sin 574), con webhooks de las 3 pasadas siguientes | 7 | 12 | **12** | 0 | 0 |

- Las dos caídas del DESPUÉS: 574 (arriba) y `webhooks-idempotencia`, cuyos 3 casos pasan y el proceso aborta al
  salir con `UV_HANDLE_CLOSING` en `src\win\async.c`: el abort de libuv de Windows de SCRUM-1204. Tres pasadas más:
  3/3 limpias. Uno de cuatro en esta máquina; CI corre en Linux.
- **Mutaciones en `dist/`, no en `src/`**, una por fichero, cada una con su ancla de recuento 1 y su fichero devuelto
  con el hash comprobado:

| mutación | fichero que cae | caso que cae, y por qué aserción |
|---|---|---|
| M1 · `pdf.service.js` deja de pintar el pie | 593d, 1 de 4 | «EL VIAJE…» · «PIE593D_ALFA no sale en su propia línea del PDF» |
| M2 · `team.routes.js` responde siempre `sent` | 131, 1 de 1 | «SIGUE MINTIENDO… dice sent=true» |
| M3 · `psp.routes.js` sin la rama del duplicado | webhooks, 1 de 3 | A12.2c · «…y marcado como duplicate» |
| M4 · `jobs.routes.js` con `operario: null` | 57 y 22, 1 de 1 cada uno | «job.operario resuelto {id,name}» / «operario resuelto {id,name}» |
| M5 · `jobs.routes.js` con el early-return del quote | 51, 1 de 1 | «Job sin quote: el detalle incluye su albarán» |
| M6 · `jobs.routes.js` con una consulta de más por trabajo | 58, 1 de 1 | «N+1: 3 Trabajos → 13 consultas, 12 Trabajos → 22» |

### ③ El trinquete baja de 42 a 35

`tests/scrum1599f-los-que-solo-ve-staging.test.mjs`: los siete salen de `SOLO_STAGING` en este PR y 574 se queda con
su motivo. Rojos vistos, cada uno con su `git diff --numstat` al lado y deshecho con el editor:
- quitar `scrum574` de la lista → «ENTRAN: scrum574-mismo-cliente-tras-migracion»;
- volver a declarar `scrum131`, ya migrado → «SALEN: scrum131-resend-honesto».

### ④ Coste

- **Local (PGlite, un fichero cada vez):** 5,3 + 5,0 + 4,5 + 3,8 + 4,2 + 3,1 + 4,6 = **30,5 s** para los 7, banco
  incluido. No predice CI.
- **En CI:** sale del obligatorio de este PR comparado con un run de main de la misma hora, y va en el comentario de
  Jira, no aquí (como en 1599f).
- **Lo que queda en los 35:** 2 sencillos, los dos apartados con motivo (116 y 574) · 12 «solo-H» · 21 con emisión,
  fiscal, carrera o merchant fijo, por las banderas de `banderas-1599h.mjs`. Lectura de banderas, no medición.

### ⑤ Lo que NO se ha hecho, ni medido

- Staging: no he corrido los siete con `QA_DB_TEST=1` (sin turno). Su destino de staging no cambia de código.
- La tanda entera en local: NO CORRIDA (varias sesiones a la vez).
- Una pasada por punto (salvo webhooks, cuatro).
- De paso, confieso: para devolver 574 a main intenté `git restore` y `guard-dangerous` lo paró; se deshizo con el
  editor, cambio a cambio, y `git diff` lo da a 0 líneas.

## J6 · SCRUM-1599i · tercer lote del diseño B: siete gateados más al banco desechable, el trinquete de 35 a 28 y las mutaciones de los lotes 2 y 3 catalogadas

**Medido contra:** `origin/main` = `9eb740a4286ee02faedd071dddfab55ddae0d515` · 2026-10-24T16:13:47Z (hora de GitHub al juntar la salida; sesión J6 `jv-j6bz` en su árbol `jv-j6bz`, por encargo del orquestador `cobroflash-backend-95`)

A9: aviso → cicatriz J6 «Lancé un `ls` con comodines sobre los trabajos de la máquina sin medir antes cuántos había (625), y el arnés lo mandó a segundo plano en un encargo que lo prohibía» — no se pudo comprobar: buscaba un PGlite ya instalado por otra sesión; lo paré con `TaskStop` y lo instalé en mi temporal. Ningún hook mide un comodín antes de expandirlo.

Decisión que se aplica: SCRUM-1599 c.20715 ① (el fundador, diseño B). Lote, criterio y forma, los de §1599f y §1599h.
Salida entera: `docs/master/evidencias/SCRUM-1599/lote-1599i.salida.txt`.

### ⓪ Primero: las mutaciones del lote 2, catalogadas, y por qué NO en `MUTACIONES_QUE_ME_TUMBAN`

§1599h dejó sus seis mutaciones sólo en la salida de evidencias, y escritas sobre `dist/`, no con su literal. Ahora
cada test de los lotes 2 y 3 declara la suya, en `src/`, con el literal (`fichero`, `de`, `a`, `cae`).

**No van al catálogo del meta-guard, y no por gusto.** El job `meta-mutaciones` de `ci.yml` corre sin base. Un caso
que sólo corre con banco sale SALTADO en su pasada limpia, y eso es CIEGO (PUERTA 1a de
`scripts/meta-guard-mutaciones.mjs`, la del `saltado`). Un solo CIEGO hace que el job salga con 2. Así que van en
`MUTACIONES_CON_BASE`, la segunda lista que ya usa `tests/scrum1390e-el-portal-solo-lo-suyo.test.mjs` para lo mismo.
Medido: el meta-guard verde de las 15:38Z (job 120907481237, 169.686 B) da «vivas 805 · ciegas 0», y de 1390e sólo
ejecuta las cuatro de su lista del meta-guard. Las dos de `MUTACIONES_CON_BASE` no salen.

**Las ejecuta** `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs`, con la forma de `SCRUM-1390e/mutar.mjs`:
- lee la lista por AST (importar el test lo ejecutaría);
- hace una pasada LIMPIA con el banco y exige que el caso `cae` haya pasado;
- exige que el texto `de` salga UNA vez en el src;
- transpila el src mutado a su sitio de `dist/`, corre el test con el banco y restaura `dist/` comprobando los bytes;
- dice QUÉ aserción cae (el `error:` del TAP), no sólo qué caso.

⚠️ **Nadie las corre en CI.** Es lo mismo que pasa con las dos de 1390e. Que lo hiciera pediría base en el job del
meta-guard, y eso es un workflow: S5 y fundador.

### ① El lote, por programa

Las banderas de `banderas-1599h.mjs`, sin cambiar, sobre los 35 de `SOLO_STAGING` en `9eb740a42`: 2 sencillos
apartados (116 y 574), **12 «solo-H»** y 21 con emisión, fiscal, carrera o merchant fijo. Es el mismo reparto que
cerró §1599h ④. El lote son los siete «solo-H» más pequeños, menos uno:

| fichero | bytes | casos que pasan a CI |
|---|---|---|
| scrum90-pay-bank-mp-token | 6.874 | 1 |
| scrum136-hub-equipo | 7.581 | 3 |
| scrum120-patch-job-roles | 7.890 | 1 |
| scrum148-filtro-por-miembro | 8.129 | 2 |
| scrum24-operarios-metrics | 8.204 | 1 |
| pdfs | 8.269 | 1 (los otros 3 ya corrían) |
| scrum66-tipo-operacion | 8.861 | 1 (el otro ya corría) |
| **total** | | **10** |

- **scrum85 se aparta** (8.753 B, le tocaba entrar). Con la base vacía, el cobro A sale con id=1, y su
  `!body.includes('/pay/card/1')` casa DENTRO del token cuando éste empieza por «1»: en el banco sería intermitente.
  Lo midió jv-j6bv en SCRUM-1218 c.20840. Me llegó por el orquestador, y aquí NO lo he repetido. Queda en el
  trinquete con ese motivo, hasta que se arregle la aserción.
- La forma es la de §1599h: `_banco-libro.mjs` detrás de `_staging-db.mjs`, y `QA_DB_TEST` **o** `LIBRO_PG_URL`.
  Ninguna aserción tocada; el diff de cada test son 3 líneas más el bloque de la mutación.
- `scrum419`: 93 → 103 tests de banco.
- Carril: `carriles.mjs de` los catorce ficheros de test, ANTES de tocarlos → «sin fila en §3». Control positivo:
  `scripts/equipo/latido.mjs` → S5.

### ② Banco local

Banco de §1599h, sin cambios. Canario cronometrado: scrum109 2/2 en 2 s.

| pasada | casos | pasan | caen | saltan |
|---|---|---|---|---|
| ANTES (los 7 de main, con `LIBRO_PG_URL`) | 18 | 4 | 0 | **14** |
| DESPUÉS (los 7 migrados) | 18 | **18** | 0 | 0 |

**Catorce mutaciones, una por fichero migrado** (las siete del lote 2 y las siete de éste). Antes de la tanda, un
canario de una sola: 5 s. Resultado: 14 MUEREN, 0 VIVEN y 0 CIEGAS. El hash de todo `dist/` es igual antes y después.
Cada una cae por la aserción que nombra lo mutado:

| | fichero mutado | qué se muta | cae (aserción) |
|---|---|---|---|
| 593d | `pdf.service.ts` | el pie guardado deja de pintarse | «PIE593D_ALFA» no sale en su línea del PDF |
| 131 | `team.routes.ts` | el reenvío responde siempre `sent` | «SIGUE MINTIENDO … sent=true» |
| webhooks | `psp.routes.ts` | sin la rama del `payment.confirmed` duplicado | «… y marcado como duplicate» |
| 57 · 22 | `jobs.routes.ts` | `operario` siempre `null` | «operario resuelto {id,name}» |
| 51 | `jobs.routes.ts` | vuelve el early-return: sin presupuesto no hay albaranes | «Job sin quote: el detalle incluye su albarán» |
| 58 | `jobs.routes.ts` | la lista serializa sin el lote | «N+1: 3 Trabajos → 31 consultas, 12 → 94» |
| 90 | `payBank.routes.ts` | `/pay/bank/<id numérico>` resuelve el cobro | «… debe ser 404 y fue 200» |
| 136 | `teamOverview.service.ts` | pendiente = aceptado, sin restar lo cobrado | «pendiente = aceptado - cobrado» (2 de 3 caen) |
| 120 | `jobs.routes.ts` | sin el gate por campo | «técnico cambiando tipoOperacion … debe dar 403» |
| 148 | `jobs.routes.ts` | el filtro por operario también para el restringido | «SCRUM-23 ROTO …» |
| 24 | `metrics.service.ts` | pendiente = aceptado | «A1: pendiente = aceptado - cobrado» |
| pdfs | `quotesAdmin.routes.ts` | responde JSON en vez del PDF | «intento 1: no devolvió PDF» |
| 66 | `jobs.routes.ts` | sin la auditoría del cambio | «SCRUM-255 … AuditLog … arrancaron 0» |

- Para 136 y 24 muté la cuenta y no la puerta de rol. Esa puerta sale en dos sitios (`requireRole` en el montaje y
  la lista de `adminOnlyRoutes.ts`), y no he medido cuál manda: quitar una sola podía dar una mutación muda.
- Control del guion: con un fichero sin `MUTACIONES_CON_BASE` dice CIEGO, rc=2.
- La mutación de `pdf.service.ts` (593d, del lote 2) sólo se aplica en el `dist/` local y se restaura. Lo que entra en
  el commit es un literal dentro del test, y el src no se toca.

### ③ El trinquete baja de 35 a 28

`tests/scrum1599f-los-que-solo-ve-staging.test.mjs`. Antes de editar la lista, con los siete ya migrados, cae
(rc=1): «SALEN: pdfs, scrum120, scrum136, scrum148, scrum24, scrum66, scrum90», exactamente los siete, y «ENTRAN: —».
Los siete salen de `SOLO_STAGING`, 85 se queda con su motivo y el número pasa a 28.

### ④ Coste

- **Local (PGlite, un fichero cada vez):** 10,8 + 6,6 + 6,8 + 5,1 + 3,6 + 2,7 + 2,4 = **38,0 s** para los 7, banco
  incluido. No predice CI.
- **En CI:** sale del obligatorio de este PR comparado con un run de main de la misma hora, y va en el comentario de
  Jira, no aquí (como en 1599f y 1599h). Los lotes 1 y 2 quedaron por debajo del ruido entre runs, con n=1 por lado.
- **Lo que queda en los 28:** 2 sencillos apartados (116 y 574) · 5 «solo-H»: uno apartado (85) y cuatro por migrar
  (74, 94, 17 y 222) · 21 con emisión, fiscal, carrera o merchant fijo. Es lectura de banderas, no medición.

### ⑤ Guards

Los de suite (237, 976, 824, 836, 419, 702, 700, 719, 1415), los del banco (1599f, 876e, 876f), los del catálogo
(745, 757, 765, 1387) y 113, 740, 812, 850, 850b, 1185, 411 y 723: **24 ficheros, 234/234, 0 fallos, 0 SKIP**, en 39 s.
Los de registro, sobre el árbol final: en el comentario de Jira.

### ⑥ Lo que NO se ha hecho, ni medido

- Staging: no he corrido los siete con `QA_DB_TEST=1` (sin turno).
- La tanda entera en local: NO CORRIDA (varias sesiones a la vez).
- Una pasada por punto.
- Que las catorce mutaciones mueran también en el Postgres de CI: nadie las corre allí (⓪).
- De paso, me corrijo: la primera versión del guion de mutaciones leía `error: |-`, que es la cabecera del bloque YAML,
  y no el mensaje. Lo vi en la salida, lo arreglé y repetí las catorce antes de dar ninguna cifra.

## J6 · SCRUM-1599k · cuarto lote del diseño B: seis gateados más al banco desechable, y el trinquete de 28 a 22

**Medido contra:** `origin/main` = `289ca894656c7c3686a0469d34785512b960e0b3` · 2026-10-26T15:26:45Z (hora de GitHub; sesión J6 `jv-j6cd` en su árbol `jv-j6cd`, por encargo del orquestador `cobroflash-backend-8b`)

A9: comprobación → `docs/master/evidencias/SCRUM-1599/mutar-1599i.mjs`

Decisión que se aplica: SCRUM-1599 c.20715 ① (el fundador, diseño B). Criterio y forma, los de §1599f, §1599h y §1599i.
0 líneas de `src/`, `.github/` o del camino de emisión; 0 aserciones tocadas (regla 41). Salida entera:
`docs/master/evidencias/SCRUM-1599/lote-1599k.salida.txt`.

### ① El lote, por programa

`banderas-1599h.mjs`, sin cambiar, sobre los 28 de `SOLO_STAGING` en `289ca8946`: 2 sencillos apartados (116 y 574),
5 «solo-H» y 21 con alguna bandera de riesgo. Es el reparto que dejó §1599i ④. El lote son:

- **los cuatro «solo-H» que quedaban** (scrum85 sigue apartado con su motivo de §1599i ①; hoy lo arregla otra sesión
  en otra rama y aquí no se toca);
- **el grupo «E» entero, los dos de una sola bandera** que no es H ni carrera: 76 y 207. Los «C» (767 y 793) se dejan
  a propósito: la carrera dentro de la tanda paralela es el riesgo ya medido (`scrum814` corrió 393 s dentro frente a
  64 s solo, SCRUM-871). Los de dos o tres banderas, también fuera.

| fichero | grupo | casos que pasan a CI |
|---|---|---|
| scrum74-recibo-token | solo-H | 1 |
| scrum94-register-teammember | solo-H | 1 |
| scrum17-recapitulativa | solo-H | 1 (los otros 11 ya corrían) |
| scrum222-deriva-arranque | solo-H | 2 (los otros 21 ya corrían) |
| scrum76-email-adjunto | E | 1 |
| scrum207-emision-auditada | E | 2 (los otros 3 ya corrían) |
| **total** | | **8** |

- **Ninguno se negó a migrar.** 17 y 207 ya fijan `INVOICING_ES_ENABLED` en su merchant, y 222 sólo LEE
  `information_schema`: contra un banco nacido de `schema.prisma` el «en-sync» sale por construcción, y la mitad que
  importa es su gemela, la deriva inyectada que TIENE que verse (y se ve).
- 76 se salta solo si hay `RESEND_API_KEY`; en el banco local no la hay y corrió. Que CI tampoco la tenga lo dirá su log.
- La forma es la de §1599h: `_banco-libro.mjs` detrás de `_staging-db.mjs`, y `QA_DB_TEST` **o** `LIBRO_PG_URL`.
  El diff de cada test son 3 líneas (5 en 222 y 207, con dos saltos) más el bloque de la mutación.
- `scrum419`: 103 → 111 tests de banco.
- Carril: `carriles.mjs de` los ocho ficheros de test, ANTES de tocarlos → «sin fila en §3». Control positivo:
  `scripts/equipo/latido.mjs` → S5.

### ② Banco local

Banco de §1599h, sin cambios; `dist/` con `tsc --noCheck`. Canario cronometrado: scrum94 en 2,7 s.

| pasada | casos | pasan | caen | saltan |
|---|---|---|---|---|
| ANTES (los 6 de main, con `LIBRO_PG_URL`) | 43 | 35 | 0 | **8** |
| DESPUÉS (los 6 migrados) | 43 | **43** | 0 | 0 |

En los doce renglones, los casos de primer nivel suman el `# tests` declarado. Local: 34,5 s para los seis, banco
incluido. No predice CI.

**Seis mutaciones, una por fichero, en `MUTACIONES_CON_BASE`** (no en `MUTACIONES_QUE_ME_TUMBAN`, por lo de §1599i ⓪).
Antes de la tanda, un canario de una sola: 22,8 s. Resultado: **6 MUEREN, 0 VIVEN y 0 CIEGAS**; `dist/` restaurado byte
a byte. Cada `de` sale UNA vez en su fuente y cada `cae` casa con un solo caso (comprobado antes de correr).

| | fichero mutado | qué se muta | cae (aserción) |
|---|---|---|---|
| 74 | `receipt.routes.ts` | `/recibo/<id numérico>` resuelve el cobro | «GET /recibo/<id numérico> debe ser 404 y fue 200» |
| 94 | `auth.routes.ts` | la ruta cerrada contesta 201 en vez de 409 | «… debe dar 409 y fue 201» |
| 17 | `jobs.routes.ts` | la rotura por mes se queda con el primer grupo | «rotura → 2 facturas (marzo + abril)» |
| 222 | `schemaDrift.ts` | el catálogo mira otro esquema | «staging debería estar en sync; salió no-pude-comprobar» |
| 76 | `email.service.ts` | la factura sale sin adjunto | «el .eml de FACTURA CONTIENE el PDF adjunto» |
| 207 | `invoiceNumber.service.ts` | el registro apunta a otro número | el caso gateado del camino feliz (y su gemelo sin base) |

- **De paso, mi fallo, y lo que lo cazó.** La primera mutación de 94 quitaba la guarda de SCRUM-94 en
  `auth.service.ts` (el `if (teamMember && …)`), y **VIVIÓ**: 0 de 1 caen. No es el test: desde SCRUM-1515
  `/auth/register` contesta 409 `registration_closed` sin leer el cuerpo ni llamar al servicio, así que esa guarda no
  se alcanza desde la ruta. La cambié por la que el test SÍ vigila (el cierre de la ruta), y muere. Lo cazó el guion de
  mutaciones, que dice VIVE y sale con 2; sin él habría catalogado una mutación muda.
- **Lo que eso deja a la vista, sin medir:** la guarda de SCRUM-94 sigue viva en `registerMerchant`, que llama la CLI
  `altaDeMerchant.ts`. En `tests/` sólo dos ficheros nombran `email_belongs_to_team`: éste y `scrum1515`, que lo cita en
  un comentario. Si algún test la ejerce por la CLI, no lo he medido. Es del carril de auth, no de J6: se nombra aquí y
  en la entrega.
- 207 muta `invoiceNumber.service.ts`, que es camino de emisión. Lo que entra en el commit es un literal dentro del
  test; el src no se toca (regla 38). La mutación sólo se aplicó en el `dist/` local y se restauró.

### ③ El trinquete baja de 28 a 22

`tests/scrum1599f-los-que-solo-ve-staging.test.mjs`. Antes de editar la lista, con los seis ya migrados, cae (rc=1):
«SALEN: scrum17, scrum207, scrum222, scrum74, scrum76, scrum94», exactamente los seis, y «ENTRAN: —». Salen de
`SOLO_STAGING` y el número pasa a 22.

### ④ Coste y lo que queda

- **En CI:** sale del obligatorio de este PR comparado con un run de main de la misma hora, y va en el comentario de
  Jira (como en 1599f, h e i). Los lotes 1 y 2 quedaron por debajo del ruido entre runs, con n=1 por lado.
- **Los 22 que quedan** (lectura de banderas, no medición): 2 sencillos apartados (116 y 574) · 1 «solo-H» apartado
  (85) · 2 «C» (767, 793) · 4 «EC» · 8 «HE» · 3 «HEC» · 1 «HC» · 1 «MC». De una sola bandera ya sólo quedan los dos «C»
  y 85, que está apartado.

### ⑤ Guards

Los de suite (237, 976, 824, 836, 702, 700, 719, 1415, 419), los del banco (1599f, 876e, 876f), los del catálogo
(745, 757, 765, 1387) y 113, 740, 812, 850, 850b, 1185, 411 y 723: **24 ficheros, 234/234, 0 fallos, 0 SKIP** (las
líneas `ok` de primer nivel suman el `# tests` declarado). Los de registro, en el comentario de Jira.

### ⑥ Lo que NO se ha hecho, ni medido

- Staging: no he corrido los seis con `QA_DB_TEST=1` (sin turno).
- La tanda entera en local: NO CORRIDA (varias sesiones a la vez).
- Una pasada por punto.
- Que las seis mutaciones mueran también en el Postgres de CI: nadie las corre allí (§1599i ⓪).
