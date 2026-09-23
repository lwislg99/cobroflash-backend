# SCRUM-534 · CENSO-AFIRMACIONES: las 19 falsas, verificadas hoy y clasificadas para decidir

**Fecha:** 16-sep-2026 · **Carril:** documentación / fiscal · **Gate:** sin gate — **no se corrige nada**
**Medido contra:** `origin/main` = `68aeb3920966a92ffb23c48802aa8f1fb26e2d4d` · 2026-09-16T10:17:30+01:00
**Tanda:** 6993 tests, 6883 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 835 ficheros · exit 0 — con tope duro, compilando DESPUÉS de mergear.

> ⛔ **ESTA ENTRADA NO CORRIGE NI UNA PALABRA.** Regla 30: todo lo que hay aquí es texto que lee un
> cliente o un tercero, y lo escribe el fundador. Esta sesión lo encuentra, lo verifica y lo
> clasifica.

## 🔴 Lo primero: el recuento del ticket no cuadra, y ése es el primer dato

| | el ticket dice | medido hoy |
| --- | --- | --- |
| guion H2 | 1 (con «dos mitades falsas») | **1**, vivo en `YAQU_MASTER.md:214` |
| en documentos a terceros | «**8** afirmaciones» | 🔴 **9** — `PACK_GESTORIA` 5 + `DECLARACION_RESPONSABLE` 4 |
| clase A total | 19 | **19, las 19 VIVAS hoy** |

**Ninguna se ha resuelto sola en los dos meses transcurridos.** Se verificaron una a una contra el
árbol de hoy: las 19 siguen ahí, con las líneas movidas (el máster ha crecido ~14 líneas, así que
las coordenadas del inventario del 19-ago ya no valen — las de aquí sí).

## La lista, clasificada — que es la columna que el fundador pidió

**Criterio del fundador:** si es landing, espera; si es de yaqu.app o sale por la puerta a un
tercero, entra.

### 🔴 ENTRA — PRODUCTO / DOCUMENTO A TERCEROS (10)

| id | fichero:línea | texto literal (fragmento) |
| --- | --- | --- |
| **A1** | `docs/YAQU_MASTER.md:214` | *«la facturación VeriFactu **está construida** y en certificación… Por ley no puedo **activarla** hasta cerrarla»* |
| **A11** | `docs/legal/PACK_GESTORIA.md:13` | *«emite cada factura con una huella digital encadenada y la **remite automáticamente a la AEAT** en el momento»* |
| **A12** | `docs/legal/PACK_GESTORIA.md:19` | *«Cada registro de facturación… **se envía a la AEAT en tiempo real** a través de su servicio web»* |
| **A13** | `docs/legal/PACK_GESTORIA.md:21` | *«la huella SHA-256 encadenada + **la remisión autenticada** cumplen el requisito (RRSIF)»* |
| **A14** | `docs/legal/PACK_GESTORIA.md:39` | *«Al cobrar, YaQu emite la factura, calcula su huella y **la remite a la AEAT**»* |
| **A15** | `docs/legal/PACK_GESTORIA.md:64` | *«es el sistema de **facturación** que **genera y remite** los registros»* |
| **A16** | `docs/legal/DECLARACION_RESPONSABLE.md:12` | *«…el bloque SistemaInformatico que **YaQu remite en cada registro de facturación**»* |
| **A17** | `docs/legal/DECLARACION_RESPONSABLE.md:39` | *«**Tipología:** sistema… en modalidad **VERI\*FACTU** (**remisión de los registros de facturación a la AEAT**)»* |
| **A18** | `docs/legal/DECLARACION_RESPONSABLE.md:49` | *«…y **remisión telemática al servicio web de la AEAT**»* |
| **A19** | `docs/legal/DECLARACION_RESPONSABLE.md:52` | *«**Remisión inmediata a la AEAT** (modalidad VERI\*FACTU), **con control de flujo**»* |

🔴 **A1 es la de más impacto y no admite espera:** la **regla 26** la declara *la única respuesta
autorizada* ante un cliente. El mecanismo que existe para que nadie improvise está distribuyendo la
frase equivocada.

🔴 **A16–A19 están en un documento que se FIRMA** (art. 13 RRSIF + art. 15 Orden HAC/1177/2024). Una
declaración responsable que afirma capacidades que el sistema no tiene no es un error de redacción.

### ⚪ INTERNO — no sale por la puerta (9)

`A2` `YAQU_MASTER.md:401` (la FSM de `VfSubmission`, Parte L «FUENTE DE VERDAD») · `A3` `:448` (runbook
R7) · `A4` `:463` (fila `SIF_ENABLED` de la Parte P) · `A5` `:720` · `A6` `:969` · `A7` `:1559` ·
`A8` y `A9` `docs/legal/SEMAFORO_CALIBRACION.md:262` · `A10` `:419`.

⚠️ **A2 no es «una más»:** de ella beben A3, A4 y el runbook. Corregirla sin corregir las que la
citan las deja huérfanas apuntando a algo que ya no dice eso.

### ✅ LANDING — CERO, y está medido

**No hay ninguna.** Barridas las **108** superficies publicadas de `public/`: 38 menciones de
VeriFactu/AEAT, todas en el dashboard, y **ni una afirma la remisión**. El único acierto del filtro
es un **comentario que dice lo contrario** —`settingsView.js:190`: *«diría al profesional que puede
elegir remitir a la AEAT, y no puede»*—, o sea código escrito para **evitar** el error.

## 🔴 Por qué son falsas — la contraprueba, medida hoy

No basta «es falsa». Esto es contra qué lo es:

**① `VfSubmission` no existe** (contraprueba de A2, A3, A4)

```
modelos en prisma/schema.prisma                      : 30
modelos Vf* / *Submission / *Verifactu               : 0  — NINGUNO
control positivo · modelos con "Invoice" que SÍ están: Invoice, InvoiceAssignee
```

El control positivo importa: el lector **sí** ve modelos, así que ese 0 no es ceguera.

**② Cero llamadas de red a la AEAT en `src/`** (contraprueba de A11–A19)

```
ficheros .ts en src/                        : 282
mencionan la AEAT                           : 31
mención de AEAT + patrón de red             : 3  → los TRES son falsos positivos
control positivo · ficheros con red (a cualquier sitio): 23
```

Los tres, mirados uno a uno:

* `registro.builder.ts` — «SOAP» aparece en **comentarios**; `construirCuerpoSoapRegFactu`
  **construye** el cuerpo XML y el propio fichero dice que *«el envío SOAP de S1-D irá por aquí»*,
  en futuro.
* `pdf.service.ts` — `axios.get(logoUrl)`: descarga un logo.
* `modoVisible.ts:21` — 🔴 **lleva escrita la contraprueba**: *«"se envía" NO EXISTE. Cero clientes
  SOAP/mTLS contra…»*.

**③ `SIF_ENABLED` se lee y se guarda; no enciende nada** (contraprueba de A4, A5)

Los **11** usos en `src/`: su declaración en `flags.ts`, y el resto **escribiéndola en la auditoría**
(`invoiceNumber.service.ts:456`, `audit.service.ts:211-254`, `flagFiscal.service.ts`). **Ninguna rama
que al ponerla en verdadero empiece a transmitir.**

## ⚠️ Un defecto de MI instrumento, dicho porque casi cambia el resultado

La primera pasada dio **A11 como «ya no está»** — habría entregado una afirmación viva en el
documento de la gestoría como resuelta. No estaba resuelta: el markdown **envuelve**, y la frase
vive partida entre las líneas 13 y 14, con un `**` en medio. Mi buscador miraba **línea a línea**.

Afecta a **todas** las entradas que el inventario anota con rango (`13-14`, `18-19`, `39-40`,
`48-49`, `262-263`). Corregido: se normaliza el fichero entero (saltos y `**` a espacio) y se busca
sobre el texto continuo, recuperando la línea después.

> Es la misma familia que el aviso del encargo sobre `[oó]`: **en un repo en español, buscar por la
> forma que uno imagina devuelve ceros donde hay cosas.**

## Verificación

* ✅ **CONTROL POSITIVO** — el buscador encuentra el guion H2 y las frases que el ticket ya nombra
  (`está construida`, `no puedo activarla`, `VfSubmission`, `la cola remite al reanudar`,
  `VERIFACTU_EVIDENCIAS`): **15 coincidencias** en la primera pasada. Si no las viera, no vería nada.
* 🔴 **SUELO** — un cero habría sido instrumento roto: el ticket nombra el guion H2. No hubo cero.
* **Dos instrumentos** — búsqueda por línea y búsqueda sobre texto normalizado. **Discreparon en
  A11**, y la discrepancia fue el dato.
* **Todo con node**, no con `grep`: el de Git Bash normaliza CRLF al leer y las clases con acento
  devuelven ceros falsos.

## Lo que NO cubre

* **Las clases B (1), C (16) y D (25)** del inventario no se han re-verificado: este ticket es la
  clase A. La C sigue pendiente y cada una es una lectura falsa esperando.
* **`docs/VERIFACTU_EVIDENCIAS.md` sigue sin existir** y lo citan el máster (`:448`, `:1042`), el
  runbook y dos skills. Estaba en el comentario del ticket; se confirma hoy.
* **No se ha corregido nada.** Ni una palabra, ni de las 19 ni del inventario.

### ⚠️ Un flaky ajeno, medido dos veces y NO arreglado (regla 9)

La primera pasada dio **2 rojos de `SCRUM-804`**: *«el censo dice 149 ramas y `for-each-ref` lista
150»*.
Corrido aislado pasa, y la segunda pasada completa da **0 fail**. Es una **carrera**: el censo hace
dos lecturas y con ~26 worktrees empujando, una rama puede nacer entre una y otra. No es de este
carril y no se toca — queda nombrado porque un rojo intermitente entrena a relanzar la tanda.

---

## Observación de la sesión (fuera del encargo)

⚠️ Va aparte y marcada, como pide el encargo: no es parte de la lista de afirmaciones falsas.

La atenuante de **BORRADOR** que llevan `PACK_GESTORIA.md` y `DECLARACION_RESPONSABLE.md` tiene una
consecuencia que conviene tener delante al decidir el orden: **quien los revise el día de su
publicación leerá afirmaciones ya escritas, no las escribirá de nuevo.** Un texto heredado se
revisa con menos desconfianza que uno en blanco — que es justo lo contrario de lo que hace falta en
un documento con régimen jurídico propio.

---

# APÉNDICE · 16-sep-2026 · SCRUM-534b · El censo de documentos fantasma

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `e778e7b232c99b5b46ce44b6c4c90d526b67b175` · 2026-09-16T10:38:44+01:00
**Tanda:** 7016 tests, 6906 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 837 ficheros · exit 0 — con tope duro, compilando DESPUÉS de mergear.

> 🔒 **Un documento citado que no existe es peor que uno que falta: el que falta se busca, y el
> citado se da por leído.**

## El reparto — que es el entregable, no el total

```
población: 707 documentos · 514 rutas .md citadas
   437 existen
    48 🔴 FANTASMA          ← el defecto
    24 🟡 deuda de nombre    ← existe, con otra ruta
     3 ⚪ plantillas         ← `sesion-N.md`: la N es una variable
     1 ⚪ futura declarada
     1 ⚪ sólo en `docs/historico/`
descontadas por vivir en bloque de código: 62
vistas SÓLO por el instrumento normalizado: 2
```

