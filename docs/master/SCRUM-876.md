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

---

# APÉNDICE · SCRUM-876d · El verde de T2, leído — y T3/T4 APARCADOS

**Medido contra:** `origin/main` = `364e7d3a267d8babc49a92244168dc12096ce996` · 2026-09-16T18:10:12Z (cabecera `Date:` de GitHub)
**Rama:** `scrum-876d-aparcado` · **Carril:** `tests/` (Sesión 3) · **Resultado:** T2 cerrada con su verde; ticket a «Por hacer»

## El verde de T2, dentro de la tanda de CI — leído en el LOG

Run **35108073567**, job `build + tests (con banco desechable)` (id `104834351937`), sobre
`e44e09caa68ba140a6ed1b4a55c9c8149111b133` — la cabeza del PR #1360, que entró en `main` con el merge
`71ebef052621b460d1ea89b46abf054942337115` (2026-09-16T14:30:21Z). Job en `success`; paso 11 («Por qué
cayó») `skipped`, como debe cuando la tanda no falla.

| lo que había que comprobar | lo que dice el log |
|---|---|
| `scrum13-cobrado` pasa **ejecutado**, no saltado | `✔ SCRUM-13/28: totalCobrado = Σ Invoices paid — webhook + manual, idempotente (453.842673ms)`, precedido de su traza `50/Parcial (webhook) → idempotente → 100/Pagado (Bizum manual)` |
| `scrum52-operario` idem | `✔ SCRUM-52: operarioId = quote.teamMemberId (+ null owner) + audit único + índice (412.565959ms)`, con su traza `operarioId poblado …` |
| `scrum692-guardado-parcial-en-base` idem | `✔ SCRUM-692 · guardar desde la ficha 360 no borra lo que sólo vive en el modal (407.861788ms)` |
| ninguno lleva el motivo de skip | `grep "sin QA_DB_TEST=1 ni LIBRO_PG_URL"` sobre el log: **0 líneas** (los saltados del log llevan el motivo viejo `sin QA_DB_TEST=1 · npm run test:staging:gated`, y ninguno de los tres está entre ellos) |
| `scrum419` ve el banco | `ℹ ✅ LIBRO_PG_URL presente: los 15 tests de banco SÍ se han ejecutado.` |
| la tanda entera | `tests 7065 · pass 6972 · fail 0 · cancelled 0 · skipped 93` |

Lo que haría este verde si el sistema estuviera roto ya está medido arriba: el run **35105775083** puso
los tres en rojo con su defecto inyectado **en el mismo destino**. Y la duración (400-450 ms cada uno,
frente a los ~0,1 ms de un skip) es coherente con que tocaron la base.

⚠️ El run acaba en `failure` por `meta-guard · los guards caen cuando deben`:
`✖ scrum859-identidad-y-motivo-cerrado.test.mjs · MUDO` — la misma muda de SCRUM-866 que ya caía en
`main` (run 35102401285). No es de esta rama ni un check obligatorio.

## T3 y T4: APARCADOS por decisión del orquestador (2026-09-16, 19:55 CEST)

Es orden de tests y ahora va antes el producto. El ticket vuelve a «Por hacer». **Nada de lo escrito
en el TRASPASO de 876c caduca con el aparcado**: los avisos de T3 (`scrum234` y `scrum781` son de
carrera; `scrum781` lee `.env` a mano) y la regla de T4 (no se desgatea nada sin causa) siguen siendo
el punto de partida para quien lo retome.

---

# APÉNDICE · SCRUM-876e · T3 (los dos que no son de carrera ni fiscales): `scrum72-pdfs-privados` y `albaran`

**Medido contra:** `origin/main` = `33f07c332c3c95fe1656f640184c5d340e519f5d` · 2026-10-07T06:28:00Z (cabecera `Date:` de GitHub)
**Rama:** `scrum-876e-obsoletos-al-banco` · **Carril:** `tests/` (Sesión 3) · **Resultado:** dos ficheros (tres tests gateados) con segundo destino y alineados; el resto de T3, T4 y el grupo C de SCRUM-868, sin tocar

A9: sin fallo que generalice — lo que salió al medir (el censo del 16-sep contó una causa por fichero y `albaran` tenía dos) es de aquel censo y queda dicho abajo

## Qué entra

