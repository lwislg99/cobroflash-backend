# SCRUM-801 · La «N» que abre otra pantalla — cuántas son, y qué hacer

**Fecha:** 6/7-sep-2026 · **Carril:** producto · navegación · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `5af8e7e9cdcd15ac90eb9b8a1473737872b6625c` · 2026-09-07T01:37:09+01:00

> **`main` se movió DOS veces durante el ticket y se dice cuál es cuál.** Se midió primero contra
> `07ec5bef…`; entraron después SCRUM-758, 778, 790, 792 y 799. La rama **se mezcló y las tres
> mediciones se repitieron enteras encima**: censo **27 / 6 / 21**, teclado real **6 + 21 + 0** y
> creación propia **7 / 3 / 11** salen **idénticos** antes y después. Los absolutos de la tanda son
> los del árbol mezclado.
**Tanda:** `npm run build` + `node --test --test-reporter=tap tests/*.test.mjs` → **5735 pruebas ·
5633 en verde · 0 rojas · 102 saltadas** · 421,8 s · salida 0.

Los **102 saltos declaran motivo y suman 102**: **92** piden base (`QA_DB_TEST` / `A55_DB_TEST` /
`AN_DB_TEST` / `BOT_SUITE_TEST` → `npm run test:staging:gated`), **9** piden un Postgres desechable
(`LIBRO_PG_URL`) y **1** no puede crear un enlace a fichero en esta máquina (EPERM: Windows lo
exige elevado) **y dice que su mecanismo queda cubierto por el control positivo portable que sí
corre aquí**. Ninguno es un salto mudo.

`npm run meta:mutaciones` sobre el mismo árbol → **98 vivas · 0 mudas · 0 ciegas · 0 ficheros
muertos**, salida 0, con las **tres** de este ticket nombradas entre las vivas.

> **ESTE TICKET MIDE Y RECOMIENDA. NO SE HA RETIRADO EL RESPALDO NI SE HA TOCADO `app.js`.**
>
> Nace de una corrección al cerrar SCRUM-769: el encargo daba por hecho que la «N» en Productos y
> Proveedores «no hace nada», y con teclado real resultó que **cae al respaldo de `app.js` y abre
> la cotización rápida**. La pregunta que quedó abierta —*¿en cuántas más?*— se contesta aquí.

---

## 🔴 EL ROJO, PRIMERO · con teclado real, no simulado

Se ejecuta **el despacho del producto**: el bloque `document.addEventListener('keydown', …)` se
**extrae de `app.js`** y se corre tal cual. Si no aparece exactamente uno, el banco se declara
ciego en vez de medir otra cosa.

```
Productos     appState.view=products   → abrió: quickQuote      ← COTIZACIÓN RÁPIDA
Proveedores   appState.view=providers  → abrió: quickQuote      ← COTIZACIÓN RÁPIDA
Trabajos      appState.view=jobs       → abrió: jobs            ✅ lo suyo
Gastos        appState.view=expenses   → abrió: expenses        ✅ lo suyo
CONTROL NEGATIVO · escrito «nuevo» en un campo: el campo queda con "nuevo" · ¿abrió algo? no
```

**No es que no pase nada: pasa OTRA COSA, de otro flujo.** El profesional está en Productos, pulsa
«N» esperando un producto nuevo, y se le abre un presupuesto.

## ① EL CENSO · en cuántas pantallas pasa

`npm run censo:respaldo-n` — `scripts/censo-respaldo-de-la-n.mjs`, **por AST y sin lista cableada**.

**🔴 La población NO son las vistas, y la diferencia decide.** El despacho no pregunta por la
función que pintó la pantalla, sino por `appState.view`. Quien fija ese valor es `renderView(view)`,
así que la población son las **etiquetas `case` de su `switch (view)`**. Censar `render*View` habría
medido otra cosa: hay vistas que se pintan desde otra y `case` que no pintan ninguna.

