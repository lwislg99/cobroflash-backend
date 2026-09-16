# SCRUM-876 · Los 16 «que necesitan un merchant sembrado»: medidos, sólo 3 lo necesitan

**Medido contra:** `origin/main` = `e62cd0db8876a4aef48139860b6072907caeca41` · 2026-09-16T13:02:06Z
**Rama:** `scrum-876-la-semilla-de-los-dieciseis` · **Carril:** `tests/` (Sesión 3) · **Gate:** sin gate

> Un gate no sólo apaga un test: le quita a su rotura la única forma de verse. Seis de estos 16
> llevaban semanas rotos por cambios del propio código, y ninguno necesitaba semilla para estarlo.

⏱ Horas **de GitHub** (el reloj local va 333 s adelantado, medido el 16-sep-2026).

---

## 0 · La etiqueta de partida, y por qué se mide en vez de aceptarse

SCRUM-869 (Sesión 1) midió que de los 57 gateados por `QA_DB_TEST`, 41 pasan enteros contra un
banco pelado, y dejó los 16 restantes con la etiqueta **«necesitan un merchant sembrado»**. El
encargo de aquí: censar qué necesita exactamente cada uno, y decidir la forma de la semilla.

Antes de sembrar nada, la etiqueta se trató como **hipótesis**. Leídos, varios de los 16 apuntaban a
otras causas —una aserción de un formato que el código ya no emite, una lectura de la base sin
filtrar por merchant, variables de entorno—, y **una semilla que crece para tapar lo que no es suyo
es otra base de datos de nadie**.

⚠️ Y una corrección al enunciado: los 16 **no son todos de `QA_DB_TEST`**. `bot-suite` se gatea con
`BOT_SUITE_TEST`. Son 15 + 1.

## 1 · El instrumento, y su suelo

La clasificación sale de **experimentos controlados**, no de leer el mensaje. Cada fichero **SOLO**
—para que la contaminación entre tests no cuente— y **sobre una base recién creada** (sólo esquema,
ni un dato) antes de cada pasada:

| pasada | variación | si pasa aquí, era… |
|---|---|---|
| P1 | sólo el gate | **PASA** (o **BASE**, si la base no sirve) |
| P2 | + entorno WhatsApp/bot (todos los nombres que lee `src/`, valores de mentira, `WHATSAPP_DRY_RUN=1`) | **ENTORNO** |
| P3 | + flag de facturación (`INVOICING_ES_ENABLED`) | **FLAG** |
| P4 | + las dos | **ENTORNO+FLAG** |
| — | cae en las cuatro | **CON TODO** → se separa leyendo la aserción contra el código de hoy |

🔴 **El suelo va primero y puede parar el censo.** Cuatro ficheros FABRICADOS, uno por casilla (sin
semilla, sin base, sin entorno, sin flag). Si uno no cae en SU casilla, el instrumento se declara
CIEGO y no publica nada. Resultado: **4 de 4 en su casilla.**

Todo se hizo en un directorio desechable (`tests876/`, hermano de `tests/`) con **copias**, y una
copia de `_staging-db.mjs` de medición que sólo acepta loopback + base `_test`. Directorio y base se
**borraron al terminar**. `assertSafeStagingUrl` no se tocó: la copia de medición no la usa.

### ⚠️ La primera versión del instrumento tenía DOS defectos, y los dos eran míos

* **No copiaba `tests/fixtures/`**, y `scrum814-carrera-del-tramo` lanza un proceso hijo desde ahí.
  Salió como «falla» con `cjs/loader`, que es un error de mi montaje y no del test.
* **Su entorno de «runner» era corto** (3 variables) y mezclaba en una sola variación cosas
  distintas. Una causa mal atribuida es peor que ninguna.

La v2 corrigió los dos y **repitió todo**. Los números de abajo son los de la v2.

## 2 · EL CENSO: qué necesita cada uno, medido

**1 + 6 + 3 + 5 + 1 = 16.**

### A · Ya pasa — no necesita nada (1)

| fichero | medido |
|---|---|
| `scrum814-carrera-del-tramo.gated` | **3/3** solo sobre base pelada. Su caída en la medición conjunta no se reproduce aislado |

