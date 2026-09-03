# SCRUM-599 · DOC-09 · Una sola forma de llegar a crear, y el atajo «N»

**Fecha:** 3-sep-2026 · **Carril:** navegación de documentos (producto) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `336e026e6a14274676881ff1e247eab66ef06d2a` · 2026-09-03T13:19:17+01:00

**Tanda:** **4.992 pruebas · 4.908 en verde · 0 fallos · 84 saltadas** — con `main` ya mergeado
dentro y medida DESPUÉS del último cambio de código.

> **ABSORBE SCRUM-585 (CONT-12 · atajo «N» en Clientes)**, aprobado por el fundador el
> 3-sep-2026. El propio DOC-09 lo pedía: «MISMO MECANISMO, NO DOS». Cuatro listas, un mecanismo,
> y un test que comprueba que no hay un segundo.

---

## La víctima

El mismo profesional, en la misma sesión, se encontraba **tres formas distintas** de llegar a
crear según el tipo: Presupuestos desplegaba un submenú («Historial» / «Crear nuevo»), Albaranes y
Facturas iban directos a la lista, y **no había ningún atajo de teclado en ninguna parte**.

## PASO 0

**ENTRADA.** El menú: `public/dashboard/index.html` — Presupuestos era el único `nav-group` con
`nav-subitems`; Albaranes (`data-view="albaranes"`), Facturas (`invoices`) y Clientes
(`customers`) ya eran entradas directas. Las cuatro listas las pintan `renderQuotesListView`,
`renderAlbaranesView`, `renderInvoicesView` y `renderCustomersView`, despachadas desde el `switch`
de `app.js`.

**MECANISMO — 🔴 EL ATAJO YA EXISTÍA, y eso cambió el diseño entero.** En `app.js` había un
`keydown` global que **ya escuchaba la «n»** y **ya se protegía de las cuatro situaciones
peligrosas** (modificadores, campos de texto, editables y modales). Lo que hacía era abrir
**siempre** la cotización rápida, estuvieras donde estuvieras.

Así que aquí **no nace un segundo manejador**: la condición se extrae a
`atajoNuevo.sePuedeDisparar` —**pura**, y por eso se puede ejercitar sin navegador— y el destino
pasa a decidirlo la vista en la que estás. Eso es darle superficie al motor, no rehacerlo.

---

## 🔴 EL CENSO DE CAMINOS CAZÓ UN DEFECTO QUE IBA A INTRODUCIR YO

El protocolo lleva escrita esta línea porque ya pasó: *«se retiró una entrada de menú dejando la
vista sin ningún camino»*. Se censó antes de tocar, y apareció esto en `quotesListView.js`:

```js
createBtn.addEventListener("click", () => {
  const menuBtn = document.querySelector('.nav-item[data-view="quotes-new"]');
  if (menuBtn) menuBtn.click();
});
```

**El botón primario de la lista no navegaba: PULSABA EL SUBÍTEM DEL MENÚ** que este ticket
retira. Al quitarlo, `menuBtn` es `null`, el `if` se lo traga, y el botón se queda **inerte** — la
creación de presupuesto **sin ningún camino desde su propia lista**, en silencio y sin un solo
error en consola. Ahora navega al destino, como ya hacían las otras cinco puertas
(`customerDetailView`, `invoicesView`, `quoteRequestsView`, `templatesView`, `quotesDetailView`).

### El censo, antes y después — sobre el DOM EJECUTADO

| lista | antes | después |
|---|---|---|
| presupuestos | «+ Crear presupuesto» (que pulsaba el menú) | **«Nuevo presupuesto» + `N`**, navegando al destino |
| facturas | «+ Nueva factura» | **«Nueva factura» + `N`** |
| clientes | «+ Nuevo cliente» | **«Nuevo cliente» + `N`** |
| albaranes | **ninguno** (9 nodos, 0 botones) | **ninguno** — y es a propósito, ver abajo |

Y el censo del destino `quotes-new` **no se ata al copy**: cuenta `renderAppView('quotes-new')`
sobre el panel entero, sin lista a mano y descartando comentarios. **Si devuelve menos de cuatro,
falla** — un cero sería la pantalla sin ninguna puerta.

