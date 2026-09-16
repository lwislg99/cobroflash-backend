# SCRUM-561 · Los 20 textos que ninguna puerta miró — y la premisa del ticket, corregida

**Medido contra:** `origin/main` = `bb721a852110117d0af17d6c8e07ba59488ead6b` · 2026-08-20T18:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14 que
> las demás entradas.

**20-ago-2026** · **Carril:** B (landing) · **Gate:** sin gate, corre en `npm test`

**Alcance:** un documento generado, un módulo, un generador y un test. **No se ha retirado ni
reescrito ningún texto, ningún marcador, ningún `hidden`. No se propone ninguna redacción
alternativa. No se toca `scripts/censo-etiquetas-pegadas.mjs` (S1) ni la aprobación de los 37.**

---

## ⓪ 🔴 LA PREMISA DEL TICKET ES MEDIO FALSA, Y MEDIRLO CAMBIA QUÉ HAY QUE ARREGLAR

El ticket dice que a estos textos **no los puso nadie delante del fundador**, y en concreto que
«El ERP por WhatsApp para los oficios» *«no está en el documento de aprobación»*.

**Medido: sí está.** Es **F4-1** de `docs/MICROCOPY_BLOQUE_F_PARA_APROBAR.md`.

| | |
|---|---|
| nodos fuera del esquema (3 secciones) | **20** |
| de ellos, presentes en el documento de aprobación | **20** |
| **inéditos** | **0** |

El cruce se hace con `===` y `Buffer.compare`, nunca `includes()`, y con **tres formas**: el nodo
suelto, el texto entero de su elemento, y el del enlace que lo envuelve. La tercera hace falta
porque el documento juntó el enlace con su flecha en una sola entrada («Empezar gratis →»): sin
ella, **seis nodos se declararían inéditos sin serlo**.

**Entonces, ¿dónde está el hueco de verdad?** No entre el marcado y el documento. Entre el
**documento (51 textos)** y **lo que la aprobación cubrió (los 38 que ve el esquema; 37 según el
recuento del día)**.

🔴 **Y eso no se puede verificar desde el repositorio: no hay ningún fichero que registre qué se
aprobó.** El único documento del bloque F es el de 51, y no lleva marca de aprobación. Mientras
siga así, *«¿está este texto aprobado?»* **no tiene respuesta comprobable** — sólo memoria de
conversación. Es el mismo defecto que este ticket denuncia, una capa más arriba.

**Lo que del motivo del ticket SÍ es cierto, y sigue siéndolo:** ninguno de los 20 pasa por el
censo de anclas. Si uno afirma algo del producto, **nadie comprueba que sea verdad**.

---

## ① La entrega: `docs/MICROCOPY_FUERA_DEL_ESQUEMA.md`

Los 20, con identificador derivado del marcado (`sección[ámbito]/etiqueta#orden`, el mismo esquema
del censo) y texto literal.

**Generado, no escrito a mano** (`node scripts/citar-fuera-del-censo.mjs`). Copiar veinte textos
con tildes y flechas a mano caduca al día siguiente sin avisar; un test comprueba que el que está
en disco es exactamente el que sale del marcado de hoy.

| sección | nodos | los ve el esquema | **fuera** |
|---|---|---|---|
| `#heroe-f4` | 8 | 5 | **3** |
| `#gremios` | 27 | 14 | **13** |
| `#comparativa` | 36 | 32 | **4** |

## ② Los que AFIRMAN algo sobre el producto — separados, que son los que hacen daño

Criterio escrito, tres señales léxicas:

| señal | qué marca | cuántos |
|---|---|---|
| `IDENTIDAD` | sustantivo de **categoría** que dice qué **es** el producto | **1** |
| `CONDICION` | condición comercial («gratis», «sin tarjeta») | **7** |
| `CAPACIDAD` | `MARCAS_CAPACIDAD`, el contraste que ya existe | **0** |

🔴 **El único `IDENTIDAD` es `heroe-f4/span#1` — «El ERP por WhatsApp para los oficios».** Dice
qué **es** el producto, no qué hace; vive en un `<span class="eyebrow">`; **ningún ancla lo
sostiene**. Queda citado con su identificador y su texto literal. **No se propone alternativa: es
posicionamiento y lo decide el fundador.**

⚠️ **Dos avisos sobre el criterio, escritos en el propio documento:**

- La lista de `IDENTIDAD` son **sustantivos de categoría, no el nombre del producto**. Meter
  «yaqu» daría un falso positivo inmediato: «Con YaQu» nombra a YaQu y no afirma nada de él.
- **Es un suelo, no un techo.** SCRUM-555 midió que el léxico de capacidad se deja **una de cada
  tres**. Por eso la entrega lleva el **texto literal** delante: para que quien la lea no dependa
  del léxico. Y de hecho el léxico de capacidad marca **cero** de los 20 — incluido el `ERP`.

## ③ El criterio de naturaleza: lo que se puede derivar y lo que no

