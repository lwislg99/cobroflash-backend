# SCRUM-1553 · «listo-para-construir» en `equipo-javier`: de 24, ninguno lo es para nuestro equipo sin más — 17 esperan una decisión, 2 ya están, 5 tienen trabajo de otro carril o en vuelo

**Medido contra:** `origin/main` = `c30729832c18b65c3793917ca836868e6cfdaa6e` · 2026-10-14T03:23:44Z

A9: aviso → A10 «La lista que decide qué se mira es la única que nadie mira.» — no se pudo comprobar: la etiqueta vive en Jira y no en el árbol, y ningún test del repo puede leer Jira; la clasificación de este censo es una LECTURA de textos (tres lectores), no un instrumento que pueda correr en CI

J2 (sesión `jv-j2d`, equipo de Javier), por encargo de su orquestador (`cobroflash-backend-2e`); el ticket es
`area-j3` y el cruce de carril lo declara el orquestador en su encargo. **Es LECTURA:** no se ha tocado ninguna
etiqueta, ni comentario ajeno, ni transición en Jira; no se ha tocado `src/`, `public/`, tests, guards ni
workflows. Entran este registro y `docs/master/evidencias/SCRUM-1553/`. El hook de arranque dijo «SIN
IDENTIDAD» (SCRUM-1549); se siguió por la orden escrita del orquestador.

## 0 · La respuesta corta

