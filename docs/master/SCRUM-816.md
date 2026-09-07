# SCRUM-816 · La lista de Trabajos: media pantalla en blanco, la misma acción veinte veces, y un dato que no viajaba

**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T19:50:23+02:00

Segunda vuelta de la lista desplegada en SCRUM-727. Siete decisiones del fundador; **dos se
cayeron midiendo, y las dos las tumbó él mismo al leer la medición.**

---

## PASO 0 ① · El tope de ancho: de dónde salía y a quién movía

Salía de **una línea**: `.jobs-pantalla { max-width: 980px }` (`styles.css`), heredada del
contenedor de tarjetas que la lista sustituyó en SCRUM-727b. La hipótesis del ticket era correcta.

**No era compartido.** La clase existe en exactamente dos sitios de todo el árbol: esa regla y
`jobsView.js`. Medido en Edge con `page.setViewport` real, subiendo la cadena de antepasados desde
la tabla hasta el `<body>` y anotando el `max-width` computado de cada uno:

| viewport | Trabajos | Clientes | Presupuestos | Facturas |
| --- | --- | --- | --- | --- |
| 1700 px | **978** | 1402 | 1402 | 1402 |
| 1280 px | **978** | 982 | 982 | 982 |

Tocarlo mueve **sólo Trabajos**, así que el alcance del ticket no cambia. Tras el cambio, a 1700 px
la tabla mide **1402 px**: la misma que sus cuatro hermanas.

> ⚠️ La cifra del ticket era ~730 de ~1.700 y la medida es 978. El mecanismo es el mismo y es
> único; la cifra que queda escrita es la medida. **Mide quien mide.**

### 🔴 Y el primer medidor mintió — lo cazó el número, no la sospecha

Daba **982 px para Trabajos, idéntico a las otras cuatro**. Imposible con un `max-width: 980px`
encima. Era ceguera: el mini-DOM de `tests/_banco-vistas.mjs` **aplana `innerHTML`**, y
`renderJobsView` abre su pantalla con `container.innerHTML = '<div class="jobs-pantalla">…'`; al
serializar salía ese div **vacío** con todo lo demás de hermano. **El envoltorio que llevaba el
tope desaparecía.**

Por eso nace `scripts/_banco-lista.mjs`: carga los MISMOS scripts que declara
`public/dashboard/index.html`, en su orden, en un navegador de verdad, y sólo dobla `apiRequest`.
Así el anidamiento lo produce el producto — y, de paso, **se puede pulsar**, que es lo que este
ticket necesitaba para probar el candado.

---

## PASO 0 ② · Los estados reales, y el estado que no era un estado

La FSM tiene **cinco** (Parte L · `job.service.ts:9`): `pendiente_agendar` «Sin agendar» ·
`agendado` «Agendado» · `en_curso` «En curso» · `terminado` «Terminado» · `cerrado` «Cerrado».

La tabla del ticket cubría tres filas y **dejaba fuera dos: Terminado y Cerrado**. Y
**«Con partes sin valorar» no es un estado de la fila**: es una condición **por línea** de un parte
(`sinValorar`, `partes.routes.ts:172`) que sólo se calcula en `/admin/partes/oficina/pendientes` y
que **no llega** a `/admin/jobs`. Hoy «Valorar» no se puede pintar aunque se firme.

---

## 🔴 El hallazgo que cambió el ticket: el botón repetido era un DATO QUE NO VIAJABA

El ticket lo planteaba como una decisión de diseño a rehacer. No lo era.

`jobNextAction` —la escalera única de SCRUM-366— **no ramifica por el estado del Trabajo**: decide
por sus **albaranes** y sus **facturas**. Y `serializeJob`, el serializador de la **lista**, no
mandaba ninguno de los dos: `albaranes` e `invoices` los añadía sólo `serializeJobDetail`. Con los
campos ausentes, `Array.isArray(undefined)` es `false`, la escalera los trata como listas vacías y
cae **siempre** al nivel 5.

Medido en navegador antes de tocar nada, una fila por cada estado × con resto y sin resto:

```
  9 ×  + Nuevo albarán          ← incluida una fila CERRADA
  1 ×  💰 Cobrar el resto (597,13 €)
```

**Control positivo, corrido:** metiendo un albarán `emitido` en el mismo lote, esas 9 pasan a
«Enviar para firmar». La causa está probada, no deducida.

Y lo caro no era el botón repetido: **la lista y el detalle decían cosas distintas del mismo
Trabajo**, que es el defecto exacto que SCRUM-366 se escribió para cerrar. Su guard pasaba en verde
porque comprueba que las dos pantallas **llamen** a la escalera; nunca que la llamen **con los
mismos datos**.

> 🔒 **Una sola fuente alimentada con dos datos distintos no es una sola fuente.**

### La decisión del fundador: (A), y (B) a ticket propio

**(A) — el dato viaja.** `loadJobRefs` gana `albaranesPorJob`: **una** consulta para las 200 filas,
el mismo patrón que `asignadosPorJob` (el N+1 que quitó SCRUM-58, y cuyo test compara el conteo con
3 y con 12 Trabajos). Las **facturas no cuestan ni una consulta**: `todosLosQuotes` ya las trae
dentro (`QUOTE_SELECT.Invoice`), y lo único que faltaba era `createdAt` —un campo en un `select`
que ya viajaba— porque el nivel 2 de la escalera pregunta por facturas sin pagar de hace ≥7 días.

**(B) — que la escalera mire también el estado** se va a **SCRUM-823**: eso mueve el héroe del
detalle del Trabajo, que es el ticket B. Depende de que (A) entre primero: cambiar la escalera
mientras una pantalla la alimenta con menos datos que la otra sería construir sobre una mentira.

Los albaranes de la lista llevan **los dos campos que la escalera lee** (`id`, `estado`); el detalle
sigue mandando el documento entero. **Se llaman igual a propósito**: si se llamaran distinto, la
lista tendría que traducirlos antes de preguntar, y esa traducción sería el segundo sitio por donde
las dos pantallas vuelven a separarse.

---

## Lo demás del ticket

### ② La cabecera decía «Trabajos» tres veces → se BORRA el subtítulo

Migaja + título + la frase, ~90 px para no decir nada nuevo.
🔒 *La explicación de una pantalla se lee una vez y estorba mil.*

**No se muda al estado vacío**, y ésa fue la corrección: el estado vacío **ya tiene su texto
aprobado** (SCRUM-651, fundador 2-sep-2026) diciendo lo mismo. Mudarlo allí habría puesto dos textos
aprobados en la misma caja. Se borra el de arriba y ya está. Firmado por el fundador el 7-sep-2026.

### ④ + ⑦ Dos insignias apiladas, y una columna vacía el 92% del tiempo → UNA columna

`SIN AGENDAR` + `PARCIAL` se apilaban en la misma celda: **una habla de agenda y la otra de cobro**,
y apiladas no se leía ninguna. Y FECHA decía «—» en 11 de 12 filas.

ESTADO y FECHA **contestaban lo mismo** —«¿cuándo se hace esto?»— así que se funden: con fecha se
pinta la fecha, sin ella «Sin agendar» (el mismo literal que llevaba la insignia). La columna
ESTADO se retira; **no se estrena ningún rótulo**.

**Lo que la fusión podía perder y no pierde:** «En curso», «Terminado» y «Cerrado» no responden a
«cuándo» — pero **cada fila vive bajo una cabecera de grupo que ya los nombra** (🔨 En curso · ✅
Terminados · 🔒 Cerrados), microcopy aprobada de SCRUM-428. La fusión no borra el estado: lo deja
donde ya estaba dicho en vez de repetirlo veinte veces.

**CONTROL del cobro:** no se pierde. Ya estaba dicho dos columnas antes y mejor —«597,14 € de
1.194,27 €» en IMPORTE—; la insignia lo repetía con una palabra en vez de con las dos cifras. Hay
test que cae si esa línea desaparece.

