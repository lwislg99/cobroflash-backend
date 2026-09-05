# SCRUM-750 · LOS DOS CALENDARIOS — un campo, una aritmética

**Medido contra:** `origin/main` = `28b045855d9a68f12906f218bfe78fa5e0472433` · 2026-09-05T02:23:31+01:00

**Origen:** la medición del apéndice de `docs/master/SCRUM-605.md` (5-sep-2026). El ticket nace de
un hallazgo, no de una intención.

---

## 1 · El defecto, en una frase

El campo «Válido hasta» del presupuesto tenía **dos escritores y dos aritméticas**:

* el **valor por defecto** y el **`min`** los ponía `quoteCaducidad.diaPorDefecto` (SCRUM-633), en
  la zona del **MERCHANT**, sumando `N × 86400000` ms;
* los **tres atajos** los ponía `quoteAtajosVencimiento.fechaDeAtajo` (SCRUM-605), con
  `new Date(y, m, d + N)` y componentes **LOCALES** — o sea, en la zona del **NAVEGADOR**.

El profesional pulsaba «30 días» y el campo se quedaba con un día distinto del que ese mismo campo
le había propuesto al abrirse, en un documento que el cliente recibe.

**Cuánto** (17.520 instantes de 2026, merchant `Europe/Madrid`, atajo +30 contra defecto +30):
`Europe/Madrid` 120 · `Europe/London` 730 · `UTC` 1.150 · `America/New_York` 4.324 ·
`Pacific/Auckland` 7.990 (45,6 %). La tabla completa, con el antes/después de SCRUM-633 y los
controles del instrumento, está en el apéndice del 605 y no se repite aquí.

> 🔴 **Ni con el navegador en su sitio cuadraba.** Los 120 de `Europe/Madrid` no son de zona: son
> **sólo** de aritmética —24 h fijas contra días de calendario— y muerden en los dos cambios de
> hora. Medido aislando la causa, no deducido.

---

## 2 · El arreglo: no «que el atajo calcule mejor», sino que **deje de haber dos**

```js
// antes
var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
// ahora
return cal.diaPorDefecto(merchant, dias, hoy instanceof Date ? hoy : undefined);
```

`fechaDeAtajo(dias, merchant, hoy)` **delega**. No queda una segunda aritmética a la que se le
pueda olvidar algo, porque no queda una segunda aritmética.

### El escalón, y por qué aquí SÍ se podía subir

El escalón de la casa es **hacerlo imposible → derivar → duplicar con guard → duplicar con
comentario**. `quoteCaducidad.js` está en el **3** y lo tiene escrito: su sitio único
(`core/zonaDelMerchant.ts`) es TypeScript compilado para Node y esa pantalla es JavaScript de
navegador servido tal cual, sin bundler — derivar era **imposible**, y se declaró así.

🔴 **Aquí no lo era, y ése es el punto del ticket.** `quoteCaducidad` y `quoteAtajosVencimiento`
son dos scripts clásicos sobre el **mismo `window`**, y el índice carga aquél **antes** que éste.
El escalón 2 estaba disponible desde el primer día y no se subió: se escribió una segunda
aritmética al lado de la primera. Eso es la regla 2 de la casa, y es cómo una de las dos se queda
atrás.

### ⚠️ Lo que esto CAMBIA, declarado y no vendido como refactor

`diaPorDefecto` suma milisegundos —24 h fijas— y formatea en la zona del merchant; la forma
anterior sumaba días de calendario. **En la ventana de los dos cambios de hora el atajo escribe
ahora un día distinto del que escribía ayer.** Es el objetivo: que el botón y el valor por defecto
no PUEDAN discrepar. *Cuánto duran «30 días»* es otra pregunta, tiene un solo sitio donde
responderse (`diaPorDefecto`) y este ticket no la responde.

**Las siete fechas límite del 605 —fin de mes, bisiesto, cambio de año, el 29 de febrero— salen
IDÉNTICAS** después de derivar. No es casualidad: en una zona sin cambio de hora, sumar
`N × 86400000` ms equivale a sumar N días de calendario.