| | |
|---|---|
| etiquetas `case` del `switch (view)` | **27** (+ un `default:`) |
| con destino registrado | **6** — `quotes-list`, `customers`, `invoices`, `albaranes`, `jobs`, `expenses` |
| 🔴 **sin destino → caen al respaldo** | **21** |

Y las 21, **una a una y con teclado real**, abriendo la cotización rápida:

```
home · quotes-new · quotes-detail · reports · templates · quote-requests · jobs-detail ·
customer-360 · cobros · partes-oficina · albaran-detail · parte-detail · invoice-detail ·
products · providers · libro-registro · export · plans · team · operarios · settings
```

**Recuento con teclado real: 6 abren el suyo · 21 abren la cotización rápida · 0 ninguna de las dos.**

* ✅ **CONTROL POSITIVO:** las 6 con destino abrieron **el suyo**, no el respaldo.
* ✅ **CONTROL NEGATIVO:** escribir `n` en un campo de texto escribe la `n` y no abre nada.
* ✅ **CONTROL POSITIVO DEL INSTRUMENTO**, dentro del propio censo: si no encuentra `products` y
  `providers` entre las que caen —medidas con teclado real— **sale con 2 declarándose ciego**,
  aunque su lista parezca razonable.
* **Tres suelos:** sin `switch (view)`, población por debajo de 20, o cero destinos → **CIEGO**.
* ⚠️ **Una de las 21 es un ALIAS y se dice:** `case 'operarios': return renderView('team', …)`
  reentra y deja `appState.view = 'team'`, así que el despacho **nunca la ve valiendo `operarios`**.
  Contarla como una pantalla más sin decirlo inflaría el censo.

### 🔴 El instrumento se equivocó una vez, y así se vio

`pintaDe` miraba la **expresión llamada**, y dos `case` invocan
`(window.renderProductsView || renderProductsView)(viewContainer)`. El texto del callee es el
paréntesis entero, no casa con `render*View`, y **Productos y Proveedores salían como «no pinta
ninguna vista»** — falso y con forma de dato, justo en las dos pantallas del control positivo.
Arreglado recogiendo **identificadores** dentro del `case`, y sujeto con su test.

### 🔴 Y EL META-GUARD ME SACÓ MUDO — dos veces, por el mismo sitio

El guard nuevo declara sus tres mutaciones (contrato de SCRUM-745). `npm run meta:mutaciones`
**rechazó la tercera**:

```
🔴 GUARDS MUDOS — pasan en verde sobre el defecto que dicen vigilar:
  · scrum801-el-respaldo-de-la-n.test.mjs · el guard NO cayó.
    Test que debía ponerse rojo: «una MENCIÓN de `registrar` en un comentario no cuenta como destino»
```

Y tenía razón. La mutación era quitar la comprobación `e.name.text !== 'registrar'` — que **no
cambia nada** sobre un fichero donde lo único que cuelga de `atajoNuevo` ya es `registrar`. No
imitaba el defecto que ese test vigila (**contar menciones**), así que el test seguía verde con
motivo. La correcta le **añade al lector un barrido por texto**, que es exactamente la
implementación alternativa contra la que el test existe.

Al reescribirla caí en un segundo agujero, del mismo sitio: escribí `a:` como **concatenación**
(`'…' + "…"`), y el lector por AST del meta-guard sólo acepta **un literal** — la declaración
entera se caía a `incompletas` y **desaparecía del censo sin ruido**. Los dos quedan escritos
junto a la mutación.

Comprobado que la corregida **discrimina**, y sin tocar el árbol (la versión mutada se escribe en
un fichero temporal fuera del repo, y se verifica por bytes que el original no se movió):

```
SANO   → ["siQueVale"]
MUTADO → ["inventada","tampoco","siQueVale"]     ← las dos menciones entran
```

## ② ¿ES LA COTIZACIÓN RÁPIDA UNA RESPUESTA RAZONABLE AHÍ?