El encargo pedía separar «texto de usuario» de «mecanismo (clase, id, atributo de datos)».

🟢 **Esa separación no hace falta aquí, y decirlo es más honesto que fabricarla.** Este censo sólo
produce **nodos de texto** —lo que hay entre `>` y `<`—; una clase o un `data-*` **no son nodos de
texto y no pueden salir de la lista**. Los 20 son, los 20, texto que un visitante lee.

Lo que sí se deriva del marcado es **de qué tipo**, con señales objetivas:

| naturaleza | criterio derivado | cuántos |
|---|---|---|
| `GLIFO` | el texto no contiene **ni una letra** (`\p{L}`) | 6 (las flechas `→`) |
| `ETIQUETA_DE_ACCION` | vive dentro de un `<a>` o `<button>` | 8 |
| `ROTULO` | `class="eyebrow"` o dentro de `.cmp-head` | 6 |
| `PROSA` | el resto | 0 |

## ④ Punto 4 · en `#comparativa`, el mecanismo de F5 **tampoco** los alcanza

Se escapan **4** (de 36 nodos). La pregunta era si su otro censo los cubre. **Medido: no.**

El registro de `tests/scrum332-comparativa-anclas.test.mjs` tiene **6 claves y las seis son
valores de `data-fila`**. Los cuatro nodos —el rótulo de sección y las tres cabeceras de columna—
están **antes de la primera fila**: no pertenecen a ninguna, así que **ninguna ancla los alcanza**.

**Es el mismo hueco con otra sección:** cada censo mira su unidad, y lo que no es esa unidad no lo
mira nadie.

## ⑤ Hallazgo de camino: dos textos existen DOS veces

El control positivo del test cayó, y tenía razón: **«Tu método actual» y «Con YaQu» están dos
veces** en el marcado — como **cabecera de columna** (`<span>`, fuera del esquema) y como
**etiqueta dentro del `<p>` de cada celda** (cubierta).

Comparar por texto suelto los daba por «ya cubiertos». Son **nodos distintos que comparten
cadena**, que es exactamente lo que el identificador derivado sirve para distinguir. El control se
pasó a comparar contra las **unidades** del censo, y el documento **los señala con ⚠️**: sin eso,
quien lea la cita creería que se le enseña algo que ya aprobó — o al revés.

## ⑥ Verificación

**SUELO** — dos, y el segundo prueba al primero: si el censo devuelve cero nodos fuera del
esquema, el test se declara ciego; y `generar()` **revienta** en vez de escribir un documento
vacío que se leería como «no falta nada por aprobar». Comprobado pasándole un HTML sin secciones.

**CONTROL POSITIVO** — ninguna de las unidades que el censo ya extrae entra en la cita. Si
entraran, la lista sería ruido.

**ROJO POR EL MECANISMO** — sobre el commit `45e885933b387bf7bf717f000cdc57013c901d63`, con el
fichero verificado idéntico al **blob** antes de empezar:

| inyección | ¿cae? |
|---|---|
| un `<span>` de texto nuevo en `#gremios` | 🔴 sí — reparto · afirmaciones · documento desfasado |
| un `<span>` de texto nuevo en `#heroe-f4` | 🔴 sí |
| cambiar la afirmación de identidad («ERP» → «CRM») | 🔴 sí — y nombra que ya no es la citada |
| cambiar la etiqueta de un botón de gremio | 🔴 sí |

Las cuatro veces la landing volvió **byte a byte contra el blob** (`Buffer.compare === 0`), y al
terminar `git status` de la landing sale **limpio**. Nunca se usó `git checkout --`.

**Tanda completa:** **3831 tests · 3754 pass · 0 fail · 77 skipped**.

## ⑦ Lo que NO se ha hecho

- ⛔ **No se amplía el extractor** a todo el marcado: ya se midió por qué. Lista declarada, no barrido.
- ⛔ **No se retira ni se reescribe ningún texto** (regla 30). Este ticket los pone delante.
- ⛔ **No se propone redacción para «El ERP por WhatsApp»**: es posicionamiento, y es del fundador.
- ⛔ **No se toca la aprobación de los 37:** sigue válida sobre lo que cubría.
- ⛔ **No se toca `scripts/censo-etiquetas-pegadas.mjs`** (S1) ni se retoman los dos hallazgos ya
  reportados en sus tickets.
- ⛔ **No se toca `package.json`:** el generador se invoca directamente, `node scripts/citar-fuera-del-censo.mjs`.

## ⑧ Lo que queda abierto — no es de este ticket

🔴 **Ningún fichero del repositorio registra qué microcopy está aprobada del bloque F.** Hoy la
respuesta a «¿esto está aprobado?» vive en una conversación. Es lo que hace posible que el ticket
naciera creyendo que 20 textos eran inéditos cuando estaban los 20 en un documento del árbol.
**Propuesta, para quien decida:** que la aprobación deje marca en el árbol — un sello por unidad
en el documento que ya existe. No se hace aquí porque tocaría el documento de aprobación, y eso es
del fundador.
