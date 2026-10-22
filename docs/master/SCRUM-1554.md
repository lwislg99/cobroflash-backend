# SCRUM-1554 · Puerta de go-live

## 22-oct-2026 · SCRUM-1554f · ¿Está COMPLETA la puerta? Censo de lo que falta — PROPUESTA, no toca `puerta.json`

**Medido contra:** `origin/main` = `808af5b4466d2649a1006d4c554d1f22e7eba47c` · 2026-10-22T10:15Z (`Date:` de
`gh api -i zen`). S0, equipo de Luis, por encargo del orquestador. Sólo lectura: no se ha tocado `puerta.json`,
ni su test, ni `.claude/carriles.json`, ni ninguna etiqueta de Jira. **El contenido de la puerta lo firma el
fundador; esto es una propuesta.**

> Este tramo va ARRIBA, no al final, a propósito: 1554d y 1554e añaden al final de este mismo fichero en la
> rama `scrum-1554e-redactar-17-y-18`, que aún no está en `main`. Escrito arriba, las dos ramas se unen sin
> conflicto (A17: no se apila).

A9: sin fallo que generalice — los tres falsos positivos por subcadena del cruce se cazaron leyendo cada entrada antes de escribir, y quedan dichos abajo

### La respuesta corta

**La puerta NO está completa, y el motivo no son entradas sueltas: mide otra cosa.** Por su definición
(regla 43, descripción de SCRUM-1554) es la lista de **lo que hoy es FALSO porque aún no está construido**
—textos, promesas—. Pero `puerta.json` se presenta como «lo que tiene que ser verdad antes de encender
`INVOICING_ES_ENABLED`», y para eso le falta **la condición que el propio máster pone a ese interruptor**:
SIF-1 v2 con las 8 en ✅ (Parte P, fila del flag; U1.3, «Solo con 8/8 ✅»; regla 24; B2.1). **Ninguna de las 23
entradas la nombra.**

- **De lo que ya mide (falsedades de texto):** no he encontrado ningún hueco nuevo de esa clase fuera de los ya
  conocidos (`terminos.html:79-80`, de 1554d). Eso NO quiere decir que no los haya: no he barrido textos.
- **De lo que dice medir (condiciones previas al interruptor):** **9 que faltan**, más 1 que el instrumento no
  puede ver (el valor real del flag en producción). Las piezas fiscales sueltas (declaración responsable,
  productor, asesor, AEAT) ya viven en otra lista —U1.3 del máster— y se cubren con UNA entrada (F1) que la cite.

### Cómo elegí la población (y qué NO miré)

**Jira**, cuatro consultas, todas con su recuento devuelto por la propia API (`searchResultMode: all`):

| consulta | recuento | qué trae |
|---|---|---|
| `labels = "go-live"` (todas, abiertas y cerradas) | **2** | SCRUM-1554 (la propia puerta) y **SCRUM-1566** |
| `labels in ("puerta", "golive", "go_live", "antes-sif1", "antes-de-sif1", "pre-sif1", "sif-1", "sif1", "bloquea-go-live", "go-live-bloqueante", "lanzamiento")` | **27** | 5 de **ROAD** con etiqueta `puerta` (ROAD-4, 5, 6, 12, 19) y 22 con `sif-1` (13 abiertas) |
| `labels in ("parado-hasta-go-live", "hasta-go-live", "antes-go-live", "pre-go-live", "go-live-pendiente", "bomba-con-fecha")` | **5** | SCRUM-1028 (`parado-hasta-go-live`), 1226, 1258, 1316, 1330 |
| texto: `"go-live"`, `"puerta de go-live"`, `"antes de SIF-1"`, `"antes de encender"`, `"primer negocio/cliente/merchant real"`, `"primer euro"`, `"INVOICING_ES_ENABLED"` en resumen, abiertas | **12 + 14 + 10** (con solape) | SCRUM-41, 143, 523, 534, 665, 678, 870, 1016, 1028, 1236, 1509, 1536, 1551, 1552, 1573… |

⚠️ **La etiqueta `go-live` no es una población:** sólo la llevan 2 tickets, y uno es la propia puerta. Las
etiquetas de esta casa no se eligen de un vocabulario cerrado (SCRUM-1554b ya midió que «la etiqueta miente en
25 de 57»), así que las variantes de arriba son **las que se me ocurrieron**: una etiqueta con otro nombre no
sale. Lo que sale con `labels in (…)` de una etiqueta que no existe es 0, igual que una que existe y está vacía.