### B · 🔴 OBSOLETOS: el test asevera algo que el código de hoy ya no hace (6)

No les falta semilla: **fallarían igual contra staging**. Se rompieron mientras estaban gateados, y
por eso nadie lo vio.

| fichero | lo que dice | por qué está desfasado | roto desde |
|---|---|---|---|
| `albaran` | espera `/^ALB-\d{4}-001$/` | SCRUM-592 cambió el formato a `AB260001` | **4-sep-2026** |
| `scrum234-carrera-serie.gated` | «los números no son consecutivos (**F260001 y F260002**)» | lo son; su `seq()` parsea el formato de antes de SCRUM-780 | **7-sep-2026** |
| `scrum17-recapitulativa` | «número de serie FISCAL (no J-)» y recibe **`F260001`** | `F260001` **es** fiscal; la comprobación lee el formato viejo | **7-sep-2026** |
| `scrum781-concurrencia-de-la-factura` | asevera `/^\d{4}-QA-\d{3}$/` | prefijo por merchant retirado por el fundador (SCRUM-780, `CORTE_FORMATO_F` = 7-sep). Además lee `.env` a mano (`DATABASE_URL_DEV`) | **7-sep-2026** |
| `tenancy-permisos` | «PLACEHOLDER SIN SUSTITUIR `/admin/supresion/:merchantId`» | SCRUM-244 (1b) añadió esa ruta y el mapa del test no la conoce | **10-ago-2026** |
| `scrum72-pdfs-privados` | `invoicesDir is not defined` | SCRUM-844 movió el `import` al test que sacó del gate y dejó el gateado apuntando a una variable que ya no existe | **15-sep-2026** |

### C · SEMILLA de verdad (3)

| fichero | lo que dice | lo que necesita |
|---|---|---|
| `scrum52-operario` | `Foreign key constraint violated: team_members_merchant_id_fkey` | `const MERCHANT_ID = 1` escrito a fuego |
| `scrum13-cobrado` | `Foreign key constraint violated: customers_merchant_id_fkey` | `const MERCHANT_ID = 1` |
| `scrum692-guardado-parcial-en-base` | lo mismo, desde `customerAdmin.createCustomer` | `const MERCHANT = 1` |

Los tres dependen de **un merchant preexistente con id 1**: el demo de staging.

### D · Sin atribuir todavía: NO es semilla, y se dice (5)

| fichero | lo que dice |
|---|---|
| `scrum47-enviar-albaran-wa` | «técnico debe poder enviar (S1) y fue **404**» |
| `scrum68-evidencias-firma` | «firmar remoto → 200 (fue **409**)» |
| `scrum49-firma-remota` | «`sent` es la verdad del envío, no solo `ok`» → `sent: false` |
| `scrum50-bot-albaranes` | «acuse digno al cliente» → no llega |
| `bot-suite` | «se esperaba 1 mensaje en el buzón y el techo de 6000 ms venció» |

**Los cinco crean su propio merchant con `withMerchant`**, así que no les falta ninguna semilla. Y
**ni el entorno de WhatsApp ni el flag los cambian**. Su causa está por medir, y no se va a tapar
con una semilla que no les corresponde.

### E · 🔴 DEFECTO REAL — el test está bien, el código no (1)

`scrum173-cadena-verifactu-serializada` · «SCRUM-177: el alta siguiente a una ANULACIÓN encadena a
ELLA» → **«DOS CADENAS: el alta B saltó la anulación y encadenó al alta A»**. Solo y sobre base
limpia, así que no es contaminación. Ver §3.

## 3 · 🔴 El defecto de la cadena VeriFactu — medido, explicado, y NO tocado

SCRUM-177 (27-jul) fijó **una sola cadena**: tras una anulación, la siguiente alta encadena a la
anulación, porque el XSD de la AEAT no tiene cómo decir a qué cadena pertenece un eslabón. La lógica
está en el código; lo que falla es **cómo desempata**:

* `ultimaHuellaDeLaCadena` elige entre la última alta y la última anulación con
  `return tAnul > tAlta ? anulación : alta` — **`>` estricto: un empate lo gana el alta**
  (`src/modules/invoicing/domain/verifactu.service.ts:481`).
* Y los dos sellos se guardan **sin milisegundos**: `formatFechaHoraHuso(new Date())` escribe
  `hh:mm:ss` y se persiste como `new Date(timestamp)` (`verifactu.service.ts:66-75`).

**Una anulación sellada en el mismo segundo que su alta empata, gana el alta, y la factura siguiente
bifurca la cadena** —lo que la AEAT lee como manipulación—. En un banco local, sin latencia, empatan
y el test cae **de forma reproducible**. ⚠️ Que contra staging no empaten es una **inferencia, no una
medición**: la latencia remota separa los sellos, y eso explicaría que el test se diera por bueno
donde se corría. No se ha comprobado en staging.

⛔ **Es el camino de emisión fiscal: no se toca aquí** (regla 38 — arreglarlo exige GO del fundador).
Impacto hoy: `INVOICING_ES_ENABLED` está apagado para merchants reales, así que no hay emisión fiscal
real afectada; está en la ruta de SIF-1. **El test es correcto y es exactamente el que tiene que
caer**: desgatearlo antes del arreglo pondría la tanda en rojo.

## 4 · LA DECISIÓN: la semilla — NINGUNA

**No se siembra nada. Los 3 que la necesitan pasan a `withMerchant`.**

1. **Sólo 3 de 16 necesitan un merchant preexistente**, y los tres están cableados a `MERCHANT_ID = 1`.
2. **Ese merchant es el que la casa QUEMÓ a propósito** (SCRUM-42: lo dejó como placeholder inerte).
   Sembrarlo sería devolverle la vida a un id que se retiró con motivo.
3. **Esto ya se decidió una vez en esta casa, y así:** `bot-suite` y `a55` dependían del seed demo, y
   SCRUM-159 no los resembró — **los migró a `withMerchant`**, «no depende del seed, sobrevive a un
   reset de staging». Es el precedente exacto.
4. **`withMerchant` no deja poso** (SCRUM-869 §4.3: `merchants = 0` al terminar). Una semilla sí, y
   es de nadie en cuanto el primer test que la usaba cambia.

«¿Una compartida o una por familia?» tiene respuesta: **ninguna**, porque las familias que parecían
pedirla eran otra cosa (§2 B y D).

## 5 · Lo que esto dice de los gates, y es lo más valioso del censo

**Seis de los 16 estaban rotos por cambios del propio código**, y el más antiguo lleva así desde el
**10-ago-2026**. Y un séptimo, `scrum173`, tapaba un **defecto real** que sólo la latencia de staging
escondía (§3). Ninguno se vio porque ninguno corre: un test gateado roto y uno gateado sano dan el
mismo `skipped`. Es el hueco de SCRUM-869 §8.3 (la familia `QA_DB_TEST` no tiene trinquete) con su
coste ya medido.

## 6 · Las tandas que propongo (paso 3 — **no se ejecuta en esta rama**)

Por valor y coste, cada una en rojo y comprobada en el LOG de CI, y con la lección de SCRUM-871: lo
que se ahogue dentro de la tanda va a paso propio.

| tanda | qué | cuántos | nota |
|---|---|---|---|
| **T1** | `scrum814-carrera-del-tramo` | 1 | ya pasa; lo que falta es darle un destino desechable sin tocar la allowlist |
| **T2** | los 3 de semilla → `withMerchant` | 3 | patrón de SCRUM-159 |
| **T3** | los 6 obsoletos → aserción al código de hoy | 6 | cada uno probado en rojo: que caiga con el defecto que dice vigilar, no con el formato |
| **T4** | los 5 sin atribuir → medir la causa primero | 5 | no se desgatea nada sin causa |
| — | `scrum173` | 1 | **bloqueado hasta el GO del arreglo fiscal**; el test está bien |

⚠️ Para correr en CI todos necesitan además **un destino desechable** que su gate acepte: hoy entran
por `_staging-db.mjs` (allowlist + marcador). Darles ese camino **sin aflojar la allowlist** es parte
de cada tanda, como propuso SCRUM-869 §7.