**Las clases suman las 514**, y hay un test que lo comprueba: un censo cuyas partes no cierran no
es un censo.

### 🔴 Los fantasmas que más se citan

| citas | documento |
| --- | --- |
| **7** | `docs/VERIFACTU_EVIDENCIAS.md` |
| 2 | `docs/RUNBOOK_PAGOS.md` · `docs/legal/AVISOS_FISCALES.md` · `docs/AUDITORIA_SUPERFICIE_PUBLICA.md` · `GRAPH_REPORT.md` · `aviso.md` |
| 1 | `docs/legal/DPA_PROFESIONAL.md` · `docs/legal/REGISTRO_ACTIVIDADES_TRATAMIENTO.md` · `docs/master/ROAD-39.md` · y 39 más |

🔴 **`docs/VERIFACTU_EVIDENCIAS.md` tiene 7 citadores, no 4**: el máster (`:448`, `:1042`),
`docs/RUNBOOKS.md:79`, `docs/master/SCRUM-538.md:124`, dos en
`docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md` y uno en el histórico.

⚠️ **Un patrón que el reparto destapa:** buena parte de los 48 son documentos de trabajo de un
ticket —`SCRUM-209.md`, `SCRUM-242-RUNBOOK.md`, `SCRUM-403-ESPEC-COLUMNAS.md`,
`SCRUM-555-punto4.md`…— citados con enlace markdown desde otra entrada. Son **enlaces que nunca
llevaron a ningún sitio**: el registro por fichero nació con SCRUM-273 y el histórico no se migró.

## Qué mira, declarado — y qué no

* `docs/**/*.md`, `.claude/skills/**/*.md`, `README.md` y `CLAUDE.md`.
* **NO mira `scripts/`**, y no por olvido: ya lo vigila **SCRUM-242**
  (`scrum242-scripts-no-prometen-documentos`). Dos censos sobre la misma población pueden divergir
  — es el defecto de SCRUM-663 con otra ropa.
* **NO mira `src/` ni `public/`**: ahí una ruta `.md` es casi siempre un dato, no una promesa.

## 🔴 Los dos instrumentos, y su discrepancia otra vez fue el dato

* **① por línea** — da el número de línea y sabe descontar bloques cercados, pero **pierde la cita
  que envuelve**.
* **② sobre texto normalizado** — ve las que envuelven; a cambio no precisa la línea.
* **Aportó 2 citas** que el ① no veía. Uno solo habría sido media medida.

### Y el control cazó un límite de MI propio instrumento

El test fabricó una ruta partida por el salto (`docs/\nVERIFACTU_EVIDENCIAS.md`) y **el instrumento
② tampoco la veía**: normalizar el salto a espacio deja `docs/ FICHERO.md` con un hueco dentro, y
la expresión no casa. Los dos fallaban igual, o sea que el segundo no servía para lo único que
está. Arreglado cerrando el espacio tras la barra.

## Verificación

* 🔴 **EL QUE DECIDE** — `docs/VERIFACTU_EVIDENCIAS.md` sale en la lista **con ≥4 citadores**, y se
  comprueba además que de verdad no existe (si alguien lo crea, el control lo dice en vez de pasar).
* ✅ **POSITIVO** — `docs/RUNBOOKS.md`, que existe y se cita mucho, **no sale**; y se exige que sí
  aparezca entre los que existen, para que su ausencia de la lista signifique algo.
* ⚠️ **Bloques de código** — una cita dentro de ``` no cuenta, **y el censo declara cuántas
  descontó (62)**. Un filtro que no dice lo que se come es un número sin auditar.
* ⚪ **Plantillas** — `sesion-N.md` va a su cubo: sin él, el censo mandaba a crear un fichero que no
  debe existir (`sesion-5.md` sí existe).
* 🔴 **SUELO** — cero citas es CIEGO, no «está limpio»; y las clases **suman** las 514.

## 🔴 Y el guard hermano cazó a este censo — SCRUM-349 en persona

Antes de empujar, **SCRUM-242 se puso en rojo acusando a este propio módulo**: nombraba en sus
comentarios tres rutas que no existen, y una de ellas era **el fantasma que viene a censar**.

> El fichero que explica la prohibición contiene los patrones que persigue.

El guard tenía razón: vigila rutas y **no puede distinguir una mención de una promesa** — lo dice
su propia cabecera. **No se relajó** (A7): se reescribieron las tres menciones partiendo el nombre
de la ruta. Es el impuesto de SCRUM-349 sobre la claridad del comentario, pagado a propósito y
dicho aquí para que no parezca un descuido de redacción.

## Lo que NO cubre

* ⛔ **No se ha creado ningún documento ni se ha corregido ninguna cita** (regla 9). Se lista.
* **Falsos positivos residuales, declarados:** `aviso.md` es un fichero que un script **genera** al
  correr, y el filtro de «generado» no lo atrapa por cómo está redactada su frase. Queda dentro de
  los 48 y se dice, en vez de afinar el filtro hasta que el número quede bonito.
* **El histórico va aparte pero no exento:** `docs/historico/` son copias congeladas y corregirlas
  sería reescribir el pasado — pero quien las lea sigue encontrando rutas que no llevan a nada.
* **No hay trinquete numérico**, a propósito: esta fase mide. Fijar el número pondría en rojo a
  quien empiece a borrar citas, que es justo lo que debe pasar.

---

# APÉNDICE · 16-sep-2026 · SCRUM-534c · El inventario: las deudas, los 50 agrupados por causa, y el que más pesa

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `9c90cc89044a20a85defdc0c93feb032e6544ca5` · 2026-09-16T11:16:20+01:00
**Tanda:** 7016 tests, 6906 pass, 0 fail, 0 cancelled · **110 skipped, aparte** · POBLACIÓN 837 ficheros · exit 0 — con tope duro, compilando DESPUÉS de mergear.

> **Una lista de huecos es una foto. Esto es el inventario.**

## 🔴 Lo primero: el censo de la fase b tenía un defecto, y el repo ya lo había documentado

Al abrir las «deudas de nombre» apareció `Scrum/SESION_ACTUAL_SCRUM-16.md` — un trozo. La ruta real
es `docs/Srpint Scrum/SESION_ACTUAL_SCRUM-16.md`, **con un espacio dentro del nombre de carpeta**, y
mi clase de caracteres no lo admitía: cortaba la ruta por la mitad y acusaba al trozo.

**Y no es un defecto nuevo.** `docs/master/SCRUM-718.md:49` lo dice, para otro censo, con estas
palabras:

> *«la ruta real es `docs/Sprint Scrum/SESION_ACTUAL_SCRUM-69.md` y **mi clase de caracteres no
> admitía el espacio**, así que la cortaba en "docs/Sprint"»*

Lo repetí igual. Un defecto que reaparece en otro instrumento es **de la casa, no del instrumento**.

⚠️ Y el primer arreglo se pasó de largo: admitir cualquier palabra antes del espacio hacía casar
`OK docs/X.md` y `for f in … docs/X.md`, arrastrando prosa — las «deudas» saltaron de 5 a 12 y las
nuevas eran todas basura. Acotado a que **las dos palabras empiecen por mayúscula**, que es la forma
de `Sprint Scrum` y no la que produce la prosa.

## ① Las «deudas de nombre»: 23, y **ninguna se arregla**

**19 de las 23 no eran deudas.** Son **citas cortas**: se cita por el nombre, sin ruta, y el fichero
existe con **ese mismo nombre** en otra carpeta (`METODO_YAQU.md` → `docs/METODO_YAQU.md`,
`SUITE_REGRESION.md` → `docs/QA/SUITE_REGRESION.md`…). Arreglarlas sería reescribir citas que
funcionan.

Quedan **3 con ruta equivocada + 1 ambigua**, y las cuatro se leyeron una a una:

| cita | veredicto |
| --- | --- |
| `docs/CLAUDE.md` en `SCRUM-538.md:24` | ⛔ **no se toca**: es una **fila de tabla que censa ese error** («🔴 vivo»). Citar el error no es cometerlo. |
| `P3-7/BUGS.md` en `YAQU_MASTER.md:990` | ⛔ **no se toca**: cita **histórica** dentro de una nota de SCRUM-75 del 22-jul, sobre cómo se llamaba entonces. |
| `PROJECT_ROOT/PRODUCT.md` en `.claude/skills/impeccable/…` | ⛔ **no se toca**: `PROJECT_ROOT` es un **marcador de plantilla**, y la skill es de terceros. |
| `cerebro-yaqu/SKILL.md` | ⚠️ **ambigua** (14 candidatos con ese nombre base) — va al bloque ②, sin tocar. |

> **0 arregladas y 4 explicadas.** El encargo pedía preferir preguntar a inventar; medido, no había
> ninguna que arreglar.

## ② Los 50 fantasmas, agrupados por CAUSA

**Las tres medidas que pedía el encargo** (derivadas de git, no a ojo):

| | |
| --- | --- |
| anteriores a SCRUM-273 (3-ago-2026), por la fecha del fichero que cita | **17** |
| posteriores o de fecha desconocida | **33** |
| citados desde **UN** solo fichero | **37** |
| citados desde **VARIOS** | **13** |
| 🔴 **EXISTIERON alguna vez en git** (se borraron) | **5** |
| 🔴 **NUNCA existieron** (no se escribieron) | **45** |

**Ésa es la medida que más cambia el trabajo: 45 de 50 nunca se escribieron.** No es documentación
perdida — es **documentación prometida y no hecha**. Se busca distinto y se decide distinto.

### Los grupos (suman 50, comprobado)

**G1 · Entradas de ticket enlazadas que nunca se escribieron — 21** *(4 existieron)*
Ejemplo literal, `docs/master/SCRUM-240.md:30`:
> `Es la forma exacta del defecto de [SCRUM-209](SCRUM-209.md) una capa más arriba`

**Causa:** el registro por fichero nació con SCRUM-273 (3-ago) y **el histórico no se migró**; los
enlaces a entradas anteriores nunca tuvieron destino. ✅ **La hipótesis de la fase b se confirma, y
ahora con número: 21 de 50.**
**Opciones para el grupo:** (a) dejarlos y aceptar que son enlaces muertos conocidos; (b) quitar el
enlace y dejar el texto (`SCRUM-209` sin corchetes); (c) apuntarlos todos a la sección del máster
donde vive el histórico.

**G2 · Documentos de análisis o legales prometidos y nunca escritos — 7** *(0 existieron)*
`docs/VERIFACTU_EVIDENCIAS.md` (11 citas) · `docs/RUNBOOK_PAGOS.md` · `docs/legal/AVISOS_FISCALES.md`
· `docs/AUDITORIA_SUPERFICIE_PUBLICA.md` · `docs/legal/DPA_PROFESIONAL.md` ·
`docs/legal/REGISTRO_ACTIVIDADES_TRATAMIENTO.md`
🔴 **Es el grupo que duele**: dos son de RGPD y uno es el del bloque ③.
**Opciones:** (a) escribirlos; (b) marcar la cita como pendiente declarado; (c) quitar la cita.

**G3 · Ficheros que un proceso GENERA al correr — 4** *(0 existieron)*
`aviso.md` · `GRAPH_REPORT.md` · `CENSO-RAMAS.md` · `_EXT.md`. **No son documentación**: se citan por
su nombre de salida. **Opción única razonable:** excluirlos del censo con su motivo escrito.

**G4 · Sólo citados desde `docs/historico/` — 0.** El cubo existe y hoy está vacío.

**G5 · SIN CLASIFICAR — 18** *(1 existió)*, y **no se reparten a la fuerza**. Dentro hay al menos
tres cosas distintas: referencias internas de la skill `impeccable` de terceros
(`responsive-design.md`, `ux-writing.md`, `cognitive-load.md`…), ejemplos genéricos (`FICHERO.md`) y
documentos de sesión con ruta parcial.

## ③ `docs/VERIFACTU_EVIDENCIAS.md` — el que más pesa

**No existe hoy, y NUNCA existió** (`git log --all --diff-filter=A` no devuelve nada).
**11 citas en 7 ficheros** — más de las 7 que dije ayer, porque el extractor arreglado ve las rutas
partidas.

⚠️ **Y hay que descontar lo mío: 4 de las 11 son autocitas** de la entrada que escribí ayer
documentándolo. Citas ajenas reales: **7, en 6 ficheros**. Lo digo porque inflar un número con las
propias menciones es justo lo que llevo el día cazando.

**Cruzado con las afirmaciones falsas del censo de la 534 — sí, se tocan:**

| citador | |
| --- | --- |
| `docs/RUNBOOKS.md:79` | 🔴 **es A3 replicada**: el runbook R7, que manda leer `VfSubmission.lastError` y «documentar en» este fichero |
| `docs/YAQU_MASTER.md:1042` | 🔴 **S1-G**, uno de los tres sitios de `VfSubmission` que el comentario del ticket señala |
| `.claude/skills/yaqu-verifactu-sif/SKILL.md:88` | 🔴 **una skill obligatoria** antes de tocar código VeriFactu |

> **La respuesta a tu pregunta es que sí, y por partida doble.** El documento no existe, y sus
> citadores no son sitios cualesquiera: el **runbook que se lee con prisa durante una incidencia**,
> el máster, y **la skill que toda sesión carga antes de tocar VeriFactu**. Quien siga el R7 en una
> incidencia busca un fichero que nunca se escribió; quien cargue la skill recibe el puntero como
> si fuera un documento leído.

## Lo que NO cubre

* ⛔ **No se ha creado ningún documento, ni corregido ninguna cita, ni tocada ninguna de las 10
  afirmaciones** (reglas 9 y 30).
* **Los 18 SIN CLASIFICAR se declaran como tales**, no se reparten a la fuerza.
* **Las fechas del cuadro son la del fichero que CITA**, no la del documento citado — que no tiene,
  porque 45 de 50 nunca existieron. Es una aproximación y va dicha.

---

# APÉNDICE · Fase d — el guard contra los extractores de rutas `.md` escritos a mano

*16-sep-2026 · rama `scrum-534d-guard-extractores`*

**Medido contra:** `origin/main` = `dc7919946ffd605ab874e541386f2b23bf84cabf` · 2026-09-16T12:19:00+01:00

## De dónde sale

`docs/master/SCRUM-718.md:49`, del 6-sep-2026, dejó escrito para su censo: *«la ruta real es
`docs/Sprint Scrum/…` y **mi clase de caracteres no admitía el espacio**, así que la cortaba en
"docs/Sprint"»*. Diez días después, el censo de documentos citados de la fase b **nació con el
mismo fallo**, y acusó de fantasma a un trozo de una cita perfecta.

> **Un defecto que reaparece en otro instrumento no es mala suerte: es que nadie lo tenía atado.**

## Qué mide, y qué NO mide

Mide los **extractores de rutas `.md` escritos a mano**: una expresión regular que saca un `.md`
con su ruta de dentro de un texto, en un fichero que no usa `scripts/_documentos-citados.mjs`.

🔴 **No persigue el agujero del espacio, persigue la duplicación que lo hace posible.** Mientras
haya extractores sueltos, cada uno tendrá sus propios agujeros y habrá que descubrirlos de uno en
uno. El agujero del espacio se mide *además*, y sólo para probar que el instrumento ejecuta de
verdad la expresión que dice estar mirando.

**No** es «prohibido usar expresiones regulares con `.md`»: el módulo compartido tiene la suya —es
la única que debe existir— y el guard la reconoce como la fuente, no como una infracción.

## 🔴 El criterio se equivocó dos veces antes de acertar, y las dos veces por lo mismo

| versión | criterio | resultado | por qué era falso |
| --- | --- | --- | --- |
| ① | «cualquier expresión que nombre un `.md`» | **17 acusados** | casi todos eran **filtros de nombre**: validan cómo se llama un fichero que ya se tiene, leyendo un `readdir`. No pueden cortar por un espacio porque **no leen prosa** |
| ② | «la que lleve la barra dentro de una clase de caracteres» | **0 acusados** | la expresión **arreglada de hoy lleva la barra FUERA de la clase**, así que el criterio no reconocía ni al propio módulo compartido |
| ③ | **se EJECUTA la expresión contra dos sondas** | **1 acusado, de verdad** | no depende de cómo esté escrita |

El ② es el más instructivo: **un criterio que no ve la versión buena tampoco habría visto la mala
si se hubiera escrito con otra forma.** Es, otra vez, un detector que sólo ve la forma que su autor
tenía en la cabeza — el mismo defecto que este guard viene a impedir, cometido al escribirlo.

Las dos sondas son el defecto de SCRUM-718 escrito como **dato**, no como opinión sobre un texto:

* `Ver docs/SprintScrum/X.md ahora` → quien de aquí saca una ruta **con barra** es un extractor.
* `Ver docs/Sprint Scrum/X.md ahora` → quien de aquí la saca **entera** admite el espacio.

## Las cuatro patas

| pata | qué hace | comprobado |
| --- | --- | --- |
| **🔴 ROJO REAL** | reconoce el extractor roto **sin que se lo digan**: lo saca de `git show <commit del arreglo>^:scripts/_documentos-citados.mjs` | ✅ |
| **✅ VERDE REAL** | en la **misma pasada**, acusa al suelto y respeta al que delega; el que usa el módulo sin expresión propia queda **fuera de población**, que no es lo mismo que aprobado | ✅ |
| **🔴 SUELO** | con 0 extractores aborta **CIEGO**, no informa «0 malos»; y el guard del árbol real exige ver el módulo compartido antes de dar veredicto | ✅ |
| **🔴 MUTACIÓN** | quita el tramo que admite el espacio y **cuenta el ancla antes de sustituir** (tiene que aparecer exactamente 1) | ✅ |

⚠️ **La versión rota no se escribe a mano: se saca de git.** Copiarla en una cadena obliga a
reescaparla, y ahí se pierde justo lo que se quiere medir — pasó al construir esto: los escapes se
perdían y el control acabó evaluando una expresión que no existió nunca, dando un rojo falso.

## La población declarada, y lo que el número no significa

```
población: 1 fichero con extractor de rutas · 1 módulo · 0 delegan · 0 A MANO · 0 no clasificados
  MODULO   scripts/_documentos-citados.mjs:73 · admite espacio: true