**Máster** (`git show origin/main:docs/YAQU_MASTER.md`): reglas 7 de CLAUDE.md, 17, 18, 24, 25, 26, 28, 29, 32
y 33 de la Parte I; B2 (checklist regulatorio España); la fila de `INVOICING_ES_ENABLED` de la Parte P; la
**excepción The Pioneer** (Parte P); y U1.3. **CLAUDE.md:** los siete STOP.

**NO miré:** los textos servidos (landing, panel, PDFs, bot) en busca de falsedades nuevas · el cuerpo de
SCRUM-1264 (la lista del asesor) · el estado real de cada ticket candidato en `main` más allá de un
`git log --grep` (se dice en cada fila).

### El instrumento, y sus controles

El cruce condición → entrada es `cruce-puerta.mjs` (en el temporal de esta tanda, no en el repo): busca las
claves de cada condición (números de ticket y palabras) en `que`, `de_donde`, `consta_en` y `condicion` de las
23 entradas.

- **Controles positivos, los tres encontrados:** SCRUM-1558 / `sendInvoiceEmail` → **23** ✔ · SCRUM-418 →
  **21** ✔ · «Cobro integrado» → **2** ✔.
- **Control negativo:** una clave inventada → **0** ✔.
- Salida: `población: 23 entradas · condiciones: 26 (4 de control) · fallos de control: 0 · EXIT=0`.
- 🔴 **El instrumento da falsos positivos por subcadena, y los he quitado A MANO leyendo la entrada:**
  `scrum-41` casaba con la 21 (es `scrum-418`) · «llamada» casaba con la 13 (es «llamada final» de la landing,
  no la llamada al Pioneer) · «asesor» casaba con la 3 (es «[REVISAR ASESOR]» del documento legal, no las
  respuestas de SCRUM-1264). **Un «casa» de este cruce no es un «está»: se lee.**

### 1 · Etiquetados frente a la puerta (las dos direcciones)

**Etiquetados que NO están:** **SCRUM-1566** (`go-live`), confirmado: ni su número ni «céntimo» ni «redondeo»
aparecen en las 23. Y, con etiqueta equivalente, **ROAD-6** (`puerta`: «Copia de seguridad probada, no solo
configurada»), que es exactamente el hueco del respaldo que midió S5. ROAD-4 (la SL), ROAD-5 («Hacienda
resuelta»), ROAD-12 y ROAD-19 son puertas **de negocio** de otro proyecto (ROAD-12 y 19 son posteriores al
primer negocio, por definición). **SCRUM-1028** (`parado-hasta-go-live`) sí está, sin su número: es la misma
materia que la entrada 2 (SCRUM-1551).

**Entradas sin ticket propio:** **18** («no lo dice el comentario»; 1554e lo encontró: SCRUM-619, 623, 624) ·
**19** («no lo dice el comentario»; 1554d lo encontró: SCRUM-1428 c.18325) · **20** (sólo una ruta de fichero) ·
**10** (apunta a la propia SCRUM-1554). Las otras 19 citan un ticket de origen.

### 2 y 3 · Las condiciones que faltan, en la tabla

«¿En la puerta?» es el cruce de arriba **leído**. «¿Etiqueta?» es si el ticket lleva `go-live` o una de las
equivalentes de la población. «De quién» sale de las etiquetas de área del ticket; donde no hay ticket, del
máster.

