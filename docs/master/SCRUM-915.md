# SCRUM-915 · el editor de presupuesto, por pasos

> La v3 del editor (prototipo, textos e inventario) está en `docs/prototipos/SCRUM-915/` y la aprobó
> el fundador (#1463, Sesión 4). Este fichero empieza con el primer corte que la lleva al panel: 915d.

## SCRUM-915d · los PASOS del editor

**Fecha:** 18-sep-2026 · **Carril:** S2 (frontend) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `972b51b384e0b21e0265787392eb5c865b98cc4a` · 2026-09-18T11:39:04Z
**Rama:** `scrum-915d-pasos-del-editor` (base c60008bd, mergeada con `origin/main` sin conflictos)

### El defecto, medido antes de escribir

El editor pintaba los cuatro bloques a la vez: el «mucha información en pantalla, muchas opciones
de golpe» del comentario 15790. El guard de navegador `scripts/guard-pasos-del-editor.mjs` se
escribió PRIMERO (commit `2f8da6037abb23e34f553502f624d65ea34ebd4a`) y, con los ficheros de
`origin/main` puestos encima de la rama ya mergeada, sigue dando hoy:

```
POBLACIÓN: 3 casos — presupuesto a 390 y 1280 px, justificante a 1280 px
🔴 EN 3 DE 3 CASOS EL EDITOR NO SE RECORRE POR PASOS:
  [presupuesto 390px]  · A · al entrar se ven 4 pasos a la vez (cliente, concepto, condiciones, generar)
  [presupuesto 1280px] · A · al entrar se ven 4 pasos a la vez (cliente, concepto, condiciones, generar)
  [justificante 1280px] · A · al entrar se ven 3 pasos a la vez (cliente, concepto, generar)
inventario 16/16 · 16/16 · 7/7   ← control positivo: el instrumento ve todos los controles de hoy
```

Con la rama: **3 de 3 en verde**, recorrido completo en los dos anchos del presupuesto, e inventario
16/16 y 7/7 tanto al entrar como al final del recorrido.

### Lo que se hace

Los pasos SON los bloques de SCRUM-286 (clase `quote-paso` / `quote-paso-parte`, estados
`is-abierto` / `is-cerrado` / `is-hecho` / `is-pendiente`). **Ningún nodo se mueve al abrir o cerrar
un paso**: lo decide `styles.css`, por clase de estado.

| paso | bloques | qué hay dentro |
|---|---|---|
| 1 · Cliente | `blockClient` | buscador, selector, alta; «Continuar» deshabilitado sin cliente, con su motivo |
| 2 · Conceptos | `blockLines` + `blockTotals` | líneas, «+ Añadir línea», descuento global; los totales van DETRÁS de las líneas |
| 3 · Condiciones | `blockConditions` + `blockDelivery` | 3 filas plegables (condiciones de pago, formas de pago —se mudaron de Envío—, validez) y la fila «Ajustes del documento» (IVA por defecto, IVA del presupuesto, dirección de obra, datos del cliente, incluir descripción) |
| 4 · Revisar y enviar | `blockActions` | los botones de hoy («Generar», «Limpiar») + «Atrás» |

- El KPI del total se ve siempre. «✓ Guardado automáticamente» pasa junto al título.
- **Justificante (documento suelto):** tres pasos —Cliente · Conceptos · Revisar y emitir—, sin
  Condiciones; el IVA por defecto sigue en Conceptos (`sueltoVatRow`) hasta 915g. En modo FACTURA la
  guía del paso 1 se omite: no hay texto firmado para ella.
- `lineaValidaParaGenerar` es UNA regla para «Continuar» y para «Generar»: no pueden discrepar.
- «Limpiar» vuelve al paso 1.
- «Con su descripción, descuento y suplido.» NO se toca: es de la hoja de guardar plantilla, que no
  se construye en este corte.

**Textos:** todos de `docs/prototipos/SCRUM-915/textos-propuestos.md`, firmados en el comentario
15868 por delegación; ficha `docs/microcopy/2026-09-18-SCRUM-915-pasos-del-editor.md`.

### Inventario: antes → después (sale de `docs/prototipos/SCRUM-915/inventario-hoy.md`)

| control | antes (sección del inventario) | después |
|---|---|---|
| buscador de cliente · selector de cliente | B · 1. Cliente | 1 · Cliente |
| dirección de la obra · dirección personalizada | B · 1. Cliente | 3 · Condiciones → Ajustes del documento |
| IVA por defecto · IVA del presupuesto | C · 2. Líneas | 3 · Condiciones → Ajustes del documento |
| «+ Añadir línea» · líneas | C · 2. Líneas | 2 · Conceptos |
| descuento global | F · Totales y descuento | 2 · Conceptos (totales detrás de las líneas) |
| total (KPI) | G · KPI | siempre visible |
| condiciones de pago · válido hasta | D · 3. Condiciones | 3 · Condiciones (filas plegables) |
| formas de pago + datos del cliente (7 casillas) | E · 4. Envío | 3 · Condiciones (formas de pago) y Ajustes (datos del cliente) |
| razón social / nombre comercial (2) | E · 4. Envío | 3 · Condiciones → Ajustes del documento |
| incluir descripción | E · 4. Envío | 3 · Condiciones → Ajustes del documento |
| acciones (Generar · Limpiar) | H · Acciones | 4 · Revisar y enviar |

16 filas y 16 presentes en los dos anchos, al entrar y al acabar (7/7 en el justificante). Ningún
control se pierde: lo que cambia es CUÁNDO se ve.

### 🔴 SCRUM-660: CAMBIA lo que mide (decisión A del orquestador, 18-sep-2026)

- **Antes:** «el IVA por defecto del documento se VE nada más abrir la pantalla».
- **Ahora:** «se ALCANZA por el camino del profesional —cliente → Continuar → una línea → Continuar →
  «Cambiar» en Ajustes del documento— y ENTONCES se ve».
- **Por qué:** la v3 APROBADA por el fundador (`docs/prototipos/SCRUM-915/`) pone el IVA por defecto
  en «Ajustes del documento», plegado dentro de Condiciones. Medir «visible al abrir» exigiría
  deshacer lo aprobado. El fin de 660 —construido ≠ alcanzable— no cambia, y se mide igual que el
  IVA de la línea en ese mismo fichero: pulsando.
- **Las dos condiciones del orquestador, cumplidas y en `tests/scrum660-iva-defecto-del-documento.test.mjs`:**
  1. dos mutantes en ROJO sobre la fuente real (con comprobación de que la mutación se aplicó):
     ① sin el selector colgado, el camino llega y no hay IVA por defecto; ② sin «Cambiar» en
     Ajustes del documento, el camino se corta y dice DÓNDE;
  2. el banco sigue CIEGO (nunca verde) si no sabe resolver una regla. Por eso todas las reglas del
     bloque SCRUM-915d de `styles.css` que ESCONDEN usan clases de estado explícitas y
     descendencia; las que llevan `>` sólo dan forma, no esconden (el banco no resuelve `>` ni `:not`).

### Censos y guards que cambian, cada uno con su motivo en el propio fichero

- `tests/_asignacion-bloques-presupuesto.mjs` — títulos firmados; `payMethods` → `blockConditions`;
  `ivaModo` y `shippingAddress*` → `blockDelivery`.
- `scrum286` (cadenas de mutación) · `_censo-dos-fronts` E3 · `scrum600` (30 ranuras / 28 textos) ·
  `scrum600b` / `scrum600g` (títulos) · `scrum601` (línea 672 → 885 y flag 12 → 13: es un trinquete
  por número de línea y se regeneró midiendo) · `scrum514` (aparca «2. Líneas» como SUSTITUIDO) ·
  `scrum522` (25 → 26) · `scrum548` (3 × quotes-new).
- `scrum600e` — la regla ② mira ahora a CUALQUIER profundidad, con `NO_SON_CAMPOS` /
  `PARTE_DE_UN_CONTROL` que caen si sobra una excepción, y un ROJO ②b nuevo; 4 campos en vez de 3.
- **Contador de nodos de `renderQuotesView`: 237 → 282, +45**, identificados por identidad en
  `scrum698` (Cliente 6 · Conceptos 3 · pie de totales 4 · Condiciones 21 · Ajustes 6 · Revisar 5);
  la rama no toca el banco. La segunda copia de esa cifra, en `scrum697`, se puso al día con el
  mismo motivo (commit `98ca8cdcd426aaf02510f09689ebddc3c9421680`).
- Guards de navegador adaptados para llegar a su paso como el profesional (camino compartido en
  `scripts/_abrir-conceptos.mjs`; `_pagina-panel.mjs` gana `preparar`): rótulos de la línea (909),
  descuento redibuja (888), caja del documento suelto. `objetivo-tactil` mide el editor con TODOS los
  pasos abiertos, y lo declara. `marcadores-en-pantalla` y `caja-datos-del-cliente` en verde sin cambios.
- Red de Node que corre siempre: `tests/scrum915d-pasos-del-editor.test.mjs` (el MECANISMO: los pasos
  son los bloques y nada se mueve de sitio al abrir y cerrar).

### Medido

- `npm run guard:pasos-del-editor`: VERDE 3/3 con la rama; ROJO 3/3 con los ficheros de `origin/main`
  (arriba), inventario completo en los dos.
- Subconjunto de Node del editor tras mergear main: **171 ficheros, 1.669 tests, 1.664 pass, 2 fail,
  3 skipped**. Los dos rojos: `scrum697` (la segunda copia del contador, arreglada arriba) y `scrum921c`
  (este mismo fichero, que `scrum660` y `_asignacion-bloques` ya citaban y aún no existía).

### Errores propios

- **La primera versión del guard daba «2 pasos abiertos» contra un editor sano**: tomaba «se ve el
  bloque de Condiciones» como paso abierto, cuando lo que se ve de un paso cerrado es su RESUMEN. Se
  corrigió juzgando un control representativo de cada paso, no el bloque.
- **La segunda copia del contador (`scrum697`) se quedó fuera del subconjunto de la primera pasada**:
  se movió 698 y no 697. Lo cazó re-correr el subconjunto tras mergear main (la sesión que relevó),
  no el diseño: el subconjunto se elige por texto y el 697 no nombra el editor.
- **El cliente de prueba de la rama llevaba un móvil ordinario (`600111222`)** en 4 sitios (el guard
  de pasos, `_abrir-conceptos.mjs`, `scrum660` y `scrum915d`). Lo cazó `scrum262` en la suite
  completa, no el subconjunto. Se cambió el DATO al rango imposible (`34000000001`), no el guard, y
  se re-corrieron los 4 guards de navegador que usan ese cliente (todos en verde) y la suite entera.

### Lo que NO cubre

- Documento vivo (915e), hoja de envío y menús: textos firmados, se registran en la ficha del corte
  que los aplique.
- El IVA por defecto del justificante sigue en Conceptos (915g).
- Capturas antes/después (AB6) a 390 y 1280: no son condición del guard y no se hicieron en este corte.

---

## SCRUM-915 · PASO 0 — cuánto queda de la v3, medido fila a fila

**Fecha:** 20-sep-2026 · **Carril:** S2 (frontend) · **Pedido por:** el orquestador
**Medido contra:** `origin/main` = `102370c9aebac27cd770c1f109c509b4ff47b956` · 2026-09-20T14:32:12Z
**Rama:** `scrum-915-paso0-inventario` · **Instrumento:** `scripts/sonda-915-inventario-v3.mjs`

Esto NO construye nada. Contesta la pregunta que el orquestador puso delante de 915: **de la v3 que
aprobó el fundador, ¿qué parte está ya en la pantalla y qué parte falta?** Sin eso no se sabe si son
dos horas o dos días, y 915d entró hace una semana sin que nadie midiera lo que dejó fuera.

### Cómo se midió

La población **no se copia a mano**: la sonda PARSEA el array `INV` del propio prototipo aprobado
(`docs/prototipos/SCRUM-915/editor-presupuesto.html`), que es el inventario «antes → después» que
el fundador vio. Son **48 filas de contenido en 13 grupos**. Una fila nueva allí sale aquí como
«sin predicado»; hoy no hay ninguna.

Cada fila se juzga **en un navegador de verdad**, sobre los ficheros de `public/` que sirve el
panel, recorriendo el camino del profesional y **midiendo el estado después de pulsar**: cliente →
Continuar → línea → Continuar → abrir la hoja de ajustes de la línea → Continuar → Revisar →
pulsar la acción primaria dos veces. Tres recorridos: presupuesto a 1280 y a 390 px y justificante
a 1280 px.

**Dos controles positivos, los dos en verde:**

1. el instrumento **ve 16/16** controles del inventario de hoy (el censo de 915d). Si no los viera
   no estaría mirando el editor y ningún «falta» valdría nada;
2. de las **8 filas que 915d entregó** y están en `main`, salen «ya está» **8**. Un «falta» sobre
   algo que ya está en main es una sonda ciega, no un hallazgo. **Visto en ROJO:** con `3 líneas en
   blanco` metida en esa lista, la sonda sale con **2 (NO SUPE MEDIR)** y nombra la fila
   (`git diff --numstat` = `1 0` al inyectar; revertido con `git restore --source=HEAD` y
   `git status --porcelain` vacío).

### El resultado

| | filas |
|---|---|
| ✅ **ya está** | **16** |
| 🟡 **parcial** (lo de 915d está, falta la otra mitad) | **4** |
| 🔴 **falta** | **20** |
| ⬜ **no medible con este banco** (con su motivo en la salida) | **8** |
| ❓ sin predicado | **0** |
| **suma** | **48 de 48** |

Detalle fila a fila, en `docs/prototipos/SCRUM-915/paso0-medido.json` (lo escribe la sonda).

**O sea: 915d entregó una tercera parte de la v3 (16 de 48). Quedan 24 filas por construir.**

### Las 8 «no medibles», declaradas — no son huecos, son límites del banco

aviso global · «Sin resultados para tu búsqueda» · 🎤 Dictar · sugerencias de la IA y su aviso
«Revisado» · «Tus conceptos más usados» · Tramos de cobro · el cuerpo del mensaje de WhatsApp ·
«pendiente de aprobación». Cada una necesita un dato o un gesto que este banco no monta (una
respuesta real de la IA, un usuario con límite de aprobación, señal de uso de conceptos…). Se dice
cuál y por qué en la salida de la sonda; ninguna se calla.

### Dos hallazgos que la medición confirmó pulsando, no leyendo

- **Generar dos veces crea DOS presupuestos.** El banco cuenta los `POST /quote/create` de verdad:
  dos clics en la acción primaria → **2 creaciones**. Es el defecto que `inventario-hoy.md` daba por
  conocido; ahora está medido.
- **La tecla `N` dentro del editor abre la Cotización rápida encima.** Medido pulsándola con el
  editor abierto: queda un modal delante.

### Errores propios de esta sonda, y por qué se cuentan

La primera pasada dio **tres rojos que eran míos, no del producto**, y los tres se leían como
hallazgos perfectamente creíbles:

1. **«el menú ⋯ de la línea no tiene nada»** (items `[]`). `querySelector('.overflow-trigger,
   [aria-haspopup]')` **no tiene prioridad**: devuelve el primero del documento, y dentro de una
   línea el input del autocompletado lleva `aria-haspopup` y va antes. Pulsaba el input. Con el
   selector partido en dos, el menú contesta `["↑ Subir","↓ Bajar","🗑️ Eliminar línea"]` — y el
   rojo REAL es otro: no ofrece «Ajustes», que es lo que pide la v3.
2. **«"✓ Guardado automáticamente" no está junto al título»**. El encabezado es
   `div.quotes-header-block`, no el `<h2>`. Preguntarle al `h2` si contenía el aviso daba
   «no» con el aviso dentro. Es un **YA ESTÁ** que 915d había entregado.
3. **«los datos de empresa están en el documento de la derecha»**, buscándolos por el texto
   `/NIF|Cargando datos de empresa/`. El merchant del banco no tiene NIF y el rótulo de carga ya se
   había sustituido: el regex daba falso con los datos delante. Por identidad
   (`.quotes-merchant-info`) la respuesta se da la vuelta: siguen en el editor, y es un **FALTA**.

Y **dos verdes sobre población vacía**, que son peores: las dos tiras de «pactado» y la etiqueta de
la descripción de la línea salían «ya está» porque se preguntaba si se VEÍAN, y las tres viven
dentro de filas que llegan cerradas. Se pasaron a medir el **rótulo del control**, se vea o no, y
las tres son rojo: los cuatro marcadores `[PENDIENTE microcopy oficial]` siguen puestos.

    🔒 Preguntarle a un control si se ve, cuando llega cerrado a propósito, es preguntarle al armario
       si la camisa existe.

Y dos más, de la casa, que cazaron los mecanismos y no yo:

4. **`scrum710b` me puso en rojo por anclar por número de línea.** Los comentarios de la sonda
   citaban `api.js:1204`, `QV:72`, `descuentoPorDefecto.js:63`… Se arregló **el código, no el
   guard** (A7): ahora cita `overflowMenu`, `.quotes-header-block` y `propuestaPara`, que es lo que
   las cosas SON. Censos en verde después: 74 tests, 0 fail.
5. **`Set-Content -Encoding utf8` de PowerShell 5.1 me destrozó el fichero entero** al quitar esos
   anclajes: leyó UTF-8 como ANSI y lo reescribió doble-codificado (`—` → `â€"`), con BOM y con
   CRLF. El `git diff --numstat` decía **200/199** en un cambio de cuatro líneas, y eso fue lo que
   lo destapó — mirar el TAMAÑO del diff antes que su contenido. Se restauró con
   `git restore --source=HEAD` y se rehizo con la herramienta de edición: **5/4**.

    🔒 Un diff que no cabe en el cambio que has hecho no es un cambio grande: es otra cosa.

### Lo que NO he mirado

- Las capturas AB6 antes/después: esta entrega no cambia un píxel, así que no hay «después».
- El rendimiento del editor con muchas líneas.
- Si el CI de #1534 (SCRUM-926) pasó: quedó `BLOCKED` esperando «build + tests» y sigue OPEN.

### PROPUESTA de partición en cortes — pendiente de que la apruebe el orquestador

Las **24 filas** que faltan, repartidas en **7 cortes**, cada uno con su guard en rojo, su población
declarada y su estado medido después de pulsar. Los tres primeros nombres ya los reservaba el
expediente de 915d (915e, 915f, 915g) y se respetan.

| corte | qué monta | filas | riesgo |
|---|---|---|---|
| **915e · el documento vivo** | el documento de la derecha con aspecto de PDF que se construye mientras escribes y resalta la zona que editas; su cabecera con los datos de empresa; los totales (suma, descuento, base, IVA) **dentro** del documento y fuera del editor; el IVA del presupuesto reflejado (y con oyente, que hoy no lo tiene); «Presupuesto válido hasta el dd/mm/aaaa.» en lugar del pie fijo que miente; el nº y el estado en el documento; «Ver documento» en móvil | 6 | **el más grande.** Es el que pidió el fundador por su nombre («la vista previa parece rota, no se va creando»). Propongo **partirlo en dos**: 915e1 el documento que se construye, 915e2 el resalte + el móvil |
| **915f · la hoja de envío** | «Guardar y enviar» abre la hoja con el mensaje tal como le llega al cliente; WhatsApp en verde a todo el ancho; email · PDF · copiar enlace · «Lo envío luego»; **se genera UNA vez**; desaparecen el modal, «Abrir PDF en nueva pestaña» y «Seguir editando» | 4 | 🔴 **STOP.** Toca el flujo de envío/cobro. Necesita el **GO escrito del fundador en mi chat** antes de desplegar (CLAUDE.md, y `orquestador.md` §20). El cuerpo del mensaje es la plantilla `quote_decision_es` y **no se toca**: las plantillas de Meta son STOP |
| **915g · el justificante al día** | la fila «Ajustes del documento» dentro de Revisar, con el IVA por defecto dentro (hoy sigue suelto en Conceptos) | 1 | bajo. Ya estaba nombrado así en 915d |
| **915h · los conceptos, más limpios** | UNA línea en blanco en vez de tres; la ficha de IVA sólo si la línea NO va con lo de siempre; «Ajustes» dentro del menú ⋯ de la línea; «+ Añadir descuento» junto a «+ Añadir línea»; la tecla `N` deja de abrir la Cotización rápida encima | 5 | bajo, y es el que más se nota al escribir |
| **915i · la cabecera y el menú ⋯** | el título arriba del editor; se retira el subtítulo (cada paso ya lleva su frase guía); «Limpiar formulario» y «💾 Guardar como plantilla» se van al menú «⋯» de arriba, y limpiar **pide confirmación** | 4 | bajo |
| **915j · el cliente por botones** | las coincidencias como botones grandes en vez del `<select>`, con «+ Nuevo cliente» y «Sin resultados para tu búsqueda» | 1 | **medio-alto**: del selector cuelgan el borrador, las dos propuestas pactadas, la pista de dirección y el documento. Corte propio por eso, no por tamaño |
| **915k · los cuatro marcadores** | «Descripción» · «Aplicar» · «Este cliente tiene pactado un descuento del N %» · «Aplicar a las líneas» | 3 | bajo. No es diseño: es sustituir marcador por texto **ya firmado** |

**El microcopy NO es un freno, y conviene decirlo alto:** la ficha del 18-sep
(`docs/microcopy/2026-09-18-SCRUM-915-pasos-del-editor.md`, comentario 15868) firmó **todos** los
textos de `textos-propuestos.md` **menos uno** — «Con su descripción, descuento y suplido.», que
exige cambio de servidor y lo decide el fundador. Eso incluye «Guardar y enviar», la hoja de envío
entera, «Lo envío luego», «🔗 Copiar enlace», «¿Vaciar este documento?», «Más acciones» y los cuatro
marcadores. Cada corte sólo tiene que **registrar en su propia ficha** los que aplique.

**Orden que propongo:** 915e1 → 915e2 → 915h → 915i → 915g → 915k → 915j → 915f. El envío el
último, porque es el único que necesita un GO del fundador y no conviene que bloquee a los demás.

---

## SCRUM-915e1 · el documento de la derecha deja de mentir y se rehace mientras escribes

**Fecha:** 20-sep-2026 19:41:07 GMT · **Carril:** S2 (frontend) · **Corte:** 1.º de la partición aprobada
**Medido contra:** `origin/main` = `8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`
**Rama:** `scrum-915e1-documento-vivo` · **Rojo medido sobre:** `e73e1630084f0cfc1096d2812eb05368c1252f1e`
**Instrumento:** `scripts/guard-915e1-documento-vivo.mjs` (`npm run guard:documento-vivo`)
**Microcopy:** `docs/microcopy/2026-09-20-SCRUM-915-documento-vivo.md` (comentario 15868)

### El defecto que abre el corte, y por qué no era un rótulo desactualizado

El pie del documento de la derecha decía, fijo:

> Presupuesto válido durante 30 días salvo indicación en contrario.

Mientras tanto, el campo «Válido hasta» de Condiciones acepta **cualquier fecha** desde A16.2, se
guarda en `validUntil` y ya se enseña en el resumen del paso. O sea que el profesional podía poner
una semana, verlo bien en su editor, y mandarle al cliente un papel que prometía un mes.

No era un texto viejo: era **el único sitio del documento donde la caducidad se afirmaba**, y
afirmaba otra cosa que la caducidad guardada. Es la fila que el PASO 0 marcó como `parcial` con la
nota «Arregla el “30 días” fijo de hoy».

### Qué entra

| | antes | ahora |
|---|---|---|
| pie del papel | «Presupuesto válido durante 30 días salvo indicación en contrario.» | «Presupuesto válido hasta el dd/mm/aaaa.», con la fecha que se guarda |
| rótulo | «Vista previa del documento» | «Así lo verá el cliente» + «Se actualiza mientras escribes» |
| hueco de la tabla | «Añade al menos una línea con concepto, cantidad y precio.» | «Aquí aparecerán los conceptos que añadas.» |
| cuándo se repinta | una lista de campos escrita a mano | la misma delegación (`input`/`change`/`click` en `leftCard`) que ya refresca los pasos |
| cuerpo de la tabla | `createElement('linesBody')` | `createElement('tbody')` |

Los cuatro textos estaban firmados desde el 18-sep; esta entrega sólo los aplica y los registra.

### Tres cosas que el fuente no distingue, y por eso el guard es de navegador

1. **La delegación.** «Válido hasta» no tenía **ni un oyente**: se cambiaba la fecha y el papel no
   se enteraba. Una lista de campos escrita a mano se queda corta el día que entra el campo número
   once y nadie se acuerda de esa línea; la delegación no se queda corta nunca.
2. **`linesBody` no es una etiqueta de HTML.** El código creaba un elemento desconocido dentro de
   la `<table>` y las `<tr>` colgaban de él. Y no era inofensivo: `styles.css` lleva desde siempre
   `.preview-lines-table tbody tr:nth-child(even)` —la cebra del documento— **que no ha pintado
   nunca**, porque aquí nunca hubo un `tbody` al que casar. Medido: los hijos de la tabla eran
   `["thead","linesbody"]`. En el fuente las dos versiones se leen igual.
3. **`fechaCorta` pasa de `const` a declaración de función.** No es estilo: `renderPreview` corre
   2.000 líneas antes y con `const` la función estaba en zona muerta. Se iza para que haya **una
   sola forma** de escribir una fecha en esta pantalla, que es lo que evita que el resumen de
   Condiciones y el papel del cliente empiecen a decir la misma fecha de dos maneras.

### El rojo, y la mutación que decide

**ROJO de partida** (`e73e1630`, sin ninguno de estos cambios): **7 hallazgos en 5 de 5 casos**.
Entre ellos, el pie contestando la MISMA coletilla con tres fechas distintas puestas
(20/10, 02/10, 20/11) y la tabla con hijos `["thead","linesbody"]`.

**VERDE con el arreglo:** 5/5.

**Mutante que decide** — se quita SÓLO la delegación y se deja todo lo demás:

| mutante | qué cae | qué NO cae |
|---|---|---|
| sin la delegación en `leftCard` | `D.2` y `D.3`: el pie se queda con **la primera fecha** (20/10) con 02/10 y 20/11 puestas | las otras 5 casillas siguen verdes |

O sea que cada mitad del arreglo sostiene lo suyo y el guard es específico: no cae en bloque.

### Los censos que cobra el guard nuevo, corridos por su nombre

| censo | antes | ahora |
|---|---|---|
| `scrum258-nota-por-sesion` | ✅ | ✅ |
| `scrum522-guards-fuera-de-la-tanda` | 🔴 31 | ✅ 32, medido |
| `scrum548-peaje-package-json` | 🔴 `3×#quotes-new` | ✅ `4×#quotes-new`, declarado |

Éste **sí** se deriva —el puerto va en variable pero la ruta `#quotes-new` está escrita literal—,
así que entra en el solape del editor en vez de declararse como «destino no resuelto». No se
fusiona con los otros tres: los tres miran el EDITOR de la izquierda y éste mira el DOCUMENTO.

### Los contratos de SCRUM-600, RE-ANCLADOS (no borrados)

- `scrum600` · la ranura del pie sigue en la lista del fundador, con su texto nuevo. Para eso el
  pie se escribe con **plantilla y no con suma de cadenas**: concatenado, `ranurasDelDocumento` no
  lo veía y la cuenta bajaba de 30 a **29**. Un censo que pierde una ranura no dice «no la veo»:
  dice un número más pequeño, y la lista que el fundador tiene delante deja de ser cierta sin que
  salte nada.
- `scrum600b` · «Vista previa del documento» → «Así lo verá el cliente», y la coletilla se ancla al
  trozo FIJO («Presupuesto válido hasta el »), porque la fecha cambia cada día que corre la suite y
  anclar a una fecha sería un contrato con caducidad. Los dos siguen siendo imprescindibles: cambia
  lo que dicen, no que estén. 28/28 en verde.

### El rojo del CI, y el hueco del instrumento que destapó (#1545)

`scrum514-aprobado-y-aplicado` tumbó el PR con **«Presupuesto válido hasta el dd/mm/aaaa.»**: cruza
cada texto firmado contra el código y ése no aparece literal en ninguna parte, porque el código lo
**compone**. El texto sí está aplicado; lo que no existía era una forma de decirlo.

El propio fichero ya tenía la respuesta escrita, para el otro extractor: `celdasDeTabla` salta las
**plantillas** (`{…}`) con este motivo medido — «un texto como `{N} facturas` NUNCA aparece literal
porque el código lo COMPONE; lo que el guard puede afirmar de una plantilla es que su parte fija
esté». Esa regla nunca se trajo a `citasDeTextoAprobado`, que es la que lee las fichas. Así que las
fichas podían firmar plantillas pero no declararlas.

Se arregla en los dos sitios, y ninguno es una rebaja:

- la ficha escribe el pie como lo que es, **«Presupuesto válido hasta el {dd/mm/aaaa}.»**, con la
  notación de plantilla que este repositorio ya usa;
- `citasDeTextoAprobado` aplica la MISMA exención que su hermana, y **sólo con llaves**: un texto
  sin ellas se sigue cruzando byte a byte. Los dos SUELOS del fichero —«la fuente se lee y tiene
  textos de sobra» y «el cruce sabe decir SÍ y sabe decir NO»— siguen en verde, que es el control
  de que la exención no ha cegado al instrumento.

La parte fija del pie la siguen vigilando `scrum600` (la ranura) y `scrum600b` (el documento
renderizado), y la fecha entera el caso D del guard de navegador, que la cambia dos veces.

    🔒 Un instrumento que no sabe expresar una categoría que él mismo reconoce en otro sitio no
       está midiendo de más: está obligando a mentirle.

### SEGUNDO rojo del CI del #1545, medido por la S2 del relevo (20-sep-2026 20:14 GMT)

Sobre `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b`. La puerta obligatoria
—«build + tests (con banco desechable)»— seguía en rojo con **6 hallazgos**, y ninguno era el 514.
Reproducidos en local en la rama (población: 34 líneas de resultado, 5 rojas) y **verdes sobre
`origin/main` con los mismos tres ficheros**, que es lo que dice que eran de la rama y no heredados:

| hallazgo | qué era | arreglo |
|---|---|---|
| `scrum697` · control negativo · `scrum698` × 2 | la cifra derivada de nodos de `renderQuotesView`: **282 → 283** | se REGENERA con su generador y se anota con el nodo identificado (abajo) |
| `scrum709` · nombre fuera de convención | la ficha se llamaba `2026-09-20-SCRUM-915e1-…`, y `PATRON_NOMBRE` es `SCRUM-(\d+)` | la ficha pasa a `2026-09-20-SCRUM-915-documento-vivo.md`: el ticket es **915**, el corte lo dice la ranura |
| `scrum709` · índice a mano | la ficha NOMBRABA a `2026-09-18-SCRUM-915-pasos-del-editor.md` | se quita la cita: el listado del directorio ES el índice |
| `scrum804` · suelo del censo de ramas | **NO es de este PR**: el censo no entiende los sufijos de dos caracteres (`scrum-915e1`, `scrum-915e2`) y tumba la puerta de TODOS los PR abiertos | lo arregla S1 en `scrum-804g-…`; aquí se declara y no se toca |

**El nodo, POR IDENTIDAD y no restando** (la regla de las cifras derivadas: no se elige lado ni se
deduce la suma). Montando el editor en el banco de vistas con el MISMO contador en los dos árboles:

| | `origin/main` | rama |
|---|---|---|
| nodos totales | **282** | **283** |
| `p.quote-preview-subtitle` | **0** | **1** — «Se actualiza mientras escribes» |
| `.preview-footer` | 1 | 1 (cambia su TEXTO, no cuántos nodos es) |

O sea: el delta entero es el rótulo firmado que este corte estrena, subárbol de 1 y sin hijos. El
`createElement("linesBody")` → `"tbody"` renombra la etiqueta de un nodo que ya existía, y por eso
no cuenta. Si mañana subiera 2, no es esto.

Tras el arreglo, corridos por su nombre y con la población declarada: **120 pruebas, 120 en verde,
0 rojas** (697, 698, 709, 514, 726, 700, 237, 258, 267, 522, 548, 723) · `npm run build` y
`npm run guards:entrada` en 0.

    🔒 Dos instrumentos distintos se quedaron ciegos ante lo MISMO —un sufijo de dos caracteres en
       un nombre— y ninguno dijo «no sé leer esto»: uno dijo «fuera de convención» y el otro, un
       número de ramas más pequeño. Un instrumento que no entiende una forma nueva no calla: acusa.

    🔒 Y el aviso de un fichero se queda donde se escribió: la ficha declaraba ser «la hermana de»
       otra, que es exactamente el índice a mano que su propio guard prohíbe. La cita amable es la
       forma que toma un punto único de escritura cuando nace.

### Errores propios

- **Di por muerta la casilla C antes de medirla.** Al escribir el guard supuse que «se construye
  mientras escribes» iba a salir roja y que la delegación era lo que la arreglaba. El rojo dijo que
  **C ya estaba verde** contra el código viejo: teclear un concepto ya repintaba el documento por
  los oyentes de cada línea. Lo que la delegación arregla es **la fecha**, no el concepto. Si no
  llego a correr el rojo, el expediente habría atribuido a este cambio una mejora que no era suya.

    🔒 Un arreglo al que no se le mide el rojo se queda con el mérito del de al lado.

- **El primer pie iba concatenado** y bajó el censo de ranuras de 30 a 29 sin que yo lo buscara.
  Lo cazó el propio contrato de SCRUM-600, no yo.

### Lo que NO cubre

- **«Nº al generar»**, firmado para este mismo bloque: hoy el documento no tiene dónde pintar un
  número, y dárselo es estructura nueva. Va con el corte que traiga el número.
- El **resalte de la zona que se edita** y el **«Ver documento»** de móvil: son **915e2**.
- Los **totales que se sacan del editor** de la izquierda (fila F del PASO 0): el desglose ya vive
  en el documento, lo que falta es quitarlo de la izquierda dejando sólo el KPI. No entra aquí
  porque mueve la tarjeta de totales, que es lo que toca **915h**.
- Capturas AB6: cambia el texto del papel y una línea de rótulo; ni un componente nuevo, ni un
  token nuevo, ni un color nuevo.

---

## SCRUM-915e2 · el documento se alcanza en el móvil, y dice cuál de sus filas se acaba de mover

**Fecha:** 20-sep-2026 19:58:06 GMT · **Carril:** S2 (frontend) · **Corte:** 2.º de la partición aprobada
**Medido contra:** `origin/main` = `8fcfd13fc7e14069bef9ce2b9c3f94fe969f2506`
**Rama:** `scrum-915e2-ver-documento` · **Rojo medido sobre:** `19fff106f514c9ca8b299f750f0171c82b335abd`
**Instrumento:** los casos F, G y H de `scripts/guard-915e1-documento-vivo.mjs`
**Microcopy:** `docs/microcopy/2026-09-20-SCRUM-915-ver-documento.md` (comentario 15868)

### El defecto: en un teléfono el documento NO se ve pequeño, no se ve

Por debajo de 1100 px `.quotes-layout` pasa a UNA columna, así que el documento deja de estar al
lado del editor y se va **debajo** de él: debajo de los cuatro pasos, las líneas y los totales. En
un teléfono son varias pantallas de scroll. El profesional escribe a ciegas, y el rótulo «Se
actualiza mientras escribes» que 915e1 acaba de poner le habla de algo que no tiene delante.

Medido: a 390 px había **0** «Ver documento» — no existía en el DOM a ningún ancho.

### Qué entra

| | antes | ahora |
|---|---|---|
| llegar al documento en móvil | bajar por todo el editor | «Ver documento» en el pie de Cliente, Conceptos y Condiciones |
| lo que abre | — | hoja con el título ya firmado «Así lo verá el cliente» y el **documento de verdad** dentro |
| salir | — | «Volver al editor», que devuelve el documento a la tarjeta |
| qué fila se acaba de mover | nada: el papel se rehace entero y todo se ve igual | la fila que cambia queda resaltada y se desvanece |

### Dos decisiones, y por qué

1. **El botón lo enseña el CSS, no un `matchMedia`.** Sale por debajo del mismo 1100 px en el que
   `.quotes-layout` pasa a una columna, y ese número vive UNA vez, en `styles.css`. Con
   `matchMedia` habría dos sitios sabiendo el mismo número y separándose sin que nadie lo note.
   El prototipo usa 999 px; aquí manda el breakpoint real de esta app, que es donde el documento
   se va de al lado de verdad.
2. **La hoja MUEVE el documento, no lo copia** — el patrón de la hoja de ajustes de la línea
   (SCRUM-139 F4). Una copia se vería idéntica en una captura y se quedaría con los datos de antes
   en cuanto el profesional volviera a teclear. Por eso el caso G no pregunta «¿hay un documento en
   la hoja?» sino **«¿el documento está DENTRO de la hoja?»**, y al cerrar comprueba que ha vuelto
   a la tarjeta: si se fuera con la hoja, en escritorio no habría documento nunca más.

### 🔴 El defecto que sólo se ve en navegador: el resalte que se borraba a sí mismo

El caso H salió rojo **con el resalte ya escrito y aparentemente bien**. La causa: cada evento del
profesional repinta el documento **dos veces** — el manejador del propio campo y la delegación de
la tarjeta que entró en 915e1, las dos llaman a `renderPreview`. El primer pintado veía el cambio
y marcaba la fila; el segundo, con la firma ya guardada, no veía ningún cambio y **borraba la
marca**. En pantalla el resalte no existía. En el fuente se leía perfectamente bien.

Arreglado dándole a la marca **un pintado de gracia**: sobrevive a un repintado sin cambios, y a
uno sólo. Al segundo quieto se apaga, que es lo que la diferencia de un resalte pegado para
siempre.

    🔒 Un mecanismo correcto leído dos veces seguidas puede deshacerse a sí mismo, y el fuente
       lo cuenta igual de bien en los dos casos.

### El rojo

**ROJO de partida** (`19fff106`, el árbol de 915e1 sin nada de e2): **2 hallazgos y 1 ciego** en
8 de 8 casos. El ciego es G, que no puede medir un botón que no existe — y **un ciego no es un
verde**: por eso G no cuenta como «pasó». La salida se cambió para imprimir los hallazgos también
cuando hay ciegos: callarlos escondía defectos reales detrás de un caso que no llegó a arrancar.

**VERDE con el arreglo:** 8/8, y el control negativo del resalte sigue en pie (un repintado que no
cambia nada no marca ninguna fila).

### Lo que NO cubre

- El **número del documento** («Nº al generar»): sigue sin sitio donde pintarse.
- Los **totales fuera del editor** de la izquierda: es 915h.
- El resalte marca filas de **conceptos**. Cambiar el descuento global o las condiciones repinta el
  documento pero no marca nada: no hay fila que señalar, y pintar el papel entero de verde sería
  ruido.
- Capturas AB6: un botón secundario del inventario AB3 y una hoja `.modal-overlay` + `.modal`
  también del inventario. Ni un componente nuevo; el único color es `--brand-tint`, el token que
  ya existe para «fondos de realce suaves». `guard:objetivo-tactil` en verde con el botón nuevo.

### El rojo del CI del #1550, medido por la S2 del relevo (20-sep-2026 20:14 GMT)

Sobre `origin/main` = `c5d642fe889af753ef6d6de27aabc84bdc3fc79b`. La puerta obligatoria traía **8
hallazgos**: los 6 del #1545 (los cinco arreglados en su sección + el `scrum804` ajeno, que no es de
este PR) **más dos propios**. Reproducidos en local con la población declarada — 45 pruebas, 6 rojas
— y, la primera vez, con un rojo que NO valía: `Cannot find module '../dist/…'`, porque un worktree
nuevo nace **sin `dist`** y el banco de vistas lo necesita. Con `npm run build` delante, 45/6.

