# SCRUM-760 · El albarán por voz recortaba el IVA en vez de rechazarlo

**Fecha:** 6-sep-2026 · **Carril:** producto / backend · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `2c155141bc27f0e450a9a1c7ca5748330b37ee39` · 2026-09-06T06:46:25+01:00

---

## LA VÍCTIMA

El profesional que dicta el parte en obra con el móvil, repasa la propuesta, la añade a la hoja y
la guarda. En la casilla del IVA pone **100**. Nadie le avisa de nada, porque no ha fallado nada:
el número es un número válido, la línea se guarda, el papel se emite y el cliente lo firma.

**Un 100 % de IVA es PLAUSIBLE PARA LA MÁQUINA E IMPOSIBLE PARA EL NEGOCIO.** No cae en ningún
`catch`, no dispara ninguna alarma, y se comporta como un tipo correcto hasta que alguien mira el
papel.

---

## LA CADENA, MEDIDA EN EL CAMINO REAL ANTES DE TOCAR NADA

```
el prompt pide un decimal (0.21)
  → el modelo devuelve 21           (queriendo decir «21 %»)
  → Math.min(1, Math.max(0, iva))   ai.service.ts:233   →  1
  → el ×100 del navegador           jobDetailView.js:2331 → 100
  → la casilla del parte:           100 % DE IVA
```

Montado el editor de albarán **de verdad** en el banco de vistas, pulsando «🎤 Dictar el parte» →
«Convertir en líneas» → «Añadir al parte», con el saneador REAL de `dist` detrás del `fetch`:

| | casillas de IVA | total orientativo |
|---|---|---|
| **antes** (modelo contesta `21`) | `[21, 100]` | Base 170,00 € · **Total 340,00 €** |
| **después** | `[21, 21]` | Base 170,00 € · Total 205,70 € |

**El cliente firmaba el doble de la base.**

Y no lo paraba nada más abajo: `validarLineas` (`albaran.service.ts:117`) admite
`0 ≤ tipoIva ≤ 100`, así que el 100 pasa el guardado sin una queja.

---

## LA IRONÍA ESTABA EN EL PROPIO FICHERO

La cabecera de `sanearLineasAlbaran` dice, con todas las letras:

> **ES EL MECANISMO, NO EL PROMPT.** […] un prompt es una PETICIÓN: si el modelo se despista, o
> cambia de versión, o alguien edita el texto del prompt, la petición deja de cumplirse en
> silencio y nadie se entera.

La función existe exactamente por eso — y no se defendía de que **su propia petición** («devuélveme
el IVA como decimal») se malinterpretara. Protegía el precio con un mecanismo y el IVA con un
recorte, que es una petición disfrazada de mecanismo.

---

## LO QUE SE CONSTRUYE

`sanearLineasAlbaran` **rechaza** en vez de recortar, y el rechazo **se deriva de la regla que ya
existía**:

```ts
const bruto = l?.tipoIva ?? l?.tax;
if (bruto !== undefined) {
  const motivo = invalidTipoIva(bruto);          // SCRUM-217, sin tocarla
  if (motivo === null) linea.tipoIva = Number(bruto);
  else linea.tipoIvaRechazado = motivo;          // y el motivo NOMBRA el valor recibido
}
```

**Se deriva, no se copia.** `invalidTipoIva` ya compara en PUNTOS BÁSICOS —para no tropezar con
`0,07 + 0,005 ≠ 0,075`— y ya nombra el valor: `invalidTipoIva(21)` → `fuera de rango (0 a 1): 21`.
Escribir una segunda validación habría sido la misma regla dos veces, y una se queda atrás el día
que Canarias (SCRUM-646) o LATAM (F3) muevan la lista.

**El silencio y el disparate no se leen igual.** Si el modelo no dice nada, no hay rechazo: a la
pantalla los dos le llegan como una línea sin IVA, y sólo uno merece explicación.

