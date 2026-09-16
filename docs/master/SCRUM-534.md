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
