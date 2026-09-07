# SCRUM-667 · Los marcadores de microcopy que hoy VE un profesional

**Fecha:** 2-sep-2026 · **Carril:** microcopy y guards · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `a5aef1b9bbd2570eccbde82b407c9d3675192c2d` · 2026-09-02T17:30:07Z

> **La premisa cambió hoy.** Producción llevaba nueve días sin desplegar por deriva de esquema. Al
> arreglarse, **cada merge sale a producción** y desapareció el hueco entre mergear y desplegar que
> hacía inofensivo un marcador. Un `[PENDIENTE microcopy oficial]` dejó de ser una nota para el
> equipo y pasó a ser texto que lee un profesional que paga.

---

## 1 · PASO 0

### ENTRADA

**Sí hay entrada, y estaba en pantalla:** `public/dashboard/js/switchTipoArticulo.js`, el switch
del catálogo, pintado en el alta y en la edición de artículo desde `productsView.js`. Tres rótulos
—«Esto es», «Producto», «Servicio»— salían con el prefijo `[PENDIENTE microcopy oficial]` delante,
en la **primera pantalla del catálogo**, en producción.

Para la parte 2 la entrada es otra: **la próxima pantalla o PDF que alguien escriba**. Los tres de
hoy se encontraron *mirando*, por casualidad. El siguiente no vendrá con una captura.

### MECANISMO · existía, y a medias — el trabajo era darle superficie

| pieza | qué mira | ¿basta? |
| --- | --- | --- |
| `scripts/censo-marcadores.mjs` | `public/dashboard/js`, `public/` entero y **`src/`** | Cuenta bien, **pero no es un guard**: es una herramienta que hay que ejecutar a mano |
| `tests/scrum402-marcador-no-se-pinta.test.mjs` | **sólo `public/dashboard/js`** | Es el trinquete, y **no mira `src/`** |

🔴 **Ahí está el hueco, y no es el que decía el carril.** Se me dijo que «`src/` no lo mira nadie»:
para el **censo** es falso —lo barre desde que existe—, pero para el **trinquete** es exacto. Las
**8 marcas de `src/` las ve el censo y no las congela nadie**, y de `src/` salen justamente las que
se imprimen en un PDF.

---

## 2 · Lo medido, con la semilla PUESTA

El control positivo eran los tres del catálogo, así que se censó **antes** de retirarlos: si el
instrumento no los encontraba, estaba roto. Los encontró — y de paso enseñó su propia forma:

```
switchTipoArticulo.js →  1 marca escrita  ·  13 «usos»  ·  pero sólo 2 PINTAN
    L59  leyenda.textContent = MARCADOR + ' Esto es'
    L82  texto.textContent   = MARCADOR + ' ' + ETIQUETA[valor]     → «Producto» y «Servicio»
```

Los otros 11 «usos» son asignaciones y exportaciones que no pintan nada, y algunos van por
duplicado. **El censo cuenta usos del identificador, no superficies**; su total de «superficies
pintadas» está por encima de lo que un profesional ve. No se corrige aquí —no es este carril— pero
queda declarado.

**Población el 2-sep-2026, después de retirar los tres:** 344 ficheros leídos · **25 marcas**
(panel 16 · público 1 · **servidor 8**).

### 🔴 Y lo caro: qué llega al PDF DEL CLIENTE

Se comprobó **leyendo el papel** con `lineasDePdf` (SCRUM-659), no la plantilla:

| factura | marcadores impresos |
| --- | :-: |
| **un** tipo de IVA | **0** ← control negativo |
| **dos** tipos de IVA | **1** — `[PENDIENTE microcopy oficial]` |

**`MARCADOR_MICROCOPY_DESGLOSE` se imprime en la factura** cuando hay más de un tipo de IVA: es el
rótulo de la columna de bases del desglose. Ese PDF **lo ve el cliente de nuestro cliente**. El
propio fichero ya lo declaraba, y la medición lo confirma. Hoy no llega a un cliente real porque
`INVOICING_ES_ENABLED` está OFF para merchants ES (regla 24) y la demo lleva marca de agua — pero
**el único freno es un flag**.