### 🛑 Regla 29 · nada emitido se recalcula

Esto toca **el formulario de creación** y nada más: `fechaDeAtajo` sólo se llama desde el manejador
del clic de un chip, que escribe en un `<input>` antes de enviar. **Ningún `validUntil` ya guardado
se vuelve a calcular**, no hay migración, no hay recálculo diferido y no se toca `expire.service`
ni la landing del cliente. Es hacia adelante.

---

## 3 · Ficheros

| fichero | qué |
|---|---|
| `public/dashboard/js/quoteAtajosVencimiento.js` | `fechaDeAtajo` delega; `atajoPorDebajoDelMinimo` recibe el merchant; cabecera reescrita |
| `public/dashboard/js/quotesView.js` | el manejador del clic pasa `currentMerchant` |
| `tests/_sonda-calendarios.mjs` | **nuevo** · la sonda que arranca en otra zona horaria |
| `tests/scrum750-los-dos-calendarios.test.mjs` | **nuevo** · 9 tests + las 4 mutaciones declaradas |
| `tests/scrum605-atajos-vencimiento.test.mjs` | firma nueva + instantes explícitos |
| `tests/scrum633-caducidad-en-la-zona.test.mjs` | el rótulo del aserto, que abarcaba más de lo que medía |
| `docs/master/SCRUM-605.md` | apéndice con la medición de origen |

### Por qué `currentMerchant` SÍ se puede leer en el clic

`quotesView.js:680` avisa de que leer `currentMerchant` **al construir el formulario** revienta la
pantalla («Cannot access before initialization»): la variable se declara 550 líneas más abajo. El
manejador del clic corre mucho después, que es el mismo momento en que ya lo lee
`refrescarCaducidad`. No es una excepción a aquella advertencia: es el otro lado de ella.

---

## 4 · Verificación

### 🔴 El control que decide

Navegador en `Pacific/Auckland`, negocio en `Europe/Madrid`, sobre 2.038 instantes de 2026:

| | +7 | +14 | +30 |
|---|---|---|---|
| **antes** (17.520 instantes) | 7.990 | 7.990 | 7.990 |
| **ahora** | **0** | **0** | **0** |

Y también con el navegador en `Europe/Madrid` (el 99 % de los profesionales, que **tampoco**
cuadraba) y en `America/New_York`: **0 en los tres atajos**.

### ✅ El control positivo: el barrido sabe ponerse rojo

La sonda tiene un modo `mutado` que **reinyecta palabra por palabra** la aritmética local de antes
—el defecto de verdad, no uno inventado— y el barrido lo ve: **1.006 divergencias de 2.038**, y se
comprueba que la diferencia es **exactamente de un día**, que es la avería descrita y no un
desastre cualquiera que también saldría rojo.

### 🔴 El suelo

El barrido **cuenta** los cambios de hora que atraviesa observando el desplazamiento de la zona
instante a instante, y exige **2** — los de 2026 en `Europe/Madrid`. Un barrido que no los
contuviera devolvería cero por no haber mirado. La densidad va concentrada donde el defecto vive
(±3 días alrededor de cada cambio, cada 30 min) más un peine de 6 h sobre el año entero:
**2.038 instantes**, y la sonda tarda 1,9 s en vez de los 14,7 s medidos del barrido plano — un
test de 15 s lo acaba desactivando alguien con prisa.

### 🔴 La prueba de rojo, sobre el fichero DE VERDAD

El control positivo vive dentro de la sonda, y eso no basta. Se inyectó la aritmética vieja en
`public/dashboard/js/quoteAtajosVencimiento.js` y se corrió la tanda:

| | |
|---|---|
| **caen 4** | EL QUE DECIDE · el mismo día en las otras zonas · CONTROL POSITIVO · «DELEGA y no recalcula» |
| **siguen verdes los 15 del 605** | y eso también es un dato: los bordes del 605 se miden en UTC, donde las dos aritméticas coinciden. **El 605 no habría cazado esta regresión**; la caza el 750 |