Para no contestarlo de oído, primero el dato: **de las 21, ¿cuáles tienen creación propia?** Se
monta cada vista real en el banco y se buscan controles cuyo texto anuncie una creación.

| | cuántas | cuáles |
|---|---|---|
| 🔴 **con creación PROPIA** — la «N» promete una cosa y abre otra | **7** | `quotes-new` (+ Añadir línea/tramo/descuento) · `templates` (+ Nuevo presupuesto) · `jobs-detail` (**dos** «+ Nuevo albarán») · `products` (Crear producto) · `providers` (Crear proveedor) · `team` (+ Añadir miembro) · `settings` (Añadir condición) |
| **sin nada que crear** — el respaldo ocupa un hueco vacío | **3** | `cobros` · `albaran-detail` · `export` |
| ⚠️ **NO MEDIDAS** — declaradas, **no** contadas como «sin nada» | **11** | 3 porque sus botones llegan al banco **sin texto** (`home`, `quotes-detail`, `reports`) · 7 porque montan en **estado vacío**, con 0 controles · 1 es el alias `operarios` |

**7 + 3 + 11 = 21.** El instrumento lleva dos suelos por vista, y los dos saltaron midiendo: una
vista con 0 controles es un estado vacío, no una pantalla sin acciones; y una vista con controles
**mudos** no puede juzgarse con un criterio textual. En `home`, tres de sus cuatro botones llegan
sin texto — y uno de ellos es el que en pantalla dice «Añadir cliente». Leer eso como «no tiene
nada que crear» habría sido un cero por no haber sabido leer.

### 🔴 EL HALLAZGO QUE DECIDE: en `home` el respaldo NO es un respaldo, es la función anunciada

`public/dashboard/js/homeView.js:56-58` — el CTA de Acciones rápidas:

```html
<button class="home-action home-cta" id="btn-quick-quote">
  <span class="home-action-title">${qLabel}</span>
  <span class="home-action-sub">en 30 segundos · tecla <kbd>N</kbd></span>
```

**La pantalla ANUNCIA la tecla.** En Inicio, «N» → cotización rápida es exactamente lo que el
producto promete por escrito. Ahí el respaldo no estorba: **es la función**, y quitarlo sin más
convertiría ese `<kbd>N</kbd>` en una mentira impresa.

### La secuencia peor, encadenando dos hechos medidos

1. En `quotes-list` la «N» hace `renderAppView('quotes-new')` (`quotesListView.js:349-351`): abre
   el presupuesto **completo**.
2. En `quotes-new` no hay destino → la «N» **cae al respaldo**.

O sea: **N, N** abre el formulario completo y encima le planta el modal de cotización rápida. Y
`sePuedeDisparar` no lo frena, porque `quotes-new` es una vista, no un modal. *(Es una cadena de
dos hechos medidos por separado, no una secuencia ejecutada de punta a punta: se declara así.)*

### Y contradice de frente la firma de SCRUM-769

El fundador retiró el atajo de Productos y Proveedores con estas palabras: **«Colgar N de un botón
que confirma es atar una tecla a un guardado. N abre, no guarda.»** El motivo es que ahí el botón
primario **confirma**. Pero hoy, en esas dos pantallas, **la «N» sigue abriendo algo** — otro flujo.
La decisión de 769 se tomó sobre «no lleva atajo» y lo que hay es «lleva otro».

## ③ POR QUÉ SCRUM-599 DEJÓ EL RESPALDO — leído, no supuesto

**Está escrito, y hay que decir DÓNDE y CON QUÉ RANGO.**

`docs/master/SCRUM-599.md`, sección **«Los huecos que declaro»**, punto 2:

> «El registro es por vista y se rellena al montarla. Si una vista se monta y luego se navega a
> otra que no registra, el atajo cae al comportamiento de siempre (cotización rápida). **Es
> deliberado —quitarlo sería retirarle el atajo a quien ya lo usa— pero no he medido** qué pasa al
> volver atrás sin remontar.»