| fichero | tests gateados | por qué caía contra un banco limpio | qué cambia |
|---|---|---|---|
| `tests/scrum72-pdfs-privados.test.mjs` | 1 | `invoicesDir is not defined`: SCRUM-844 se llevó el `import` al test que sacó del gate | el test gateado vuelve a importar `invoicesDir` |
| `tests/albaran.test.mjs` | 2 | ① esperaba `ALB-2026-001` y el código emite `AB260001` (SCRUM-592) · ② sus `PATCH` no mandaban `version`, y desde SCRUM-361 eso es un 409 antes de validar nada | el formato de hoy, y cada `PATCH` manda la versión que recibió |

Los dos ganan un **segundo destino sin aflojar el primero**, el mismo de T2: con `QA_DB_TEST=1` siguen yendo a staging por `_staging-db.mjs`; si no, usan `LIBRO_PG_URL`, el banco que CI ya levanta para la tanda. **Ninguna variable nueva y `ci.yml` no se toca.**

## El módulo nuevo: `tests/_banco-libro.mjs`

T2 escribió el bloque del segundo destino DENTRO de cada fichero. Aquí no se puede: `albaran.test.mjs` importa `dist/…/albaran.service.js` de forma estática, ese módulo construye el cliente de Prisma al cargarse, y en ESM los imports se evalúan antes que el cuerpo. Una asignación de `DATABASE_URL` en el cuerpo llegaría tarde. Por eso el bloque vive en un módulo que se importa el segundo, detrás de `_staging-db.mjs`.

Es el mismo criterio, con una barrera más: con **cualquiera** de los tres gates de staging puesto (`QA_DB_TEST`, `A55_DB_TEST`, `BOT_SUITE_TEST`) es inerte; el de T2 sólo miraba el primero. Los tres ficheros de T2 no se han movido a este módulo: siguen con su bloque propio.

Sus barreras las fija `tests/scrum876e-el-segundo-destino.test.mjs`, que corre siempre y sin base (ocho casos). Réplica local de sus mutaciones declaradas, con el lector del propio test (`evidencias/SCRUM-876e/replica.txt`): base sin mutar, ocho casos y cero caídos; las cuatro mutaciones tumban cada una su caso. El octavo caso (quien lo importa, lo importa antes de `dist/`) se vio caer moviendo el import de `albaran.test.mjs` detrás de los de `dist/` (`git diff --numstat`: 1 1), y se restauró.

## El rojo de cada test gateado, en el banco local

Mutando `dist/` y nunca `src/`. Cada mutación exige casar una vez y `dist/` se restaura por hash (`evidencias/SCRUM-876e/mutar-dist-876e.mjs`). Banco: Postgres 16.4 portable, loopback, base `yaqu_libro_test` creada con el DDL de `migrate diff --from-empty` (33 tablas, las del esquema).

| test | verde | defecto inyectado en `dist/` | rojo | poso |
|---|---|---|---|---|
| `scrum72` · PDFs no públicos | pasa | la ruta del PDF de factura deja de filtrar por merchant | «otro merchant no debe acceder al PDF»: 200 en vez de 404 | `merchants = 0` |
| `albaran` · SCRUM-14 tenencia | pasa | `findAlbaran` deja de filtrar por merchant | «PATCH … con sesión B debería ser 404 y fue 409» | `merchants = 0` |
| `albaran` · SCRUM-65 valorado | pasa | el candado del modo de valoración deja de mirar el estado | el `PATCH` tras emitir ya no da 409 | `merchants = 0` |

Y el defecto de partida, corrido hoy antes de tocar las aserciones: `scrum72` caía con `invoicesDir is not defined`; `albaran` con `AB260001` contra `/^ALB-\d{4}-001$/` en un test y con `409 !== 400` en el otro.

Los cuatro juntos contra el banco (`scrum876e`, `scrum419`, `scrum72`, `albaran`, en paralelo): 35 tests, 35 pasan, 0 saltados, `merchants = 0` al terminar. Sin `LIBRO_PG_URL`: los tres gateados salen `# SKIP` con su motivo. Con un host que no es loopback: los dos ficheros CAEN, no se saltan.

## Lo que el censo del 16-sep no vio

El §2 B de este registro da UNA causa por fichero. `albaran` tenía dos: la del formato, y los `PATCH` sin `version`. La segunda no salía porque el primer test caía antes y el segundo test del fichero no se miró por separado. Los otros obsoletos pueden tener lo mismo detrás de su primera causa: no se ha mirado.

## Lo que NO entra, y por qué