`tipoIvaRechazado` viaja en la respuesta de `/admin/ai/suggest-albaran-lines`. **Hoy no lo pinta
nadie** — ver la propuesta de abajo.

---

## ⛔ LO QUE NO SE HA HECHO, Y ES DELIBERADO

- **NO se amplía el recorte a `Math.min(100, …)`.** Aplanar sigue siendo aplanar: convertiría un
  `2100` («21 % en puntos básicos», el siguiente malentendido probable) en un 100 % con la misma
  cara de inocente.
- **NO se toca el PROMPT como arreglo.** El prompt ya pide el decimal. El defecto no era la
  petición: era que nadie comprobaba si le hacían caso.
- **NO se toca `invalidTipoIva`.** Está bien. Acomodarla a la voz sería mover una regla fiscal para
  que le quepa un caso de dictado.
- **NO se toca la INTERFAZ.** Qué debe hacer la pantalla con un tipo rechazado se MIDE y se PROPONE
  aquí abajo; lo firma el fundador (regla 30).
- **NO se toca el camino de emisión.** Se leyó (regla 38) y se dice lo que se vio, abajo.

---

## ✅ CONTROL NEGATIVO — EL FILO DEL TICKET

El backend admite **SIETE** tipos en puntos básicos `{0, 200, 400, 500, 750, 1000, 2100}`. El 2 %,
el 5 % y el 7,5 % están ahí **a propósito**: una rectificativa puede tener que rectificar una
operación de aquellas ventanas temporales. **Un arreglo que los tirase rompería una rectificativa.**

Los siete se prueban **UNO A UNO por la puerta de la VOZ**, no por la de `invalidTipoIva`: probarlos
en el validador mediría el otro lado del cable y dejaría sin vigilar justo el trozo que este ticket
cambia.

Y la mutación **B3** lo demuestra vivo: estrechar la puerta a `{0, 10, 21}` pone ROJO ese control.

---

## LA PREGUNTA 3, MEDIDA — QUÉ HACE HOY LA INTERFAZ (y qué se propone)

**Lo medido, no lo supuesto:**

1. Una línea que llega **sin** `tipoIva` acaba en `mkRow` (`jobDetailView.js:2150`), que escribe un
   **21 CABLEADO**: `iv.value = (l.tipoIva != null) ? l.tipoIva : 21`. Medido en el banco: casillas
   `[21, 21]`, total 205,70 €.
2. **El albarán NO tiene «IVA por defecto del documento».** Ese campo existe sólo en el presupuesto
   (`vat_default`, `quotesView.js:463`, SCRUM-660). En `jobDetailView.js` no hay ninguno: medido por
   búsqueda de `vatDefault`/`vat_default` en el fichero — cero apariciones.
3. Sí existe doctrina FIRMADA para este caso exacto, de SCRUM-646: los productos «**nacen sin tipo**»
   y la línea «cae al *IVA por defecto* del documento, **que el profesional VE y puede cambiar**» —
   *«el general SIEMBRA, nunca PISA»*.
4. Y existe regla firmada para no ajustar tipos, de SCRUM-611: *«Nada se ajusta al vecino más
   cercano, nada se pierde.»*

**Las tres salidas, con su coste:**

| | qué pasa | coste | pega |
|---|---|---|---|
| **A** · línea sin tipo, y que elija el profesional | hoy la casilla enseña el **21 cableado** | cero código | el 21 es un número **que él no ha elegido**: es el mismo defecto un piso más arriba |
| **B** · `vatDefault` del documento | **no existe en el albarán**; habría que crearlo | campo nuevo + UI + schema | es lo que dice la doctrina de SCRUM-646, pero es otro ticket |
| **C** · marcar la línea y enseñar el motivo | `tipoIvaRechazado` ya viaja; falta pintarlo | microcopy NUEVA → marcador + caja medida | el profesional se entera de que hay algo que decidir |