## ⛔ No tocado

`src/` (tampoco el defecto de §3) · `tests/` · `tests/_staging-db.mjs` · `scripts/_db-guard.mjs` y
`assertSafeStagingUrl` · `.github/workflows/` · ninguna base del proyecto (todo contra un cluster
local desechable, bases borradas) · las dos mudas de SCRUM-866 (`scrum757`, `scrum859`).

## Lo que también entra en esta rama

La corrección del registro de **SCRUM-871** (§4): la evidencia leída en el log de CI del PR #1328 y
la cifra de `skipped` (bajó **1**, no 2). Arrastrada aquí porque el PR se mergeó antes de poder
leerla — no se abre un PR sólo para eso.

---

# APÉNDICE · SCRUM-876b · T1 — `scrum814-carrera-del-tramo` NO se desgatea, y está medido

**Medido contra:** `origin/main` = `e5e67c013db2c69fa1e4960e15f921e5abd69188` · 2026-09-16T13:19:26Z
**Rama:** `scrum-876b-el-tramo-en-su-banco` · **Tanda:** T1 · **Resultado:** queda gateado y declarado

> «Pasa contra un banco pelado» no es «vigila contra un banco pelado». Este fichero pasa 3/3 ahí,
> y también pasa 3/3 con el defecto que existe para cazar.

## Lo que se intentó

Darle a su gate un **segundo destino** sin aflojar el primero: `QA_DB_TEST=1` seguía yendo a
staging por `_staging-db.mjs`, y `TRAMOS_PG_URL` —el banco desechable que CI ya levanta para su
hermano `scrum814-carrera-de-tramos-postgres`, sin variable nueva— con su propio guard fail-closed
(loopback + base `_test`). Iba a correr en el paso aislado de CI, uno tras otro con su hermano.

Los guards que leen el fichero por texto quedaron verdes (`scrum814-carrera-de-tramos-postgres`,
`scrum814-recuento-dentro`, `scrum838`, `scrum419`: 16 ok, 0 fail, los saltos declarando su variable).

## 🔴 El rojo que NO salió

Mutando `dist/` —nunca `src/`— para reabrir la carrera que SCRUM-814 cerró (dentro de la
transacción, el tramo se decide con la cuenta leída FUERA, `existingInvoices.length`, en vez de la
serializada), contra el banco desechable y sobre base recién creada:

| | resultado |
|---|---|
| ① verde de referencia | 3 ok · 0 caídos · 0 SKIP |
| ② **con la carrera reabierta** | **3 ok · 0 caídos · 0 SKIP** — «dos peticiones simultáneas NO pueden emitir el MISMO tramo» sigue verde |
| ③ restaurado | 3 ok · `dist/` verificado byte a byte |

**Medido dos veces**: sobre un `dist/` compilado antes de que main cambiara `emisorCongelado.ts`, y
otra vez **recompilado sobre el código de la rama**. Mismo resultado.

**Así que su verde en ese banco no respalda nada.** Por la regla de suelo del encargo, se queda
gateado y declarado. El cambio del test y el de `ci.yml` se **revirtieron** y se comprobó que los dos
ficheros son idénticos a `HEAD`: esta rama no entrega ningún verde nuevo.

## Por qué no cae — y lo que está medido y lo que NO

No hay índice único que impida dos facturas del mismo tramo (`@@unique([merchantId, number])` es el
único del modelo), así que no es otra barrera tapándolo.

⚠️ **La explicación es una inferencia, no una medición:** la carrera es de **latencia**. Contra
staging cada consulta cuesta ~175 ms y las dos peticiones leen el presupuesto a la vez; contra un
banco local la emisión entera acaba antes de que la segunda lea, así que la segunda ya ve la factura
de la primera y la carrera no llega a existir. El suelo del test comprueba que las dos peticiones
**salgan** juntas (desfase ≤ 120 ms), no que sus **lecturas** se solapen. Es el mismo patrón que
documenta `scrum728` en su cabecera («en loopback no basta»).