| qué | estado |
|---|---|
| `scrum17-recapitulativa` (T3) | sin tocar. Crea facturas de serie fiscal y sus merchants a mano (está en `MIGRACION_PENDIENTE` de `scrum113`, «con su dueño»). Antes de darle destino hay que medirlo solo contra el banco |
| `scrum234-carrera-serie.gated`, `scrum781-concurrencia-de-la-factura` (T3) | sin tocar. Son de carrera: lo dicho en el TRASPASO de 876c sigue valiendo |
| T4 (los cinco sin atribuir) | sin tocar: su causa sigue sin medir |
| Grupo C de SCRUM-868 (`a55-window-quote`, `bot-suite`) | sin tocar. `a55` exige `WHATSAPP_DRY_RUN=1` y la tanda de CI no lo pone (medido: `ci.yml` no lo nombra); darle el banco pide decidir si el propio test lo fija en ese destino |
| El verde y el rojo EN CI | el verde se lee en el log del `build + tests` de este PR: los tres con ✔ y sin `# sin QA_DB_TEST=1 ni LIBRO_PG_URL`. El rojo en CI con un paso temporal (como hizo T2) no se ha hecho: ese paso vive en `ci.yml`, que es de S5 |

## Reproducir

    node --test tests/scrum876e-el-segundo-destino.test.mjs
    LIBRO_PG_URL=<banco loopback, base *_test> node --test tests/scrum72-pdfs-privados.test.mjs tests/albaran.test.mjs

---

# APÉNDICE · SCRUM-876f · El grupo C de SCRUM-868: `a55-window-quote` y `bot-suite` al banco, en seco y con la salida cortada

**Medido contra:** `origin/main` = `725c0e3a1fff3409fdc2db2bdd493918cba5cec0` · 2026-10-07T07:42:50Z (cabecera `Date:` de GitHub)
**Rama:** `scrum-876f-a55-al-banco` · **Carril:** `tests/` (Sesión 3) · **Resultado:** los dos gateados del grupo C corren con `LIBRO_PG_URL`; `ci.yml` no se toca y no hay variable nueva

A9: sin fallo que generalice — la primera sonda de «bot-suite dentro de una tanda» no medía la tanda (55 vecinos que acabaron en 3 s y el bot corrió 17 s solo); se vio en sus propios tiempos antes de concluir nada, se repitió con 300 ficheros y queda dicho abajo

## El verde de 876e, leído en el log (lo que quedó pendiente)