🔴 **Recomendación (no decisión):** **A + C**. La casilla no debería estampar un número que nadie
eligió sin decir que lo ha hecho — y el dato para decirlo ya está en la respuesta. **B** es la
doctrina correcta a largo plazo, pero exige un campo nuevo en el albarán y no cabe en este ticket.

**Aviso honesto sobre A:** hoy el 21 cableado da, por casualidad, el número CORRECTO en el caso que
motivó este ticket (el modelo dice `21` queriendo decir 21 %). Esa coincidencia no es una razón para
dejarlo: es exactamente la clase de acierto por accidente que esconde el defecto siguiente.

---

## 🔴 LO QUE SE VIO AL LEER EL CAMINO DE EMISIÓN (y no se ha tocado)

Leer no es STOP (regla 38); modificar sí, y no se ha modificado ni un carácter. Lo que se vio:

- `albaranes.routes.ts:1148` convierte la línea del albarán a línea de factura con
  **`tax: l.tipoIva / 100`** y la entrega a `emitInvoice` (facturación parcial, origen `C7-parcial`).
  Un albarán con el 100 % habría llegado allí como **`tax: 1.0`**.
- **`invalidTipoIva` y `TIPOS_IVA_ES_BP` no aparecen en `src/modules/invoicing/` ni en
  `src/modules/fiscal/`** — medido por búsqueda: cero apariciones. O sea que **el camino de emisión
  no valida el tipo**: la única puerta que lo hace es la de entrada (`CreateQuoteSchema`), y la
  factura desde albarán no pasa por ella.

Este ticket cierra el agujero **aguas arriba**, que es donde nacía. Que el emisor deba además
validar lo que recibe es una decisión sobre el sellado (regla 29) y **no se toca aquí**: queda
declarado para su propio ticket.

---

## EL ROJO, ANTES DE TOCAR NADA

```
not ok 1  🔴 EL CONTROL QUE DECIDE: el modelo contesta 21 y la pantalla NO pinta 100 %
              Casillas: [21,100]
ok     2  ✅ CONTROL POSITIVO: un 0.21 legítimo sigue dando 21 %, exactamente como hoy
not ok 3  el 21 se RECHAZA, no se recorta, y el rechazo NOMBRA el valor recibido
ok     4  ✅ CONTROL NEGATIVO: los SIETE tipos españoles pasan por la puerta de la VOZ
not ok 5  el 15 % inventado también cae, y SIN_VALORAR sigue sin IVA de ninguna clase
not ok 6  la puerta de voz LLAMA a `invalidTipoIva`, no reimplementa la regla
ok     7  la lista de tipos españoles vive en UN solo fichero de `src/`
```

**4 rojos, y los dos controles que debían estar verdes YA lo estaban.** Después del arreglo,
**8 de 8**. Lo que funcionaba no se ha movido: el control positivo estaba verde antes y sigue verde.

---

## EL BANCO DE VISTAS ESTABA CIEGO AL DICTADO ENTERO

Para medir el camino real hubo que arreglar el banco: **`insertAdjacentElement` no existía**, y
`attachVoiceInput` (`voiceInput.js:85-86`) revienta con `TypeError` en cuanto una vista pinta el
micro. **El camino del dictado completo era estructuralmente inalcanzable** para cualquier control
apoyado en el banco.

Y no era sólo la voz: **`productsView.js:1036` lo llama SIN CONDICIÓN**.

Es el mismo hueco que `prepend` (SCRUM-460), `parentNode` (SCRUM-609) e `insertAdjacentHTML`
(SCRUM-698): una pantalla fuera del alcance del banco por una API que el banco no tenía, no por
nada del producto. Se corrige **en el banco**, no se rodea desde el test. La colocación de las
cuatro posiciones del estándar queda **en un solo sitio** (`_colocarAdyacente`), compartida con
`insertAdjacentHTML`.

**Radio medido:** la tanda pasó de 5.519/5.431 a 5.526/5.438 — **+7 tests, +7 pass, y ni un
veredicto cambiado**. Añadir un método sólo puede dejar avanzar a vistas que antes reventaban; se
comprobó que no movió ninguna.

