# SCRUM-876 · Los 16 «que necesitan un merchant sembrado»: medidos, sólo 3 lo necesitan

**Medido contra:** `origin/main` = `e62cd0db8876a4aef48139860b6072907caeca41` · 2026-09-16T13:02:06Z
**Rama:** `scrum-876-la-semilla-de-los-dieciseis` · **Carril:** `tests/` (Sesión 3) · **Gate:** sin gate

> Un gate no sólo apaga un test: le quita a su rotura la única forma de verse. Siete de estos 16
> llevaban semanas rotos, y ninguno necesitaba semilla para estarlo.

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
bifurca la cadena** —lo que la AEAT lee como manipulación—. Contra staging casi nunca empatan (la
latencia remota separa los sellos); en un banco local empatan siempre. Por eso este test estaba
verde donde se corría y rojo en cuanto se le quita la latencia.

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

**Siete de los 16 estaban rotos por cambios del propio código**, y el más antiguo lleva así desde el
**10-ago-2026**. Ninguno se vio porque ninguno corre: un test gateado roto y uno gateado sano dan el
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