### ⑤ 🔒 El desplegable de técnicos en la fila, sin levantar el candado

> 🔒 Una acción que modifica datos y se dispara con el mismo gesto con el que se navega es una
> acción que se va a disparar sin querer. Y el jefe no se entera hasta que el técnico se presenta
> en una obra que no era la suya.

`<details>/<summary>` nativos con las casillas del modal de SCRUM-727b. Se guarda al marcar, se
dice quién queda, **y si el guardado falla la casilla y el resumen vuelven atrás**. La lista se
refresca **al cerrar**, no en cada casilla: un Trabajo puede llevar tres técnicos y repintar entre
marca y marca cerraría el control en la cara del jefe.

#### 🔴 La guarda de la fila estaba atada a la FORMA, no al hecho

Decía `closest('button, a, input, textarea, select, label')`: **una lista de etiquetas**. Un
`<summary>` no está en ella, ni el `<div>` que envuelve las casillas — así que pulsar el hueco entre
dos nombres **habría navegado al Trabajo en mitad de una asignación**. Ahora pregunta por el hecho
—`[data-fila-no-navega]`, que el control se pone a sí mismo— y la lista de etiquetas se queda para
lo que ya cubría.

> 🔒 **Un prefijo no es un nombre, y una lista de etiquetas se satisface dejando de enumerar.**

#### 🔴 Y el guard cazó un defecto MÍO al primer intento

La reversión no revertía. `change` salta **después** de que el navegador haya cambiado la casilla,
así que `casillas.map((c) => c.checked)` devolvía el estado **nuevo**: el guard dijo «No se pudo
guardar» y se quedó con el técnico marcado — la mitad peligrosa del defecto que el control viene a
evitar. El estado anterior se **reconstruye** (la única que cambió es la del evento), no se lee.

### ⑥ El filtro: se descartó copiar `nuevaFacturaModal`, y el fundador lo aceptó

Dos premisas del ticket no se sostenían:

1. **SCRUM-713 no existe.** Está en «Tareas por hacer» y **no hay ninguna rama `scrum-713-*` en el
   remoto** (listado completo). No había «cómo queda ése» que mirar.
2. **El patrón de `nuevaFacturaModal` es búsqueda EN SERVIDOR** (`GET /admin/customers?search=`,
   espera de 250 ms) porque los clientes son miles. **Los técnicos no**: `/admin/team` ya trae el
   equipo entero en una petición que esta pantalla ya hacía.

Así que el filtro busca **en cliente**, sobre lo ya cargado. Cero peticiones nuevas — y la trampa
que el propio ticket avisaba (*la respuesta lenta de una consulta anterior pisa la última*) **no se
esquiva: no puede existir**, porque no hay segunda consulta.

Dos cosas que se midieron y decidieron aquí:
- **No llama a `paint()`.** La barra se repinta entera en cada `paint`, así que teclear una letra
  habría destruido el propio `<input>` y con él el foco: la segunda letra no se podría escribir.
  Escribir sólo re-pinta las opciones del selector.
- **El técnico seleccionado nunca se cae de la lista.** Si el filtro activo es Miguel y se teclea
  «nad», quitar su opción cambiaría el `value` del selector **sin que nadie haya elegido nada**.
- Compara **sin tildes**: «sanchis» tiene que encontrar a «Toni Sanchís», que es donde se usa.

---

## ⛔ Microcopy: CERO texto nuevo en todo el ticket

| literal | de dónde sale |
| --- | --- |
| «Sin asignar» | firmado 4-sep-2026 (SCRUM-727), ya en la celda y en el filtro |
| «✓ Técnicos: …» / «✓ Sin asignar» | ya los usaba el modal del «⋯» desde SCRUM-727b |
| «Fecha» | rótulo que las cuatro listas hermanas ya usan |
| «Sin agendar» en la celda | el mismo `JOB_STATE_META` que llevaba la insignia |

**«Agendar» / «Reagendar»** ya están en pantalla con ese literal exacto en el «⋯»; subirlos a la
acción principal es la misma palabra cambiando de sitio (aprobado por el fundador el 7-sep-2026) y
llega con **SCRUM-823**, que es donde la acción pasa a depender del estado.