| # | condición | ¿en la puerta? | ¿ticket con etiqueta? | cómo se mediría | de quién sería |
|---|---|---|---|---|---|
| F1 | **SIF-1 v2 con las 8 en ✅** (S1-0…S1-H). Es LA condición del interruptor en la Parte P, U1.3 y la regla 24. Hoy U1.3 dice S1-D 🟡, S1-E 🟡, S1-F ⏳, S1-G ⏳, S1-H 🟡 | **NO** | sí, `sif-1` en sus piezas (13 abiertas); ninguna `go-live` | la línea de resumen de SIF-1 (U1.3) del máster con las 8 en ✅; SCRUM-1323 ya construye el guard que impide que resumen y detalle se contradigan | fundador + equipo de Javier (J1); la entrada la escribe quien mantenga la puerta |
| F2 | **1566 · base + IVA = total** (22,50 € al 21 % da 4,72 y no 4,73; sale en la `CuotaTotal` del XML) | **NO** | **sí, `go-live`** | un test que, para 22,50 € al 21 %, espere cuota 4,73 y base + cuota = total | J1 (`area-j1`), con STOP del fundador |
| F3 | **Regla 29 · una factura sellada no se re-sella** (SCRUM-1330) | **NO** | `sif-1`, `bomba-con-fecha` | `tests/scrum1330-una-sellada-no-se-resella.test.mjs` existe en `main` y el PR #2053 entró; Jira la tiene «En curso». **No lo he corrido**: si ya está, la entrada nace cerrada | J1 |
| F4 | **Regla 29 · el PDF de una emitida no se regenera con el código y los datos de hoy** (SCRUM-665) | **NO** | ninguna | hay `tests/scrum665a/b/e-…` en `main`; Jira «En curso». Se mide con el PDF de una emitida servido igual antes y después de cambiar los datos del negocio | J1 |
| F5 | **Regla 28 · los recordatorios de cobro respetan J6** (SCRUM-1509; 1508). Con el interruptor en OFF no hay recordatorios (regla 24): **encenderlo es lo que los despierta**. 1554b ya escribió que «bloquean el go-live» | **NO** | `stop-fundador`; ninguna `go-live` | el caso de 1509 (escritura que falla en silencio → 48 plantillas en 48 pasadas) devuelve 1 | J2 (`area-j2`) |
| F6 | **Excepción The Pioneer** (Parte P): llamada hecha **y anotada** antes de encender; encendido sólo por la llave `cambiar-flag-fiscal.mjs`, por merchant; **la variable global sin tocar**; caduca el 31-ene-2027. Si el primer negocio real es él, **esta** es su puerta y no la 8/8 | **NO** | ninguno | fila `cambio_flag` en el AuditLog para ese merchant + la nota con fecha de la llamada en el apartado de la Parte P + `INVOICING_ES_ENABLED` sin definir en Railway | fundador |
| F7 | **Copia de seguridad de producción probada** (restaurada, no sólo configurada) | **NO** (S5: 0 coincidencias) | **sí, `puerta` (ROAD-6)** | una restauración con fecha, a una base desechable, con su recuento de filas | fundador (Railway) |
| F8 | **El cierre en ejecución** (mitad B de 1554c): con una entrada abierta, el interruptor no se enciende. Hoy ni `puerta.mjs` ni la llave lo impiden: la llave no lee la puerta (`scripts/cambiar-flag-fiscal.mjs`, sin ninguna referencia a ella) | **NO** | no | interruptor en ON + una entrada abierta → `isFlagEnabled` da `false` (lo que 1554c B ya describe) | S5, con GO del fundador (flag global de la Parte P) |
| F9 | **Regla 33 nueva · el alta excluye forales y Canarias** (SCRUM-1536, decisión del 22-oct, c.20218/c.20225) | **NO** | no | un alta con provincia foral o canaria no crea merchant (test del alta) | equipo de Javier (`area-fiscal`) |
| F10 | **El valor REAL de `INVOICING_ES_ENABLED` en producción** (SCRUM-1097; 1109 lo quería automático) | **NO** | `sif-1`, `stop-fundador` | el guard de 1097 contra producción. ⚠️ **No se puede medir desde un árbol** (SCRUM-418: ningún worktree tiene credenciales de producción) | fundador |

**Lo que he mirado y NO propongo como entrada nueva**, con su motivo:

| condición | por qué no |
|---|---|
| Declaración responsable publicada (regla 17, S1-E, SCRUM-523) · nombre real del productor en el XML (SCRUM-870) · revisión del asesor y anticipos/IVA (S1-F, regla 32) · producción AEAT con una factura real (S1-G) | **caen dentro de F1**: son piezas de las 8. Repetirlas aquí serían dos listas que divergen |
| La SL (ROAD-4, SCRUM-143) | ROAD-4 dice «NO bloquea VeriFactu: hay Modelo C»; lo que sí bloquea (el productor, la vía de colaborador social) cae en F1 |
| Tarjeta sólo con Connect (reglas 18 y 23) | ya está la 11 (el texto «Tarjeta»), y la regla la hace cumplir un flag que está en OFF (`PAYMENTS_CONNECT_ENABLED`) |
| Stripe en live (SCRUM-41) y secretos de webhook (SCRUM-678) | son para cobrar la suscripción a YaQu o la tarjeta, no para el interruptor de facturación. Si la puerta pasa a ser «antes del primer negocio real» en general, entonces sí |
| Guion H2 (regla 26) | la 1 viene de SCRUM-534, que es justo el ticket del H2. No he comprobado si cubre las dos falsedades del H2 o sólo los literales de P2 |
| Privacidad + DPA publicadas antes del primer pagante (B2.4) | hay texto (`public/privacidad.html`; `docs/legal/RGPD_TRATAMIENTO_DATOS.md`, 21 menciones de encargado del tratamiento). **No he medido** si está publicado ni revisado: es una pregunta, no un hueco |
| Plantillas de WhatsApp de factura y recordatorio aprobadas en la WABA de producción (STOP de Meta) | **no medido**: no se ve desde el repo |

