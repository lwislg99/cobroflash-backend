# SCRUM-768 · Retirar el residuo de navegación y DESCLAVAR el guard de SCRUM-599

**Fecha:** 6-sep-2026 · **Carril:** navegación del panel (producto) · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `74aba16eb8786a7f9fa8a45325c8c0718274594a` · 2026-09-06T07:17:25+01:00
**Tanda:** 5545 tests, 5457 pass, 0 fail, 88 skipped (salida 0) — con `main` ya mezclado dentro

> Nace de la medición de SCRUM-599, que llegó **ya mergeada** (#981 el 3-sep, #1010 el 4-sep) con
> el tablero diciendo «Tareas por hacer». El ticket estaba entregado; lo que quedaba es esto.

---

## El defecto — y no es el residuo, es el guard

`tests/scrum599-navegacion-documentos-y-atajo.test.mjs` tenía esta línea:

```js
assert.match(INDEX, /nav-item nav-item-parent" type="button" data-view="quotes-list"/,
  '🔴 la entrada de Presupuestos no lleva a la lista. Sin `data-view` no navega a ningún sitio.');
```

El mensaje habla de `data-view` —que es lo que importa— pero **la regex ataba además
`nav-item-parent`**, que es el residuo del submenú que el propio test dice haber retirado. El
veredicto era correcto y **el diagnóstico mentía**: quien se encontrara ese rojo habría vuelto a
poner la clase creyendo que arreglaba la navegación. Por eso el residuo llevaba tres días vivo.

## 🔴 El rojo cambia de lado — provocado en los DOS sentidos

| árbol | mutación | resultado |
|---|---|---|
| **antes** (`main`) | **QUITAR** `nav-item-parent` | **1 fail / 14** · «la entrada de Presupuestos no lleva a la lista. Sin `data-view` no navega a ningún sitio.» |
| **después** | **PONER** `nav-item-parent` | **1 fail / 15** · «ha vuelto «nav-item-parent» al marcado de la barra… no lo vuelvas a poner para acallar un rojo — el rojo que buscas es el de arriba, el del `data-view`.» |

Las dos mutaciones restauradas con `Buffer.compare = 0` contra los bytes de disco.

El arreglo no es tocar la regex: es **partirla en dos afirmaciones con dos mensajes** — una por el
destino (`data-view="quotes-list"`) y otra por la clase (que no puede volver). Ninguna puede
esconderse detrás de la otra.

## El residuo NO era cosmético — medido en navegador real

`.nav-item-parent` era `justify-content: space-between`, y existía **sólo para hacerle sitio al
chevron**. Sin chevron, empuja el rótulo al borde derecho. Medido en Edge sobre el `<aside
class="sidebar">` real de `index.html` con las hojas reales, a **929 px** y a **390 px**:

| entrada | ANTES · x del rótulo | DESPUÉS · x del rótulo |
|---|---|---|
| Presupuestos | **146,7** | **46,0** |
| Albaranes | 46,0 | 46,0 |
| Facturas | 46,0 | 46,0 |
| Clientes | 46,0 | 46,0 |
| **dispersión** | **100,7 px** | **0,0 px** |

A 390 px la barra está fuera de pantalla (off-canvas) y la geometría interna es la misma: antes
`[-101,3 · -202 · -202 · -202]`, después `[-202 · -202 · -202 · -202]`. El hueco entre el icono y
el texto pasa de **110,7 px** a los **10 px** que tienen sus tres hermanas.

**Lo que se va:** la clase y el `<div class="nav-group">` del HTML · **NUEVE** reglas CSS · los dos
bloques de `app.js` que recorrían `.nav-group`/`.nav-subitem` sin encontrar nada
(`setActiveMenu` y el «Submenú toggle», que colgaba un SEGUNDO manejador de click al botón).

> ⚠️ **El asesor dijo SEIS reglas; son NUEVE.** Censadas sobre el CSSOM, no sobre el texto:
> `.nav-group`, `.nav-item-parent`, `.nav-chevron`, `.nav-group.open .nav-chevron`,
> `.nav-subitems`, `.nav-group.open .nav-subitems`, `.nav-subitem`, `.nav-subitem:hover`,
> `.nav-subitem.active`.

### 🔴 Y el censo de reglas dio CERO cuando estaba CIEGO

El primer recorrido del CSSOM devolvió `[]` reglas del submenú **sobre el árbol que todavía las
tenía**. No era limpieza: **en Chromium toda `CSSStyleRule` tiene `.cssRules`** (CSS anidado), así
que un `if (r.cssRules) { recorrer(...); continue; }` no visitaba **ni una sola regla de estilo**.

Lo cazó el control positivo, que buscaba `.nav-item` —una regla que existe seguro— y devolvía
**0**. Con el recorrido corregido, el mismo instrumento sobre `main` enumera las nueve. El censo se
hace sobre el CSSOM y no sobre el texto del fichero **a propósito**: ahí los comentarios no son
reglas, así que el comentario que explica la retirada no puede contarse a sí mismo (SCRUM-203).

## Los dos guards que contaban mal

Regla 3 — el instrumento no medía lo que su nombre decía medir:

| test | decía | recorría | ahora |
|---|---|---|---|
| «LAS CUATRO LISTAS registran su destino» | cuatro | **tres** | cuatro |
| «la tecla se pinta EN el botón, en las tres listas» | tres | tres | **CUATRO** |

La que faltaba en los dos era **Albaranes**, que registra y pinta su tecla desde SCRUM-606
(ALB-01) — o sea, **la única de las cuatro añadida después era justo la que no tenía vigilante**.
La cabecera del fichero seguía diciendo «ALBARANES SE QUEDA FUERA, Y NO ES UN OLVIDO», que fue
verdad el 3-sep y dejó de serlo el 5. Se corrige contando la historia, no borrándola.

Las dos ampliaciones, provocadas sobre `albaranesView.js`: sin `registrar` cae la primera
(«al montar renderAlbaranesView la vista «albaranes» NO ha registrado destino»), sin `etiquetar`
cae la segunda («en renderAlbaranesView hay 0 teclas pintadas y debía haber UNA»).

## Facturas llama a la pieza en vez de copiarla

`invoicesView.js` reimplementaba `etiquetar` en línea —cinco líneas del `<kbd>`, misma clase, mismo
`aria-label`— así que **era la única de las cuatro listas que no compartía el mecanismo** que
SCRUM-599 presume de tener único. Pasa a `etiquetar(nuevaFacturaBtn, null)`.

`null` y no `'invoices'`, y es la parte que importa: `etiquetar` sólo reescribe el texto si su
`textoDe` devuelve algo, y con `null` no devuelve nada — así se conserva el rótulo que se acaba de
poner, **incluido el de JUSTIFICANTE, que la regla 26 blinda**.

**Medido, no supuesto.** Montando la vista de verdad en el banco, en los DOS modos, y comparando el
literal en claro **y en hexadecimal**:

| modo | literal | hex |
|---|---|---|
| `factura` | `Nueva factura` | `4e756576612066616374757261` |
| `justificante` | `+ Nuevo justificante` | `2b204e7565766f206a75737469666963616e7465` |

Idénticos antes y después, junto con la clase y el `aria-label` del `<kbd>` y el registro del
atajo. **Control positivo del instrumento:** pasando `'invoices'` en vez de `null`, el literal del
justificante SÍ cambia a «Nueva factura» y el diff lo enseña — o sea que sabe ver un cambio. Y de
paso demuestra que `null` no era una elección de estilo: `'invoices'` habría roto la regla 26.

## El censo — `tests/scrum768-listas-sin-atajo.test.mjs`

El atajo «N» **no se hereda**: cada vista llama a `atajoNuevo.registrar(vista, accion)` al
montarse. Es una decisión y no un descuido —un atajo que buscara «el botón primario de la
cabecera» podría pulsar «Guardar» o «Cargar catálogo»—, pero **lo que no se hereda se olvida**.

El censo deriva del **DOM ejecutado** de cada vista del banco (población: `render*View`, sin lista
a mano) y enumera las que tienen botón primario de crear y **no** registran destino:

```
renderExpensesView · renderJobDetailView · renderJobsView · renderProductsView · renderProvidersView
```

> ⚠️ **SON CINCO, NO CUATRO.** El asesor listó `jobs`, `expenses`, `products` y `providers`. Falta
> **`renderJobDetailView`** («+ Nuevo albarán»), que además es el ÚNICO camino real de creación de
> un albarán. No es una lista, y se declara DENTRO con su nota en vez de excluirlo: sacarlo
> exigiría justo la lista escrita a mano que este censo existe para evitar.

**Enumera, no cuenta** (lección de SCRUM-411): un `deepEqual` con nombres, para que una recién
llegada se lea de un vistazo. Una vista que no monta va a `ciegas` y **falla declarándose ciega**,
nunca se salta. Y lleva su suelo doble: la población de botones de crear no puede encogerse
(`>= 8`) y la lista no puede vaciarse sola.

**Controles, dentro del propio test y sin tocar el árbol:** se inyecta en el banco una
`renderCachivachesView` con un `.btn-primary` «Nuevo cachivache» — sin registrar, el censo la ve;
registrando, deja de verla.

**Control positivo externo, el que pedía el encargo:** quitado el atajo de **Clientes**, el censo
pasa de cinco a seis, se pone rojo y **nombra** `renderCustomersView` (2 fails de 6). Restaurado
con `Buffer.compare = 0`.

## Lo que NO se ha tocado — y por qué

* ⛔ **Ni un literal visible.** Medido byte a byte en el único sitio donde podía cambiar.
* ⛔ **`SIN_APROBAR = 1` y el rótulo `[PENDIENTE microcopy oficial] Nuevo albarán`** siguen como
  estaban: son de SCRUM-606 y esperan firma del fundador (regla 30).
* ⛔ **No se registra el atajo en las cinco.** Cuatro de sus rótulos («Trabajo nuevo», «+ Nuevo
  gasto», «Crear producto», «Crear proveedor») no siguen el patrón «Nuevo X» de los tres firmados
  el 4-sep: unificarlos es **copy nuevo** y va en su propio ticket. El censo es lo que protege
  mientras tanto.
* ⛔ `prisma/schema.prisma`, el camino de emisión y la numeración: intactos.

## Verificado en rojo — cuatro mutaciones declaradas

`MUTACIONES_QUE_ME_TUMBAN` (contrato de SCRUM-745), tres en el guard de 599 y una en el censo:

| mutación | cae |
|---|---|
| vuelve `nav-item-parent` al HTML | `Presupuestos ya NO tiene submenú, y su entrada abre la LISTA` |
| Albaranes deja de `registrar` | `LAS CUATRO LISTAS registran su destino, y Clientes es una de ellas` |
| Albaranes deja de `etiquetar` | `la tecla se pinta EN el botón, en las CUATRO listas` |
| Clientes deja de `registrar` | `la lista de vistas con botón de crear y SIN atajo no CRECE` |

`npm run meta:mutaciones` corrido **tres veces**: `vivas 26 · mudas 0 · ciegas 0` las tres, salida
0. Las cuatro mías vivas en las tres pasadas. Apuntan a `public/`, que no tiene paso de
compilación: se muta exactamente lo que el guard lee.

## Un guard de la casa me cazó, y tenía razón

La **primera tanda completa salió en ROJO**: 1 fail, `SCRUM-553 · el número de etiquetas con el
`>` pegado NO SUBE` — **21, y el tope es 20**. El extractor nuevo era mío:

```
tests/scrum599-navegacion-documentos-y-atajo.test.mjs:83   <nav class="sidebar-nav">
```

El suelo del filtro de comentarios buscaba ese literal **pegado**, así que un `id` nuevo en esa
etiqueta lo habría roto por un motivo que no tiene nada que ver con lo que mide. Corregido a
`/<nav[^>]*class="sidebar-nav"[^>]*>/`, que es exactamente lo que el mensaje del guard enseña a
hacer. Segunda tanda: **0 fallos**.

## Huecos declarados

1. **La tecla no se ha pulsado en un navegador real.** Igual que en SCRUM-599: las prohibiciones se
   prueban sobre la condición pura y el registro sobre el DOM del banco, pero el recorrido de punta
   a punta (pulsar «N» en Edge y ver abrirse la creación) sigue sin ejercitarse.
2. **El criterio de «botón de crear» es TEXTUAL** (`nuevo|nueva|crear`). No hay atributo ni clase
   que marque una acción de creación en este panel, así que un botón renombrado a algo sin esas
   palabras se le escapa al censo. Lo tapa el suelo (`>= 8`) y la comprobación por nombre de las
   cuatro registradas, no lo cierra.
3. **La medición de la barra se hace sobre el `<aside>` recortado de `index.html`**, no sobre el
   panel entero con sesión. Es lo que permite medir sin credenciales; lo que no cubre es un estilo
   que llegara de un `<script>` en tiempo de ejecución.
4. **No se ha comprobado con lector de pantalla real** que la barra siga leyéndose igual sin el
   envoltorio `.nav-group`. Era un `div` sin rol ni `aria`, así que no debería cambiar nada, pero
   «no debería» no es una medición.
5. **`renderJobDetailView` queda en el censo** aunque no sea una lista. Es un hueco de forma, no de
   fondo: el criterio derivable es «vista con botón primario de crear», y «lista» no lo es.

## Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/index.html` | fuera `.nav-group` y `.nav-item-parent`; el comentario cuenta la medición |
| `public/dashboard/css/styles.css` | fuera las nueve reglas del submenú; re-anclada la cita de `.nav-subitem.active` |
| `public/dashboard/js/app.js` | fuera los dos bloques que recorrían el submenú |
| `public/dashboard/js/invoicesView.js` | la tecla la pinta la pieza (`etiquetar(btn, null)`) |
| `tests/scrum599-navegacion-documentos-y-atajo.test.mjs` | desclavado, los dos guards a CUATRO, tres mutaciones declaradas |
| `tests/scrum768-listas-sin-atajo.test.mjs` | **nuevo** · el censo (6 tests) y su mutación |
| `docs/master/SCRUM-768.md` | **nuevo** · esta entrada |