---

## EL TEST DE SCRUM-71 TENÍA EL DEFECTO ESCRITO EN VERDE

`tests/scrum71-voz-albaran.test.mjs:60` decía:

```js
assert.equal(salida[1].tipoIva, 1, 'el IVA se acota a [0,1]');
```

Acotar **era** el defecto. El caso (`tipoIva: 3`) se conserva porque sigue siendo bueno; lo que
cambia es qué se espera de él: **rechazo, y que nombre el 3**.

---

## MUTACIONES

### Declaradas al meta-guard (`MUTACIONES_QUE_ME_TUMBAN`) — 5, las 5 VIVAS

| # | qué imita | cae |
|---|---|---|
| ① | la puerta deja de consultar la regla fiscal | el guard AST |
| ② | vuelve el `Math.min` | el guard AST |
| ③ | nace una SEGUNDA copia de la lista de tipos | el censo de un solo sitio |
| ④ | no se añade NINGUNA línea a la hoja | el que decide |
| ⑤ | desaparece el `×100` del navegador | el control positivo |

② importa por la lección de SCRUM-745: el `import` y los comentarios mantienen la palabra
`invalidTipoIva` viva en el fichero, así que un guard que comparase por TEXTO seguiría verde. Este
mira **llamadas por AST**. ④ importa porque sin ella *«no hay ningún 100 %»* podría estar midiendo
una hoja VACÍA — un cero sobre población vacía, que no es un cero.

`npm run meta:mutaciones` — **corrido TRES veces sobre el árbol ya mezclado**: **vivas 27 · mudas 0
· ciegas 0** en las tres, idénticas. (Antes del merge, tres pasadas más: 24/0/0, también idénticas.)
**No se ha reproducido la oscilación de SCRUM-754.**

### 🔴 EL LÍMITE DEL CORREDOR, DECLARADO EN VEZ DE DISIMULADO

`meta-guard-mutaciones.mjs` muta el fuente y corre el guard **SIN RECOMPILAR**. Los tests de
comportamiento importan de `dist/`, así que una mutación en el `.ts` **no les llega**. Declararlas
allí habría pintado de «vivo» un guard que nadie ha visto caer.

Por eso las del backend se corrieron **A MANO, recompilando entre pasos** y verificando los bytes
**del fuente Y del compilado**:

| # | mutación | rojos |
|---|---|---|
| **B1** | vuelve el recorte entero (`Math.min(1, Math.max(0, iva))`) | 5 — incluido el que decide |
| **B2** | el rechazo deja de nombrar el valor (texto propio en vez del motivo derivado) | 2 |
| **B3** | la puerta se estrecha a `{0, 10, 21}` y tira el 2 %, el 5 % y el 7,5 % | 5 — **incluido el CONTROL NEGATIVO** |

Las tres restauraron fuente y `dist` con `sha256` idéntico al de partida.

**B1 NO tumbó el control negativo, y es correcto:** con el recorte puesto, un `0.02` sigue saliendo
`0.02`. Que las mutaciones discriminen —que cada una caiga por lo suyo— es la señal de que los
tests miden cosas distintas.

### Y un test le pregunta AL LECTOR OFICIAL si me ve

Por la sospecha de que el meta-guard **ignora en silencio** una declaración con forma propia
(SCRUM-757), un test importa `mutacionesDeclaradas` del script oficial, le pasa este fichero y exige
que vea **las cinco, campo a campo**, y que cada `de` siga existiendo hoy en su fichero. Una
declaración que el corredor no lee es una promesa que no comprueba nadie.

---

## MICROCOPY

**NO APLICA — no hay microcopy nueva, y por eso no hay marcador ni caja medida en navegador.**

