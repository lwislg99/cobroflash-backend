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