El experimento que lo habría confirmado —imprimir bajo la mutación los tramos emitidos: si salen
«Anticipo + Final», no hubo carrera— **no llegó a hacerse**: la limpieza del temporal borró
`pgsql/share/timezone` y `pg_isready.exe` del banco local en plena sesión, y esa pasada dio 0/3 por el
banco, no por el test. Esa pasada no cuenta.

## Lo que esto le exige a T2, T3 y T4

**Cada desgateo necesita su rojo EN EL DESTINO donde va a correr.** Que un fichero pase contra el
banco desechable no dice nada si no cae ahí con el defecto que vigila. Y cualquier test de CARRERA es
sospechoso por construcción en un banco sin latencia.

Opción que **no** se ha hecho y es decisión del fundador: reproducir la latencia de staging con un
proxy TCP entre el test y el banco desechable. No toca `src/` ni ninguna base del proyecto, pero es
infraestructura nueva en CI.

## TRASPASO — el estado exacto para quien siga (16-sep-2026)

| tanda | estado |
|---|---|
| **T1** · `scrum814-carrera-del-tramo` | **cerrada**: gateada y declarada (este apéndice) |
| **T2** · `scrum52`, `scrum13`, `scrum692` → `withMerchant` | **sin empezar** |
| **T3** · 6 obsoletos | **sin empezar**. Cada cambio de aserción cita en el commit la decisión firmada (592 para `ALB-`, 780 para el formato de factura, 844 para el `import`). 🔴 `tenancy-permisos` va aparte: ANTES de tocarlo, medir si la ruta de supresión de SCRUM-244 filtra por `merchantId` (regla 2); si no filtra, es una fuga entre comercios y se para |
| **T4** · 5 sin atribuir | **sin empezar** |
| `scrum173` | no se toca: su causa es SCRUM-880 (STOP fiscal) |

**Para cada tanda:** rojo por fichero **en el destino donde va a correr** · los 41 que ya pasaban
siguen pasando · ningún «pass» que sea un salto, comprobado en el LOG de CI · si el destino
desechable no acepta el gate, el fichero se queda gateado y declarado. **No se toca:** `src/`,
`verifactu.service.ts`, `_staging-db.mjs`, ninguna base del proyecto, las mudas de SCRUM-866.

**El banco local está ROTO al cerrar esta sesión.** Faltan `pgsql/share/**` y `bin/pg_isready.exe`,
y quedan procesos `postgres` vivos que no aceptan conexiones nuevas. Para recuperarlo: parar esos
procesos, re-extraer `pgsql/bin`, `pgsql/lib` y `pgsql/share` del `pg.zip` guardado con
`[System.IO.Compression.ZipFile]`, y relanzar con `Start-Process` —nunca desde una tarea en segundo
plano: al terminar la tarea se lleva el servidor (SCRUM-871 §2)—.

**Los instrumentos vivían en el scratchpad de la sesión y se pierden con ella.** Su diseño está
escrito en el §1 de esta entrada (censo por experimento controlado, P1-P4, suelo de cuatro
fabricados) y en este apéndice (rojo mutando `dist/` con restauración por bytes).

---

# APÉNDICE · SCRUM-876c · PASO 0, PASO 1 y T2

**Medido contra:** `origin/main` = `4b0d5739bc19e7bad5109a32822ef7039d9ca860` · 2026-09-16T13:53:47Z (cabecera `Date:` de GitHub)
**Rama:** `scrum-876c-tres-a-withmerchant` · **Carril:** `tests/` (Sesión 3)

## PASO 0 · ¿Quién borró el banco? **Windows, no el repo** — medido

La sospecha era un script del repo borrando bajo el temporal compartido (SCRUM-864 acababa de entrar).
**No es eso.** Lo borró el **Sensor de almacenamiento de Windows**, y las cuatro medidas lo cuadran:

| medida | dato |
|---|---|
| configuración (`HKCU:\…\StorageSense\Parameters\StoragePolicy`) | `01` = 1 (activo) · `04` = 1 («borrar archivos temporales que mis aplicaciones no usan») |
| `StoragePoliciesLastTrigger` (FILETIME) | **15:25:01** hora local |
| log del cluster | último checkpoint sano **15:25:17**; primer `FATAL … share/timezone` a las **15:25:56** (13:25:56 GMT) |
| `mtime` de `Temp/pgt/pgsql` | **15:25:50** |