| hallazgo | qué era | arreglo |
|---|---|---|
| `scrum697` · `scrum698` × 2 | cifra derivada de nodos: **283 → 286** | se regenera; los tres nodos IDENTIFICADOS (abajo) |
| `scrum709` · nombre e índice | la ficha de este corte repetía los dos defectos del #1545: sufijo en el nombre y cita a sus hermanas | `2026-09-20-SCRUM-915-ver-documento.md`, y sin citar a nadie |
| `scrum601` · rótulo nuevo a pelo | **falso positivo de un ANCLAJE POR LÍNEA**: «Solo presupuesto (facturación manual)» no se ha tocado, pero el «Ver documento» del pie de los pasos se escribe 150 líneas más arriba y lo bajó de **885 a 889** | se corrige el anclaje con la cifra que da el propio censo. Corregir un anclaje no es añadirlo (`scrum710b`) |
| `scrum350` · cobertura del pie | `scripts/guard-915e1-documento-vivo.mjs` nombraba `.modal-footer` y el censo de pies mira el front, no `scripts/` | el guard ancla al botón primario **de esa hoja**, que es lo que de verdad mide |

**Los tres nodos, POR IDENTIDAD.** Se comparan las FIRMAS (etiqueta + clase + texto) de los dos
árboles montados con el mismo contador, en vez de restar 286 − 283:

```
POBLACIÓN  base = 283   rama = 286   delta = 3
SOBRA en la rama:  +3  BUTTON.btn btn-secondary quote-ver-documento|Ver documento
FALTA en la rama:  (nada)
```

Que la lista de «falta» esté vacía es la mitad que importa: un delta de +3 podría ser +5 y −2, y
entonces la anotación estaría contando mal dos cosas a la vez.

**Lo que el `scrum350` no sabe distinguir, y es un hallazgo del instrumento (no abre ticket, CAMBIO
3):** su cobertura exige que todo fichero que NOMBRE `.modal-footer` esté dentro de su censo de
pies, y el censo mira las fuentes del front. Un guard de NAVEGADOR no construye un pie: lo **lee**.
Hoy hay uno; el día que haya tres, los tres tropezarán con lo mismo, y el rojo dirá «pie sin medir»
cuando lo que pasa es «lector fuera del censo».

    🔒 Un anclaje por número de línea no falla cuando su línea cambia de contenido: falla cuando
       OTRO escribe encima. El fichero acusa al que no tocó nada.

Tras el arreglo, corridos por su nombre: **147 pruebas, 147 en verde, 0 rojas** (350, 601, 697, 698,
709, 514, 726, 700, 237, 258, 267, 522, 548, 723) · `npm run build` y `npm run guards:entrada` en 0.

