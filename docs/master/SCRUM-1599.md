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