El único texto que este ticket produce es el motivo de `invalidTipoIva`, que **ya existe y ya está
aprobado** (SCRUM-217) y que la puerta del presupuesto ya usa. Se DERIVA en vez de escribir uno
nuevo, que es el primer escalón. Y **hoy no llega a ninguna pantalla**: viaja en la respuesta y
nadie lo pinta.

El día que se decida pintarlo (opción **C** de arriba) **sí** entra con marcador `[PENDIENTE]`,
contador y caja medida a 929 y 390 px con texto dentro. El censo de microcopy sin marcar
(`scrum549`) corre dentro de la tanda y sale verde.

---

## HUECOS DECLARADOS

- **No hay medición en navegador real.** Todo lo de pantalla es DOM simulado
  (`_banco-vistas.mjs`). Se declara porque el banco no aplica motor de maquetado: mide **qué valor
  tiene la casilla**, no cómo se ve. Para este ticket el árbitro es el valor, no el píxel — pero
  no se afirma nada visual.
- **El camino real medido llega hasta la casilla del editor, no hasta el PDF firmado.** Que un
  albarán guardado con 100 % lo imprima está INFERIDO de `albTotalesJS` y del total orientativo,
  no observado en un PDF.
- **`Math.max(0, precio)` sigue siendo un recorte**, en la línea de al lado. Un precio negativo se
  aplana a 0 en vez de rechazarse. Es la misma forma de defecto, NO se ha tocado (fuera de
  alcance), y queda escrito aquí para que no se descubra otra vez desde cero.
- **La doble unidad de `tipoIva`** —fracción a un lado del cable (`Quote.lines[].tax` = 0,21),
  porcentaje al otro (`Albaran.lineas[].tipoIva` = 21), con cinco conversores— **no se ha tocado**.
  Está medido que **no hay dinero mal calculado** por ella. Es ticket aparte y no se abrió este
  frente.
- **`invalidTipoIva` es ESPAÑA-only** y la puerta de voz la aplica ahora sin ramificar por país,
  igual que ya hacía `CreateQuoteSchema` (medido: `quotes.routes.ts:81`, sin `country` en
  `schemas.ts`). O sea que un merchant MX/CO/PE/CL vería rechazado su IVA local por la voz — pero
  **ya lo tenía rechazado por la puerta del presupuesto**, así que esto no introduce la asimetría:
  la hereda. El día de F3 hay UN sitio que cambiar, y por eso se derivó.
- **Trabajo ajeno apartado:** el árbol traía cambios sin commitear de SCRUM-586
  (`docs/sql/…`). Están en `git stash` con el mensaje *«SCRUM-586 en curso, apartado por la sesión
  de SCRUM-760»*. **No se han perdido y no viajan en esta rama.**

---

## TANDA

**5.538 tests · 5.450 pass · 0 fail · 88 skipped · estado 0**, sobre el árbol ya mezclado con
`main` (dos merges: SCRUM-608 y SCRUM-761).

Los 88 saltados declaran su motivo y **suman**: 76 `QA_DB_TEST` + 9 `LIBRO_PG_URL` +
1 `BOT_SUITE_TEST` + 1 `A55_DB_TEST` + 1 que no puede crear un enlace a fichero en Windows sin
elevación (ese dice que su mecanismo queda cubierto por el control positivo portable que sí corre).

Línea base en `origin/main` antes de tocar nada: **5.519 · 5.431 pass · 0 fail · 88 skip**.

---

## EL MERGE DE `main`, Y POR QUÉ LA TANDA VA DESPUÉS

`main` se movió **dos veces** con este ticket en vuelo, y las dos trajeron **guards nuevos**
(`scrum608-tipo-de-documento-en-la-cabecera` y `scrum761-sembrador-columnas-derivadas`) más dos
ficheros de infraestructura de tests (`_censo-columnas-derivadas.mjs`, `_huerfanos-declarados.mjs`).
Se mezcló `main` **DENTRO** de la rama —nunca al revés, nunca rebase— y la tanda y el meta-guard se
volvieron a correr **después** de cada merge. Un merge puede traer un guard que te juzgue.