⏱ Horas del reloj LOCAL (va ~333 s por delante de GitHub): los cuatro sellos salen del mismo reloj, así
que su orden y su separación valen tal cual.

**Qué borra y qué no — y por eso parecía selectivo:**

* De `bin/` quedaron **13 ficheros: `postgres.exe` y sus DLL cargadas**, o sea exactamente lo que
  estaba **en uso**. Cayeron `pg_isready`, pero también `initdb`, `pg_ctl` y `psql`: el apéndice de
  SCRUM-876b sólo vio el primero.
* `share/` quedó **vacío** (nada de ahí lo tiene abierto un proceso).
* El criterio es la **antigüedad** (> 7 días), y aquí está la trampa: `ZipFile` conserva el `mtime`
  **de 2024** de cada entrada del zip, así que un banco extraído hace diez minutos **parece de hace
  dos años**.
* Control: en la raíz de `Temp` sobreviven **2** ficheros de más de 7 días de 446, y son `con.log` y
  `con.txt` — `CON` es un nombre reservado de Windows que el borrado normal no puede quitar.

**Scripts del repo:** `tests/_temporal.mjs` (SCRUM-864) sólo borra lo que crea su propio proceso
(`pendientes`), y los dos `readdirSync(os.tmpdir())` del árbol (`scrum864-el-temporal-que-se-borra` y
su evidencia `el-que-decide.mjs`) filtran por su prefijo y no borran lo listado. ⚠️ Esto es una
búsqueda por texto de quién LISTA el temporal, no un censo por AST de cada `rmSync`: lo que cierra la
pregunta es la coincidencia de los cuatro sellos de arriba, no esta búsqueda.

**Así que no es un defecto del repo y no hay nada que parar.** Es configuración de la máquina, y
queda anotado para el fundador: cualquier cosa de más de 7 días de `mtime` en `Temp` —bancos
extraídos de un zip incluidos— puede desaparecer en plena sesión. **Mitigación usada aquí:** banco en
el scratchpad con `LastWriteTime = ahora` en cada fichero al extraer (7 días de margen), puerto propio
(55876). **El cluster compartido de `Temp/pgt` + `Temp/pgb` no se ha parado**: es de varias sesiones
(SCRUM-809) y sigue sin aceptar conexiones nuevas.

## PASO 1 · 🔴 `tenancy-permisos`: la supresión **SÍ filtra** por merchant — medido corriendo

**Leído:** `supresion.routes.ts` compara `merchantId !== req.merchantId` y responde 404 **antes** del
`findUnique` (SCRUM-440). **Corrido**, contra el banco con `MERCHANT_DELETE_ENABLED=true` y dos
merchants de `withMerchant`:

| pasada | admin de A → suprimir B (con el nombre de B bien escrito) | control: B se suprime a sí mismo |
|---|---|---|
| código de hoy | **404**, B intacto | **200**, B anonimizado (el flag estaba encendido de verdad) |
| `dist/` sin la comparación | **200, B anonimizado** ← la fuga que la comparación impide | 409 (ya estaba borrado) |

`dist/` restaurado y comprobado por hash. **No hay fuga: el test estaba desfasado**, y su propio
mensaje decía el arreglo («Añade su reemplazo arriba, junto a `:invoiceId`/`:planId`»). Se añade
`:merchantId` → el merchant **propio** del técnico (el caso que importa: un técnico pidiendo suprimir SU
empresa tiene que dar 403 por el rol).

| pasada (copia de medición, banco local) | resultado |
|---|---|
| HEAD | cae: `PLACEHOLDER SIN SUSTITUIR "/admin/supresion/:merchantId"` |
| alineado | 2/2 |
| alineado, `dist/app.js` sin `requireRole('admin')` en la supresión | **cae**: `PERMISOS ROTOS: técnico obtuvo 404 en POST /admin/supresion/2 (esperado 403)` |

