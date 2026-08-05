# SCRUM-284 · B1 — censo derivado de los campos de Configuración

**Fecha:** 4-ago-2026 · **Carril:** B (tooling) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `17289f59f73e041b8989bddd69868aca056eec17` · 2026-08-04T15:20:57+01:00
**Tanda:** 1287 tests, 1220 pass, 0 fail, 67 skipped (`npm test` con exit **0**)
**Ficheros:** `tests/_censo-configuracion.mjs`, `tests/scrum284-censo-configuracion.test.mjs` (8)

> **ALCANCE:** solo el **censo**. No toca la sidebar, no mueve ni un campo, no renombra nada y
> **no asigna campos a submenús** — la asignación espera a que el fundador confirme el orden de B1.

## Por qué derivado

B1 trocea Configuración en nueve submenús, y el ticket nombra su propio fallo mudo: *«un ajuste
que desaparece en una reorganización… nadie lo nota hasta que alguien va a cambiar su IBAN y no lo
encuentra»*. Una lista a mano no avisa de lo que le falta.

## El resultado: 25 campos, en CUATRO formas de declaración

| origen | nº |
|---|---|
| `createField(etiqueta, clave, tipo, obligatorio)` | 13 |
| `createToggle(clave, etiqueta, pista)` | 3 |
| `createElement("select")` + `.name` | 1 |
| HTML dentro de plantillas (`<input id>`, `<select id>`) | 8 |

## 🔴 La cuarta forma es la lección, y la pagué yo

La **primera versión declaraba TRES formas**, medidas del árbol, daba **22 campos** y tenía **los
suelos en verde**. Los tres avisos por email no aparecían por ningún lado **con la pantalla
intacta** — se declaran con `createToggle`, no con `createField`.

**Lo destapó el CONTRASTE con la lista a mano del ticket, no el censo.** O sea que un censo
derivado tampoco es infalible: lo que lo salva es contrastarlo contra la lista humana y
**reportar la diferencia en vez de callarla**. La lista del ticket no sirve como censo, pero sí
como control cruzado — cada una ve lo que a la otra se le escapa.

## El cruce que caza un renombrado

Un conteo solo ve desapariciones. Si alguien **renombra** `iban`, el conteo no se mueve y el
ajuste queda escribiendo en una columna que no existe. Por eso toda clave de `createField` debe
ser columna de `Merchant`, **derivada del schema**, no de una lista. Con su propio suelo: si el
parseo del schema se rompiera, el conjunto quedaría vacío y el cruce pasaría en verde sin comparar
nada.

## Suelos, medidos hoy

13 `createField` · 3 `createToggle` · 1 `select` · 5 plantilla. No son cifras de gusto: son lo que
hay, fijado. Quitar un campo baja el conteo y cae.

## Verificado en rojo

- **Campo quitado** (`iban`, línea 113 de `settingsView.js`): cae con
  `🔴 el censo solo vio 12 campos vía createField (esperados ≥13)`.
- **Detector cegado** (`createField` deja de reconocerse): caen **dos** suelos. El mensaje dice las
  dos causas porque desde fuera son indistinguibles: *«o ha desaparecido un ajuste, o el detector
  dejó de reconocerlos»*.

Commiteado **antes** de inyectar. Árbol restaurado y verificado.

## Controles negativos

- Un **botón**, un **div** o un **enlace** con `id` no son ajustes: contarlos inflaría el censo y el
  suelo dejaría de proteger nada.
- La **declaración** del helper no es un campo; solo lo son sus llamadas.

## Contraste con la lista del ticket — lo que el fundador necesita

**Campos que la lista de doce asuntos NO menciona:**

- **`country`** (selector de país, línea 93)
- **`clabe`** (CLABE interbancaria · México, línea 114)
- **`approvalThreshold`** («Importe máximo sin aprobación», línea 412) — es un asunto entero:
  aprobaciones de equipo
- **`qr-formato`, `qr-size`, `qr-dark`** (línea 782) — opciones de descarga del QR

**Y lo que la lista SÍ menciona y el censo no veía:** los tres avisos por email — ya incorporados.