Restaurado y comprobado con `Buffer.compare(disco, ORIGINAL) === 0` contra los **bytes de disco**,
no contra el blob (SCRUM-570: en un fichero normalizado el blob no sirve de referencia).

### Lo que se comprueba además

* **FAIL-CLOSED**: sin `quoteCaducidad` en el `window`, `fechaDeAtajo` devuelve `null` y no calcula
  por su cuenta — con su control al revés, porque un `null` constante pasaría igual.
* **La firma vieja `(dias, hoy)` devuelve `null`**: un `Date` en el hueco del merchant daría una
  fecha **plausible** calculada en UTC. Se prefiere no escribir nada.
* **La derivación no puede deshacerse**: el **cuerpo** de `fechaDeAtajo` —no el fichero, que cita
  la aritmética vieja en la cabecera para explicar por qué se fue— tiene que contener
  `diaPorDefecto` y no puede contener `getFullYear`, `getMonth`, `getDate` ni `86400000`.
* **El orden de carga del índice**, que es el eslabón que de verdad se pierde.

### MUTACIONES_QUE_ME_TUMBAN — en el contrato de SCRUM-745, y EJECUTADAS

🔴 **La primera versión de esta declaración era INVISIBLE.** Se escribió con forma propia
(`{ que, cae, comprobada }`) y un test propio que la validaba. El contrato de SCRUM-745 pide
`export const` con `{ fichero, de, a, cae }` y lo lee por AST: una declaración con otra forma no
da error — simplemente **no se ejecuta**. Es la misma avería que el marcador `[copy: fundador]`
del 605, que el censo no contaba porque buscaba `[PENDIENTE`. Se derivó del instrumento que ya
existía en vez de inventar una segunda forma.

Salida de `npm run meta:mutaciones` el 5-sep-2026 — **vivas 10 · mudas 0 · ciegas 0**:

| mutación | fichero | qué cae |
|---|---|---|
| reinyectar la aritmética local de antes del 750 | `quoteAtajosVencimiento.js` | ✔ EL QUE DECIDE |
| quitar `currentMerchant` de la llamada de la vista | `quotesView.js` | ✔ la VISTA le pasa el merchant |
| que el fail-closed devuelva una fecha en vez de `null` | `quoteAtajosVencimiento.js` | ✔ FAIL-CLOSED |
| una lectura de componentes del dispositivo que NO cambia el comportamiento | `quoteAtajosVencimiento.js` | ✔ DELEGA y no recalcula |

La cuarta es la que justifica el guard estructural: es **código muerto**, ninguna prueba de
comportamiento la ve, y reabre la puerta por la que se entró.

> ⚠️ **Lo que NO declaro, y por qué:** no hay mutación que tumbe el aserto de los dos cambios de
> hora (`cambiosDeHora === 2`). Lo garantizan DOS partes independientes del barrido —el peine de
> 6 h del año y las dos ventanas densas—, así que cualquier mutación que se lo cargue tumba antes
> el aserto del número de muestras. Declarar una que no cae sería peor que no declararla.

---

## 5 · Los huecos que declaro

1. **Nadie ha pulsado los tres botones en un navegador real.** Sigue siendo el hueco nº 1 del 605.
   Lo que se prueba aquí es la función y la forma del pintado.
2. **El hueco de ③ de SCRUM-633 SIGUE ABIERTO y no se ha tocado**: el instante `23:59:59` que se
   guarda se construye en la zona del dispositivo. Su test lo fija y sigue en verde. Este ticket
   arregla ① (lo que el profesional ve y elige), no ③ (lo que se persiste).
3. **El barrido usa `Europe/Madrid` como zona del negocio.** No se ha medido con un merchant en
   Canarias ni fuera de España.
4. **No se ha medido el efecto en presupuestos ya guardados**, porque no lo hay por construcción
   (§2), pero no se ha ejercitado contra base.
5. **`atajoPorDebajoDelMinimo` sigue sin llamarlo nadie** — hueco heredado del 605. Aquí sólo se le
   ha pasado el merchant para que no quede con la firma vieja.