```

* **Población:** los `.mjs` de `tests/` y de `scripts/`.
* **Alcance declarado del lector de literales:** se reconocen los que abren tras `=`, `(`, `,` o
  `:`. Con sólo `=` —la primera versión— el censo veía 9 literales y **un** extractor; abriendo a
  los otros tres ve 20 y **dos**, y el segundo era real. Lo que quede fuera de esas cuatro
  aperturas **no está medido**.
* **`NO CLASIFICADO` cuenta del lado malo**: si un literal no compila, no se puede sondar, y no
  poder decidir no es poder aprobar.
* **Un fichero que usa el módulo y no tiene expresión propia NO entra en población.** Meterlo
  inflaría el denominador y haría que el porcentaje de sanos pareciera mérito del guard.

## 🔴 Lo que cazó, sin que se lo dijeran

`tests/scrum242-scripts-no-prometen-documentos.test.mjs:51` extraía inline, dentro de un
`matchAll(…)`, con una expresión propia que **no admitía el espacio**. Un `docs/Sprint Scrum/X.md`
nombrado por un script se le cortaba en `docs/Sprint`.

**Arreglado el código, no el guard (regla 41).** Ahora delega en `citasPorLinea`. El cambio se
midió **antes** de hacerlo, el 16-sep-2026: **48 rutas `docs/*.md` con la expresión a mano y 48
con el módulo, cero diferencia en los dos sentidos**, con 7 scripts que llevan valla de bloque de
código —que es lo único que el módulo descuenta y aquella expresión no—.

## Las dos mutaciones declaradas (SCRUM-745)

Las dos tocan **el módulo** y no este fichero, a propósito: una declaración que mutara su propio
test se encontraría a sí misma —el texto de `de` vive también dentro de la declaración— y la
sustitución caería en la declaración en vez de en el código. Es SCRUM-349 con otra ropa.

| mutación | tumba a |
| --- | --- |
| quitar el tramo que admite el espacio | `🔴 MUTACIÓN: quitar el espacio de la expresión reabre el agujero, y ENTRA` |
| quitarle la barra (deja de ser extractor de rutas y pasa a filtro de nombre) | `🔴 ningún extractor de rutas .md se escribe A MANO` |

Las dos ejecutadas: **exit 1 y cae el test declarado**, con restauración byte a byte verificada
contra los bytes de disco (SCRUM-570 / SCRUM-808).

## Decisión del fundador registrada en esta tanda

`docs/legal/DPA_PROFESIONAL.md` y `docs/legal/REGISTRO_ACTIVIDADES_TRATAMIENTO.md` —dos de los 50
fantasmas de la fase b, con 3 citadores cada uno— **no se retiran del censo: se escribirán antes
del go-live y quedan enlazados a SCRUM-505.** Aquí sólo se anota el enlace; **los documentos no los
escribe esta sesión** (regla 30: el texto legal es del fundador).

## Lo que NO cubre

* ⛔ No se ha creado ningún documento ni corregido ninguna cita de las fases a/b/c.
* El censo sólo mira `tests/` y `scripts/`. Un extractor a mano en `src/` o en un `.claude/` no
  entra en población, y su ausencia de la lista **no significa que no exista**.
* La marca `DELEGA` es **generosa a propósito**: un fichero que importa el módulo y además arrastra
  una expresión vieja se cuenta como que delega. El criterio no puede saber cuál de las dos usa de
  verdad, y un guard que acusa por la duda acaba silenciado.

---

# APÉNDICE · Fase e — la población del censo, fijada antes de medir sobre ella

*17-sep-2026 · rama `scrum-534e-poblacion-del-censo`*

**Medido contra:** `origin/main` = `aa465cdd6fc64625bc5a4e16d575fd0810064be6` · 2026-09-17T09:32:00+01:00

## Por qué esto va ANTES que arreglar citas

El fundador lo dijo así y tiene razón: *«G5 y G3 no arreglan fantasmas — corrigen la población. Si
eso se hace después, todos los porcentajes del censo hay que recalcularlos; la población se fija
antes de medir sobre ella.»*

## Los dos cubos nuevos, con criterio DERIVADO

### `enSkillDeTerceros` — 6

`.claude/skills/impeccable/reference/adapt.md` cita a sus hermanos (`typography`, `personas`, `responsive-design`… todos con extensión `.md`, escritos aquí
SIN ella a propósito) y el proveedor los absorbió en línea, dejando las referencias colgadas.
Son referencias rotas de verdad, pero **no las mantenemos nosotros**.

🔴 **El criterio sale del MÁSTER, que es quien decide (regla 35), no de una lista escrita aquí.** El
máster declara textualmente, en tres sitios: *«`impeccable` es skill de TERCEROS (regla 36)»* y
*«Excepción a la regla 36 (plugins de terceros): la skill `impeccable`…»*.

⚠️ **Y el criterio falló primero, medido:** quedarse con las frases que contienen «terceros» y
buscar el nombre dentro marcó como ajenas a **cinco skills nuestras** (`verifactu`,
`yaqu-premium-ui`, `yaqu-release-check`, `yaqu-sprint`, `yaqu-verifactu-sif`) — porque el máster
tiene frases que hablan de terceros y nombran de paso las de la casa. Era **eximir por vecindad**:
SCRUM-511 por tercera vez en este módulo. Ahora se exige el nombre **entrecomillado a menos de 60
caracteres** de la palabra, que es como el máster declara de verdad.

🔴 **Va APARTE, NO EXENTO**, igual que `docs/historico/`: la fuente se sigue leyendo y la cifra se
sigue publicando en la línea de población. **Una fuente retirada de la población no puede volver a
ponerse roja nunca**, y este censo existe para que un cero signifique «he mirado». Si se prefiere el
borrado literal de `FUENTES`, es una línea — pero entonces deja de haber vigilancia ahí.

### `generados` — 1

Antes se derivaba de los **verbos que rodean la cita**
(`genera|escribe|deja|produce|salida|crea`), y eso es **eximir por mencionar**. Medido el
17-sep-2026: con ese criterio el cubo tenía **0** entradas teniendo `aviso.md` delante, que
`scripts/vigia-pasada.mjs` escribe.

Ahora la pregunta es la que ya probó SCRUM-242: **¿escribe algún script del árbol esta ruta?**
Derivado, no listado — el día que el script deje de escribirlo, la ruta vuelve a exigirse.

⚠️ **Se exige la ruta ENTERA, no el nombre base**, y el matiz lo cazó una medición: buscando sólo el
nombre, `tests/_censo-fixture.mjs` —que escribe un `LEEME` suyo (con extensión, partida aquí a propósito) dentro de un árbol sintético— hacía
pasar por salida generada a `spike/LEEME.md`, que es un documento que **existió en esa ruta y se
borró**. Dos cosas distintas con el mismo final de nombre.

## El efecto sobre el censo

```
antes:  50 FANTASMA · 0 generados
ahora:  43 FANTASMA · 1 generado · 6 en skill de terceros
```

50 − 6 − 1 = 43. El SUELO de la fase b cazó el cubo nuevo por no estar en la suma de clases; **se
completó la cuenta, no se relajó el guard** (regla 41).

## 🔴 CORRECCIÓN: tres cifras que el informe de la fase c dio mal

Van aquí porque una cifra mal dada que no se corrige por escrito se convierte en la cifra buena.

| lo que dije | lo medido | por qué falló |
| --- | --- | --- |
| `G4 · existieron y se borraron: **0**` | **5** | medí el historial sin `--all`, así que no veía los commits que no cuelgan de `main` |
| `G3 · salidas generadas: **4**` | **1** derivable | clasifiqué 3 por intuición. `GRAPH_REPORT.md` es salida de una herramienta **externa**; `CENSO-RAMAS.md` se cita para decir que **no debe existir**; `_EXT.md` es un **falso positivo de mi propio extractor** (la cita es `SPRINT_DEMO_READY.md + _EXT.md`, una abreviatura, y el fichero real existe) |
| `G1 · el destino existe en **10 de los 12**` | **0 de 12** | lo afirmé sin medirlo |

## 🔴 G1 NO es mecánico, y por eso no se ha tocado

Leídas las 12 citas una a una, G1 no es «media ruta»:

* **8 de 12 se citan precisamente para decir que NO deben existir.** Literal, `docs/master/SCRUM-273.md:104`:
  `` `SCRUM-242-RUNBOOK.md` y `SCRUM-406-canal.md`. El guard cazó los tres — hacía su trabajo. ``
  Y `docs/master/SCRUM-652.md:9`: `` El fichero se llama `SCRUM-652.md`, no `SCRUM-652-reconocimiento.md`. ``
  Escribirles la ruta completa crearía la deuda que esas frases celebran haber evitado.
* **4 de 12** (`SCRUM-209/216/235/250`) son enlaces markdown a entradas hermanas que **nunca
  existieron** — comprobado contra todo el historial. No son media ruta: son promesas sin cumplir.

**No se ha inventado criterio para ninguno de los dos casos.** Queda como decisión del fundador.

## Lo que NO cubre

* No se ha creado ningún documento ni corregido ninguna cita.
* El cubo de terceros depende de que **el máster siga declarándolo**. Si alguien retira esa frase,
  las 6 entradas vuelven a contarse como deuda nuestra — que es el comportamiento correcto.
* `GRAPH_REPORT.md`, `CENSO-RAMAS.md` y `_EXT.md` **siguen contados como fantasmas**: no hay
  criterio derivable que los saque, y forzarlos sería inventar la causa.

## ⚠️ Y ESTE APÉNDICE SE CAZÓ A SÍ MISMO

Escrito tal cual, **subía el censo de 43 a 45**: al citar los hermanos de la skill ajena desde
`docs/master/`, esas rutas dejaban de tener **todos** sus citadores dentro del paquete y volvían al
cubo de fantasmas. Y una de las menciones —el `LEEME` del fixture— creaba una ruta citada **que no
tenía ningún otro citador**: inventada por el documento que la explica.

Es SCRUM-349 en el cubo nuevo: *el texto que explica la regla cae bajo la regla*. Se arregla como ya
se arregló en la cabecera del módulo y en SCRUM-242 — **rompiendo la forma de ruta** en las
menciones de ejemplo, no relajando el criterio (regla 41). Medido después: **43 · 1 · 6**, igual que
antes de escribir esto.

⚠️ **Lo que sigue contaminado, y va dicho:** las citas literales que este apéndice reproduce
—`GRAPH_REPORT`, `CENSO-RAMAS`, y los nombres de ticket de G1— **suman una cita más** a cada una de
esas rutas. No cambian de cubo, así que el reparto es el mismo, pero el recuento de citadores de
esas entradas lleva dentro a este documento.

---

# APÉNDICE · 22-sep-2026 · SCRUM-534f · El guion H2 reescrito, listo para firma, y las 9 (no 8) afirmaciones de los documentos a terceros

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** sin gate — **NO SE APLICA NADA de esto** (regla 39: texto de cliente lo firma un jefe)
**Medido contra:** `origin/main` = `9ba9ac75559c1cd027e49839338c9e01b1e59b36` · 2026-09-22T08:09:33Z

> ⛔ **ESTA ENTRADA NO CAMBIA NI UNA PALABRA de `YAQU_MASTER.md`, `PACK_GESTORIA.md` ni
> `DECLARACION_RESPONSABLE.md`.** Propone; firma un jefe (J4, `puesto-j4.md`). Aplicarlo es tarea
> aparte, después de la firma.

## PASO 0 — el encargo dice OCHO, medido hoy son NUEVE

El encargo de hoy pide "las OCHO afirmaciones falsas restantes". El censo de esta misma ticket, fase
a (16-sep-2026), ya midió **NUEVE**, no ocho, y hoy se ha vuelto a comprobar una a una contra
`origin/main` = `9ba9ac75...`: las nueve siguen literalmente donde estaban (`docs/legal/PACK_GESTORIA.md`
y `docs/legal/DECLARACION_RESPONSABLE.md` no se han tocado desde el 13-jun-2026, confirmado por
`git log`), y ninguna se resolvió sola. **No eran ocho: van las nueve**, con la discrepancia dicha en
vez de recortada para que cuadre el número del encargo.

## 1 · El guion H2 — el literal completo, para firmar tal cual

**Qué dice hoy** (`docs/YAQU_MASTER.md:215`, dentro de la Parte H2, regla 26 — es la única respuesta
autorizada ante "¿me vale para VeriFactu?"):

> *"Te contesto como fabricante: la facturación VeriFactu está construida y en certificación — con
> declaración responsable del productor, que es lo que tu gestor te pedirá. Por ley no puedo
> activarla hasta cerrarla; por eso la beta es de presupuestos y cobros. Los founding la estrenáis al
> cerrarse, sin cambio de precio. Si quieres, le paso a tu gestor el detalle técnico cuando lo
> publique."*

**Las dos cosas que dice y no son verdad, medidas hoy:**

1. **"está construida y en certificación"** — 🔴 doblemente falso. **(a)** No está construida: de los
   9 eslabones del camino de una factura, existen 7 (huella SHA-256 encadenada, QR, XML con el sobre
   oficial) y **faltan los 2 últimos, la cola de remisión y el envío telemático a la AEAT**
   (`docs/legal/AUDITORIA_CAMINO_EMISION.md`, tabla del punto 1; reconfirmado hoy: `git grep` sobre
   `prisma/schema.prisma` no encuentra ningún modelo `Vf*`/`*Submission`, y sobre
   `src/modules/fiscal/verifactu/` no hay ninguna llamada de red — cero, igual que el 19-ago).
   **(b)** No existe ninguna "certificación" de VeriFactu a la que se pueda estar entrando: el
   régimen se basa en una **declaración responsable** del productor (art. 13 RRSIF), no en un
   proceso de certificación (skill `verifactu`, §0 y §6, verificado contra el BOE).
2. **"por eso la beta es de presupuestos y cobros"** — 🔴 falso desde el 21-sep-2026. La regla 24,
   en su redacción de hoy (`docs/YAQU_MASTER.md:246`), dice literal: *"Con el interruptor en OFF,
   YaQu no emite ningún documento para ese merchant [...] y no cobra por YaQu a sus clientes: ni
   enlace de pago, ni señal al aceptar el presupuesto [...]. Presupuestos, firma, albaranes y partes
   siguen igual. El profesional cobra por fuera de YaQu hasta que exista la factura."* Con
   `INVOICING_ES_ENABLED` en OFF —que es el estado de todo merchant ES real hoy (regla 24, primera
   frase)— **la beta es de presupuestos y firma, no de cobros.** Decirle a un cliente que la beta
   "es de cobros" es prometerle algo que la propia regla 24 firmada hace tres días prohíbe.

**Dato que sostiene la reescritura** (aportado por el orquestador, medición de producción,
22-sep-2026, no re-derivado por esta sesión: no tengo acceso de lectura a producción): **en
producción hay UN solo documento emitido y es un justificante — `F1 = 0` y `R1 = 0`.** YaQu nunca ha
emitido una factura fiscal. Cualquier frase que sugiera una facturación VeriFactu "cerrándose" o "en
marcha" habla de algo que no ha ocurrido ni una vez.

### El literal nuevo — listo para pegar en `docs/YAQU_MASTER.md:215`, sin huecos

> *"Te contesto como fabricante: hoy generamos cada registro de facturación con el formato oficial de
> la AEAT —huella SHA-256 encadenada y QR de cotejo—, pero la remisión a Hacienda todavía no está
> construida: no puedo decir que esté cerrada. Tampoco existe una «certificación» de VeriFactu — el
> régimen se basa en una declaración responsable del fabricante, que publicaremos en cuanto el envío
> esté terminado. Mientras tanto, en España la beta es de presupuestos y firma: no emitimos ningún
> documento de facturación ni cobramos por la app — la señal la gestionas tú por fuera. Los founding
> estrenaréis la facturación VeriFactu con su declaración responsable en cuanto esté cerrada, sin
> cambio de precio. Si quieres, le paso a tu gestor el detalle técnico cuando lo publiquemos."*

**Verificación de cada frase, cláusula a cláusula, contra hoy:**

| cláusula | fuente que la sostiene |
| --- | --- |
| "generamos cada registro... con el formato oficial... huella SHA-256 encadenada y QR" | ✅ es literalmente la frase de "verdad sostenible" de la skill `verifactu` §7, y los eslabones 4/6/7 de la auditoría **EXISTEN** |
| "la remisión a Hacienda todavía no está construida" | ✅ eslabones 8/9 **NO EXISTEN** (auditoría + `git grep` de hoy, arriba) |
| "no existe una «certificación»... declaración responsable del fabricante" | ✅ skill `verifactu` §0 y §6, art. 13 RRSIF |
| "en España la beta es de presupuestos y firma: no emitimos... ni cobramos" | ✅ es case a case el texto de la regla 24 de hoy (`YAQU_MASTER.md:246`) |
| "Los founding estrenaréis... sin cambio de precio" | decisión comercial ya tomada (H1), no es un claim fiscal — se conserva igual que en el guion viejo |

**Qué NO toca esta propuesta:** la línea de categoría y el "PROHIBIDO" que preceden al guion en
`YAQU_MASTER.md:215` (*"categoría = 'herramienta para presupuestar, firmar y cobrar señales por
WhatsApp'"*) — esa frase es del carril de SCRUM-1016 (ya entregado, en curso, esperando que Javier
elija eje) y esta sesión tiene instrucción explícita de no tocarlo. Se deja dicho porque la misma
regla 24 que invalida "cobros" en el guion probablemente también le pesa a esa categoría, pero
**es hallazgo para el otro ticket, no para este.**

## 2 · Las 9 afirmaciones falsas de los documentos a terceros — dónde, por qué hoy, corrección, y quién firma

Las nueve viven en dos plantillas marcadas **BORRADOR — no distribuir hasta SIF-1 8/8** que
acompañan la declaración responsable y el pack de la gestoría. Que estén marcadas borrador no las
exime: `DECLARACION_RESPONSABLE.md` es un documento que un representante legal **firma bajo su
responsabilidad** (art. 13 RRSIF), y un borrador que ya trae la frase falsa escrita se revisa con
menos desconfianza que uno en blanco — lo mismo vale para el one-pager que se le entrega a la
gestoría del cliente. Las nueve comparten la misma causa: afirman en presente que YaQu **remite** los
registros a la AEAT, cuando esa remisión no existe en el código (medido hoy, arriba). Ninguna
necesita al asesor — el hecho que las hace falsas es MEDIBLE en el código, y ahí el árbitro es el
código (`yaqu-verifactu-sif`, decisión del fundador SCRUM-538 punto 2), no una interpretación legal.

| id | fichero:línea (hoy) | frase falsa | por qué es falsa HOY | corrección propuesta | ¿corregible con frase del máster, o pide asesor? |
| --- | --- | --- | --- | --- | --- |
| **A11** | `PACK_GESTORIA.md:12-14` | *"emite cada factura con una huella digital encadenada y la **remite automáticamente a la AEAT** en el momento"* | 0 llamadas de red a la AEAT en `src/` (medido hoy) | *"...emite cada factura con una huella digital encadenada según el formato oficial de la AEAT. La remisión telemática se activará junto con esta declaración, antes de distribuirse este documento."* | **Máster** (código decide; sin asesor) |
| **A12** | `PACK_GESTORIA.md:18-19` | *"Cada registro... se envía a la AEAT en tiempo real a través de su servicio web"* | mismo hecho medible: no existe el envío | *"Cada registro... queda preparado con el sobre oficial de la AEAT, listo para su remisión en cuanto ésta esté construida."* | **Máster** |
| **A13** | `PACK_GESTORIA.md:20-21` | *"la huella SHA-256 encadenada + **la remisión autenticada** cumplen el requisito (RRSIF)"* | la dispensa de firma la cumple la huella encadenada por sí sola (art. 16.2-16.3 RRSIF, "presunción de cumplimiento por diseño" — skill `verifactu` §3); atribuirlo a "la remisión" además de ser prematuro, es la razón equivocada | *"...no se exige firma electrónica: la huella SHA-256 encadenada cumple el requisito por sí sola (art. 16.2-16.3 RRSIF)."* | **Máster** (es cita de ley ya verificada, no interpretación nueva) |
| **A14** | `PACK_GESTORIA.md:39` | *"Al cobrar, YaQu emite la factura, calcula su huella y **la remite a la AEAT**"* | mismo hecho medible | *"Al cobrar, YaQu emite la factura y calcula su huella; la remisión a la AEAT se añadirá con el envío telemático."* | **Máster** |
| **A15** | `PACK_GESTORIA.md:64-65` | *"es el sistema de facturación que **genera y remite** los registros"* | mismo hecho medible | *"es el sistema de facturación que genera los registros con el formato oficial; los remitirá en cuanto el envío esté construido."* | **Máster** |
| **A16** | `DECLARACION_RESPONSABLE.md:11-13` | *"los valores... DEBEN coincidir con el bloque SistemaInformatico que YaQu **remite** en cada registro"* | tiempo presente sobre algo que no ocurre aún; instrucción de plantilla, no frase de cara al cliente, pero la firma un representante legal | *"...DEBEN coincidir con el bloque SistemaInformatico que YaQu remitirá en cada registro, una vez conectado el envío a la AEAT."* | **Máster** |
| **A17** | `DECLARACION_RESPONSABLE.md:39-41` | *"Tipología: sistema... en modalidad VERI\*FACTU (**remisión de los registros... a la AEAT**)"* | describe una capacidad presente que no existe; ⚠️ distinto de P14 (si YaQu ya es "productor" hoy) — **esa pregunta no la contesta esta sesión**, es del asesor | *"...en modalidad VERI\*FACTU (remisión de los registros a la AEAT, una vez completado el envío telemático)."* | **Máster** para el tiempo verbal — **el fondo de si aplica ya el régimen es P14, del asesor** |
| **A18** | `DECLARACION_RESPONSABLE.md:46-49` | *"...y **remisión telemática al servicio web de la AEAT**"* | mismo hecho medible | quitar la cláusula o marcarla "(pendiente de construir)" | **Máster** |
| **A19** | `DECLARACION_RESPONSABLE.md:53` | *"**Remisión inmediata a la AEAT** (modalidad VERI\*FACTU), **con control de flujo**"* | mismo hecho medible, y además **"con control de flujo" nombra un mecanismo que no está decidido en ningún sitio** (ni en U1.3, ni en la skill `yaqu-verifactu-sif`, ni en el stack de S1-0b) | quitar "con control de flujo" en vez de inventar un mecanismo; dejar *"Remisión a la AEAT (modalidad VERI\*FACTU), una vez construido el envío."* | **Máster** para "remisión inmediata"; **"control de flujo" no es fixable con una frase — es diseño técnico sin decidir, y la decisión es de los fundadores, no del asesor fiscal** |

**Resumen de la columna que pedías, para firmar sin riesgo:** de las 9, **9 de 9 son corregibles con
una frase que sale de hechos ya medidos o de ley ya verificada — ninguna necesita al asesor para el
texto en sí.** Lo único que roza al asesor es la pregunta de fondo detrás de A17 (P14: si el plazo del
productor, vencido el 29-jul-2025, ya nos aplica) — y ésa **no se contesta aquí**, ya está registrada
en `PREGUNTAS_ASESOR.md` y en el traspaso de este puesto.

## Lo que NO cubre esta entrada

* ⛔ No se ha tocado `docs/YAQU_MASTER.md`, `PACK_GESTORIA.md` ni `DECLARACION_RESPONSABLE.md` — regla
  39, lo firma un jefe.
* No se ha vuelto a medir la clase B/C/D del inventario `INVENTARIO_AFIRMACIONES_VERIFACTU.md`; esto
  es solo la clase A de esta ticket (guion H2 + los 9 de documentos a terceros).
* No se contesta P14 ni se propone texto para SCRUM-1028 ni SCRUM-1016 (fuera de carril esta tanda,
  con instrucción explícita de no seguir).
* El dato "F1=0 · R1=0 · 1 justificante en producción" es el que me dio el orquestador; esta sesión no
  tiene acceso de lectura a producción y no lo ha vuelto a medir por su cuenta.

---

# APÉNDICE · 22-sep-2026 · SCRUM-534i · El guion H2 y las 3 líneas de "certificación" APLICADAS al máster, con firma comprobable

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** ninguno — aplicación directa, ya firmada
**Medido contra:** `origin/main` = `a71ddc7f85216988872dde3909a624952d555bd3` · 2026-09-22T08:59:50Z

## La firma que autoriza esta aplicación

Comentario **16404** de este mismo ticket (Jira, `SCRUM-534`), escrito por Javier el 22-sep-2026,
**repetido a petición de la sesión ejecutora anterior** porque la firma previa (comentario 16395) le había
llegado relayada por el orquestador y su clasificador de permisos la rechazó (A19: una autorización no se
hereda entre sesiones). El 16404 es la firma DIRECTA, en el canal comprobable, literal:

> «firmo el literal del guion H2 de la fase f» — y, sobre las tres líneas del censo de "certificación"
> (fase h): «Firmo».

Esta sesión (`jv-j4`, relevo) lee ESE comentario, no un mensaje de chat que lo cite.

## Qué se aplicó, exactamente

**C1 · `docs/YAQU_MASTER.md:215`** — el guion único de la regla 26 (Parte H2) cambia al literal completo
firmado en el apéndice de fase f de esta misma ficha ("El literal nuevo — listo para pegar", línea 671).
Pegado TAL CUAL, sin una palabra distinta.

**C2 · `docs/YAQU_MASTER.md:650`** (entrada SCRUM-17) — *"...latente hasta la certificación; visible en
demo)."* → *"...latente hasta que se active la facturación VeriFactu con su declaración responsable;
visible en demo)."*

**C3 · `docs/YAQU_MASTER.md:988`** (V0-6, ESTADO DE EJECUCIÓN) — *"...se activan al cerrar la
certificación, sin cambio de precio"* → *"...se activan al cerrar la declaración responsable del
fabricante, sin cambio de precio"*. **Esto desbloquea el titular del Eje A de la landing (SCRUM-1016)**,
que estaba parado a propósito por depender de esta frase (V0-6).

`git diff --numstat docs/YAQU_MASTER.md` de esta rama: 1 fichero, 3 líneas insertadas + 3 borradas — solo
las tres frases de arriba, nada más tocado (verificado antes de empujar).

## Lo que NO cubre esta entrada

* Las 9 afirmaciones falsas de `PACK_GESTORIA.md`/`DECLARACION_RESPONSABLE.md` (fase f, §2) siguen sin
  aplicarse — la firma del comentario 16404 cubre solo el guion H2 y las 3 líneas de "certificación", no
  esas 9.
* El censo completo de fase h (`SCRUM-534h`, PR #1651, sin mergear a la hora de esta entrada) descartó 11
  de 14 apariciones de "certifica" por no ser la idea falsa; esas 11 no se tocan aquí.
* El titular/subtítulo/`<title>` del Eje A (SCRUM-1016) no se escriben en esta entrada — carril aparte
  (encargo 3 de esta tanda), ahora desbloqueado por C3.
## SCRUM-534h · Censo de "certificación" de VeriFactu en el máster (y CLAUDE.md) — PROPUESTA, nada aplicado

**Medido contra:** `origin/main` = `194a7061369347a9fdf96766a11efd7191476301` · 2026-09-22T08:38:19Z

**Encargo:** el orquestador del equipo (`cobroflash-backend-da`), por mensaje entre sesiones el
22-sep-2026, dice que Javier firmó el literal nuevo del guion H2 (§1 de esta ficha, fase f) y con él
resolvió a favor de "no existe certificación, es declaración responsable" la contradicción que esta
misma ficha había dejado sin resolver frente a V0-6. Pide aplicar el guion a
`docs/YAQU_MASTER.md:215` y censar todo sitio con la misma idea falsa.

**🔴 Lo que esta sesión NO hizo, y por qué:** no aplicó nada a `docs/YAQU_MASTER.md`. El clasificador
de permisos bloqueó el intento de registrar la aplicación citando "Instruction Poisoning", y al
pararme a revisarlo mis propias normas dicen lo mismo desde otro ángulo: **A7** exige que la firma
delegada del orquestador sea "un comentario de Jira" registrado en `docs/microcopy/` con su README
— comprobable, no un mensaje de chat citado de memoria — y **A19** dice que ninguna autorización se
hereda de otra sesión. El mensaje no traía ese comentario de Jira. Este es exactamente el tipo de
texto para el que existen las STOP conditions de mi ficha (claims fiscales/VeriFactu): se propone y
se para. La edición que había empezado a hacer en un worktree aparte (`scrum-534g-h2-firmado-en-master`)
se dejó SIN commitear y SIN empujar — no llega a nadie. Lo que sigue es solo censo y propuesta.

**Población:** `grep -n -i "certifica" docs/YAQU_MASTER.md` → 13 líneas con la raíz "certifica" +
1 más con "Certificado" en mayúscula al inicio de frase (14 en total) · el mismo grep sobre
`CLAUDE.md` → **0 líneas** (control positivo: el patrón SÍ encuentra las 14 del máster, así que el
cero de `CLAUDE.md` es "no hay", no "no miré").

**De las 14, 11 NO son la idea falsa — descartadas con su motivo:**

| línea | qué dice | por qué NO cuenta |
| --- | --- | --- |
| 102 | "Certificado digital FNMT (HUMANO, día 1) → desbloquea SIF-1" | el certificado FNMT es real y existe; autentica, no "certifica VeriFactu" |
| 465 | `SIF_ENABLED`: "Depende de: certificado + S1-D" | mismo certificado FNMT real |
| 513 | "cada merchant remite con su propio certificado" (Modelo C) | idem, certificado FNMT de cada merchant |
| 649 | bloque del PDF de albarán "Certificado de evidencias" | nombre de un bloque de evidencia de firma, sin relación con VeriFactu |
| 962 | "cert FNMT ✅ conseguido 15-jun" | certificado FNMT real, ya obtenido |
| 971 | "certificado emitido + cita asesor" | idem |
| 1037 | "certificado FNMT + alta entorno pruebas AEAT" | idem |
| 1346 | "...certificaría una tanda que leyó artefactos reescritos a mitad" | verbo "certificar" sobre un guard de tests, sin relación con VeriFactu |
| 1513 | "remisión... es servicio web SOAP con certificado" | certificado digital del canal de transporte, no una "certificación" de VeriFactu |
| 1738, 1864 | "STEL Order: ...VeriFactu certificado..." | describe el producto de un COMPETIDOR, no un estado de YaQu |

**Las 3 que SÍ son la misma idea falsa que el guion H2 corrige — literal propuesto para cada una:**

| id | fichero:línea | texto de hoy | por qué es la misma idea que el guion H2 corrige | literal propuesto |
| --- | --- | --- | --- | --- |
| **C1** | `YAQU_MASTER.md:215` (Parte H2, guion citado en regla 26) | *"...la facturación VeriFactu está construida y en certificación..."* | es el propio guion que Javier ya firmó (fase f/g de esta ficha) | el literal completo ya está escrito arriba, en "El literal nuevo — listo para pegar" (fase f). **No se repite aquí para no crear una tercera copia que diverja** — pendiente de aplicarse con la firma por el canal comprobable |
| **C2** | `YAQU_MASTER.md:650` (entrada SCRUM-17) | *"Doc de usuario: `docs/COMO_FUNCIONA_YAQU.md` §5 (honesto: latente hasta la certificación; visible en demo)."* | mismo régimen: no hay "certificación" de VeriFactu que cerrar, es una declaración responsable | *"Doc de usuario: `docs/COMO_FUNCIONA_YAQU.md` §5 (honesto: latente hasta que se active la facturación VeriFactu con su declaración responsable; visible en demo)."* |
| **C3** | `YAQU_MASTER.md:988` (V0-6, ESTADO DE EJECUCIÓN) | *"...(`docs/legal/ALCANCE_BETA.md`: \"presupuestos+firma+**albaranes**; **el cobro a tus clientes y** la facturación VeriFactu se activa**n** al cerrar la certificación, sin cambio de precio\")"* | es la frase que el encargo 1 de hoy (Eje A de la landing) iba a citar como ancla, y es la que choca directamente con el guion H2 nuevo | *"...la facturación VeriFactu se activa**n** al cerrar la declaración responsable del fabricante, sin cambio de precio"* — mismo giro que usa el guion H2 ya firmado, para que las dos frases digan la misma cosa con las mismas palabras |

**Hallazgo fuera del alcance pedido, declarado y no tocado:** `docs/legal/ALCANCE_BETA.md` (que NO es
máster ni `CLAUDE.md`, así que no entra en este censo por encargo) cita **V0-6 literalmente** en su
cabecera y en su §2 con la misma frase "se activa al cerrar la certificación". En cuanto C3 se firme,
ese fichero hereda la misma corrección — lo señalo para que quede en la cola, no lo propongo aquí
porque el encargo de hoy pedía solo máster y `CLAUDE.md`.

## Lo que NO cubre esta entrada (h)

* No aplica C1/C2/C3 a `docs/YAQU_MASTER.md` — quedan propuestos, a la espera de la firma por el
  canal comprobable (comentario de Jira + `docs/microcopy/`, o el propio Javier en este chat).
* No propone texto para `docs/legal/ALCANCE_BETA.md` (fuera del máster/CLAUDE.md pedido hoy).
* No vuelve a medir las 9 afirmaciones a terceros de la fase f (siguen igual, sin firma).

---

# APÉNDICE · 23-sep-2026 · SCRUM-534k · Re-medición de las 9 (encargo 2, parte 2) — nada nuevo, nada aplicado

**Fecha:** 23-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** ninguno — solo lectura,
propone; no toca `PACK_GESTORIA.md`, `DECLARACION_RESPONSABLE.md` ni `YAQU_MASTER.md` (regla 39)
**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:12:12Z

**Encargo:** el orquestador pidió re-medir las «8 afirmaciones falsas» de esta ficha (parte 2 del
ticket, reabierto porque el cierre anterior solo verificó la parte 1, el guion H2) porque el guion
H2 y el censo de "certificación" cambiaron en `YAQU_MASTER.md` desde el 22-sep, y podían haber
arrastrado a `PACK_GESTORIA.md`/`DECLARACION_RESPONSABLE.md` con ellos.

**Resultado: no arrastraron nada. Siguen siendo 9, no 8, y son las MISMAS 9 de la fase f, palabra
por palabra.**

- `git log --oneline -- docs/legal/PACK_GESTORIA.md docs/legal/DECLARACION_RESPONSABLE.md` → los
  dos únicos commits son de su creación (13-jun-2026, S1-H y S1-E). **Ningún commit los ha tocado
  desde entonces**, tampoco los tres de fase i (C1/C2/C3 viven solo en `YAQU_MASTER.md`).
- Los dos ficheros, leídos ENTEROS hoy (76 + 104 líneas, no solo las líneas ya censadas): A11-A19
  siguen literalmente en su sitio (mismas líneas: `PACK_GESTORIA.md:12-14/18-19/20-21/39/64-65`,
  `DECLARACION_RESPONSABLE.md:11-13/39-41/46-49/53`). Cero candidatas nuevas — revisado el resto del
  texto (F1/F2 400€, exports, QR, inalterabilidad…) y nada más afirma en presente una remisión a la
  AEAT que no exista.
- El hecho que las hace falsas se re-verificó hoy, no se dio por bueno de ayer: `grep -n "model Vf\|Submission" prisma/schema.prisma`
  → 0 · `grep -rn "fetch(\|axios\|https.request\|http.request\|net.connect" src/modules/fiscal/verifactu/`
  → 0. Sigue sin existir ninguna remisión a la AEAT en el código.
- Comprobado que la ruta que SÍ cita `PACK_GESTORIA.md` §5 (`GET /admin/exports/verifactu.xml`)
  existe de verdad (`src/modules/exports/app/routes/exports.routes.ts:531`) — no es una décima
  afirmación falsa, es correcta.

**🔴 Sobre la trampa de "certificación" que avisó el orquestador: ninguna de las 9 es de esa
familia.** Las 9 afirman en presente que YaQu **remite/envía** registros a la AEAT (una capacidad de
código que no existe); la familia "certificación" (C1/C2/C3, fase h/i, ya aplicada en
`YAQU_MASTER.md` con firma del comentario 16404) afirmaba que existe un proceso de *certificación*
de VeriFactu al que se está entrando, cuando el régimen real es una *declaración responsable* (art.
13 RRSIF). Son dos ideas falsas distintas, con víctimas distintas: la de "certificación" es interna
(máster/landing); la de "remite" va en dos documentos que se **entregan a terceros** (gestoría del
cliente, y una declaración que firma un representante legal bajo su responsabilidad) — por eso ésta
es la que "más daño hace", como pedía el orquestador. Sí aparece la palabra "Certificación" una vez
en `DECLARACION_RESPONSABLE.md:103`, pero es el título literal de la FAQ de la AEAT que se cita como
fuente ("Certificación de los sistemas informáticos: declaración responsable"), no una afirmación
sobre YaQu — no es una décima falsa ni pertenece a la familia C1-C3.

**El diff, listo para firmar (idéntico al de la fase f — re-confirmado hoy, no reescrito):**

| id | dónde | sale | entra | por qué la nueva es verdad hoy |
| --- | --- | --- | --- | --- |
| A11 | `PACK_GESTORIA.md:12-14` | "...emite cada factura con una huella digital encadenada y la **remite automáticamente a la AEAT** en el momento." | "...emite cada factura con una huella digital encadenada según el formato oficial de la AEAT. La remisión telemática se activará junto con esta declaración, antes de distribuirse este documento." | 0 llamadas de red a la AEAT en `src/` (re-medido hoy) |
| A12 | `PACK_GESTORIA.md:18-19` | "Cada registro de facturación (alta, rectificativa y anulación) se envía a la AEAT en tiempo real a través de su servicio web." | "Cada registro de facturación (alta, rectificativa y anulación) queda preparado con el sobre oficial de la AEAT, listo para su remisión en cuanto ésta esté construida." | mismo hecho medible |
| A13 | `PACK_GESTORIA.md:20-21` | "...la huella SHA-256 encadenada + **la remisión autenticada** cumplen el requisito (RRSIF)." | "...no se exige firma electrónica: la huella SHA-256 encadenada cumple el requisito por sí sola (art. 16.2-16.3 RRSIF)." | art. 16.2-16.3 RRSIF, "presunción de cumplimiento por diseño" (skill `verifactu` §3) — la huella basta sola, atribuirlo a la remisión es la razón equivocada además de prematura |
| A14 | `PACK_GESTORIA.md:39` | "Al cobrar, YaQu emite la factura, calcula su huella y **la remite a la AEAT**." | "Al cobrar, YaQu emite la factura y calcula su huella; la remisión a la AEAT se añadirá con el envío telemático." | mismo hecho medible |
| A15 | `PACK_GESTORIA.md:64-65` | "...es el sistema de facturación que **genera y remite** los registros..." | "...es el sistema de facturación que genera los registros con el formato oficial; los remitirá en cuanto el envío esté construido." | mismo hecho medible |
| A16 | `DECLARACION_RESPONSABLE.md:11-13` | "Los valores del sistema DEBEN coincidir con el bloque `SistemaInformatico` que YaQu **remite** en cada registro de facturación." | "...que YaQu remitirá en cada registro de facturación, una vez conectado el envío a la AEAT." | mismo hecho medible |
| A17 | `DECLARACION_RESPONSABLE.md:39-41` | "Tipología: sistema informático de facturación en modalidad VERI\*FACTU (**remisión de los registros de facturación a la AEAT**)." | "...en modalidad VERI\*FACTU (remisión de los registros a la AEAT, una vez completado el envío telemático)." | corrige el tiempo verbal; el fondo de si el régimen ya aplica hoy es P14, pendiente del asesor — no se decide aquí |
| A18 | `DECLARACION_RESPONSABLE.md:46-49` | "...y **remisión telemática al servicio web de la AEAT**." | se quita la cláusula, o se marca "(pendiente de construir)" | mismo hecho medible |
| A19 | `DECLARACION_RESPONSABLE.md:53` | "**Remisión inmediata a la AEAT** (modalidad VERI\*FACTU), **con control de flujo**." | "Remisión a la AEAT (modalidad VERI\*FACTU), una vez construido el envío." | mismo hecho medible; "con control de flujo" además nombra un mecanismo sin decidir en ningún sitio (ni U1.3, ni la skill, ni el stack de S1-0b) — se quita, no se inventa |

**No se aplica nada de esto** — regla 39, la firma es de Javier. Este apéndice es la confirmación de
que el trabajo de la fase f **sigue vigente sin cambios**, para que se firme sobre él con la
seguridad de que no quedó desfasado por lo de anoche.

## Lo que NO cubre esta entrada (k)

* No aplica A11-A19 a `PACK_GESTORIA.md` ni a `DECLARACION_RESPONSABLE.md`.
* No repite el censo del guion H2 ni de la familia "certificación" (fase f/h/i) — ya aplicado,
  fuera del alcance de esta parte 2 del ticket.
* No decide P14 (si el régimen VeriFactu ya aplica hoy a YaQu) — sigue siendo pregunta del asesor.
# APÉNDICE · 23-sep-2026 · SCRUM-534j · El expediente de `VfSubmission` (parte 3): qué dice el máster, qué hay de verdad, quién bebe, y el texto para firmar

**Fecha:** 23-sep-2026 · **Carril:** J1 (facturación y VeriFactu) · **Gate:** ninguno — **NO SE APLICA NADA a `docs/YAQU_MASTER.md`** (regla 39: lo firma un jefe; el clasificador de permisos de esta sesión bloquea ese fichero por CONTENIDO)
**Medido contra:** `origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:09:09Z

> Encargo del orquestador (`jv-j1`, relevo): SCRUM-534 tiene tres partes; la primera (guion H2) ya
> está aplicada (fase i). Ésta es la tercera — el interno ⚪ de la fase a, clase A2/A3/A4: la FSM
> `VfSubmission` de la Parte L y quien la cita como si existiera. **Mide y propón. No construye.**

## PASO 0 — lo ya medido, confirmado de un vistazo

`VfSubmission` aparece **4 veces en `docs/YAQU_MASTER.md`** y **0 veces en `prisma/schema.prisma`**
(`git grep -n "VfSubmission" origin/main -- prisma/schema.prisma` → sin resultado, exit 1).
Confirmado hoy contra `62176956...`, sin discrepancia con lo que traía el encargo.

## § 1 · Qué publica la Parte L (y sus vecinas) sobre `VfSubmission` — las 4 apariciones, literales

| # | dónde (`YAQU_MASTER.md`) | texto literal completo | qué promete |
| --- | --- | --- | --- |
| **L1** | `:156`, Parte D2 (capas nuevas y fase) | *«`src/modules/fiscal/verifactu/` ← SIF-1 (F1): `sif.client.ts` + cola `VfSubmission`»* | ✅ **no es la parte defectuosa** — vive bajo el epígrafe «Capas nuevas», explícitamente prospectivo. Se cita por completitud del censo, no se toca. |
| **L2** | `:404`, Parte L (*«STATE MACHINES OFICIALES · FUENTE DE VERDAD, regla 27»*) | *«**VfSubmission:** `pending → sent → accepted` · `sent → rejected(error) → pending(retry, attempts++)` · `attempts≥5 → manual_review`. accepted terminal.»* | 🔴 **el defecto central.** Formato IDÉNTICO al de Quote/Invoice/Charge, que sí existen — nada en la frase distingue «esto es diseño» de «esto está construido», y la sección donde vive se declara *fuente de verdad* por la regla 27. |
| **L3** | `:449`, Parte O (runbooks), R7 | *«**R7 · SIF rechaza registros:** leer `VfSubmission.lastError` → dato de factura: corregir vía R1 si emitida; estructural (XSD/firma): `SIF_ENABLED=false` + avisar asesor; la emisión local sigue y la cola remite al reanudar. Documentar en VERIFACTU_EVIDENCIAS.»* | 🔴 **el segundo defecto**, y el más caro operativamente: es un runbook, formato imperativo, sin marca de futuro — se lee y se sigue durante una incidencia real. Cita además `docs/VERIFACTU_EVIDENCIAS.md`, que tampoco existe (medido en la fase b de este mismo ticket). |
| **L4** | `:1042`, Parte U1.3 (S1-D, una de las 8 obligatorias de SIF-1) | *«**S1-D · Envío en pruebas AEAT:** `src/modules/fiscal/verifactu/sif.client.ts` + cola `VfSubmission {invoiceId,status,attempts,lastError}` + retry backoff + incidencias/subsanación + logs legibles. Done: ≥10 registros (alta/anulación/R1) aceptados consecutivos.»* | ✅ **tampoco es la parte defectuosa** — es un ítem de checklist con su criterio de «Done», sin el ✅ que sí llevan S1-A/B/C. Se lee como tarea, no como hecho. |

**Resultado:** de las 4, **2 son el defecto** (L2, L3) y **2 están correctamente enmarcadas como
futuro** (L1, L4). La enmienda solo necesita tocar L2 y L3.

**Hallazgo colateral, fuera de las 4 pero de la misma causa — no se re-propone aquí, se deja
dicho:** la fila `SIF_ENABLED` de la Parte P (`:465`) dice *«seguro: cola pausa, emisión local
sigue»* — la misma idea falsa (que hay una cola que pausar) sin usar la palabra `VfSubmission`, así
que el censo por texto literal no la encuentra. La corrige quien firme L2, porque describir bien
qué es `vfEstado` hace obvio que no hay nada que "pausar".

## § 2 · Qué existe de verdad — por lectura de fuente, no por grep

**La columna real es `Invoice.vfEstado`** (`prisma/schema.prisma`, dentro de `model Invoice`,
`@@map("invoices")`): un **campo STRING en la propia factura**, no una tabla ni una entidad aparte.
Sus hermanas, todas en el mismo modelo: `vfHash`/`vfPrevHash`/`vfTimestamp` (alta) y
`vfAnulHash`/`vfAnulTimestamp`/`vfAnulPrevHash` (anulación) — siete columnas, cero tablas.

**Los estados reales son 3, no 6**, definidos en `src/modules/invoicing/domain/selladoEstado.ts`:

```
SELLADO_PENDIENTE = 'pendiente_de_sellado'   (nace así; default del schema)
SELLADO_HECHO     = 'sellado'
SELLADO_NO_APLICA = 'no_aplica'              (justificantes, merchant sin NIF o no-ES)
```

**Las transiciones reales** (leídas en `selladoEstado.ts`, funciones `estadoAlNacer` y
`sellarTrasEmision`, no un grep de la palabra):

- **Nacimiento** → `pendiente_de_sellado` si el documento entra en la cadena VeriFactu
  (`entraEnLaCadena`), si no → `no_aplica` directamente.
- `pendiente_de_sellado → sellado`: al terminar `applyVeriFactu` (huella SHA-256 + QR) con éxito,
  **después** del commit de la emisión.
- `pendiente_de_sellado → pendiente_de_sellado` (se queda igual): si `applyVeriFactu` lanza. Queda
  un `AuditLog` (`action: 'sellado_fallido'`) con el motivo. **No hay reintento automático, ni
  contador de intentos, ni ningún estado tipo `manual_review`** — eso es diseño de la FSM de la
  Parte L, no código que exista.
- **`sellado` es terminal para este campo.** Anular NO lo cambia (`sellarAnulacionTrasEmision` no
  toca `vfEstado`, y lo dice el propio comentario del fichero: el registro de anulación es un
  eslabón MÁS de la cadena, no un cambio de estado del alta — regla 29).

**Lo que esto significa para la FSM de la Parte L:** `vfEstado` describe el **sellado LOCAL** (huella
+ QR calculados y persistidos), no la **remisión a la AEAT**. Ningún estado real se llama `pending`
con el mismo sentido de la Parte L (que es «a la espera de que la AEAT conteste»), ni existe
`sent`, `rejected`, `accepted` ni `manual_review` en ningún sitio — coherente con lo ya medido en la
fase a de este ticket (②: cero llamadas de red a la AEAT en `src/`) y con la auditoría
`docs/legal/AUDITORIA_CAMINO_EMISION.md` (eslabones 8 y 9: NO EXISTE).

## § 3 · Quién bebe — medido, no de oídas

**Metodología:** `git grep -l "VfSubmission" origin/main` sobre todo el repo → **33 ficheros**. De
esos 33 se descarta: el propio `YAQU_MASTER.md` (es la fuente, no un bebedor), 1 copia congelada en
`docs/historico/` (política ya fijada en la fase b de este ticket: no se toca), y **28 que YA citan
la ausencia correctamente** — auditorías (`AUDITORIA_CAMINO_EMISION.md`, los dos `INVENTARIO_*`,
`SEMAFORO_MAPA_EMISION.md`), entradas de `docs/master/*` que la miden como inexistente (298, 328,
524, 525, 538, 566, 575, 815, 955 y sus evidencias), el guard `_guard-afirmacion-fiscal.mjs` (es el
mecanismo de detección, no un bebedor), 3 comentarios de código que ya dicen «NO EXISTE»
(`modoVisible.ts`, su test, y `correoDeFacturaEnviado.ts` que solo cita la lista cerrada de FSMs de
la Parte L sin afirmar que funciona) y `docs/SIF_SPEC_NOTES.md` (ya lleva las etiquetas
`[SE HARÁ]` de SCRUM-566).

**Quedan 4 — y son éstos, no los que nombraba el traspaso** (que hablaba de A3/A4 *dentro* del
máster + el runbook; aquí se cuentan ficheros *fuera* de `YAQU_MASTER.md` que tratan
`VfSubmission` como si ya existiera, sin ningún aviso):

| # | fichero | qué dice, sin aviso de que no existe | riesgo |
| --- | --- | --- | --- |
| **D1** | `docs/RUNBOOKS.md:75-81` (R7) | copia casi literal de L3, y AÑADE un guion para el merchant: *«Tus facturas siguen emitiéndose con normalidad; la remisión a la AEAT se reanuda en cuanto cerremos la incidencia técnica.»* | 🔴 **el más caro**: es el documento que se abre EN UNA INCIDENCIA REAL, y lleva un guion que le mentiría a un cliente sobre un servicio que no existe. |
| **D2** | `.agents/skills/yaqu-verifactu-sif/SKILL.md:3,28-29` | el campo `description` (se carga en TODA sesión, no solo al invocar la skill — es el mismo mecanismo de exposición que documentó `INVENTARIO_AFIRMACIONES_SKILLS.md` para la copia de `.claude/`) dice *«cola VfSubmission, envío AEAT»*, y el cuerpo repite la FSM como «regla dura» sin ninguna marca. | 🔴 **alto**: es una COPIA DESINCRONIZADA. `.claude/skills/yaqu-verifactu-sif/SKILL.md` (la que se cargó al empezar esta tanda) SÍ está corregida desde SCRUM-538/566 — con `🔴 NO CONSTRUIDO` delante de la FSM. La de `.agents/` se quedó con el texto viejo. |
| **D3** | `docs/legal/SEMAFORO_CALIBRACION.md:196-198` | *«La cola `VfSubmission` (máster, Parte L) es el sitio donde se gestionan»* (los códigos de rechazo `3000-3004` de la AEAT) | 🟡 medio: documento técnico/legal sobre códigos de error, no un runbook de incidencia, pero lo mismo — asume que el sitio donde gestionarlos ya existe. |
| **D4** | `docs/equipo/puesto-j1.md:15-16` | lista *«VeriFactu (huella, QR, registros, la cola `VfSubmission`, el envío a la AEAT)…»* dentro del área que este mismo puesto tiene asignada | ⚪ bajo: es una ficha interna de equipo, y quien la lee (yo, ahora mismo) descubre la verdad en el primer ticket. Se cita por completitud. |

**Por qué el número no es «cuatro» por la misma razón que decía el traspaso:** el traspaso
apuntaba a una relación DENTRO del máster (A2 → beben A3, A4, el runbook — es decir 3 sitios, dos
de ellos dentro del propio `YAQU_MASTER.md`). Medido aquí con otro criterio —ficheros AJENOS al
máster que tratan `VfSubmission` como real— la cifra también da 4, pero es OTRA lista (RUNBOOKS +
la skill duplicada + SEMAFORO_CALIBRACION + puesto-j1), y coincide con el número por composición
distinta, no porque ambas cuentas midan lo mismo. Quede dicho para que nadie lea «4» dos veces
como si fuera un solo hecho verificado dos veces.

## § 4 · El texto de la enmienda — dos opciones, para que Javier elija y firme

**Ninguna de las dos toca `docs/YAQU_MASTER.md`.** Van aquí, literales, listas para pegar el día
que haya firma (regla 39).

### Opción A — anotar con `[SE HARÁ]` (mínimo cambio; conserva el diseño donde está)

Misma convención que ya aplicó SCRUM-566 en `SIF_SPEC_NOTES.md`. Sustituye **L2** por:

> **VfSubmission `[SE HARÁ — no construida; no está en `prisma/schema.prisma`, medido]`:** diseño
> para cuando exista la remisión a la AEAT (S1-D): `pending → sent → accepted` ·
> `sent → rejected(error) → pending(retry, attempts++)` · `attempts≥5 → manual_review`. accepted
> terminal. **Lo que existe hoy es otra cosa, con otro nombre:** el sellado LOCAL de cada factura
> vive en `Invoice.vfEstado` (`pendiente_de_sellado → sellado`, o `no_aplica` si el documento nunca
> entra en la cadena) — ver `src/modules/invoicing/domain/selladoEstado.ts`.

Y **L3** por:

> **R7 · SIF rechaza registros `[SE HARÁ — no puede ocurrir hoy: no hay remisión a la AEAT,
> medido]`:** cuando exista la cola de remisión (S1-D), leer su último error → dato de factura:
> corregir vía R1 si emitida; estructural (XSD/firma): `SIF_ENABLED=false` + avisar asesor; la
> emisión local sigue y la cola remite al reanudar. Documentar en VERIFACTU_EVIDENCIAS (tampoco
> existe, medido en SCRUM-534b).

**Pro:** cambio de una frase por entrada; conserva el diseño ya decidido para S1-D en el mismo
sitio donde alguien construyendo esa tarea iría a buscarlo. **Con:** la Parte L se declara
*«FUENTE DE VERDAD»* (regla 27) — mezclar ahí una entrada real (Quote, Invoice…) con una etiquetada
`[SE HARÁ]` es la misma mezcla de hechos y plan que SCRUM-566 corrigió sacándola de
`SIF_SPEC_NOTES.md`; aquí se propone dejarla dentro, solo con la etiqueta.

### Opción B — sacar el diseño de la Parte L, documentar solo lo que hay

Sustituye **L2** por (deja de listarse como `VfSubmission`; se documenta la entidad real, con su
nombre real):

> **Invoice.vfEstado (sellado local — NO es la remisión a la AEAT):**
> `pendiente_de_sellado → sellado` (huella SHA-256 + QR calculados y persistidos tras el commit de
> la emisión) · `pendiente_de_sellado → no_aplica` (documento que nunca entra en la cadena:
> justificante, o merchant sin NIF/no-ES). `sellado` es terminal para este campo — anular no lo
> cambia (regla 29; el registro de anulación es un eslabón más, no un estado nuevo). Fuente:
> `src/modules/invoicing/domain/selladoEstado.ts`. **La cola de remisión a la AEAT no está
> construida** — no hay tabla, no hay envío, cero llamadas de red
> (`docs/legal/AUDITORIA_CAMINO_EMISION.md`, eslabones 8-9). Su diseño (antes descrito aquí como
> `VfSubmission`) queda en S1-D, Parte U1.3, para cuando se construya.

Y **L3** por (describe solo lo que puede fallar HOY, sin inventar un mecanismo que no existe):

> **R7 · Falla el sellado local de una factura:** `vfEstado` se queda en `pendiente_de_sellado`; la
> huella SHA-256/QR no se pudo calcular tras la emisión (motivo en `AuditLog`, acción
> `sellado_fallido`); la factura no produce PDF ni QR hasta resellarse. **[FALTA decidir el
> mecanismo de reintento — no hay uno automático hoy, medido; no se propone uno aquí porque
> inventarlo es del carril de código, no de este expediente.]** Esto es distinto de un rechazo de
> la AEAT: esa remisión no está construida (S1-D), así que hoy no puede rechazar nada.

**Pro:** la Parte L vuelve a ser 100% lo que su cabecera promete —hechos, no diseño—, y R7 deja de
prometer una acción que nadie puede ejecutar. **Con:** cambio mayor; y destapa un hueco real —no
hay runbook para un fallo de sellado local— que esta entrada señala pero no resuelve (es decisión
de producto/soporte, no un texto que se pueda derivar solo de lo medido).

**Recomendación de esta sesión, sin decidir por Javier:** Opción B para L2 (la Parte L gana más
siendo estrictamente cierta que conservando el diseño con una etiqueta) y Opción A para L3 si se
prefiere no abrir ahora el hueco del runbook de sellado — son combinables independientemente.

## Verificación

* ✅ **Control positivo** — el mismo `git grep -l "VfSubmission"` que da 33 ficheros SÍ encuentra
  `docs/YAQU_MASTER.md`, así que la ausencia de ese fichero de la lista de «28 ya corregidos» no es
  ceguera: se excluyó a propósito por ser la fuente.
* ✅ **Dos instrumentos independientes para §2** — el schema (`prisma/schema.prisma`, declarativo)
  y el código (`selladoEstado.ts`, comportamiento) coinciden en los mismos 3 estados; no se leyó
  solo uno.
* 🔴 **Suelo** — 0 en `prisma/schema.prisma` no es ceguera: el mismo grep encuentra 30 modelos
  reales (`Invoice`, `InvoiceAssignee`…), así que el cero es «no está», no «no miré» (mismo control
  que ya dejó escrito la fase a).
* ⚠️ **D2 (`.agents/`) es hallazgo de esta sesión, no heredado**: no aparece en el censo de
  SCRUM-538/566 porque esos censos midieron `.claude/skills/` y `docs/`/`docs/legal/`, no
  `.agents/skills/`. Ninguna entrada previa de este ticket ni de esos dos lo cubre.

## Lo que NO cubre esta entrada

* ⛔ No toca `docs/YAQU_MASTER.md`, `docs/RUNBOOKS.md`, ninguna de las dos copias de la skill, ni
  `SEMAFORO_CALIBRACION.md` ni `puesto-j1.md` — regla 39 para el máster; para el resto, el mandato
  de esta tanda es medir y proponer, no construir.
* No decide entre Opción A y Opción B — las dos quedan listas para que Javier elija y firme.
* No re-abre la fila `SIF_ENABLED` de la Parte P (`:465`) ni la línea `:580` — comparten la misma
  causa (señalado en §1) pero no llevan la palabra `VfSubmission`, así que quedan fuera del
  alcance literal del encargo; se nombran para que no se pierdan, no se proponen aquí.
* No corrige D1-D4: son consecuencia de lo que se firme en L2/L3, y arreglarlos antes sería fijar
  cuatro textos que la firma podría volver a mover.