### Lo que esto pide decidir (es del fundador, en la revisión)

1. **¿Qué es la puerta: la lista de falsedades (regla 43) o la lista de lo previo al interruptor?** Hoy es la
   primera con el nombre de la segunda. Si es la segunda, F1 es la entrada que falta, y basta UNA que cite U1.3.
2. **¿Quién es el primer negocio real: The Pioneer, con su excepción (F6), o uno cualquiera tras el 8/8 (F1)?**
   Las dos puertas son distintas, y la puerta de hoy no tiene ninguna de las dos.

### Anexo (misma tanda, 10:24Z según Jira, c.20283; pedido por el orquestador) · Las otras puertas: no son dos, son CUATRO

**Población:** ROAD-4, 5, 6, 12 y 19 leídas enteras (descripción, comentarios, autor, fechas); `project = ROAD`
entero (**56** tickets); `project = ROAD AND updated >= 2026-09-01` → **0**, con control positivo: el mismo
proyecto sin el filtro de fecha devuelve 56, y el más reciente es ROAD-56, del 20-ago. En el repo,
`git grep -i "scrum-390"` en `src/ scripts/ tests/ .github/` → 6 ficheros, y se leyeron los dos de `src/`.

**Las cinco de ROAD.** Las creó la cuenta de Javier el **14-ago-2026, entre las 20:27 y las 20:29**. Son
épicas de un plan por etapas (ROAD-1 «Poner la casa en orden», ROAD-2 «El primer usuario», ROAD-3
«Repetirlo»). La última edición de cualquiera de ellas es del 19-ago. Son **de antes de los dos equipos**:
`docs/equipo/` nace el 7-sep (`1e8014a0b`) y `dos-equipos.md` el 18-sep (`5e9096f7a`). Es el mismo caso que
los dos ficheros de `scripts/` sin dueño.

| ROAD | qué exige («Hecho =») | ¿en `puerta.json`? | ¿en algún ticket SCRUM? | estado |
|---|---|---|---|---|
| **4** · La sociedad existe | escritura + CIF + cuenta a nombre de la SL. Dice que NO bloquea VeriFactu (Modelo C), y que la SL hace falta para el Modelo A y para Stripe en live | no | SCRUM-143 (Acción del fundador), SCRUM-870 (el productor espera el NIF de la SL), SCRUM-41 | **sin empezar**, en lo que consta en Jira (los fundadores decidieron reparto y objeto social el 17-ago) |
| **5** · Hacienda resuelta | «respuesta escrita a todas, dada por alguien que responde de ella»: ventana sin VeriFactu hasta enero (contestada el 17-ago), y ABIERTAS la fecha exacta, si YaQu factura al profesional, el IVA de la suscripción, si YaQu toca el dinero, cuántos años se conservan las facturas, el contrato de encargado del tratamiento | no | en parte: SCRUM-1264 (la lista del asesor) y la entrada 18 de la puerta. **No he comprobado** cuáles de las cinco abiertas están en 1264 | **a medias** (1 de 6 contestada) |
| **6** · Copia de seguridad probada | las cuatro: copia automática · se sabe cada cuánto y cuánto se guarda · restaurada en un entorno aparte · escrito quién la restaura y cómo | **no** | **SCRUM-242** (Finalizada, cerrada por una de sus cuatro partes) → **SCRUM-1525** (Por hacer: «la COPIA no se dispara») | **a medias**: según el código, la restauración está probada (§R14, `scripts/backup-restore.mjs`) y la copia no existe. En `src/core/cron/cron.ts`, `.github/` y `package.json` hay **0** referencias a `backup`; el control, `avisarSiEntroClienteReal` en `cron.ts`, sale 3. Si se lanza desde Railway, no se ve desde aquí: **no medido** |
| **12** · Un profesional real ha hecho el ciclo entero | filas en producción de un profesional que no es ninguno de los dos fundadores, con presupuesto → firma del cliente → **factura emitida desde YaQu**, y el cobro fuera de YaQu (redacción del 19-ago, ROAD-37) | no | ninguno | **sin empezar**. 🔴 **No es una condición previa: es el RESULTADO.** Exige que el interruptor ya esté encendido para ese merchant |
| **19** · Usuarios 2 y 3 cobrando sin captación uno a uno | dos profesionales más cobrando, y que la respuesta a «¿cómo se enteró?» no sea «nos lo dijeron» | no | ninguno | **sin empezar**. Es posterior al primer negocio real por definición |