**«Valorar» queda FUERA** hasta que el dato viaje: firmar un rótulo que no tiene con qué encenderse
es peor que no tenerlo.

---

## Verificación

`npm run guard:lista-trabajos` (Edge, `page.setViewport` real):

```
① 🔒 el clic en el DESPLEGABLE asigna y NO navega          ✅ ✅ ✅ ✅ ✅
② 🔒 el clic en la FILA navega y NO asigna a nadie         ✅ ✅ ✅
③ guardado FALLIDO → lo dice y REVIERTE lo que se ve       ✅ ✅ ✅
④ varios técnicos · con cero «Sin asignar» · sin equipo, sin adorno  ✅ ✅ ✅
⑤ 390 / 1280 / 1700 px, con 20 y con 1 · scroll horizontal: no en los seis
   1700 px · tabla 1402 px (82% de la ventana)
⑥ Clientes · Presupuestos · Albaranes · Facturas — IDÉNTICAS por hash contra origin/main
   control positivo · Trabajos SÍ cambia · 9532e51203fa6ab4 → f0fbb14c2dbff312
```

**Probado en rojo:** quitando `closest('[data-fila-no-navega]')` caen las dos afirmaciones de ①
(«ABRIR EL DESPLEGABLE NAVEGÓ», «MARCAR UNA CASILLA NAVEGÓ»), exit 1. Restaurado y verde.

**Suelos del guard**, para que un silencio no se lea como un verde:
- Exige ≥10 filas, un desplegable por fila y 4 casillas por desplegable; si no, «NO SUPE MIRAR».
- El hash de las hermanas exige que la pantalla de `origin/main` **haya pintado filas**: dos
  pantallas de error también salen idénticas. (Salió: `/admin/albaranes` devuelve
  `{filas, ejes, contadores}` y servirle `[]` pintaba un error de 555 caracteres — se le dio su
  fixture real.)
- **Control positivo del comparador:** Trabajos tiene que salir DISTINTA. Si saliera igual, los
  cuatro verdes de arriba no significarían nada.

Capturas en `docs/capturas/scrum-816/{antes,despues}/`, a 390 y 1280 px, con 20 Trabajos y con 1.
El **antes se materializa desde `origin/main` en cada pasada** —árbol **y** dato, con
`conDocumentos: false`, porque servirle al código viejo un lote que sí trae albaranes fotografiaría
una pantalla que nunca existió—, así que el par es reproducible hoy y dentro de un mes en vez de
depender de que alguien se acordara de sacar el «antes» antes.

---

## Hallazgo reportado, NO arreglado aquí (regla 37)

**El guard de SCRUM-366 no puede ver este defecto.** Comprueba que las dos superficies llamen a la
escalera; no compara lo que cada una le pasa. **Sí se puede atar**: derivando del propio
`jobNextAction.js`, por AST, qué propiedades de `job` lee, y exigiendo que **los dos** serializadores
las devuelvan todas — la pertenencia sale del código que decide, no de una lista que hay que
recordar actualizar. Queda propuesto; no se construye en este ticket porque es del carril del 366.

## Lo que NO se ha tocado

- `jobNextAction.js` — componente compartido con el detalle del Trabajo (ticket B). Intacto.
- Ningún rótulo nuevo · ningún `style=` en línea · ningún botón compartido (`btn-sm` sigue en 30 px).
- `prisma/schema.prisma` · el camino de emisión (regla 38).
- El detalle del Trabajo · los estados de los PRESUPUESTOS (SCRUM-820, sesión 2): **no comparten
  componente**. Presupuestos pinta con `.status-pill*`; Trabajos pinta la FSM con `.jobs-estado-*`,
  suyas desde SCRUM-727b. Lo único común era `.status-pill`, que Trabajos usaba **sólo** para el
  chip de cobro — el que este ticket quita. **Reduce el acoplamiento, no lo aumenta.**