## Límites declarados

- Si aparece una **quinta forma** de declarar un campo, este censo no la verá. Por eso el suelo
  exige encontrar de las cuatro y por eso el contraste se reporta.
- El censo enumera **controles de la pantalla**, no columnas persistidas: `qr-*` y `ref-link` son
  controles de interfaz, no ajustes que se guarden. La distinción la decide la asignación, que no
  es de esta tarea.

---

## Asignación a submenús (segunda entrega de B1)

**19 asignados · 6 pendientes de decisión · 0 sin sitio.**

El censo dice QUÉ hay; la asignación dice DÓNDE va. `tests/scrum284-asignacion-submenus.test.mjs`
falla si un campo no está ni asignado ni declarado pendiente: el fallo mudo del ticket convertido
en fallo ruidoso.

**Los pendientes no se asignaron por cuenta propia** — la asignación es del fundador. Van
declarados **con su motivo por campo**, porque una excepción sin motivo se hereda para siempre. Y
van como *pendientes* y no como rojo a propósito: un guard en rojo permanente esperando una
decisión se acaba desactivando.

**Microcopy sin aprobar (regla 30):** solo hay claves internas; todo rótulo pasa por `PENDIENTE()`
y un guard comprueba que ninguna clave parezca microcopy (mayúsculas, acentos o espacios).

**Control cruzado, aplicando la lección del censo:** la lista de asuntos del ticket vive en el
fichero tal cual y un test **reporta** la diferencia. Reporta y no bloquea.

### 🔀 Diferencia encontrada al contrastar

El ticket habla de **nueve submenús** pero enumera **doce asuntos**. La asignación usa **once**
claves internas. La reconciliación doce → nueve **es una decisión del fundador**, no una que se
pueda derivar: agrupar «fiscales» con «dirección», o «moneda» con «prefijo de factura», cambia
dónde busca la gente su ajuste.

### Lo que NO se construyó, y por qué

**La sidebar y los nueve submenús no están construidos.** `CLAUDE.md` marca `yaqu-premium-ui` como
obligatoria antes de tocar UI (DESIGN.md + Parte AB + checklist AB6), y esta sesión no tenía margen
para hacerle justicia a esa mitad además del mecanismo. Media sidebar entregada sería el «menú que
lleva a una página vacía» que el fundador acaba de vetar. Queda para una pasada propia.

### Corrección propia

La primera versión de esta entrada declaraba el sha **sin la hora**, y el guard de **SCRUM-267** la
tumbó en la suite completa (`falta la HORA (la fecha sola no dice si caducó)`). Mis siete tests
pasaban aislados: lo cazó correr la suite entera, que es exactamente para lo que se corre entera.

---

## Segunda tabla del mapa: las SUPERFICIES (tercera entrega de B1)

**Medido contra:** `origin/main` = `eebc191dc75da0040f4934ccd8b92cc857726832` · 2026-08-04T16:03:42+01:00
**Ficheros:** `tests/_censo-superficies-configuracion.mjs`, `tests/scrum284-dos-poblaciones.test.mjs` (9)

### Por qué hacía falta

El censo de campos midió 25 ajustes y no estaba mal — medía **campos**. La pantalla también tiene
**bloques que no son campos**, y un mapa construido solo sobre los campos los deja sin sitio: el
mismo fallo mudo con otra cara.

**Es la segunda vez que un censo derivado mío se queda corto:** la primera por una FORMA
(`createToggle`), esta por una POBLACIÓN ENTERA. Las dos las destapó el contraste humano.

### El criterio, declarado

**Una SUPERFICIE es una función `render…(container)` que pinta un bloque con TÍTULO PROPIO.** Dos
hechos estructurales, y hacen falta los dos: recibe un contenedor (es un bloque, no un control) y
su marcado abre un `<h2>` (el usuario la ve como «una cosa»).

**⚠️ El criterio NO puede ser «tiene id»**, y el caso que lo prueba está medido: el contador de
WhatsApp (`renderWaFairUseCard`) **no tiene ningún id**. Un censo por identificadores lo perdería
entero — justo la superficie que destapó que faltaba una población. Hay un control positivo que lo
fija.