> ⚠️ **Mi primera medición dio 0 y era FALSA.** Construí la factura con `quantity`/`unitPrice`/
> `vatRate` y el generador lee `qty`/`price`/`tax` (fracción): todas las líneas cayeron al 0 %, un
> solo tipo, y el marcador no salía. Un falso negativo perfecto — el mismo error que este ticket
> persigue, cometido midiéndolo. Por eso el guard lleva dentro el control de que el lector ve el
> PDF (`QA SL` = 1) **antes** de afirmar nada sobre lo que no ve.

---

## 3 · Qué se construyó

### Parte 1 · Los tres, retirados

El fundador aprobó los textos **tal cual**: «Esto es» · «Producto» · «Servicio». Se retiró **sólo
el prefijo**; el texto no se toca, ni se abrevia, ni se reordena, ni se le añade puntuación
(regla 30 — es copy del fundador desde ahora).

Y **se apagaron los tres a la vez**, que es justo lo que la entrada anterior del censo avisaba de
que *no* se podía dar por hecho: salían de una sola constante `MARCADOR`, así que aprobar uno solo
habría obligado a partirla. Se aprobaron los tres, así que la constante se retiró entera.

El censo baja **en el mismo commit**: `switchTipoArticulo.js` **sale** del `CENSO` de SCRUM-402 —
entrada borrada, no puesta a 0, como las once del 17-ago. Y `tests/scrum609b` deja de exigir el
marcador y pasa a exigir su **ausencia** y el texto literal.

### Parte 2 y 3 · `tests/scrum667-marcador-visible.test.mjs`

Deriva de `censar()` en vez de releer el árbol por su cuenta.

* **Trinquete de `src/`** por fichero, en **las dos direcciones**: uno nuevo o que sube es rojo; y
  si **baja**, también — «un trinquete que sólo sabe subir deja de significar algo el día que algo
  se cierra», que es exactamente lo que ha pasado hoy.
* **`EN_EL_PAPEL`**: la lista declarada de lo que puede imprimirse en un PDF, con su condición. Se
  verifica leyendo el papel.
* **Suelos**: menos de 100 ficheros o cero marcas → CIEGO. Y un **suelo por ámbito**: si `src/`
  dejara de barrerse, su trinquete pasaría en verde sobre un conjunto vacío — el estado del que
  sale este ticket.
* **Negativos**: un marcador en un **comentario** no cuenta, y `tests/` no entra en el censo.

---

## 4 · Evidencia

Commiteado en verde antes de mutar; **toda mutación revertida con `git status` vacío** como
post-condición.

| mutación | resultado |
| --- | --- |
| marcador nuevo en `src/core/entitlements.ts` | 🔴 cae nombrando el fichero: «HAY MARCADORES NUEVOS EN `src/`: src/core/entitlements.ts (+1)» |
| **segundo marcador impreso en el PDF** | 🔴 caen **dos** guards; el del papel dice «EL PAPEL DEL CLIENTE TRAE 2 MARCADOR(ES) Y HAY 1 DECLARADO(S)» y **transcribe el intruso** |
| retirar un marcador de `src/` sin bajar el censo | 🔴 cae: «han bajado, que es la dirección buena: `jobDireccion.ts`: 1 → 0. Actualiza `CENSO_SERVIDOR` en este mismo commit» |
| **negativo**: marcador en un **comentario** de `src/core/flags.ts` | ✅ **10 pass, 0 fail** — no lo tumba |
| **negativo**: factura de un solo tipo de IVA | ✅ 0 marcadores en el papel |

**Verde**: `npm test` completo después del último cambio, worktree limpio, `main` mezclado dentro,
Prisma regenerado y `dist/` reconstruido desde este worktree. `npm run guards:entrada` verde.

---

## 5 · Huecos declarados

* **El censo cuenta «usos», no superficies pintadas.** Medido: 13 usos donde pintan 2. Su total de
  superficies está inflado por asignaciones, exportaciones y duplicados. El trinquete de este
  ticket cuenta **marcas por fichero**, que sí es estable — pero quien lea «266 superficies» está
  leyendo un número mayor que lo que ve un profesional.
* **`EN_EL_PAPEL` cubre la FACTURA.** Presupuesto, albarán y parte generan PDF por caminos propios
  y **no** están bajo este guard. Es el siguiente escalón natural y no se ha hecho hoy.
* **La visibilidad real de los 16 del panel no se ha medido uno a uno.** El banco de vistas
  (SCRUM-666) podría decir si se pintan, con su tercera respuesta CIEGO; queda como trabajo
  declarado, no hecho. Lo que sí está cerrado es que **ninguno nuevo entra sin verse**.