**🔴 La puerta que nadie había nombrado hoy, y que SÍ corre en producción: SCRUM-390,
`src/modules/system/domain/puertaClienteReal.ts`.** La evalúa el cron diario (`src/core/cron/cron.ts:97`) y
se abre sola con dos señales: un merchant con suscripción de Stripe, o más merchants que las
`CUENTAS_DE_PRUEBA_DECLARADAS` (= 13). Al abrirse manda un WhatsApp al fundador con sus cláusulas
(`avisoPuerta.service.ts:26-44`). Son cuatro: la regla fechada de los datos de producción del máster, el
backfill de `MIGRATIONS_PENDING.md`, la microcopy de Bizum de SCRUM-402 y **«SCRUM-242 — hay copia de
seguridad de la base (restaurar ya está probado; la COPIA no existe)»**. ⇒ **El respaldo SÍ estaba en una
puerta: en ésta.** El «0 coincidencias» de S5 es cierto para `puerta.json` y no para el proyecto.

**¿Son la misma lista con dos nombres? No. Son cuatro listas, y cada una salta con otra cosa:**

| lista | qué contiene | qué la dispara | ¿mecanismo? | desde |
|---|---|---|---|---|
| **A** · `docs/go-live/puerta.json` (SCRUM-1554) | textos falsos hasta que esté construido (regla 43) | encender `INVOICING_ES_ENABLED` | un guard de CI que sólo comprueba que la lista está bien formada; la mitad B no está construida | 14-oct |
| **B** · `puertaClienteReal.ts` (SCRUM-390) | 4 decisiones tomadas «mientras no haya cliente real», el respaldo entre ellas | detecta que ha entrado el primer cliente real (paga, o hay más de 13 merchants) | **SÍ**: cron diario + WhatsApp. Avisa, no impide | 9/10-ago |
| **C** · U1.3 del máster (SIF-1 v2, 8/8) | lo fiscal: AEAT, declaración, asesor, evidencias | encender `INVOICING_ES_ENABLED` a reales | ninguno: texto | jun |
| **D** · ROAD, etiqueta `puerta` | hitos de empresa por etapas (SL, Hacienda, respaldo, primer usuario, usuarios 2-3) | ninguno | ninguno; dormido desde el 20-ago | 14-ago |

**Dónde se solapan, medido:** el **respaldo** está en B (cláusula), en D (ROAD-6) y en SCRUM-1525, y **no está
en A**. Lo de **Hacienda** está a la vez en D (ROAD-5), en C (S1-F, el asesor) y en A (la 18). **La SL** está
en D (ROAD-4) y, a través del productor, en C. Fuera de eso no se tocan: ROAD-12 y ROAD-19 son resultados,
no condiciones, y lo que da A (textos) no lo tiene ninguna de las otras tres.

⇒ **No hay que unificar dos listas, ni elegir una de las dos.** Hay **dos instantes** —«entra el primer
cliente real» (B, que salta ANTES si el alta del Pioneer sube el padrón a 14; el padrón de hoy no lo he medido) y «se enciende la
facturación» (A y C)— y **cuatro listas** que reparten condiciones entre ellos sin saber unas de otras. La
decisión que queda es de qué lista cuelga cada condición. Mi lectura, no medida: lo que exige un
mecanismo cuelga de A y B, que lo tienen o lo tendrán, y C y D se citan desde ahí en vez de repetirse.

## 19-oct-2026 · SCRUM-1554c · La puerta en un fichero, con un guard que no deja borrar renglones (A); el cierre en ejecución, sólo propuesto (B)

**Medido contra:** `origin/main` = `8ff423895024c7d2ce1c6bcb96054da11a227b90` (base de la rama) · 2026-10-19T07:26Z (hora real, cabecera
`Date:` de `gh api -i zen`). S5, equipo de Luis. El orquestador da OK a A y dice NO a construir B (mensaje
del 19-oct). El carril: el ticket es de `equipo-javier`, pero `docs/go-live/` es nuevo y el guard es nuestro.
El orquestador avisa a su equipo.