---

## ⚠️ ALBARANES SE QUEDA FUERA, Y NO ES UN OLVIDO

El único endpoint de creación es **`POST /admin/jobs/{jobId}/albaranes`**: **exige un Trabajo**.
No existe crear un albarán suelto — el documento nace dentro de un Trabajo y su modal copia las
líneas del presupuesto de ese Trabajo.

Un botón «Nuevo albarán» en la lista global **sería una promesa rota**, que es exactamente lo que
el propio menú tiene prohibido por escrito: *«una entrada que apunta a nada es una promesa rota
cada vez que se pulsa»*. Darle destino significaría **elegir Trabajo primero** (diseño nuevo, sin
aprobar) o **un endpoint que no existe** (backend, fuera de carril). **Se reporta, no se inventa.**

---

## El atajo: lo que no puede pasar, con un test cada uno

| se prueba | qué pasaría si no |
|---|---|
| foco en `input` / `textarea` / `select` / editable | un fontanero escribiendo «Nueva caldera» acabaría en una pantalla de creación |
| con un modal abierto | otra creación **encima** de un formulario a medio llenar |
| `Ctrl+N`, `Cmd+N`, `Alt+N` | se le secuestra al navegador la ventana nueva |
| **sin poder mirar si hay modal** | «no supe comprobar» se leería como «no hay modal» |

> El cuarto salió de la prueba de rojo: la primera versión caía al `document` global cuando no le
> pasaban uno, así que «no puedo mirar» acababa siendo «adelante». Ahora quien llama pasa el suyo
> —`app.js` lo hace— y sin él **no se dispara**: ante la duda, no abrir es recuperable.

Y un **control positivo**, porque con tanta prohibición el atajo podría estar muerto y todo lo
anterior seguiría verde: la «n» y la «N» a secas **sí** disparan, y otra tecla no.

---

## Microcopy — aprobada por el asesor, a la espera del fundador

> `Nuevo presupuesto` · `Nueva factura` · `Nuevo cliente`

Van **en la pieza y en un solo sitio**: si cada vista escribiera el suyo, cambiar el copy sería
tocar tres ficheros y el tercero se quedaría atrás. `SIN_APROBAR = 3`, declarado. **Sin
marcadores** — esto se ve en pantalla.

La tecla va en un `<kbd>` **aparte**, no dentro del texto: así el rótulo sigue siendo una cadena
comparable —la que se aprueba— y el adorno no se cuela en el copy.

**`+ Nuevo justificante` se conserva tal cual**: no está en la microcopy de este ticket y la regla
26 lo blinda. Se le pinta la tecla igual, porque un botón con atajo y otro sin él en la misma
pantalla enseñaría que a veces no va.

### La caja, MEDIDA en navegador real

| botón | caja | tecla | ¿desborda? |
|---|---|---|---|
| `Nuevo presupuesto  N` | 240 × 36 | 23 × 20 | **no** |
| `Nueva factura  N` | 192 × 36 | 23 × 20 | **no** |
| `Nuevo cliente  N` | 139 × 30 | 23 × 20 | **no** |

**Cabe en los tres**, así que no hace falta acortar nada ni poner marcador. A **360 px** la tecla
**se oculta** (no hay teclado y es donde menos sitio hay) y no aparece scroll horizontal
(360 = 360).

---

## El rojo, probado por el mecanismo — seis mutaciones con post-condición

| se rompe a propósito | cae |
|---|---|
| el registro del atajo **en Clientes** | «LAS CUATRO LISTAS registran su destino», **nombrando `customers`** |
| el registro **en Facturas** | el mismo, **nombrando `invoices`** |
| vuelve el camino por el botón del menú | el censo de caminos **y** «no depende de un botón del menú» |
| vuelve el submenú al HTML | «Presupuestos ya NO tiene submenú» |
| nace un **segundo** manejador de la «n» | «UN SOLO MECANISMO» |
| se cambia un rótulo aprobado | «el microcopy es el APROBADO» |

Y un **control negativo**: renombrar el rótulo **no** tumba el censo de caminos, porque el censo
mide **destinos**, no textos. Si midiera textos estaría vigilando el copy en vez de la navegación.