Y tampoco «toda función `render…`»: `renderProfileQrButton(card, m)` recibe una tarjeta ya pintada
y no abre título — es un control DENTRO de una superficie. La distinción la da el primer parámetro
más el título, no el nombre.

### Las cuatro superficies

| Línea | Clave | Título |
|---|---|---|
| 528 | `renderWaFairUseCard` | «WhatsApp este mes» |
| 564 | `renderReadinessCard` | «Tu cuenta, lista para cobrar» |
| 652 | `renderPublicProfileCard` | «Tu página pública» |
| 857 | `renderReferralCard` | «Invita y gana meses gratis 🎁» |

**`connect-status-body` no sale como superficie propia:** vive DENTRO de `renderReadinessCard`.
Por eso su propuesta va anotada dentro de la de esa tarjeta.

### El cuadre de la suma — no hay tercera población

**21 identificadores: 8 son campos · 13 son controles de superficie o contenedores. 8 + 13 = 21 ✓**

Hay un test que lo comprueba y falla si aparece un identificador que no sea ni una cosa ni la otra.

### Dónde van — propuesta, no decisión

Las cuatro van **declaradas pendientes con su propuesta escrita**, y el guard las acepta sin dar
rojo: un guard que vive en rojo esperando una decisión es un guard que alguien desactiva.

- **`renderPublicProfileCard`** → «Tu página pública» **cae sola**, y con ella los `qr-*` y el botón
  de descarga, que son controles DE esta superficie, no ajustes sueltos. **Eso resuelve tres de los
  huérfanos de campos.**
- **`renderReadinessCard`** → a decidir. Es estado **transversal** (cobros, WhatsApp, datos
  fiscales), no cae solo en ningún submenú. Contiene el estado de Connect, que por sí solo iría a
  Cobros.
- **`renderWaFairUseCard`** → a decidir. Informativo, no persiste: por la regla del fundador no es
  Configuración, pero hoy no tiene otra pantalla donde vivir.
- **`renderReferralCard`** → pendiente mayor: no es un ajuste, es un canal de crecimiento. Ya está
  escrito como tarjeta con render propio sobre un contenedor, así que **moverlo a la barra lateral
  es cambiar dónde se la llama, no rehacerla**.

### Suelos y controles

Suelo por población, por separado: ≥25 campos y ≥4 superficies. Positivo: la superficie **sin id**
se censa. Negativos: un control dentro de una tarjeta no es superficie, y la vista entera tampoco.

---

## El mapa se arregla y su guard pasa a BIDIRECCIONAL (cuarta entrega de B1)

**Medido contra:** `origin/main` = `077fa8ac24d7e832d446a589b31367e9c15de916` · 2026-08-05T05:54:55+01:00
**Tanda:** 1423 tests, 1356 pass, 0 fail, 67 skipped
**Ficheros:** `tests/_asignacion-submenus.mjs`, `tests/scrum284-asignacion-submenus.test.mjs` (12, antes 7)

> **ALCANCE: no toca UI.** `public/` está intacto. Este paso arregla el mapa y su guard; construir
> los diez submenús es el resto del incremento 1 y **está bloqueado por la decisión de `resenas`**.

### El defecto

El mapa mergeado en `a6d2cd4` tenía **once destinos y seis no existían como submenú** (`fiscales`,
`whatsapp`, `moneda`, `serie`, `resenas`, `referidos`). Al revés, **cinco de los diez submenús no
tenían ni un campo** (`facturacion`, `numeracion`, `datos`, `cumplimiento`, `equipo`). **Y el guard
estaba VERDE**, porque preguntaba «¿tiene sitio este campo?» y nunca «¿existe ese sitio?». Es el
fallo mudo del ticket un piso más arriba, y el mismo trinquete de un solo sentido de SCRUM-299.