Y el mecanismo, en la cabecera de `atajoNuevo.js` y en el MECANISMO de la entrada:

> «En `app.js` había un `keydown` global que **ya escuchaba la «n»** … Lo que hacía era abrir
> **siempre** la cotización rápida, estuvieras donde estuvieras. Así que aquí **no nace un segundo
> manejador**: … el destino pasa a decidirlo la vista en la que estás.»

**Medido en el historial, no deducido:** el atajo nació el **4-jun-2026** en el commit `e9f6da22`
(*«design(impeccable): Home iteración 2 — número héroe + atajo de teclado»*), y desde ese día abría
la cotización rápida **en todas partes, sin condición**. SCRUM-599 (4-sep-2026, tres meses después)
**no añadió un respaldo: estrechó el que había.**

**El veredicto que el encargo pedía, con su matiz:**

| pregunta | respuesta |
|---|---|
| ¿Es una situación de hecho? | **Sí**: es el comportamiento original, de tres meses antes |
| ¿Está el motivo ESCRITO? | **Sí**, literal, en la entrada de SCRUM-599 |
| ¿Está escrito como DECISIÓN? | **No**: está en «los huecos que declaro», y la misma frase dice «pero **no he medido**» |
| ¿La firmó el fundador? | **No.** Su firma del 4-sep-2026 (`docs/microcopy/2026-09-04-SCRUM-599-atajo-nuevo.md`) cubre **tres rótulos**, no el comportamiento |
| ¿Está en `docs/YAQU_MASTER.md`? | **No.** Barrido: el máster nombra el **Quick Quote** como función (línea 119 y la Parte AB, «acciones rápidas» de Inicio), pero **de la tecla y del respaldo no dice nada** — cero apariciones de «cotización rápida», cero de la «N» como comportamiento |

Así que **no se cierra diciendo «ya estaba decidido»**: lo que hay es un motivo escrito por quien
lo dejó, en el apartado donde se declara lo que **no** se ha medido. Eso es exactamente lo que este
ticket ha venido a medir.

## ④ LAS TRES SALIDAS, CON SU COSTE

### ① Retirar el respaldo — «donde no hay destino, la «N» no hace nada»

* **Cambio:** una línea de `app.js` (`if (typeof openQuickQuoteModal === 'function') …`).
* 🔴 **Coste que NO se ve en esa línea:** deja **mintiendo al `<kbd>N</kbd>` de Inicio**, que
  anuncia la tecla en pantalla. Retirarlo obliga además a **registrar `home`** o a cambiar ese
  texto — y eso último es microcopy, o sea firma del fundador (regla 30).
* **Coste de producto:** le quita el acelerador a quien lo usa **desde el 4-jun-2026** en 20
  pantallas, sin haber medido a cuánta gente. Es justo lo que SCRUM-599 no quiso hacer.

### ② Dejarlo sólo donde tenga sentido — **RECOMENDADA**

* **Cambio:** registrar `home` → `openQuickQuoteModal` (su propio botón, su propia tecla anunciada)
  y **quitar el respaldo global**. Dos líneas y su guard.
* **Efecto medido de antemano:** la «N» pasa a abrir algo en **7** pantallas (las 6 listas + Inicio)
  y **a no hacer nada en 20** — incluidas las 7 que tienen creación propia, hasta que alguien
  decida pantalla por pantalla, que es como se decidió en SCRUM-769.
* **Lo que gana, y es lo que más pesa:** el comportamiento pasa a ser **derivable del registro**.
  Hoy `vistasConAtajo()` dice 6 y la verdad es «6 + un catch-all invisible»; después, el registro
  **es** la verdad entera y este censo se vuelve exacto en vez de necesario. Es el escalón de
  «imposible» frente a «vigilado».