Run `37583212357` (el `build + tests` de #2245, punta `f700f3bf`): `SCRUM-72: PDFs de factura y presupuesto no son públicos` ✔ 1.128 ms · `SCRUM-14: tenancy del albarán + lock de firmado` ✔ 1.365 ms · `SCRUM-65: albarán VALORADO` ✔ 425 ms. Ninguno con `# sin QA_DB_TEST=1 ni LIBRO_PG_URL`. En ese mismo log `A5.5` y `A8.4` salen saltados (`﹣`, 0,7 ms): es el antes de este apéndice.

## La decisión, y lo que se comprobó antes de aplicarla

SCRUM-868, comentario 18621 (orquestador): el propio test fija `WHATSAPP_DRY_RUN=1` cuando su destino es el banco, con tres condiciones.

| condición | qué se hizo | dónde se ve |
|---|---|---|
| La aserción se queda | `assert.equal(process.env.WHATSAPP_DRY_RUN, '1')` sigue siendo la primera línea del test; el fichero se pone la bandera en su cuerpo, sólo con destino banco | `tests/a55-window-quote.test.mjs` |
| Demostrar que ponerla surte efecto | El sender la lee EN CADA ENVÍO (`isDryRun` es una función). Corrido: sender cargado con la bandera ausente → `null`; puesta después → contesta en seco; quitada → `null` otra vez. Y el orden real del fichero se asierta con el estado del proceso (el sender no estaba cargado al fijarla; con su suelo: después de cargarlo la misma pregunta dice que sí) | `tests/scrum876f-el-seco-se-decide-al-enviar.test.mjs` (3 casos, sin base) |
| Lo que decide es que no salga la llamada | `tests/_sin-salida.mjs` corta `net.Socket.prototype.connect` para todo lo que no sea loopback y apunta host y puerto. Control positivo delante de cada uso: un POST de axios y un fetch a un host `.invalid` tienen que verse y cortarse, o lanza. Tras cada envío, y al acabar, lo apuntado que no sea del control tiene que ser `[]` | los dos tests gateados, y el caso 1 de `scrum876f` |

El corte sólo se instala con el banco como destino. Contra staging no: la base es remota y ese camino no se ha tocado. Límite dicho en el módulo: el motor de Prisma no pasa por ahí.

## Los rojos, en el banco local

Base sin mutar verde antes y después de cada serie; cada mutación exige casar una vez y se restaura por hash (`evidencias/SCRUM-876f/mutar-dist-876f.mjs`); `git status` vacío al terminar.

| test | defecto inyectado | resultado |
|---|---|---|
| `a55` | el fichero deja de ponerse la bandera (`tests/`, `numstat` 1 1) | ROJO en la aserción que se quedó: «este test exige WHATSAPP_DRY_RUN=1» |
| `a55` | con la bandera a `1`, el sender suelta un POST sin esperarlo, por fuera del punto único (`dist/`) | ROJO: «caso 1 … el envío INTENTÓ salir», dos intentos al host de Meta, puerto 443, los dos cortados. El envío seguía contestando `ok` y en seco |
| `scrum876f` (sin base) | la bandera se congela al cargar el sender (`dist/`) | ROJO: «la bandera, puesta después de cargar el sender, NO surte efecto» |
| `a55` | esa misma mutación | VERDE, y es lo esperado: el fichero la pone antes de cargar el sender. Por eso la lectura al enviar la fija el test sin base y no éste |
| `bot-suite` | el POST suelto de arriba | ROJO: «el bot INTENTÓ salir», 67 intentos al host de Meta, cortados |
| `bot-suite` | la confirmación de la baja al cliente lleva otro texto | ROJO: «confirmación de baja» |
| `bot-suite` | el profesional no recibe el aviso de la baja | ROJO sin veredicto: el techo de 6.000 ms vence esperando el aviso |

Las dos primeras filas de `scrum876f` van además declaradas en su `MUTACIONES_QUE_ME_TUMBAN` (la de `src/` y la del propio corte).

## `bot-suite`: medido solo y dentro de un tramo de la tanda

Contra el banco, con el gate cambiado en local, ANTES de decidir dónde corre.

| cómo | pasadas | resultado |
|---|---|---|
| solo, tal cual estaba | 4 | 4 caídas, las cuatro en el paso 11 (BAJA), a los 19 s |
| solo, con el paso 11 corregido | 3 | 3 verdes · 18,9 a 19,3 s · poso 0 |
| con sus 55 vecinos de la tanda | 1 | verde, pero NO VALE: los vecinos acabaron en 3 s |
| dentro de los 300 primeros ficheros de la tanda, concurrencia 3 | 1 | CAÍDA en el paso 8f a los 10,5 s; y una fila de `whatsAppMessage` que llegó después de la limpieza |
| lo mismo, con el paso 8f corregido | 2 | 2 verdes · 19,3 y 19,7 s |
| lo mismo, con los cuatro arreglos y concurrencia 7 | 3 | 3 verdes · 23,2 · 26,4 · 25,3 s · poso 0 |

En las seis pasadas por tramos `a55` salió verde. El único caído ajeno fue `scrum1321 · PUERTA 1b`, que en esta máquina cae siempre (temporal en `C:`, repo en `D:`).

**Lo que caía no era carga: eran cuatro sitios donde el test decidía por el reloj.** El bot hacía lo correcto en todos (sonda del buzón en el paso 11: primero la confirmación al cliente, después el aviso al profesional).

| paso | qué hacía el test | qué hace ahora |
|---|---|---|
| 11 · BAJA | leía `last()`; la baja manda dos mensajes y «el último» era ya el aviso al profesional | busca lo que le llegó AL CLIENTE desde su BAJA: una respuesta, y con el texto de la confirmación |
| 8f · enviar la solicitud | asertaba el aviso al profesional en cuanto llegaba el primer mensaje | espera a esa condición (`esperarCondicion`, techo 6 s; vencido, no hay veredicto) |
| 8g · cancelar | esperaba un mensaje y asertaba dos | espera los dos |
| 11 · final | acababa sin esperar el aviso de la baja al profesional, cuya fila podía llegar tras la limpieza | espera el aviso y a que el buzón quede quieto |

**Dónde corre: dentro de la tanda, con `LIBRO_PG_URL`, sin paso propio.** Con qué se decide y qué no cubre: cinco pasadas verdes de cinco dentro de un tramo de 300 ficheros, en esta máquina (8 hilos), contra un Postgres de loopback. No es la tanda entera (1.270 ficheros) ni el runner de CI. El precedente de `scrum814` (un paso propio en `ci.yml`) era otro mecanismo: una transacción que vencía a los 5 s bajo carga; aquí el bot tardó entre 19 y 26 s con techos de 6 s por paso, y ningún techo venció. Si en CI cae o parpadea, la salida es sacarlo de la tanda (volver a su gate) y pedir el paso propio en `ci.yml`, que es de S5.

## Lo que NO entra

| qué | estado |
|---|---|
| El camino de staging (`A55_DB_TEST`, `BOT_SUITE_TEST`) | sin correr: no cambia de destino ni de gate, pero los cuatro arreglos de `bot-suite` también corren ahí y esa tanda no se ha lanzado |
| El rojo EN CI con un paso temporal | no hecho: ese paso vive en `ci.yml` (S5). El verde en CI se lee en el log del `build + tests` de este PR: `A5.5` y `A8.4` con ✔ y con duración |
| `scrum17`, `scrum234`, `scrum781` y T4 | sin tocar, igual que en 876e. Ojo para T4: `bot-suite` estaba en esa lista como «causa sin medir» y su causa era ésta |

## Reproducir

    node --test tests/scrum876f-el-seco-se-decide-al-enviar.test.mjs
    LIBRO_PG_URL=<banco loopback, base *_test> node --test tests/a55-window-quote.test.mjs tests/bot-suite.test.mjs

# APÉNDICE · SCRUM-876f (segunda parte) · El obligatorio de #2255 cayó: al merchant efímero le tocó el id del demo

**Medido contra:** `origin/main` = `5f1bb361ae5b6b0d720b28b54c624f5d8483ff3b` · 2026-10-07T15:06:27Z
**Rama:** `scrum-876f-a55-al-banco` · **Carril:** `tests/` (Sesión 3) · **Resultado:** `withMerchant` no entrega nunca el id 1; `ci.yml`, `src/` y los dos tests gateados no cambian

A9: comprobación → `tests/merchant-fixture.test.mjs`

## Qué dijo el juez

Run `37590893205` (el `build + tests` de #2255, punta `491ed48b`): 10.827 tests, 1 caído.

| test | resultado en el log |
|---|---|
| `A8.4: suite completa del bot` | ✔ 18.680 ms, merchant efímero 4 |
| `A5.5: ventana abierta → envío por SESIÓN` | ✖ 393 ms, `false !== true` en `closed.ok` (línea 138), merchant efímero **1** |

Justo delante del ✖, el sender dice: `V0-2: envío desde el merchant demo … BLOQUEADO (no está en DEMO_SAFE_NUMBERS)`. El corte de salida no apuntó ningún intento: el envío no llegó a intentarse.

## La causa

El banco de CI se crea vacío en cada run. El primer merchant que nace en él recibe el id 1, que es el demo (regla 8), y el producto le aplica sus frenos a propósito. Le toca al fichero que llegue antes: en ese run fue `a55`. `bot-suite` pasó porque recibió el 4, no porque fuera inmune.

**Mi fallo:** di por bueno el verde local sin mirar en qué se diferenciaba mi banco del de CI. La secuencia de `merchants` del mío iba por 225; en CI empieza en 1. Las «5 de 5 dentro de un tramo de 300» del apéndice de arriba medían la carga, y este defecto no depende de la carga.

## El arreglo, y por qué en el fixture

`tests/_merchant-fixture.mjs`: si el merchant recién creado es el demo, `withMerchant` lo borra y crea otro. La secuencia ya ha pasado del 1, así que ocurre como mucho una vez por banco. Va ahí y no en `a55` porque el defecto no es de `a55`: es de cualquier fichero que use el fixture y llegue el primero.

Lo que NO cubre: los ficheros que crean su merchant a mano, sin `withMerchant`, contra el banco. Si a uno de ésos le toca el id 1, sigue siendo el demo. No los he censado.

## Los rojos

Banco local (Postgres 16.4, loopback), secuencia de `merchants` reiniciada a 1 antes de cada pasada.

| qué se corre | fixture | resultado |
|---|---|---|
| `a55` | el de #2255 (`491ed48b`) | ROJO, el de CI: línea 138, mismo aviso V0-2, merchant efímero 1 |
| `a55` | con el arreglo | VERDE, merchant efímero 2 |
| `merchant-fixture.test.mjs` (sin base) | arreglo anulado (`numstat` 1 1) | ROJO en 2 de 13: «NO entrega el id del demo» y «si el segundo también nace demo» |
| `bot-suite` | arreglo anulado | ROJO, merchant efímero 1, `V0-2: lista desde el merchant demo … BLOQUEADA` |
| `bot-suite` + `a55` + `merchant-fixture` | con el arreglo | VERDE, 15 de 15, merchants efímeros 2 y 3, poso 0 |

Restaurado con `git restore --source=HEAD`; `git status` vacío después.

## Reproducir

    psql -d <banco> -c "alter sequence merchants_id_seq restart with 1"
    LIBRO_PG_URL=<banco loopback, base *_test> node --test tests/a55-window-quote.test.mjs