**LA CAUSA ESTRUCTURAL, que es lo que hay que retener:** el conjunto de destinos válidos se
**DERIVABA de los propios valores del mapa** (`[...new Set(Object.values(ASIGNACION))]`). Un conjunto
que se define por lo que lo usa **no puede detectar un uso equivocado** — escribir un destino
inventado lo declaraba válido en el mismo gesto. Por eso el arreglo no es añadir un `if`: es que la
lista de los diez submenús pase a existir como **conjunto cerrado y declarado**, independiente de
quién la use.

### Los cuatro sentidos

① campo sin sitio (el de siempre) · ② destino que no es submenú · ③ submenú sin campos, salvo que
esté en `VACIOS_DECLARADOS` con su motivo · ④ **vacío declarado que YA tiene campos**. El ④ impide
que esto degenere: si un submenú deja de estar vacío en silencio, la lista sigue declarando un hueco
que ya no existe y nadie sabe nunca cuándo se vació del todo. **Que el guard falle por una MEJORA es
deliberado** — misma propiedad que el censo heredado de SCRUM-267.

Se abre una **tercera categoría**, `FUERA_DE_CONFIGURACION` (hoy solo `ref-link`): sin ella, sacar
algo de Configuración sería indistinguible de olvidarlo. Y un test nuevo exige que las tres
categorías sean **excluyentes** — un campo en dos dejaría el mapa diciendo dos cosas, y cuál gana
dependería del orden de los `if`.

### `resenas` no se decidió: la condición que se le puso no se cumple

El criterio era «si es la petición automática tras el cobro → avisos; si es la ficha pública →
publica». Medido: **las dos ramas son verdaderas a la vez y hay una tercera**. `googleReviewUrl` lo
consumen (1) el WhatsApp automático tras el cobro — `psp.routes.ts:221`, `mpWebhook.routes.ts:181`;
(2) la ficha pública `/p/:slug` — `publicProfile.service.ts:73`; y (3) **la página de recibo**, con
botón y estrellas — `receipt.routes.ts:248`. Un campo, tres superficies. Queda en
`PENDIENTES_DE_DECISION` con la medición escrita.

### Discrepancia con el encargo, resuelta por el propio mecanismo

El encargo listaba **cuatro** vacíos declarados incluyendo `equipo`, pero el fundador ya había
colocado `approvalThreshold` → `equipo`. Con esa asignación **`equipo` ya no está vacío**, así que
declararlo habría hecho saltar el sentido ④. Los vacíos son **tres**: `facturacion`, `datos`,
`cumplimiento`. Lo dice el guard, no una lectura.

### Verificado en rojo

**PRIMER INTENTO DESCARTADO POR NO PROBAR NADA:** poner el mapa de `origin/main` tal cual tumbaba el
fichero entero (`1 test, 1 fail`), pero por **error de importación** — el mapa viejo no exporta
`SUBMENUS` ni `VACIOS_DECLARADOS`. Un rojo de carga del módulo no demuestra que el guard cace el
defecto: demuestra que no llegó a correr.

**EL ROJO BUENO:** se conserva el andamiaje nuevo y se sustituyen **los datos** por los del mapa
viejo (19 campos, 11 destinos reales). El guard corre de verdad y da **7 de 12 en rojo**, con los
sentidos nuevos nombrando el defecto exacto: **②** los seis destinos inexistentes, **③** `numeracion`
y `equipo` sin un solo campo (los otros tres ya están declarados con su motivo, que es justo la
diferencia entre deuda y error). Coincide **campo por campo** con lo medido a mano en el ticket.
Restaurado, 12/12.

El **suelo va primero**, y tiene un complemento que hacía falta: el ③ podría estar verde si TODOS los
submenús estuvieran declarados vacíos, así que un negativo exige que al menos siete tengan campos de
verdad.

---

## La pantalla: Configuración troceada en diez submenús (quinta entrega de B1)

**Medido contra:** `origin/main` = `c2be01e9347a2b0b761e764de7033f322f820f85` · 2026-08-05T06:25:00+01:00
**Tanda:** 1451 tests, 1384 pass, 0 fail, 67 skipped
**Ficheros:** `public/dashboard/js/settingsSubmenus.js` (nuevo) · `settingsView.js` ·
`dashboard/index.html` · `sw.js` · `tests/_asignacion-submenus.mjs` ·
`tests/scrum284-configuracion-submenus.test.mjs` (nuevo, 8) · `docs/capturas/scrum-284/`