| Clase | Cuántos | Cuáles |
| --- | --- | --- |
| 🔴 **ESPERA UNA DECISIÓN** (sola o con parte ya en `main`) | **17** | 1043 · 1050 · 1051 · 1052 · 1054 · 1055 · 1058 · 1063 · 1064 · 1065 · 1066 · 1067 · 1076 · 1077 · 1401 · 1403 · 1502 |
| 🔴 **YA ESTÁ** (entero en `main`; sólo queda cerrarlo, A13) | **2** | 1246 · 1481 |
| **LISTO DE VERDAD** (falta trabajo, sin decisión escrita pendiente) | **5** | 1408 ② (carril S1, vía SCRUM-1504) · 1503 (carril S3) · 1505 (carril S5) · 1548 ② (con precondición: averiguar de quién es `scripts/guards-entrada.mjs`) · 1550 (construido, en el PR #2416 abierto) |
| **NO HE PODIDO MIRAR** | **0** | — |

**Ninguno de los 24 es trabajo que una sesión del equipo de Javier pueda coger mañana sin preguntar a nadie.**
Los cinco «listos de verdad» son de un carril del equipo de Luis (1408, 1503, 1505), están ya construidos y
en vuelo (1550), o llevan una precondición escrita sin resolver (1548).

## 1 · La población, y cómo se derivó

- Consulta: `project = SCRUM AND labels = "listo-para-construir" AND statusCategory != Done`, hecha el
  14-oct hacia las 04:20Z: **34** tickets (`totalCount` 34, `hasNextPage: false`).
- De esos, **24** llevan `equipo-javier`; dos de ellos también llevan `equipo-luis` (1503, 1505). Los otros
  **10** son solo `equipo-luis` (332, 334, 774, 1045, 1056, 1069, 1072, 1074, 1144, 1231): fuera del
  ticket, no censados.
- Foto guardada: `docs/master/evidencias/SCRUM-1553/foto-jira-2026-10-14.tsv` (clave, estado, etiquetas).
- **Error mío, dicho:** la consulta la lancé sin `labels = "equipo-javier"` y filtré a mano por la columna de
  etiquetas. La foto lleva las etiquetas de cada fila para que el filtro se pueda repetir.

## 2 · Los controles

| Control | Esperado | Salió |
| --- | --- | --- |
| **NEGATIVO** · un ticket sin la etiqueta no aparece | 1132, 1508 y 1496 (ya se la quitó el orquestador) fuera de la consulta | fuera: no están entre los 34; entran en la tabla solo como controles forzados |
| control a cero del censo de la casa (SCRUM-9999, en la misma pasada) | NADA EN MAIN | NADA EN MAIN ✅ |
| 🔴 **POSITIVO** · 1496 | YA ESTÁ | **YA ESTÁ** (#2263). El lector añadió además lo que pide c.19528 del 14-oct: anexar la foto 1496b (ya va dentro del PR #2416 de SCRUM-1550) y mover el script a `scripts/equipo/` (necesita el visto bueno de S5) |
| 🔴 **POSITIVO** · 1508 | YA ESTÁ + ESPERA DECISIÓN | **YA ESTÁ + ESPERA DECISIÓN** (c.18868, «Sin elegir») |
| 🔴 **POSITIVO** · 1132 | ESPERA DECISIÓN | **ESPERA DECISIÓN** (c.19538: firma de 4 literales y elegir entre (a) y (b)) |

Los tres positivos se repartieron **a ciegas**, uno en cada lote (los lectores no sabían cuál era el control
ni qué tenía que salir).

## 3 · Con qué se midió

**No se escribió un segundo censo.** «¿Hay algo en `main`?» lo contesta la casa, y se llamó tal cual:

    node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs --jira docs/master/evidencias/SCRUM-1553/foto-jira-2026-10-14.tsv --ref c30729832c18b65c3793917ca836868e6cfdaa6e --lineas <fichero fuera del árbol>

Salió 0, en 31 s: **23 ALGO EN MAIN · 4 NADA EN MAIN · 0 NO HE PODIDO MIRAR** sobre 27 (24 más 3 controles).
La salida está entera en `tabla-ya-esta-c30729832.md` y las líneas citadas en `lineas-c30729832.tsv`. La
capa por contenido de SCRUM-1550 (PR #2416) **no está en `main`** y no se usó. Solo habría cambiado algo en las
4 filas «NADA EN MAIN»: 1052 y 1054 esperan al asesor sin haber nada construido, 1132 es el positivo, y 1550 es
ella misma.

**«ALGO EN MAIN» no es «YA ESTÁ».** Separar las tres clases exige leer el ticket. Lo leyeron **tres lectores**
(subagentes, nueve tickets cada uno), con una regla fija: clase solo con cita (id de comentario con su fecha y
una frase literal, o `fichero:línea` de `c30729832`); sin cita, NO HE PODIDO MIRAR. ⚠️ **Es una lectura, no
un instrumento:** los tres positivos la calibran, pero no la hacen repetible en CI. Por eso el A9 es un aviso.

## 4 · La tabla, con QUÉ decisión y DE QUIÉN

| Ticket | Clase | Qué decisión, de quién | Dónde consta |
| --- | --- | --- | --- |
| 1043 | YA ESTÁ (servidor) + ESPERA | firma del microcopy del chip «con deuda» y la columna de saldo · **fundador** (regla 39); el front es de J2 | `SCRUM-1043.md:6` «Ese microcopy no está firmado» |
| 1050 | ESPERA | no se construye hasta que haya un **caso real** · decisión de **Javier**, ya tomada | c.16593 «DECISIÓN DE JAVIER · 23-sep-2026: NO se construye todavía» |
| 1051 | YA ESTÁ (mecanismo #1715) + ESPERA | validar el NIF del destinatario toca la identidad fiscal (fuera del GO) · **fundador**; y el flag por profesional necesita un **ALTER** | `SCRUM-1051.md:266` «vuelve al fundador si se quiere avanzar» |
| 1052 | ESPERA | Q-C1 contestada por una IA, sin revisar · **asesor**; y además es un STOP fiscal · **fundador** | `docs/legal/PREGUNTAS_ASESOR.md:848` |
| 1054 | ESPERA | Q-C3 y Q-C4 · **asesor**; STOP fiscal y de dinero · **fundador** | `PREGUNTAS_ASESOR.md:905`, `:920` |
| 1055 | ESPERA | Q-C6 · **asesor** | c.16645 «Lo que desbloquea esto: la respuesta a Q-C6. Nada más.» |
| 1058 | YA ESTÁ (nota de diseño #1695) + ESPERA | visto bueno a la Opción A · **J1**; para construir, además, GO del **fundador** (regla 29) | c.16596 «Queda pendiente del visto bueno de J1» |
| 1063 | YA ESTÁ (1063b #1763) + ESPERA (débil) | añadir 29/45/46 al CSV del paquete, que es «otra decisión» y no tiene dueño escrito; separar gasto corriente de inversión · **Javier** (ALTER) o el **asesor** | `SCRUM-1063.md:125`, `:169` |
| 1064 | ESPERA | firma del texto de la pantalla y del nombre del modelo · **fundador**. El otro bloqueo (el cálculo) ya no existe | `SCRUM-1064.md:28-29` |
| 1065 | ESPERA | Q-C8 revisada por un profesional · **asesor**; después, la firma · **fundador** | c.16415; `docs/producto/CONTABILIDAD.md:131` |
| 1066 | YA ESTÁ (dato, SCRUM-1103) + ESPERA | firma del texto de la pantalla y de las cuatro preguntas de alta · **fundador**. ⚠️ Su `esperando-alter` está caducada: el ALTER ya se aplicó (`SCRUM-1066.md:82`) | c.16699 «Sigue haciendo falta la firma del fundador» |
| 1067 | ESPERA | Q-C8 y el umbral · **asesor**; después, la firma · **fundador** | c.16417 |
| 1076 | ESPERA | los plazos de cada modelo · **asesor**; la firma de los rótulos · **fundador** | c.16418 «hoy no hay ninguna fecha citada en el repositorio» |
| 1077 | ESPERA | la firma del texto · **fundador**; cómo entran las rectificativas y los bienes de inversión · **asesor**; y depende de 1064 | `CONTABILIDAD.md:5` |
| 1401 | YA ESTÁ (8 de 10) + ESPERA | firma antes de tocar lo que queda · **fundador**; `WhatsAppMessage` es un cambio de máster (SCRUM-1499); las tres vivas · **orquestador de Javier** | c.18794 «Esa firma no ha llegado hoy» |
| 1403 | YA ESTÁ (②③⑤) + ESPERA | qué agregados de la ficha de cliente ve un Técnico (tres salidas) · **fundador** | c.18045; `SCRUM-1403.md:21` «pedida (2-oct-2026) y sin contestar» |
| 1502 | YA ESTÁ (①②③) + ESPERA | preguntar una a una las 27 marcas que no constan · **fundador**; la propuesta ⑤ · **un jefe** (afecta al obligatorio de los dos equipos) | c.18835; c.18797 |
| 1246 | YA ESTÁ | — | `docs/YAQU_MASTER.md:438` «corregido el 28-sep-2026 (SCRUM-1246…» |
| 1481 | YA ESTÁ | — | c.18761 «PR #2265 mergeado» |
| 1408 | YA ESTÁ (①③④) + LISTO (②) | ninguna: el comentario de `asignacionDeDocumento.ts:13` lo escribe **S1** (SCRUM-1504) | c.18798 «NO HECHO → S1, SCRUM-1504» |
| 1503 | YA ESTÁ (medición) + LISTO | el fundador ya eligió la B; el trabajo es de **S3** | c.18852 «2-Ok vamos por B» |
| 1505 | YA ESTÁ (③④) + LISTO (①) | ninguna; el trabajo es de **S5** | c.18845 «esto pasa a S5» |
| 1548 | YA ESTÁ (①, #2414) + LISTO (②) | ninguna decisión, pero antes de tocar nada hay que averiguar de quién es `scripts/guards-entrada.mjs` | c.19533 |
| 1550 | LISTO (en vuelo) | ninguna; PR #2416 abierto con auto-merge, `BLOCKED` a las 04:25Z mientras pasa el obligatorio | c.19536 |

Quién decide, contando cada ticket una vez por cada decisor: **fundador 14** · **asesor 8** · J1 1 · Javier
2 (1050, ya decidida; 1063, el ALTER) · un jefe 1 · orquestador de Javier 1.

### Etiquetas que se contradicen entre sí (lo vio el lector, se apunta para el orquestador)

**`listo-para-construir` convive en el MISMO ticket con una etiqueta que dice lo contrario** en 8 de los 24:
`esperando-asesor` (1052, 1054, 1055, 1076) · `esperando-caso-real` (1050) · `esperando-alter` (1066, y
esta además caducada) · `decision-jefe` (1403) · `fundador` (1502). Eso **se detecta solo con Jira**, sin
leer ningún texto.

## 5 · Qué se hace con la etiqueta: opciones con su coste, SIN elegir

| Opción | Coste | Qué deja sin cubrir |
| --- | --- | --- |
| **A · Retirarla** de los 19 que no lo son (17 que esperan y 2 que ya están); los 5 de otros carriles o en vuelo, según se decida | una pasada de etiquetas del orquestador (A13) | vuelve a pasar: nada impide ponerla mañana a un ticket que espera una firma. Una prohibición sin mecanismo es una frase |
| **B · Sustituirla** por `espera-firma` / `espera-asesor` / `espera-decision` | la misma pasada, más acordar el vocabulario (ya hay `esperando-*` y `decision-jefe`: no hace falta otro) | también caduca: `esperando-alter` en 1066 sigue puesta con el ALTER ya aplicado |
| **C · Derivarla en el momento de repartir:** «listo» = sin `esperando-*`/`decision-jefe`/`fundador`/`sin-firma` **y** `tabla-ya-esta` ≠ YA ESTÁ | un guion que cruce la consulta de Jira con el censo de la casa (lo que hizo este registro, a mano) | no ve una decisión pendiente que solo esté escrita en un comentario sin etiqueta: aquí lo estaban 1043, 1051, 1058, 1063, 1064, 1065, 1067, 1077 y 1401 (9 de 17). Y hereda las etiquetas caducadas |
| **D · Comprobar la contradicción:** la consulta `labels = listo-para-construir AND labels in (esperando-*, decision-jefe, fundador, sin-firma)` debe salir vacía, y el que reparte la corre antes | una consulta; es la única opción que sale **ROJA** hoy (8 filas) | lo mismo que C: solo ve lo que alguien etiquetó |

Ninguna de las cuatro ve sola la clase que más daño hace: **9 de las 17 decisiones pendientes solo constan en
el texto**. Para esas no hay mecanismo barato: hace falta leer, como en el PASO 0.

## 6 · Lo que NO contesta

- Si un «LISTO DE VERDAD» merece la pena.
- Cuántos repartos se han desperdiciado en total: se conocen los cinco de SCRUM-1132 porque están en su
  historial; el resto no se ha censado y no se deduce de no haberlo visto.
- Los 10 tickets solo de `equipo-luis` que llevan la etiqueta.
- Las dudas que declararon los lectores, sin resolver: el «ESPERA» de 1063 es débil, porque son restos que
  declara el registro, no partes de la aceptación. Lo de que el front de 1043 no está se comprobó con `grep`,
  que es un suelo. En 1065, 1067 y 1076, «Q-C8 respondida por una IA» se lee como pendiente del asesor por
  `CONTABILIDAD.md:131` y SCRUM-1261, no por un comentario del propio ticket. Los estados de SCRUM-1048,
  SCRUM-1499 y SCRUM-1504 no se miraron.
- No se tocó ninguna etiqueta: eso es del orquestador (A13).

---

## SCRUM-1553b · ③ salida D: la consulta que tiene que salir VACÍA, construida — hoy sale ROJA con 8

**Medido contra:** `origin/main` = `76c29b57c871584b04c8206c11571f9c56c9d699` · 2026-10-14T06:52:27Z

A9: comprobación → `docs/master/evidencias/SCRUM-1553/contradiccion.mjs`

J3 (sesión `jv-j3g`, equipo de Javier), por encargo de su orquestador (`cobroflash-backend-2e`), que **eligió la
D** entre las cuatro del §5 («las otras tres dependen de que alguien se acuerde»). El hook de arranque dijo «SIN
IDENTIDAD» (SCRUM-1549); se construyó por la orden escrita del orquestador. **No se tocó ninguna etiqueta de
Jira** (las mueve él, A13), ni `src/`, tests, guards, workflows, esquema o bases.

⚠️ **La comprobación del A9 corre cuando alguien la lanza, no sola.** No está en el obligatorio ni en ningún
workflow: meterla es decisión del orquestador (abajo, §④). Hasta entonces convierte el fallo en una
comprobación de un comando, no en una puerta.

### ① Qué es

`docs/master/evidencias/SCRUM-1553/contradiccion.mjs --foto <foto.tsv> [--equipo equipo-javier]`. Lee la foto de
la casa (el mismo TSV `clave⇥estado⇥etiquetas` que lee `SCRUM-1496/tabla-ya-esta.mjs --jira`; **no es un
segundo censo**: no mira `main`, solo las etiquetas) y saca los tickets con `listo-para-construir` y una
contraria: cualquier `esperando-*` (con el guion) o, por nombre exacto, `decision-jefe`, `fundador`,
`sin-firma`. **Sale 0 si está vacía, 1 si no, 2 si no ha podido mirar.**

- **La fecha es obligatoria:** la foto lleva delante `# medido: <ISO Z> · jql: … · total: N`. Sin fecha, sin
  `total`, o con un `total` que no casa con las filas (foto cortada), sale 2. Imprime además cuántas horas
  tiene la foto; no pone umbral (una ventana fija es una tolerancia disfrazada).
- **No consulta Jira él mismo:** el repositorio no guarda credenciales de Jira. La foto se saca por el MCP con
  la JQL que el guion imprime si se le llama sin `--foto`.
- **Cero filas con la etiqueta sale 2**, no 0: cero no es «vacía», es «no hay qué mirar».
- **El límite va en CADA salida**, no solo aquí: los que llevan la etiqueta sin contraria salen como «NO
  JUZGADOS, NO LIMPIOS» con su lista, y debajo las tres cosas que no ve — la decisión que solo consta en el
  texto (el dato de jv-j2d, **con su fecha**: 9 de 17 el 14-oct hacia las 04:20Z, 1043 1051 1058 1063 1064
  1065 1067 1077 1401), la contraria caducada (la cuenta igual: `esperando-alter` de 1066), y lo que no trae
  la foto.

### ② Lo que sale hoy

Foto nueva, `evidencias/SCRUM-1553/foto-jira-2026-10-14T0649Z.tsv`: la JQL de §1 sin filtro de equipo, **34**
filas, `totalCount` 34, `hasNextPage: false`. Salida entera en `salida-contradiccion-2026-10-14T0649Z.txt`.

| Alcance | Con la etiqueta | Contradicciones (exit 1) | No juzgados |
| --- | --- | --- | --- |
| `--equipo equipo-javier` | 24 | **8**: 1050 `esperando-caso-real` · 1052, 1054, 1055, 1076 `esperando-asesor` · 1066 `esperando-alter` · 1403 `decision-jefe` · 1502 `fundador` | 16 |
| sin filtro (los dos equipos) | 34 | **13**: los 8, más 1045, 1056, 1072 `esperando-alter` · 1069 `esperando-decision` · 1074 `esperando-asesor` (los cinco, `equipo-luis`) | 21 |

**Los 8 de `equipo-javier` son exactamente los que midió jv-j2d a las 04:15Z.** Los 5 de `equipo-luis` no
estaban en §4 porque el censo no miraba ese equipo; `esperando-decision` (1069) no la citaba nadie y la caza el
prefijo, que es por lo que se eligió prefijo y no lista cerrada.

### ③ Los controles

**Sembrados**, dentro del guion, y pasan por **la misma función** que la foto real en CADA ejecución, antes de
mirarla; si fallan, sale 2. Ninguno es un ticket de la foto: el día que el orquestador quite las 8 etiquetas, los
controles siguen cazando lo suyo.

| Caso sembrado | Esperado | Por qué |
| --- | --- | --- |
| SCRUM-90001 `esperando-semilla-1553b` | SALE | POSITIVO por prefijo, con un nombre que no existe |
| SCRUM-90002 `fundador` | SALE | POSITIVO por nombre exacto |
| SCRUM-90003 `decision-jefe` + `sin-firma` | SALE, nombrando las dos | POSITIVO doble |
| SCRUM-90004 solo la etiqueta | NO sale (no juzgado) | NEGATIVO |
| SCRUM-90005 `esperandox`, `fundadores`, `no-esperando-x` | NO sale | NEGATIVO: un prefijo no es un nombre, una subcadena tampoco |
| SCRUM-90006/90007 contraria sin la etiqueta | NO sale | NEGATIVO |
| SCRUM-90008 de `equipo-luis` | fuera con `--equipo equipo-javier` | el filtro de equipo |
| foto sin fecha · foto cortada | ciegas | las puertas de «no he podido mirar» |

**El rojo, primero.** Seis mutaciones del guion, cada una en una copia fuera del árbol, con `--solo-controles`:
las seis salen **2** y nombran qué falló — nada es contraria (3 fallos) · sin prefijo (2) · prefijo como
subcadena (2) · sin la comprobación de `total` (1) · nombres exactos como subcadena (2) · sin filtro de equipo
(2). Sobre la foto real: sin cabecera sale 2 (sin fecha, sin total); cortada a 19 filas sale 2 («Jira dijo
total 34 y la foto trae 19»); con `total: 0` sale 2; sin `--foto` sale 2 e imprime la JQL.

### ④ ¿Obligatorio o a mano? — lo decide el orquestador

Recomiendo **a mano, en el PASO 0 de quien reparte**, y meter en la tanda **solo** `--solo-controles`:

- La consulta real **no puede** correr en el obligatorio: CI no tiene Jira, y una foto commiteada es de una hora
  concreta — correrla en CI sería dar por bueno, cada vez, el Jira del día que se sacó.
- `--solo-controles` sí podría ir a la tanda (no lee nada de fuera; 0 si el instrumento caza su semilla). Eso
  vigila que nadie rompa el instrumento, **no** que las etiquetas digan verdad. **No lo he metido**: el encargo
  pide decirlo antes.

### ⑤ Error mío, dicho

La hora de la foto (`06:49Z`) la escribí yo a mano: la herramienta de Jira no devuelve hora, y el `date -u`
lo lancé después de la consulta (dio `06:50Z`). Es exacta al minuto, no al segundo.

### ⑥ Lo que NO hace

- No cambia ninguna etiqueta, ni propone cuál quitar: las 8 son del orquestador (A13).
- No juzga los 16 «no juzgados»: entre ellos están los 9 que esperan una decisión escrita solo en el texto.
- No sabe si una contraria está caducada (1066).

---

## SCRUM-1553c · los controles de la consulta vacía, en la tanda

**Medido contra:** `origin/main` = `6c5b3ad61fcce65bcedaad61499afa0a97167e73` · 2026-10-14T07:28:35Z

A9: comprobación → `tests/scrum1553c-la-consulta-vacia-se-vigila.test.mjs`

J3 (sesión `jv-j3g`), por encargo de su orquestador (`cobroflash-backend-2e`), que decidió que `--solo-controles`
entra en la tanda y la consulta real se queda a mano en el PASO 0. El fallo que cierra es el mío del tramo
1553b: dejé la decisión escrita y el instrumento fuera de la tanda, así que nadie se habría enterado el día que
dejara de cazar. **Este test no toca Jira**: solo lanza el guion con `--solo-controles`.

### Qué exige

| Test | Verde solo si |
| --- | --- |
| ① la consulta caza su semilla | el guion existe, el hijo no muere, imprime «CONTROLES · N tickets sembrados … pasan» con **N ≥ 8**, y sale 0 |
| ② 🔴 con un control roto sale 2 | una copia en `os.tmpdir()` con el prefijo cambiado imprime «FALLAN», sale 2 y nombra SCRUM-90001; si el ancla de la mutación desaparece, cae |
| ③ 🔴 no arrancar no es pasar | un guion que revienta al cargar y uno que no existe salen distinto de 0 y **sin** la línea de controles |

El ① distingue «pasan» de «no arrancó» por la LÍNEA con su recuento, no solo por el código de salida: un guion
que sale 0 sin decir nada cae.

### El rojo, primero (cinco mutaciones en el árbol, restaurado y comparado con `cmp` después de cada una)

| Mutación de `contradiccion.mjs` | Resultado (TAP) |
| --- | --- |
| ninguna | 3 de 3 pasan |
| A · un control roto (la comparación del positivo) | cae ① (1 de 3) |
| B · guion renombrado | caen ① («NO ARRANCÓ: no existe …») y ② |
| C · revienta al cargar | caen ① y ② |
| D · sustituido por `process.exit(0)` (sale 0 mudo) | caen ① y ② |
| E · la semilla declara 3 casos | cae ① («solo 3 tickets sembrados») |

### Guards antes de empujar

`dist/` reconstruido con `tsc --noCheck` (el worktree no lo tenía), para que scrum636 arranque esta vez. Las
cifras van en la entrega.