A9: comprobación → `tests/scrum1554c-puerta-de-go-live.test.mjs`

### ⚠️ Este fichero choca con el PR #2428 (SCRUM-1554b, equipo de Javier)
#2428 también CREA `docs/master/SCRUM-1554.md`. Lleva abierto desde el 14-oct, con `build + tests` en rojo,
y nadie lo ha tocado desde entonces. **Quien entre segundo resuelve el conflicto juntando las dos
secciones**, sin borrar ninguna. 1554b y 1554c no se solapan en contenido:

| | SCRUM-1554b (Javier, #2428) | SCRUM-1554c (esto) |
|---|---|---|
| Qué es | Clasifica los **57 tickets de Jira** que «esperan al fundador», por tipo de decisión | La **lista de entradas** de la puerta, en un fichero, y un guard sobre ella |
| Toca | Sólo este registro y `docs/master/evidencias/SCRUM-1554b/` | `docs/go-live/puerta.json`, `scripts/go-live/puerta.mjs` y su test |
| Relación con la puerta | Cuenta 3 tickets aparcados en ella (1502, 1551, 1554) | Recoge sus entradas (1–23) |

### Lo medido antes de construir (y cambia lo que se puede prometer)
- **`INVOICING_ES_ENABLED` se enciende por la VARIABLE DE ENTORNO de Railway o por `merchants.flags` en la BD,
  a mano** (`src/core/flags.ts`: merchant > país > env > default). **Ninguno de los dos caminos pasa por la CI.**
  Por eso un guard de CI **no puede impedir** que se encienda: como mucho avisa. El requisito 1 de
  c.19645 («que impida, no que avise») no se puede cumplir desde la CI. Sólo se cumple en ejecución (B).
- **La lista no vivía en ningún fichero.** Estaba en el cuerpo del ticket (filas 1–8) y en sus comentarios
  (9, 10, 11–15). c.19645 nombra otros seis grupos «movidos» sin redactarlos, y **dos entradas sólo constaban
  en registros ajenos**: `SCRUM-1183.md:66` (el botón de exportar sin año) y `SCRUM-1558.md:29`
  (`sendInvoiceEmail` dice `ok` sin enviar; el registro dice «el orquestador lo apunta en la puerta», pero
  en el ticket NO consta). Así que el requisito 2 (autocontenido) tampoco se cumplía.

### A · Lo que entra
1. **`docs/go-live/puerta.json`**: 23 entradas, cada una con `numero`, `que`, `de_donde` y `consta_en`
   (dónde se escribió), y `condicion` cuando la fuente la da. **22 abiertas y 1 cerrada**: la 4, el P1 con
   asteriscos, por PR #2425 (`cd99c713994f`, ancestro de main, comprobado), con su motivo de c.19593/19594.
   Las 18 y 19 dicen «no lo dice el comentario» en `de_donde`: c.19645 no da el ticket de origen. No me lo
   invento.
2. **`scripts/go-live/puerta.mjs`**: `juzgarPuerta`, `leerPuerta` y `recuento`, y línea de órdenes:
   **0** = ninguna abierta · **1** = hay abiertas · **2** = NO PUDE LEER (nunca 0 por no poder leer).
   Hoy: `PUERTA DE GO-LIVE · 22 abierta(s) de 23 · cerradas: 4`, salida 1.
3. **El guard**, que corre en la tanda (`build + tests`, el obligatorio). Declara `TOTAL = 23` y
   `CERRADAS = [4]`, y cae **en los dos sentidos**:
   - una entrada que **desaparece**, aunque se renumere el resto → rojo («una entrada NUNCA se borra»);
   - una entrada **cerrada sin** `{por, motivo, sha, fecha}`, o con un sha que no se puede buscar → rojo;
   - una entrada **nueva**, o una **cerrada que el guard no declara**, o una **reabierta** → rojo, hasta que
     el mismo cambio suba `TOTAL` o toque `CERRADAS`. **Así el diff dice cuál salió** (requisito 3), y su
     motivo queda en la lista.

### Comprobado
| corrida | resultado |
|---|---|
| test nuevo | **14/14** |
| test nuevo + 1349 + 1415 + 824 + 723 | **46/46** |
| **mutantes sobre la lista DE VERDAD** (cambio y `git restore`; árbol limpio al acabar) | **borrar la 23 → cae**, con «faltan 1 entrada(s) (23)…» · **cerrar la 1 sin `cerrada`** → cae, con «cerrada sin {por, motivo, sha, fecha}» y «el guard no lo declara» |
| los 163 ficheros de test que barren `scripts/` o `tests/`, CONTRA LA BASE (la misma tanda en `8ff423895` sin el cambio) | base 85 caídos, rama 87. **Los 2 de más eran míos: `SCRUM-1349`.** Mi `spawnSync` dejaba pasar `FORCE_COLOR`; arreglado donde nace. Los 85 de la base son los de siempre en un árbol sin `dist/` (`scrum1398`, `scrum1262`…) |

### B · El cierre en ejecución: SÓLO PROPUESTA. NO construido
**Por qué no se construye:** cambiar `isFlagEnabled` es tocar un flag de la Parte P a nivel global, y eso es
un STOP del CLAUDE.md. **Lo lleva el orquestador al fundador con la pregunta sola, y nadie lo construye
hasta que haya una cita suya.**

**El diseño** (en `src/core/flags.ts`, dentro de `isFlagEnabled`, justo antes de devolver):
```ts
// SCRUM-1554 · LA PUERTA DE GO-LIVE: INVOICING_ES_ENABLED no se enciende con entradas abiertas.
// Fail-closed: si la lista no se puede leer o no tiene su forma, cuenta como CERRADA la puerta (OFF).
function puertaDeGoLiveLibre(): boolean {
  if (cachePuerta !== undefined) return cachePuerta;
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'go-live', 'puerta.json'), 'utf8'));
    cachePuerta = Array.isArray(doc.entradas)
      && doc.entradas.length > 0
      && doc.entradas.every((e: any) => e && e.estado === 'cerrada');
  } catch { cachePuerta = false; }
  return cachePuerta;
}
// …y al final de isFlagEnabled, para este flag y sólo cuando el resultado sería true:
//   if (flag === 'INVOICING_ES_ENABLED' && resultado && !puertaDeGoLiveLibre()) return false;
```
- **`docs/` viaja al despliegue**: `legalPages.routes.ts:13` ya lee `path.join(process.cwd(), 'docs', 'legal')`
  en producción. La lista sólo cambia con un despliegue, así que se lee **una vez por proceso**.
- **Cierra los dos caminos a la vez** (env de Railway y `merchants.flags`), porque los dos pasan por
  `isFlagEnabled`. Y no toca el camino de emisión: lo que cambia es la respuesta del interruptor.

**🔴 Lo que hay que decidir ANTES de construirlo, medido:**
1. **33 ficheros de `tests/` encienden `INVOICING_ES_ENABLED`** (por env o por override) y esperan que
   emita. Con B tal cual, con 22 abiertas, **caen todos**. Hace falta una salida para los tests que **no sea
   un agujero en producción**. Una variable de entorno que salte la puerta es justo el camino que Railway
   puede poner. Opciones, sin elegir: (a) la puerta sólo rige con `NODE_ENV=production` (⚠️ staging
   también lo tiene, según SCRUM-1558, y el de producción no lo he medido); (b) los tests inyectan la
   lista por un parámetro de `FlagContext` que en producción nadie rellena.
2. **Si alguna cuenta tiene hoy el flag encendido** por `merchants.flags` (la demo, por ejemplo), **B se lo
   apaga al desplegar**. No lo puedo medir: ningún árbol tiene credenciales de producción (SCRUM-418).
   ⚠️ **Eximir a las cuentas de prueba es el agujero**: no se propone.
3. **El ratón y el gato del guard**: una entrada cerrada sin arreglar de verdad pasa el guard igual. B no lo
   arregla; lo que lo sujeta es que el cierre lleve `por`, `motivo` y `sha`, y que el diff lo vea un humano.

**🔢 La cifra de los 33, medida después (19-oct, sólo lectura, sobre `8ff423895`).** La pidió el orquestador
para que el fundador no decida B a ciegas:

| cómo encienden el flag | ficheros |
|---|---|
| **`merchant.flags = { INVOICING_ES_ENABLED: true }`** en un objeto que el test pasa a funciones de dominio (`getEmissionMode`, `allocateInvoiceNumber`, `modoDocumentoSuelto`…), o en un Prisma falso o en el banco desechable | **31** (incluidos `_banco-emision-con-estado.mjs`, `scrum974` con su `ENCENDIDA` y `scrum1097`, que es un guard que mide comercios encendidos) |
| **`process.env.INVOICING_ES_ENABLED = 'true'`** | **2** (`emission.test.mjs`, `flags.test.mjs`; el segundo prueba además el override) |
| sustituyen `isFlagEnabled` o su módulo | **0** |

Lo que eso dice de las dos salidas para los tests:
- **(a) la puerta sólo rige con `NODE_ENV=production`**: no toca ninguno de los 33, porque ninguno pone
  `NODE_ENV=production`. ⚠️ Sigue sin medir qué `NODE_ENV` tienen staging y producción.
- **(b) inyectar la lista por `FlagContext`**: 31 de los 33 NO llaman a `isFlagEnabled`: llegan a él a través
  del dominio. Habría que pasar el parámetro por cada función, y eso es mucho más invasivo de lo que parecía.
  Una variante menos invasiva es un interruptor en memoria exportado por `flags.ts` que sólo llaman los tests.
  No se puede poner desde Railway, pero sí desde cualquier código del proceso. Tampoco se elige aquí.

**Dos cosas que YA existen y cambian la pregunta:**
- **`scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097)** es de sólo lectura (lo verifica por AST) y
  contesta la duda 2: si hay hoy algún comercio ES, que no sea la demo, con el override encendido o con alguna
  factura fiscal emitida. **El fundador puede correrlo contra producción antes de decidir B**, sin escribir
  nada nuevo. Dice en su cabecera que no ve la variable de entorno; para eso tiene su brazo (b): ¿se ha emitido
  algo fiscal?
- **Ese guard EXCLUYE A LA DEMO (id=1) a propósito, por la regla 8.** B, tal como está escrita arriba, le
  apagaría la facturación a la demo si tiene el override encendido. Si la regla 8 la deja fuera de la puerta,
  eso lo decide el fundador. Una excepción por id fijo no es el agujero de «eximir cuentas de prueba» (no
  depende de ningún dato que se pueda poner desde fuera), pero tampoco lo propongo yo.
- **`scripts/cambiar-flag-fiscal.mjs`** es, según SCRUM-1097/1099, **la única vía humana y deliberada** de
  encender el override por comercio. Que ese guion se niegue con entradas abiertas cerraría UNO de los dos
  caminos sin tocar `flags.ts` (la variable de Railway seguiría abierta). Se nombra; no se propone ni se ha
  leído entero.

### Lo que NO hace
- **No impide encender el interruptor.** Hasta que exista B, esto es una lista vigilada, no una puerta.
  **La fila c3-17 de la página del fundador NO se cierra con A**: queda a medias, y la cierra B.
- **No está completa.** Recoge lo que consta escrito en el ticket y en los registros de `main` que mandan
  algo a esta puerta (`git grep` de «puerta de go-live» y «SCRUM-1554» en `docs src public tests scripts`).
  Lo que se aparcó sólo de palabra, o en Jira de otro ticket sin registro, no está.
- **No lee Jira.** Una entrada nueva hay que escribirla en el fichero. Si sólo se escribe en el ticket, el
  guard no la ve.
- No he redactado las seis que c.19645 sólo nombra (16–21): llevan el nombre que les dio el comentario.

#### Arreglo del check obligatorio (mismo día, antes de mergear)
El `build + tests` del PR #2601 caía con `not ok 3440 - SCRUM-1480f`: `scripts/go-live/puerta.mjs` (creado en
este mismo PR) es un script NUEVO sin fila en `docs/equipo/dos-equipos.md` §3.3. Medido el motivo: SCRUM-1554
lleva las etiquetas `decision-jefe, equipo-javier, fundador, go-live, legal, microcopy` — NINGUNA es
`area-*`. Por «Cómo nace la fila de un fichero de `scripts/`» (SCRUM-1480), un ticket sin UNA etiqueta de
área hace que el criterio calle: no se le puede dar fila a un puesto. Declarado en
`scripts/_sin-fila-declarados.json` (caso 2: lo crea el equipo de Luis en un ticket sin etiqueta de área).
`tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`: 6/6 verde tras el cambio.
El rojo de `guards de navegador (fuera de la tanda)` (34 verdes, 3 rojos, 1 ciego) es PREEXISTENTE: medido
también en rojo en el último run de `main` (39218813067, el mismo job, misma conclusión `failure`), y
ninguno de los 4 ficheros de este PR toca `public/` ni el dashboard. No es de este PR; no se toca aquí.