> Mi post-condición tuvo un defecto propio: exigía que el ancla **desapareciera**, y en las dos
> mutaciones que **añaden** (submenú y segundo manejador) eso daba un falso «no cambió» aunque el
> test sí caía. Corregida a «cambió ese fichero y contiene lo nuevo».

## Dos cosas que sólo dijo la tanda entera

Añadir un `<script>` al índice tiene dos consecuencias que no se ven en el carril:

1. **El SHELL del service worker.** `atajoNuevo.js` no estaba en `public/sw.js`, así que **la
   primera visita sin cobertura se habría quedado sin el atajo y sin los rótulos** — y con red no
   se nota nada, que es por lo que ese guard existe. Añadido al `SHELL`.
2. **SCRUM-622 ancla su excepción por NÚMERO DE LÍNEA.** Las 12 líneas que este ticket añade en
   `invoicesView.js` desplazaron la red benigna de la 520 a la 532 y su censo cayó. **No se ha
   relajado**: la excepción sigue siendo una y sigue esperando decisión; lo que se ha hecho es
   re-anclar un dato que se movió. Va como hallazgo, porque volverá a pasarle al siguiente.

## Ficheros

`public/dashboard/js/atajoNuevo.js` (**nuevo**: el registro, la condición pura y el copy) ·
`public/dashboard/index.html` (fuera el submenú y el chevron; carga del script) ·
`public/dashboard/js/app.js` (superficie al manejador que ya existía) ·
`public/dashboard/js/quotesListView.js` · `invoicesView.js` · `customersView.js` (rótulo, tecla y
registro) · `public/dashboard/css/styles.css` (`.btn-atajo`) ·
`public/sw.js` (el SHELL precachea el script nuevo) ·
`tests/_banco-vistas.mjs` (declara el script nuevo) ·
`tests/scrum622-…` (re-anclado: su excepción se identifica por número de línea) ·
`tests/scrum599-navegacion-documentos-y-atajo.test.mjs` (**nuevo**, 14 tests) · esta entrada.

**No se ha tocado:** `prisma/schema.prisma` —**este ticket no lleva columnas nuevas**— · el camino
de emisión · la numeración · el catálogo · el selector de cliente del documento (SCRUM-591, lo
está haciendo otra sesión) · `scripts/_suelo-de-la-tanda.mjs` · sin dependencias (regla 36).

## Estado del árbol

* Rama nacida de `origin/main`, con `main` mergeado dentro —no rebase, nunca `--force`—.
* Cliente de Prisma regenerado desde ESTE worktree antes de la tanda.
* `npm run guards:entrada` en verde. Cero CR en disco (medido por BYTES) — `quotesListView.js`
  venía sucio con 334 CR y se rematerializó en LF, que es lo que `.gitattributes` promete.

## Los huecos que declaro

1. **No he pulsado la tecla en un navegador real.** Las cuatro prohibiciones se prueban sobre la
   condición pura, que es donde vive la decisión, pero el recorrido completo —pulsar «N» en la
   lista y ver abrirse la creación— no está ejercitado de punta a punta.
2. **El registro es por vista y se rellena al montarla.** Si una vista se monta y luego se navega
   a otra que no registra, el atajo cae al comportamiento de siempre (cotización rápida). Es
   deliberado —quitarlo sería retirarle el atajo a quien ya lo usa— pero **no he medido** qué
   pasa al volver atrás sin remontar.
3. **No he medido con lector de pantalla.** El `<kbd>` lleva `aria-label`, pero no lo he
   verificado con uno de verdad.
4. **La medición de la caja es con los textos de hoy.** Un rótulo más largo en otro idioma no
   está contemplado: `appLocale` cambia `quoteNew`, y este ticket fija el castellano.
5. **No he comprobado que el submenú retirado no deje CSS huérfano**: `.nav-subitems` y
   `.nav-chevron` pueden seguir en la hoja sin usarse.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* El botón «Nuevo cliente» usa `btn-primary btn-sm` y a 360 px queda en **30 px de alto**, por debajo del objetivo táctil de 44 px de AB6 — **ya era así antes de este ticket**, y el guard `objetivo-tactil` no lo caza porque corre fuera de la tanda.