* **No se ha tocado ningún marcador cuya copy no esté aprobada.** Los otros 25 se listan, no se
  inventan (regla 30).

---

## Tests que introduce esta entrada

* `tests/scrum667-marcador-visible.test.mjs` — 10 pruebas: dos suelos del censo (árbol y por
  ámbito), el trinquete de `src/` en las dos direcciones, el suelo del lector de PDF, el control
  negativo de la factura de un tipo, el guard del papel del cliente, los dos negativos
  (comentario y `tests/`) y la fijación de los tres textos aprobados.
* `tests/scrum609b-switch-tipo-articulo.test.mjs` — el test del microcopy se invierte: exigía el
  marcador, ahora exige su ausencia y el texto literal aprobado.
* `tests/scrum402-marcador-no-se-pinta.test.mjs` — `switchTipoArticulo.js` sale del `CENSO`.

---

# SCRUM-722 · el censo de marcadores sobre lo PINTADO, y el guard que faltaba

**Medido contra:** `origin/main` = `af08201502a3978a484de3933132dfcdf26df790` · 2026-09-07T13:55:27+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-722-marcadores-a-la-vista`
**Carril:** front / microcopy + un guard de navegador

## De dónde salió

De rebote. El barrido de SCRUM-721 devolvió «[PENDIENTE microcopy oficial] Nuevo albarán» midiendo
otra cosa. Llevaba **tres días en pantalla** y no lo encontró ningún mecanismo.

## 🔴 La respuesta que más vale: por qué ninguno de los CUATRO guards lo vio

No fue descuido. Ninguno mira eso, y cada uno lo dice:

| guard | sobre qué | por qué no lo vio |
|---|---|---|
| SCRUM-402 | el **fuente** (`public/dashboard/js`, por AST) | Es un **trinquete**, no una prohibición: congela un censo por fichero. `atajoNuevo.js: 1` está **dentro** del censo, así que ese marcador estaba **contado y permitido**. Hizo exactamente lo que promete. |
| SCRUM-667 | el **fuente**, ampliado a `src/` | Mismo eje. Un marcador más en un fichero ya censado no es noticia. |
| SCRUM-720 | el **DOM renderizado** | Es el único del eje bueno, y su propia constante `COBERTURA` declara que sólo cubre `parteDetailView.js` y `jobAsignados.js`. **Dos ficheros.** |
| SCRUM-755 | el **árbol**, contando SITIOS que pintan | Tenía `atajoNuevo.js: 1` **en su censo**: lo contaba bien. Pero contar no es avisar — mientras el número cuadre, nadie mira si lo contado está delante de un cliente. ⚠️ **A éste no lo encontré en mi primer barrido de guards**; salió en rojo al correr la suite, y por eso esta tabla dice cuatro y no tres. |

🔒 **Teníamos tres guards y ninguno cubría el panel entero sobre lo pintado.** El fuente dice qué
literales existen; sólo el DOM dice cuáles se leen. Y un marcador que vive en una constante
compartida —como éste— no sube el censo del fichero que lo pinta, porque no vive ahí.

## ① El censo, sobre el DOM renderizado

**26 vistas** (derivadas del `switch` del router, no de mi memoria) **× 3 estados** = 78 pares.

**La unidad, declarada** (la lección de SCRUM-714, donde tres instrumentos dieron 1, 4, 13 y 14):

- **APARICIÓN** — una ocurrencia del literal en un **nodo de texto del DOM ya pintado**. Es lo que se cuenta.
- **VISIBLE** — su padre tiene caja y ningún ancestro está oculto. Se cuenta **aparte**.
- **PAR** — (vista, estado). El del parte sólo salía en dos de tres: el estado importa.
- **No cuenta**: atributos (`title`, `placeholder`, `aria-label`) ni `value` de input. Es un hueco real y se declara.

**Resultado: 15 apariciones · 9 visibles · 3 vistas · 0 ciegos.**

| vista | apariciones | visible | dónde |
|---|---|---|---|
| `albaranes` | 3 (1 por estado) | 👁 **sí** | `atajoNuevo.js:48` → botón de la lista |
| `export` | 6 (2 por estado) | 👁 **sí** | `exportView.js:87` y `:100` |
| `quotes-new` | 6 (2 por estado) | oculto | `quotesView.js:890`, `:1363`, `:1398` |

## Cuatro veces que el banco me mintió, y cómo se cazaron

1. **La página no era la página.** Sin sesión, el arranque hace `location.href='login.html'`: el
   documento se sustituye, no queda ni un script y **las 26 vistas salían «no existe render…»**.
   Cero absoluto con cara de limpio. Se le da sesión por `fetch` **antes** de los scripts.
2. **El contenedor desaparecía**: alguna vista reescribe el `body`. Se recrea.
3. **«Sin datos» no es «sin forma»**: devolver `[]` a todo reventaba tres vistas y las dejaba
   ciegas. Se conserva la forma y se vacían sus listas.
4. **El estado del albarán en mayúsculas** (`'BORRADOR'`) daba un destino inexistente y la vista
   moría antes de pintar. Va en minúscula.

Los cuatro se cazaron porque el barrido **aborta cuando no puede mirar**. Con un instrumento que
contara «0» en esos casos, este informe diría que el panel está limpio.

## ② El arreglo

`atajoNuevo.TEXTOS.albaranes` pasa a **«Nuevo albarán»**, firmado por el fundador el 7-sep-2026 y
registrado en `docs/microcopy/2026-09-07-SCRUM-722-nuevo-albaran.md`. Vive en la pieza, así que la
firma llega a la vez al botón de la lista y al título del modal del buscador.

**Del resto no se ha inventado ni una palabra.** Van en el informe con su literal para que los firme.

## ③ El guard: `guard:marcadores-en-pantalla`

Un guard de navegador más en la tanda (ahora **14**). Vigila que **ningún marcador nuevo llegue al
DOM renderizado** de las 26 vistas en sus tres estados.

**Es un trinquete y no una prohibición**, por el mismo motivo que SCRUM-402: hoy quedan dos ranuras
sin firmar, y un guard que naciera rojo lo apaga alguien en una hora. Vigila que **el número no
suba y que no aparezca una vista nueva**. Las entradas se **borran**, no se ponen a 0.

**Sus dos suelos:**

- Una vista que no se puede pintar es **CIEGA y el guard falla**. «No he podido mirar» no es «está limpio».
- **El control negativo se corre en CADA ejecución**: inyecta un marcador y comprueba que el
  detector lo ve. No se confía en que se probara una vez.

**🔴 El rojo, corrido — y el primer intento no cayó.** Inyecté un marcador al principio de
`renderTemplatesView` y el guard **siguió verde**: el propio render reasigna `innerHTML` después y
se lo comía. Eso no era un guard flojo, era una inyección que no llegaba a pintarse — la misma
distinción entre *estar en el fuente* y *llegar al DOM* que justifica todo este ticket. Inyectado
donde sí se pinta (un `textContent` real), el guard **cae** nombrando vista, número y literal.
Revertido, vuelve al verde.

## Lo que queda SIN FIRMA, y no se toca

| dónde | qué dice hoy | visible | qué es |
|---|---|---|---|
| `exportView.js:87` | `[PENDIENTE microcopy oficial]` | 👁 sí | párrafo de ayuda bajo «Facturas emitidas» |
| `exportView.js:100` | `[PENDIENTE microcopy oficial]` | 👁 sí | rótulo del botón `#btn-libro-emitidas` |
| `quotesView.js:890` · `:1363` · `:1398` | `[PENDIENTE microcopy oficial]` | oculto | el botón de la propuesta de pago y su porcentaje |

Los de `quotesView` llegan al DOM pero están ocultos en los tres estados medidos: se despliegan al
elegir la propuesta de pago. **Cuentan igual** — que hoy no se vean depende de un despliegue, no de
que el texto esté aprobado.

## Cierre

`npm run build` → 0 · `guards-visuales` **14/14**, el nuevo incluido.

### Addendum · el hueco que este censo NO alcanza, dicho antes de que lo encuentre otro

El censo mide las vistas **tal como se pintan al entrar**. Un modal que sólo se abre con un clic
queda fuera, y ahí hay marcadores reales: `albaranDesdePresupuestoModal.js` declara **seis**
(`ALB_ORIGEN_SIN_APROBAR = 6`) y el profesional los ve en cuanto abre el buscador de presupuestos.

Se dice aquí en vez de dejar que el número de arriba parezca la foto completa. Abrir cada modal
desde el guard es otro ticket: hay que decidir con qué gesto se abre cada uno, y eso es una lista
a mano —justo lo que este guard evita en las vistas, donde las deriva del router—.