### 🔴 EL MAPA SE MUDA A `public/`, Y ESE ES EL CAMBIO QUE IMPORTA

Mientras el mapa vivió en `tests/`, el guard comprobaba **una tabla que la pantalla no usaba**. Su
verde no decía una sola cosa sobre lo que el profesional ve: bastaba con colocar un campo en otro
sitio dentro de `settingsView.js` para que las dos versiones divergieran en silencio. **Es el defecto
del ticket una vuelta más** — dos fuentes que empiezan de acuerdo y se separan sin que nadie lo note.

Ahora el mapa es `public/dashboard/js/settingsSubmenus.js`: la pantalla **coloca leyendo de ahí** y
el guard **verifica contra ahí**. `tests/_asignacion-submenus.mjs` se conserva como puerta del test
(la ruta de importación no cambia) y como sitio del control cruzado.

### La decisión de `googleReviewUrl`, y el criterio que la sostiene

**→ `avisos`.** Criterio del fundador, que queda escrito porque sirve para las que vengan: **el
destino de un ajuste sale de lo que GOBIERNA, no de dónde se ve su efecto.** El campo configura el
envío automático de la petición de reseña —lo dice el propio texto de la pantalla,
`settingsView.js:283`— y sus otras dos superficies solo lo CONSUMEN. Configurar y consumir no son lo
mismo, y este mapa es de configuración. Igual que el logo: se configura en Marca y aparece en el PDF,
en la ficha pública y en los correos, y a nadie se le ocurre que viva en tres sitios.

**Los TRES consumidores quedan anotados en el mapa** para que quien toque cualquiera de ellos sepa
que el origen es único y no salga a buscarlo: `psp.routes.ts:221` y `mpWebhook.routes.ts:181` (el
WhatsApp tras el cobro) · `publicProfile.service.ts:73` (la ficha pública) · `receipt.routes.ts:248`
(el botón y las estrellas del recibo).

### Lo que el guard nuevo destapó al primer intento

**Los seis `pp-*`/`qr-*` estaban asignados a `publica` en el mapa y se pintaban FUERA de los diez
paneles**, porque quien los dibuja es `renderPublicProfileCard`, que colgaba del `container`. El
guard de asignación —mirando solo el mapa— habría seguido verde para siempre.

De ahí sale `ASIGNACION_SUPERFICIE` y el **cruce entre las dos poblaciones**: no basta con que una
superficie esté colocada en algún sitio, tiene que estarlo en **el mismo submenú** que el mapa dice
para los campos que ella pinta. Si no, el mapa diría `publica`, la pantalla los enseñaría en otro
panel, y los dos guards estarían verdes.

**Y una segunda cazada, a mí mismo:** el bloque de estado de Connect lo coloqué con
`paneles.cobro.appendChild(...)`, que es la misma colocación a mano sin ser un literal. El censo no
lo veía. Se amplió para mirar también los accesos `paneles.<clave>` — es la forma más cómoda de
saltarse el mapa, y por eso la que se escribe sin pensar.

### Cómo se hizo el cambio, y por qué así

**No se ha movido ni reescrito la construcción de un solo campo.** Siguen creándose igual y en el
mismo orden; lo único que cambia es dónde se hace `appendChild`: `form.appendChild(x)` pasa a
`colocar('clave', x)`. Eso es lo que mantiene el cambio revisable (regla 4) y lo que permite que el
censo siga viendo los 25. `submenuDeCampo` **lanza** si la clave no está en el mapa: caer en el sitio
equivocado sería mudo, fallar se oye.

Se retiran los cuatro separadores internos, cuyo único trabajo era subdividir un scroll que ya no
existe. Los diez paneles cuelgan del MISMO `<form>`, así que **un solo «Guardar cambios» sigue
guardando todo**: trocear la pantalla no trocea el guardado.

### Verificado

