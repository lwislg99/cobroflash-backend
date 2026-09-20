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
   `div.quotes-header-block` (QV:72), no el `<h2>`. Preguntarle al `h2` si contenía el aviso daba
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