---

## SCRUM-915h · los conceptos, más limpios

**Fecha:** 21-sep-2026 07:32:58 GMT · **Carril:** S2 (frontend) · **Corte:** 3.º de la partición aprobada
**Medido contra:** `origin/main` = `d7de8e659c7c3e92d36a26878ce5d232dc344647` (al empezar)
**Rama:** `scrum-915h-conceptos-limpios`
**Instrumento:** `scripts/guard-915h-conceptos-limpios.mjs` (`npm run guard:conceptos-limpios`)
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-915-conceptos-limpios.md` (comentario 15868)

### El orden, y por qué no era negociable

El traspaso de la S2 lo dejó medido: **los totales no se podían quitar del editor sin ponerlos antes
en el documento.** El documento de la derecha pintaba Base imponible / IVA total / Total y NO
«Suma de líneas» ni los dos descuentos. Borrar `.quote-totals` de la izquierda tal cual habría dejado
el descuento sin verse en ninguna parte — un dato que nadie ve es un dato que nadie corrige
(CONT-01 ②). Así que primero el documento, luego el editor.

### Qué entra (las filas del PASO 0)

| fila | antes | ahora |
|---|---|---|
| F · totales | desglose de apoyo en el editor (`.quote-totals`) y en el documento sólo Base/IVA/Total | el documento pinta **Suma de líneas / Descuento / Descuento global** con los mismos rótulos y la misma condición que el PDF (`pieDePresupuesto`) y la cifra de `T`, la cuenta del editor; en Conceptos queda sólo el TOTAL (el KPI) |
| F · descuento global | «+ Añadir descuento» dentro del bloque de totales | justo detrás de «+ Añadir línea», dentro de Conceptos |
| C · líneas | tres renglones en blanco | **UNA** línea lista para escribir |
| C.1 · ficha | «IVA 21 %» en todas las líneas | sólo si la línea **no** va con lo de siempre (otro IVA que el por defecto, descuento o suplido); cuando lo es, vuelve y lo dice |
| C.1 · menú ⋯ | Subir · Bajar · Eliminar línea | **Ajustes (IVA, descuento, descripción…)** · Subir · Bajar · Eliminar línea |
| Teclado | la `N` dentro del editor abría la Cotización rápida encima | no abre nada; en las listas y en #home sigue igual |

**Decisiones, con su motivo:**

- **La ficha se oculta con una CLASE (`is-de-siempre`), no con `hidden`.** En la rejilla de ≥640 px
  tiene su columna: quitarla del flujo corría el total y el ⋯ de ESA fila bajo la columna de al lado.
  Ahí se queda el hueco con `visibility: hidden` (fuera del tabulador); en móvil, que va en su propia
  fila, se quita entera.
- **En el documento suelto no cambia nada de la línea.** Su hoja tiene un solo campo («IVA %») y el
  literal del menú prometería descuento y descripción que ahí no existen; la ficha es su único
  control del IVA y se queda siempre a la vista.
- **La `N`:** ni un destino vacío (control muerto) ni quitar el respaldo (quitaría el atajo en las
  listas). Un predicado puro, `atajoNuevo.esUnaCreacion(vista)`, derivado del nombre de la vista
  (`-new` = las dos del editor) y el respaldo de `app.js` detrás de él.

### El rojo

El guard nuevo, corrido con el `public/` de main puesto encima de la rama (y devuelto después con
`git restore --source=HEAD`, `git status --porcelain` vacío): **8 hallazgos en 5 de 5 casos** —3
líneas al abrir, el bloque de apoyo en el editor, «Ajustes» ausente del menú (dos casos), el
descuento lejos de «+ Añadir línea», la ficha «IVA 21 %» visible en una línea de siempre y la `N`
abriendo un modal encima del editor—. **Verde con la rama: 5/5.**

Cada caso lleva su control: tras «+ Añadir línea» son dos (A), sin descuento el documento NO lleva
«Suma de líneas» (B), al cerrar Conceptos el descuento se va con él (C), con IVA 10 % la ficha
VUELVE y dice «IVA 10 %» (D), y la `N` en #home SÍ abre un modal (E).

### Errores propios

1. **El control de la `N` salió contaminado DOS veces, y en los dos casos lo cazó el rojo, no el
   verde.** Primero lo medía después del editor, y el modal que la `N` acababa de abrir en main
   seguía delante: ciego. Al ponerlo primero, `goto` a otro hash de la MISMA página no recarga, y el
   modal de #home seguía delante del editor: la `N` salía «quieta» sobre main porque había un modal,
   no porque el editor la frenara. Ahora hay recarga real (`about:blank`) y un suelo que exige 0
   modales antes de pulsar.
2. **Perdí una edición sin comitear al inyectar el rojo** — la casilla 9 de A23 (commit de TODO antes
   de inyectar). Restauré `public/` desde HEAD con el refactor del menú todavía en el árbol, y se fue.
   Lo cazó buscarlo después por su texto, no el guard (el cambio no mueve el DOM). Rehecho y comiteado
   aparte («rehecho: se perdió al restaurar public/ sin comitear»).
3. **El menú ⋯ se cierra solo entre dos `evaluate`** (el helper cierra con cualquier desplazamiento):
   el primer verde salió rojo con el ítem delante. Abrir y pulsar van ahora en la misma llamada.

### Censos y guards que cambian, cada uno con su motivo en el propio fichero

| fichero | qué exigía | por qué cambia |
|---|---|---|
| `scrum139-cuadernillo` | `LINEAS_CUADERNILLO >= 2` (SCRUM-139 F2) | **re-anclado, no borrado**: la v3 aprobada pide UNA. Mismo procedimiento que 915d con SCRUM-660. Sigue exigiendo el número explícito y de un solo sitio; el suelo de 1 lo sujeta además `scrum794` |
| `scrum139-acciones-linea` | el literal `overflowMenu([subirBtn, bajarBtn, removeBtn]` | admite «Ajustes» delante; lo vigilado —que las acciones pasen por el helper— no cambia |
| `_asignacion-bloques-presupuesto` (286) | descuento global en `blockTotals` | pasa a `blockLines` |
| `scrum598` · `scrum229` | la fila «Margen» buscada en `.quote-totals__apoyo` / entre `totalsBox` y el KPI | la misma puerta, buscada donde viven ahora los totales: el documento |
| `scrum897` | el repintado de `.quote-totals` y del KPI | queda el KPI, y se exige que `.quote-totals` NO exista (si volviera, tiene que volver a medirse) |
| `scrum697` · `scrum698` | 286 nodos | **245**, por IDENTIDAD, abajo |
| `scrum522` · `scrum548` | 32 guards fuera de la tanda · 4× `#quotes-new` | 5× en 548; en 522, **34** tras mergear `origin/main` = `43f4c7fc3f8d0330089edcd785cb0eea58ccb784` (la rama decía 33 y main decía 33 por otro guard: undécima colisión del contador, sólo en los comentarios). Medido corriendo el test sobre el árbol fusionado, no sumado |

**Los −41 nodos, por identidad** (firmas etiqueta + clase de los dos árboles montados en el banco):

```
POBLACIÓN  main = 286   rama = 245   delta = −41
FALTA en la rama: −34  las 2 líneas en blanco (17 nodos cada una)
                  −7   div.quote-totals + 2 filas de apoyo (div + span + strong)
SOBRA en la rama: +1   BUTTON.quote-line__ajustes.is-de-siempre  ← el MISMO nodo con otra clase (−1 de la clase vieja)
```

### Medido

- Sobre el árbol YA FUSIONADO con `43f4c7fc`: `npm run build` 0 · los **205 ficheros** que leen
  `quotesView.js`, `atajoNuevo.js`, `app.js` o `styles.css`, más los censos de la lista de la S2
  (237, 258, 267, 350, 514, 522, 548, 601, 662, 697, 698, 700, 709, 710b, 723, 726): **1.683
  pruebas, 1.640 pass, 0 fail, 43 skipped** · `npm run guards:entrada` 11/11 · `guard:conceptos-limpios` 5/5.
- Guards de navegador del editor, todos 0 y con su población: `pasos-del-editor` (3 casos),
  `descuento-redibuja`, `rotulos-de-la-linea` (10 anchuras), `duplicar-conserva`, `objetivo-tactil`,
  `documento-vivo` (8 casos), `un-solo-presupuesto` (3 casos), `descuentos-en-el-detalle` (4 casos),
  `marcadores-en-pantalla` (27 vistas; `quotes-new` sigue en su techo de 6).

### Lo que NO cubre

- «Línea N» como título del menú: firmado, **no construido**. El menú es el helper compartido
  `overflowMenu`, que no pinta título; ponérselo es tocar un componente de todas las pantallas.
- Los dos marcadores del descuento pactado («Este cliente tiene pactado…» / «Aplicar a las líneas»):
  son de 915k.
- El documento suelto con la ficha oculta: no se ha medido porque no cambia (la ficha se queda).
- La suite completa: no corrida (norma de la tanda); la corre el PR.
- Staging: sin recorrer todavía.

## SCRUM-915i · la cabecera y el menú «⋯» de arriba

**Fecha:** 21-sep-2026 08:09:27 GMT · **Carril:** S2 (frontend) · **Corte:** 4.º de la partición aprobada
**Medido contra:** `origin/main` = `6b0d92e425157ff3a8c1512bccd224f7e000e03d` (mergeado en la rama a través de 915h)
**Rama:** `scrum-915i-cabecera`, sobre `scrum-915h-conceptos-limpios` (#1562), porque tocan el mismo fichero
**Instrumento:** `scripts/guard-915i-cabecera.mjs` (`npm run guard:cabecera-del-editor`)
**Microcopy:** `docs/microcopy/2026-09-21-SCRUM-915-cabecera-del-editor.md` (comentario 15868)

### Qué entra (las cuatro filas del PASO 0, «A · Cabecera» y «H · Acciones»)

| fila | antes | ahora |
|---|---|---|
| título | «Crear presupuesto» | **«Nuevo presupuesto»**, el rótulo que la app ya pone a esta ruta (`L.quoteNew`). El suelto sigue con `tituloModal()` |
| subtítulo | «Genera un presupuesto con varias líneas…» | **se retira**: cada paso lleva su frase guía desde 915d |
| «Limpiar formulario» | suelto en el último paso, **sin confirmar** | en el «⋯» de arriba («Más acciones»), y **pide confirmación**: «¿Vaciar este documento?» · la frase firmada · «No, seguir» / «Limpiar formulario» |
| «💾 Guardar como plantilla» | suelto en el último paso | en el mismo «⋯», delante de limpiar |

La sonda del PASO 0 (`scripts/sonda-915-inventario-v3.mjs`) sobre la rama: las cuatro filas **✅ ya
está**, y el recuento pasa a **28 ya · 3 parcial · 8 falta · 9 no medible = 48 de 48**. (La sonda
reescribe `paso0-medido.json` al correr; ese fichero es la foto del PASO 0 y se devolvió a HEAD.)

**La decisión que no es cosmética: vaciar vuelve a PINTAR la pantalla entera.** El reset viejo
devolvía cinco campos a mano (cliente, dirección, IVA por defecto, condición de pago, líneas) y se
dejaba el IVA del presupuesto, la validez, las formas de pago, los datos del cliente, «incluir
descripción» y el descuento global — lo dice el inventario de hoy. La hoja firmada promete «Se
quitan el cliente, las líneas y los cambios de este documento»: con el reset viejo detrás, habría
mentido. `vaciarDocumento()` cancela el autoguardado pendiente, borra el borrador y llama a
`renderQuotesView(container, null, esDocumentoSuelto)`, que es abrir la pantalla nueva. Las
plantillas (del servidor) y las opciones de siempre (se vuelven a leer al pintar) se quedan, como
dice la segunda frase. El foco de la hoja va a «No, seguir»: un acto irreversible no es nunca la
acción principal.

### El rojo, y los mutantes

`guard:cabecera-del-editor` con el `public/` de 915h (`a25c1595`) encima de la rama, devuelto con
`git restore --source=HEAD` y `git status --porcelain` vacío: **6 hallazgos en 4 de 4 casos** (el
título, el subtítulo, sin «⋯» arriba, y B, C y D sin poder llegar a limpiar). **Verde con la rama: 4/4.**

Como con el público viejo B y C se paran al no encontrar el «⋯», lo que vacía se probó por mutación,
con el guard comiteado antes (`a7fa735a`) y cada mutante devuelto a HEAD:

| mutante en `vaciarDocumento` | resultado |
|---|---|
| M1 · el reset viejo, campo a campo | **cae**: «tras vaciar el descuento global sigue en 25» |
| M3 · sin `clearDraft()` | **cae**: 5 hallazgos (cliente, línea y descuento siguen; el borrador vuelve al recargar) |
| M2 · sin `clearTimeout(draftSaveTimer)` | **SOBREVIVE**, 2 de 2 pasadas, también vaciando sin una sola espera tras la última tecla |

M2 va declarado en la cabecera del propio guard. Causa **no demostrada**; hipótesis: la pantalla
nueva escribe su propio borrador después del temporizador viejo y lo pisa. El `clearTimeout` se
queda porque no depende de esa suerte, pero **no se afirma que haya una red que lo sujete**.

### Censos y guards que cambian, cada uno con su motivo en el propio fichero

| fichero | qué exigía | por qué cambia |
|---|---|---|
| `scrum139-cuadernillo` | `dibujarCuadernillo()` ≥ 3 veces (el reset lo llamaba) | **re-anclado** (procedimiento de 915d con 660, decidido por el orquestador): ≥ 2, y que `vaciarDocumento` pase por `renderQuotesView` |
| `_censo-dos-fronts` (E7) | `actionsRow.appendChild(saveTemplateBtn)` | la capacidad es la misma y cambia de DIRECCIÓN: el botón va en la lista del `overflowMenu` y el menú cuelga de `headingRow` |
| `scrum600` (ranuras) | 30 posiciones, 28 textos | **29 / 27**: «Crear presupuesto» → «Nuevo presupuesto» y sale el subtítulo. Ningún texto nuevo |
| `scrum600b` · `scrum600g` | «Guardar como plantilla» en el contenedor | se lee **con el menú abierto**, pulsando el «⋯» como el profesional |
| `scrum601` | «Solo presupuesto…» en `quotesView.js:889` | **890**, medido con el propio censo. La trampa del ancla por número, otra vez |
| `scrum697` · `scrum698` | 245 nodos | **244**, por IDENTIDAD, abajo |
| `scrum548` | 5× `#quotes-new` | 6× `#quotes-new`, 2× `#invoices-new`, y **`2×about:blank` declarado: no es un solape** (es la recarga por la que 915h y 915i pasan antes de cada `goto`) |
| `scrum522` · `_guards-de-navegador-declarados` | — | el guard se apunta en su propia línea (SCRUM-970) y deja su comentario |

**Los −1 nodos, por identidad** (firmas etiqueta + clase + texto propio, banco `_banco-vistas.mjs`):

```
POBLACIÓN  915h = 245   915i = 244
FALTA en 915i:  P.quotes-desc (el subtítulo)
                BUTTON.btn btn-secondary «Limpiar formulario»      ← al menú: fuera del árbol hasta abrirlo
                BUTTON.btn-ghost btn-sm quote-header-btn (plantilla) ← ídem
SOBRA en 915i:  DIV.quotes-header-row
                BUTTON.overflow-trigger btn-ghost btn-sm «⋯»
                (H2.quotes-title es el MISMO nodo: «Crear presupuesto» → «Nuevo presupuesto»)
```

### Medido

- `npm run build` 0. Los 70 ficheros de `tests/` que leen `quotesView`, `renderQuotesView`,
  `renderDocumentoSueltoView`, «Limpiar formulario» u `overflowMenu`: la primera pasada dio 685 tests,
  **13 rojos** (los contratos de arriba); tras re-anclarlos, los 7 ficheros afectados 68/68.
- Guards de navegador del editor, todos 0: `cabecera-del-editor` (4 casos), `pasos-del-editor`,
  `documento-vivo`, `conceptos-limpios`, `descuento-redibuja`, `rotulos-de-la-linea`,
  `duplicar-conserva`, `marcadores-en-pantalla`, `un-solo-presupuesto` y `objetivo-tactil`.

### Errores propios

1. **El «⋯» de arriba nació CORTO** (30,7 px, la clase `.btn-sm` que arrastran los de cada línea).
   Lo cazó `guard:objetivo-tactil` en el documento suelto; el mío no mide áreas. Arreglado en el
   código (44 px mínimo en la fila del título), sin tocar el guard ni añadir excepción.
2. **Mi primer caso C no ejercitaba la carrera que decía vigilar.** Esperaba entre la última tecla y
   el vaciado, el temporizador ya había saltado, y M2 sobrevivía por eso. Lo cambié a un vaciado sin
   esperas… y M2 sigue vivo por otra causa. Queda declarado en vez de darlo por cubierto.
3. **El rojo de #1562 (915h) era mío**: un «5 casos» en un comentario de `scrum522`, en una línea sin
   fecha, y el censo de SCRUM-737 pasó de 81 a 82. Reproducido en local antes de arreglarlo
   (`a2c53547`: la cifra va en la línea de su fecha).
4. **Corrí la sonda del PASO 0 sin mirar que escribe**: reescribió `paso0-medido.json`. Lo vi en
   `git status` y lo devolví a HEAD antes de comitear.
5. **El guard nombraba la clase del pie de los modales en un selector**, y el censo de SCRUM-350
   exige mirar a todo fichero que la nombre: rojo en `scrum350`. Ahora lee los botones de la hoja por
   su propia clase y sin los de la cabecera; al cambiarlo salió un tercer botón, la ayuda «?» de
   `cabeceraModal`, que tampoco es del pie. Repetidos el rojo contra 915h (6 hallazgos) y M1 (cae).
   `scrum939b` también sale rojo aquí, y sale igual sobre 915h sin mi rama: no es de este corte.

### Lo que NO cubre

- «Línea N» como título del menú de cada línea: firmado, **no construido** (toca `overflowMenu`, el
  menú de todas las pantallas). Pendiente de que el orquestador lo meta en un corte.
- `merchantInfo` («datos de empresa» en la izquierda): no es de este corte.
- La suite completa: no corrida (norma de la tanda); la corre el PR.
- Staging: sin recorrer.