**EN EL NAVEGADOR, contando controles panel por panel** (no leyendo el código): **24 controles +
`ref-link` (fuera de Configuración) = los 25 del censo, cero duplicados, cero perdidos.** Los tres
paneles vacíos son exactamente los tres declarados. El índice de estado queda en la cabecera y no
dentro de ningún panel; «Invita y gana» ya no está; el contador de WhatsApp está dentro de Avisos.

**UN FIXTURE EQUIVOCADO CASI ME DEJA PROBAR DE MENOS**, y va escrito porque es la parte útil: la
primera pasada mandaba `profileSlug` y `renderPublicProfileCard` sale por `if (m.slug === undefined)
return`. La tarjeta no se pintaba **ni en el antes ni en el después**, así que la comparación parecía
correcta y en realidad no miraba los seis `pp-*`/`qr-*`. Se midió la condición en el código en vez de
suponerla.

**Dos inyecciones** en la suite: colocar a mano en un panel, y dejar un campo sin colocar. Y el
**guard bidireccional de la entrega anterior sigue en 14/14** después de tocar justo la pantalla que
vigila — comprobado explícitamente, no por el verde global.

### Dos correcciones del fundador, aplicadas en esta misma rama

**① «Invita y gana» se ENLAZA PROVISIONALMENTE.** Yo la dejé sin llamar y lo propuse como opción; la
respuesta corrige el criterio y tiene razón: *el programa de referidos paga un mes gratis al
referidor, o sea que es DINERO, y que desaparezca de la interfaz «solo durante un PR» es una
regresión real*. La orden «el menú crece cuando existe el destino» valía para crear entradas nuevas,
**no para dejar huérfana una que ya funcionaba**. Se sigue pintando donde está hoy —tarjeta suelta al
final, fuera de los diez paneles— y queda en `SUPERFICIES_PROVISIONALES` con lo que la sustituye.

El guard exige **las dos mitades**, y esa es la parte que evita que «provisional» se vuelva
permanente: que la colocación esté declarada **y** que se siga pintando. Declararla sin pintarla
sería la regresión; pintarla sin declararla sería olvidarla.

**② Los diez rótulos se APRUEBAN y se aplican.** No era redacción nueva —los nueve primeros están
escritos en la descripción del ticket y el décimo es el nombre que usó el fundador al colocar
`approvalThreshold`—, así que aterrizarlos no fue escribir microcopy: fue dejar de usar el marcador.

**Y había un motivo de MEDICIÓN para hacerlo antes de capturar, que es el que no se me había
ocurrido:** con el marcador (28 caracteres) las diez pestañas caían **una por fila** a 390 px, así
que mis capturas estaban midiendo el marcador y no la pantalla. Con los textos reales, medido:
**cuatro filas (3+3+3+1)**, pestaña más ancha 124 px, 44 px de alto, sin desbordamiento en X. **No
había problema de layout: era el marcador.** Por eso no sale hallazgo ni ticket — se midió con el
texto real antes de decidirlo, en vez de apañar contra un texto provisional.

El guard de microcopy cambia de forma en consecuencia, igual que en SCRUM-344: deja de exigir el
marcador —eso solo impedía INVENTAR mientras no había texto— y pasa a **fijar el aprobado carácter a
carácter**, que es lo que impide CAMBIARLO. Verificado en rojo sobre el módulo real: «Cobros» →
«Cobro» tumba el test y nombra la ranura. **El estado vacío SÍ sigue con el marcador**, y la
diferencia importa: «aquí todavía no hay nada» no está escrito en ninguna parte, así que es
redacción nueva y la aprueba el fundador.

### Lo que NO cubre

* **La sidebar (incremento 2) y la pestaña de Plantillas (incremento 3) no se tocan.** El incremento
  2 le da a «Invita y gana» su entrada definitiva y borra su colocación provisional.
* **La matriz de dispositivos reales** (V0-5) es humana y por bloque. Declarada como hueco.
* **No se ejecuta la vista en `npm test`**: no hay banco de DOM y montarlo sería dependencia nueva
  (regla 36). Lo que corre es el mapa y el AST; el navegador se ejercitó a mano y quedó en capturas.