* No existe forma de crear un albarán fuera de un Trabajo (`POST /admin/jobs/{jobId}/albaranes` es el único endpoint), así que la lista global de albaranes es la única de las cuatro sin acción primaria.
* El censo de SCRUM-622 identifica su única excepción por NÚMERO DE LÍNEA (`invoicesView.js:520`), así que cualquier edición por encima la desplaza y tumba el guard sin que haya cambiado nada de lo que vigila.
* `tutorial.js` declara un paso para la vista `quotes-new` que hasta hoy se alcanzaba desde el submenú; sigue alcanzable por hash y por los cinco botones, pero nadie ha comprobado que el tutorial siga encontrando su ancla.

---

## Los dos rojos del CI, y cómo se arreglaron

La tanda local salía verde y el CI encontró dos cosas más. Las dos eran **guards haciendo su
trabajo sobre cambios deliberados de este ticket**, no regresiones.

### ROJO 1 · el control positivo de SCRUM-698: «Clientes monta 63 nodos y antes montaba 62»

**Primero se demostró QUÉ es el nodo 63**, porque un número que sube no dice qué subió.
Identificado **por identidad** —no por posición ni por texto—: es el **único `<kbd>` de la vista**,
con la tecla «N», dentro del botón que registra el destino del atajo
(`atajoNuevo.accionDe('customers')` devuelve función y el botón está montado).

> ⚠️ **Y la medición corrigió la suposición de partida:** el botón **no es nuevo**. Ya estaba en
> `main` como «+ Nuevo cliente» —así lo recogía el censo ANTES de esta entrada—. Lo que entra es
> la TECLA que se pinta dentro. Por eso sube **uno** y no dos.

Sólo entonces se actualizó **62 → 63**, con el motivo escrito **dentro del propio test**. **El
mecanismo del guard no se toca**: sigue siendo una igualdad exacta, sin rango, sin tolerancia y
dentro de la tanda. Lo que sube es la línea base; la exigencia, no.

### ROJO 2 · `guard:contraste`: `nav-section-label` a 3,67 sobre el verde oscuro

`--neutral-500` (`#6b756f`) sobre el fondo del sidebar (`#0f1c17`) da **3,67**, y AA pide **4,5**.

**El token NO se toca**, y por eso: **lo usan 16 sitios**. Subirlo ahí habría movido dieciséis
pares para arreglar uno — arreglar uno y romper tres es peor que el rojo de ahora. El color pasa a
vivir **en `.nav-section-label` y sólo ahí**.

| | color | ratio sobre `#0f1c17` |
|---|---|---|
| antes | `#6b756f` (token) | **3,67** ✗ |
| ahora | `#818e88` (propio) | **5,14** ✔ |
| ítem del menú (`--neutral-400`) | `#9aa5a0` | 6,14 |

**Mantiene la intención**: la etiqueta sigue **por debajo** del ítem del menú, así que se lee como
secundaria, que es lo que es. **No se relajó el umbral ni se metió el par en «conocidos»** — esa
lista es deuda registrada, no un cajón para lo nuevo.

> **Medido en navegador real sobre el CSS real**, no calculado a ojo: fondo `rgb(15, 28, 23)`
> —el mismo que reportó el guard—, etiqueta `rgb(129, 142, 136)`, ratio **5,14**.
>
> ⚠️ **Hueco:** `guard:contraste` **no arranca en esta máquina** («NO PUDE ARRANCARLO en 3
> intentos»), y su propio mensaje avisa de que eso es **NO MEDIDO**, no «sin defectos». Por eso la
> comprobación se hizo con la fórmula de WCAG sobre los colores computados en una página que carga
> la hoja de estilos de verdad. Quien pueda correr el guard, que lo confirme.

### Sobre el marcador de microcopy

**Este ticket no pintó ningún marcador**: los tres rótulos cabían medidos en su caja, así que no
hizo falta. Comprobado igualmente cuál es la grafía que el censo cuenta, con el número delante:
`tests/scrum402-…:48` declara `const MARCA = '[PENDIENTE'`. La forma `[[MICROCOPY-PENDIENTE-…]]`
**no la ve ese censo**, así que no es un marcador: es una frase sin aprobar camino de la pantalla.