⚠️ Dos errores míos en el instrumento, dichos: la primera pasada de HEAD apuntaba a `t_HEAD_test` y
`psql` había creado `t_head_test` (sin comillas, minúsculas) — corrió contra una base inexistente y dio
2 caídos en vez de 1; y la primera mutación de `dist/app.js` **no entró** (los nombres compilados eran
otros) y dio un verde que no valía. Las dos se repitieron con la comprobación delante.

**Destino:** `tenancy-permisos` sigue **gateado por `QA_DB_TEST`** (staging), que esta sesión no puede
tocar. Su rojo está medido en el banco, **no en staging**: se queda gateado y declarado.

## T2 · `scrum13`, `scrum52`, `scrum692` → `withMerchant`, y a la tanda de CI

Los tres tenían `MERCHANT_ID = 1` (el demo que SCRUM-42 quemó). Ahora crean su merchant con
`withMerchant` (precedente SCRUM-159) y ganan un **segundo destino sin aflojar el primero**:

* `QA_DB_TEST=1` → staging por `_staging-db.mjs`, **igual que antes** (con esa variable, la nueva ni se lee).
* Si no, `LIBRO_PG_URL` —el banco que CI ya levanta para la tanda, **sin variable nueva**— con guard
  propio fail-closed: loopback y base `*_test`, o el fichero **cae** (comprobado: con un host ajeno cae;
  sin variable, `skipped`).

### El rojo, por fichero, en el banco local

Mutando `dist/` —nunca `src/`—, cada mutación comprobada con `grep -c` = 1 antes de correr, y `dist/`
restaurado por hash después:

| fichero | verde | defecto inyectado | rojo | poso |
|---|---|---|---|---|
| `scrum13-cobrado` | 1/1 | `recalcJobCobradoForJob` suma también las `pending` | `totalCobrado = 50` → **actual 100** | `merchants = 0` |
| `scrum52-operario` | 1/1 | `ensureJobForQuote` escribe `operarioId: null` | `operarioId = creador` → **actual null** | `merchants = 0` |
| `scrum692-guardado-parcial-en-base` | 1/1 | `updateCustomer` rellena `billing*`/`internalRef` a `null` | **HA BORRADO LA DIRECCIÓN DE FACTURACIÓN** | `merchants = 0`, `customers = 0` |

### El rojo, en CI — el destino donde van a correr

Run **35105775083**, job `build + tests (con banco desechable)`, sobre `2f2f53a5e247034e83ebcb5644c960ae61203b8a`
(leído en el LOG el 2026-09-16T14:14:49Z). Un paso temporal, colocado tras levantar el banco y antes de
la tanda, inyectó en `dist/` las tres mutaciones —cada una exigiendo casar **una** vez, y las tres
imprimieron `mutado:`— y corrió los tres ficheros contra `yaqu_libro_test`:

| fichero | en CI, con su defecto |
|---|---|
| `scrum13-cobrado` | pass 0 · fail 1 · skipped 0 — `totalCobrado = 50`: **actual 100** |
| `scrum52-operario` | pass 0 · fail 1 · skipped 0 — `operarioId = creador`: **actual null, esperado 1** |
| `scrum692-guardado-parcial-en-base` | pass 0 · fail 1 · skipped 0 — **HA BORRADO LA DIRECCIÓN**: actual null |

El paso se retiró en el commit siguiente (`47da81c9`), y `ci.yml` quedó **idéntico al de `main`**
(comprobado por hash de blob): esta rama no deja infraestructura nueva en CI.

⚠️ En ese mismo run cayó también `meta-guard · los guards caen cuando deben` por
`scrum859-identidad-y-motivo-cerrado · MUDO`. **No es de esta rama:** cae igual en `main`
(run 35102401285, sobre `4b0d5739`), y `scrum859` es una de las mudas de SCRUM-866, que no se tocan.
No es un check obligatorio (lo es sólo `build + tests`).

### Y el verde, dentro de la tanda de CI