* **Coste:** el que se paga una vez —dos líneas, un test, una entrada— más aceptar que en las 20
  restantes la tecla calle. **Y ese silencio es honesto**: hoy, en 7 de ellas, promete una cosa y
  abre otra.
* **Riesgo declarado:** quien hoy usa la «N» desde Informes o Cobros como atajo global la pierde.
  No se sabe cuánta gente es —no hay telemetría de teclado— y por eso no se hace en este ticket.

### ③ Dejarlo y escribirlo como decisión

* **Cambio:** cero código. Una línea en el máster, donde viven las decisiones, **no** en los huecos
  de una entrada.
* **Coste:** deja en pie las **7** pantallas en las que la «N» promete una cosa y abre otra, y deja
  en pie la contradicción con la firma de SCRUM-769 —«N abre, no guarda»— en Productos y
  Proveedores, que es de donde salió este ticket.
* **Cuándo sería la correcta:** si el respaldo se usa de verdad. Eso **no se sabe**, y saberlo pide
  una medida que hoy no existe.

### RECOMENDACIÓN

**②**, y en este orden: **primero registrar `home`** —que es reparar una promesa impresa, no una
decisión de producto— y **sólo después** retirar el catch-all, en el mismo commit y con el censo de
arriba como control de antes/después. Si el asesor prefiere no tocar el comportamiento todavía,
**③ es aceptable siempre que la decisión se escriba donde manda** y se diga con todas las letras
que en 7 pantallas la tecla abre otra cosa. **① a secas no**: rompe el `<kbd>N</kbd>` de Inicio.

## Ficheros

| fichero | qué es |
|---|---|
| `scripts/censo-respaldo-de-la-n.mjs` | **nuevo** · el censo por AST, con sus tres suelos y su control positivo dentro |
| `package.json` | **nuevo** alias `censo:respaldo-n` + su `//` con la convención de SCRUM-548 |
| `tests/scrum801-el-respaldo-de-la-n.test.mjs` | **nuevo** · 7 pruebas que vigilan **el instrumento**, no el respaldo — y **no fijan en 21** el número de pantallas que caen: ese número es el hallazgo que hay que decidir, no una regla aprobada. Declara **3** mutaciones, las tres verificadas vivas |
| `docs/master/SCRUM-801.md` | **nuevo** · esta entrada |

**⛔ No se ha tocado:** `app.js` ni su respaldo · la ficha del Trabajo ni «+ Nuevo albarán» ·
`atajoNuevo.js` · ningún literal · ninguna vista.

## Huecos declarados

1. **11 de las 21 no están medidas** en la pregunta «¿tiene creación propia?»: 7 montan en estado
   vacío, 3 traen los botones sin texto y 1 es un alias. Se declaran; **no** se cuentan como
   «no tienen nada».
2. **El puente del banco de teclado.** La pieza y el despacho son del producto; **qué vistas
   registran destino** sale del censo por AST y se **replica** en la página. La ruta completa
   —`initApp()` con sesión, navegando de verdad— sigue sin ejercitarse.
3. **`openQuickQuoteModal` es un doble** en ese banco: se cuenta que se llama, no se abre la
   cotización de verdad.
4. **La secuencia `N, N` (lista → formulario → modal encima) es una CADENA de dos hechos medidos
   por separado**, no una navegación ejecutada de punta a punta.
5. **No hay ninguna medida de uso.** Cuánta gente usa hoy la «N» fuera de las 6 listas es
   desconocido, y es justo el dato que decidiría entre ② y ③. Ningún número de esta entrada lo
   sustituye.
6. **El registro nunca se vacía.** `registrar` sólo añade: una clave registrada al montar una vista
   sigue ahí después de navegar a otra. No afecta a lo medido —el despacho pregunta por
   `appState.view`— pero es el mismo hueco que SCRUM-599 declaró sin medir, y sigue sin medirse.