⚠️ **Pendiente de leer, y se dice:** con el automerge armado y `build + tests` como único check
obligatorio, el push que lleva este registro se mezcla en cuanto pasa, así que su evidencia no cabe
aquí. Lo que hay que comprobar en el log del run de `build + tests` sobre la cabeza de esta rama: los
tres aparecen con ✔ y **sin** `# sin QA_DB_TEST=1 ni LIBRO_PG_URL` (un skip también se pinta como
pasado), y `scrum419` dice «`LIBRO_PG_URL` presente». Lo que sí está medido: en la suite local con
`LIBRO_PG_URL`, los tres pasan **dentro de la tanda paralela** (7.055 tests, fallaban sólo los 2 de
`scrum419` que pedían la declaración, ya hecha).

## TRASPASO — estado exacto al cerrar la Sesión 3 (16-sep-2026)

Cierro por tamaño de contexto (norma de ~300k), no por bloqueo.

| paso | estado |
|---|---|
| **PASO 0** · quién borró el banco | **cerrado**: Sensor de almacenamiento de Windows, no el repo. Nada que parar. Configuración de la máquina → fundador |
| **PASO 1** · supresión y regla 2 | **cerrado**: filtra (medido corriendo, con rojo). `tenancy-permisos` alineado, **sigue gateado** (staging) |
| **T1** · `scrum814-carrera-del-tramo` | cerrada en SCRUM-876b: gateada y declarada |
| **T2** · `scrum13`, `scrum52`, `scrum692` | **cerrada en este PR**: `withMerchant` + `LIBRO_PG_URL`, rojo en CI |
| **T3** · 5 obsoletos restantes | **sin empezar** (ver abajo) |
| **T4** · 5 sin atribuir | **sin empezar** |
| `scrum173` | no se toca (SCRUM-880, STOP fiscal) |

**T3, lo que queda:** `albaran` (cita SCRUM-592, formato `AB260001`), `scrum234-carrera-serie.gated`,
`scrum17-recapitulativa` y `scrum781-concurrencia-de-la-factura` (los tres citan SCRUM-780), y
`scrum72-pdfs-privados` (cita SCRUM-844, el `invoicesDir` que se quedó sin `import`). Tres avisos:

1. ⚠️ **`scrum234` y `scrum781` son de CARRERA.** Lo que T1 midió vale aquí: en un banco sin latencia una
   carrera puede no existir, y su verde no respaldaría nada. Alinear la aserción al formato de hoy sí
   se puede; **desgatearlos, sólo si caen con la carrera reabierta EN CI**. Si no, alineados y gateados.
2. `scrum781` además **lee `.env` a mano** (`DATABASE_URL_DEV`): eso es anterior al formato y hay que
   mirarlo antes de darle ningún destino.
3. El patrón de T2 está probado de punta a punta y se puede copiar: segundo destino `LIBRO_PG_URL` con
   guard fail-closed, declaración en `scrum419`, rojo en local mutando `dist/`, y **rojo en CI con un
   paso temporal que se retira en el commit siguiente**. Empujar PRIMERO el commit rojo: con el
   automerge armado por `pr-automatico.yml`, un primer push verde podría mezclar antes de tener la
   evidencia.

**T4:** los 5 crean su merchant con `withMerchant`; ni el entorno de WhatsApp ni el flag los cambian
(§2 D). Su causa está por medir y **no se desgatea nada sin causa**.

**El banco de esta sesión** vive en su scratchpad (puerto **55876**) y se pierde con ella. Para
rehacerlo: el `pg.zip` de la sesión `cba1b7dc…` seguía vivo el 16-sep; copiarlo al scratchpad propio,
extraer `pgsql/(bin|lib|share)` con `[System.IO.Compression.ZipFile]` **poniendo `LastWriteTime` = ahora**
a cada fichero (o el Sensor de almacenamiento lo borra), `initdb` y `pg_ctl` con `Start-Process`, y el
esquema con `migrate diff --from-empty` desde un worktree sin `.env`. Una base plantilla y
`CREATE DATABASE x_test TEMPLATE plantilla` por pasada da bases recién creadas en un segundo. ⚠️ Nombres
de base **en minúsculas**: `psql` las crea así sin comillas y la URL no perdona.
