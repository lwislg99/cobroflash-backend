# SCRUM-782 · El objetivo táctil del PANEL, y el guard que no miraba donde decía

**Fecha:** 6-sep-2026 · **Carril:** UI / accesibilidad · **Rama:** `scrum-782-objetivo-tactil-del-panel`
**Medido contra:** `origin/main` = `16bd95731883a6c84ceb57820a493c8fe1500f6d` · 2026-09-06T10:40Z
**Worktree:** `cobroflash-backend` · **Tanda:** 5602 tests · 5514 pass · **0 fail** · 88 skip

---

## 1 · 🔴 EL ROJO, Y ERA PEOR DE LO QUE YO MISMA HABÍA DICHO

Medido con `elementsFromPoint` —el árbitro de `_medidor-de-toque.mjs`, no la caja CSS— sobre la
lista de Clientes montada por el producto:

```
══════ 929 px ══════
  Seleccionar todos      CABECERA <th>  caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
  Administración de F…   FILA <td>      caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
  Carmen Ruiz            FILA <td>      caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
  Comunidad de Propie…   FILA <td>      caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
  Seleccionar todos      BARRA <div>    caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
  SONDA (botón de 12 px, respuesta conocida): tocable 13 → la caza ✅
══════ 390 px ══════
  Seleccionar todos      [OCULTA — no medible]        (a ≤640 px `thead{display:none}`)
  …las tres FILA <td>    caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
  Seleccionar todos      BARRA <div>    caja 18  tocable 19  → 🔴 25.0 px POR DEBAJO
```

### ⚠️ CORRIJO UN DATO MÍO DE SCRUM-582: la barra NO cumplía

En 582 escribí «la BARRA 44,3 / 67,5 ✅ cumple». **Es falso, y el error era de método**: medí la
caja del `<div>` que la contiene, no lo que responde al dedo. Por área de toque la barra daba
**19 px**, igual que las otras cuatro. **Los tres fallos eran cinco.** Es la lección de SCRUM-542
mordiendo otra vez: *la caja miente hacia el lado cómodo*.

---

## 2 · LA TÉCNICA SE ELIGIÓ MIDIENDO, NO RAZONANDO

Cuatro candidatos, mismo árbitro, misma página:

| candidato | casilla a la vista | área de toque |
|---|---|---|
| como está hoy | 18×18 | 19 px |
| `border: 13px solid transparent` | 18×18 | **19 px** |
| `padding: 13px` | 18×18 | **19 px** |
| `outline: 13px solid transparent` | 18×18 | **19 px** |
| `<label>` de 44 px alrededor | 18×18 | **19 px** ← el área pasa a pertenecer AL LABEL |
| **pseudo-elemento `::before` con `inset`** | **18×18** | **45 px** ✅ |

El `input` nativo no cuenta borde, padding ni outline para el hit-test. El pseudo sí — y es la
técnica que la landing ya usa en `.announce a::after` (SCRUM-543), así que no estrena patrón.

**Y el valor sale de medir, no de la aritmética.** `18 + 13·2 = 44` es la cuenta, pero con
`inset:-13px` las FILAS daban 45 y la CABECERA **42**: el `th` es más bajo (43,3 px) y el área no
se expande igual. Probados los cuatro:

```
-13 → cabecera 42   ·   -14 → 43   ·   -15 → 44,0   ·   -16 → 45
```

Se toma **-16px**. Con -15 la cabecera queda clavada en 44,0 y el medidor **afina el borde por
bisección** (SCRUM-542): un objetivo justo en el límite se lee 43,9 en la pasada siguiente y el
guard caería por redondeo, no por un defecto.

---

## 3 · EL VERDE, Y EL CONTROL POSITIVO QUE IMPORTA

```
══════ 929 px ══════                        ══════ 390 px ══════
  Seleccionar todos  <th>   tocable 45        Seleccionar todos  [OCULTA]
  las tres FILA      <td>   tocable 51        las tres FILA <td> tocable 51
  Seleccionar todos  <div>  tocable 51        Seleccionar todos  <div> tocable 50.4
```

**Control de regresión** — todos los interactivos de la pantalla, antes y después, mismo fichero
CSS servido con y sin la regla (no dos estados de git):

```
══ 929 px · elementos medidos: antes 14 · después 14
══ 390 px · elementos medidos: antes 14 · después 14
RESUMEN · mejoran 8 · igual 18 · EMPEORAN 0
nuevos incumplimientos creados por el arreglo: NINGUNO
```

> ⚠️ El encargo proponía como control positivo «la barra, que YA cumple, sigue cumpliendo». Esa
> premisa se cayó al medirla (§1), así que el control se cambió por el que sí vale: **ninguno de
> los 26 objetivos medidos baja**, y el conjunto medido es el mismo antes y después.

---

## 4 · 🔴 EL GUARD YA NO MIDE UNA PÁGINA Y LLAMARSE COMO SI MIDIERA TODO

`guard:objetivo-tactil` hacía `goto('/')`. Medía la landing. Y **la ceguera era DOBLE**:
`INTERACTIVOS` tampoco incluía `input[type="checkbox"]`, así que de las **11 casillas de la página,
veía 0**. Visitar el panel sin arreglar el selector habría dado «✅ todo cumple» sin mirar el
control del que va el ticket — peor que antes, porque parecería cubierto.

### La decisión: CUBRIR, no renombrar — y se eligió midiendo

| | coste medido |
|---|---|
| **renombrar** a `-landing` | **33 referencias en 17 ficheros**, tres de ellas tests que fijan la cadena exacta (`scrum522` la lleva en una lista; `scrum542` exige que `"guard:objetivo-tactil"` aparezca UNA vez en `package.json`). Diff mayor y más arriesgado… **y el panel se quedaría igual de descubierto** |
| **cubrir** | una superficie más en el mismo guard; el nombre pasa a ser verdadero |

**Cómo:** se añade el panel como **segunda superficie**, de forma **aditiva** — el bucle de la
landing no se toca. La página se monta con el banco de vistas y se **serializa**
(`scripts/_pagina-panel.mjs`): el marcado lo produce `renderCustomersView`, no una tabla escrita a
mano. `scripts/` importando de `tests/` ya tenía tres precedentes.

**Anchos del panel: 929 y 390**, no los 1280/360 de la landing — son los que este defecto se midió.

### El coste en el censo de guards de navegador

```
ANTES    guard:objetivo-tactil  2.8 s   ·  páginas: /index.html
DESPUÉS  guard:objetivo-tactil  3.9 s   ·  páginas: /index.html /__panel
         11 guards de navegador, antes y después
```

**+1,1 s en el guard.** Siguen siendo **once**: se añadió cobertura, no un guard nuevo. El censo
detecta la página nueva solo, porque deriva las rutas del fuente.

> ⚠️ El TOTAL salió 57,2 s → 55,8 s. **No lo leo como una bajada**: SCRUM-548 tiene medido que el
> total varía un 8 % entre dos pasadas en la misma máquina. El número que sí significa algo es el
> del guard.

### ✅ EL CONTROL QUE PRUEBA QUE VE

Con un botón de 10 px inyectado en el panel:

```
   ✖ 11px   < 44 · [(suelto)] BUTTON «x» (caja CSS 10px)     ← 929 px
   ✖ 11.4px < 44 · [(suelto)] BUTTON «x» (caja CSS 10px)     ← 390 px
   🔴 2 problema(s)          (salida 1)
```

Lo caza en las dos anchuras. La sonda se retiró y el fichero se verificó **byte a byte**.

### Y un SUELO propio, que es el que faltaba

El panel exige que **las casillas estén entre lo medido** (5 a 929, 4 a 390 — a 390 la de cabecera
va oculta). Si un día vuelven a salir del censo, el guard lo dice en vez de dar verde.

---

## 5 · 🔴 EL GUARD, EN CUANTO MIRÓ, ENCONTRÓ TRECE DEFECTOS QUE NADIE HABÍA VISTO

Primera vez que algo mide esta pantalla, y salen **13 objetivos cortos** que no son de este ticket:

```
  ✖ 31px   · BUTTON.btn-secondary.btn-sm «⬆ Importar CSV»   (caja CSS 30px)
  ✖ 31px   · BUTTON.btn-primary.btn-sm   «Nuevo»
  ✖ 30.9px · BUTTON.btn-secondary.btn-sm «Editar» ×3 · «Portal» ×3
  ✖ 30.9px · BUTTON.btn-ghost.btn-sm     «📊 Historial» ×3
```

**No se absorben callando ni se arreglan aquí**, y las dos mitades tienen motivo: `.btn-sm` es una
clase compartida por toda la aplicación, así que subirla cambia pantallas que este ticket no ha
medido — es decisión de producto; y dejarlas sin declarar pondría el guard rojo por algo ajeno, que
es como muere un guard (alguien lo apaga).

Van a **`EXCEPCIONES_PANEL`**, **acotadas al panel a propósito**: en la lista compartida excusarían
cualquier `.btn-sm` corto que apareciera mañana en la landing, y eso sí sería bajar el umbral. Cada
una se **imprime** con su medida —una deuda que no se ve deja de existir— y **quien la retira es el
fundador**, decidiendo qué hacer con `.btn-sm`.

Y un guard sobre el guard: **si una excepción deja de hacer falta, el guard cae** y pide borrarla.
Ese detector saltó en falso en su primera versión (comprobaba por anchura, y `.btn-ghost.btn-sm`
cumple a 390 y no a 929); ahora comprueba **sobre las dos**.

---

## 6 · DÓNDE VA EL EXCESO DE LA TABLA — hueco de SCRUM-582, cerrado

```
══════ 929 px ══════
  suma de columnas: 945.8 px · ancho de la <table>: 945.8 px · la PÁGINA no desborda
     TABLE.table.table--stack-mobile   ancho 945.8 · client 946 · scroll 946 · overflow-x:visible
     DIV.table-scroll                  ancho   879 · client 879 · scroll 946 · overflow-x:auto   🔴 AQUÍ (67 px)
     DIV.data-card                     ancho   881 · client 879 · scroll 879 · overflow-x:hidden
     DIV.view-container                ancho   929 · client 929 · scroll 929
     BODY                              ancho   929 · client 929 · scroll 929 · overflow-x:clip
══════ 390 px ══════  la tabla mide 364 px y NADIE desborda (apila: `table--stack-mobile`)
```

**Se lo come `DIV.table-scroll` con `overflow-x:auto`**: la tabla scrollea horizontalmente DENTRO
de su tarjeta.

### ⚠️ Y corrijo otro número mío: no son 16,8 px, son **67**

En 582 resté contra `.view-container` (929 px). El contenedor real de la tabla es `.table-scroll`,
que mide **879 px** porque la tarjeta tiene padding. **Sin** la columna de selección el exceso ya
era **899,8 − 879 = 20,8 px**; **con** ella es **945,8 − 879 = 66,8 ≈ 67 px**. O sea: la casilla
**no creó** el scroll horizontal, lo **triplicó**. Se reporta; arreglarlo es otra decisión.

---

## 7 · Lo que este PR toca, y lo que no

| fichero | qué |
|---|---|
| `public/dashboard/css/styles.css` | la regla `.casilla-seleccion::before` con `inset:-16px` |
| `public/dashboard/js/customersView.js` | UNA línea: la clase, en la función que ya se declaraba responsable de AB6 |
| `scripts/_medidor-de-toque.mjs` | `input[type="checkbox"]` entra en `INTERACTIVOS` |
| `scripts/guard-objetivo-tactil.mjs` | la segunda superficie, su suelo y sus excepciones |
| `scripts/_pagina-panel.mjs` | **nuevo** · monta y serializa la vista para los guards |
| `package.json` | la nota del guard declara su alcance nuevo |

⛔ **No se tocó**: ningún literal · el mecanismo de selección · la pérdida de selección al remontar
· la búsqueda · ninguna acción en bloque · ninguna dependencia.

**La landing no se mueve:** 35 interactivos en el DOM, 29 medidos a 1280 y 25 a 360, **0 cortos**,
antes y después de ampliar `INTERACTIVOS` — y está medido que la landing tiene **cero casillas**,
así que su población no podía cambiar.

---

## 8 · Dos guards de la casa me cazaron a mí, y tenían razón

1. **SCRUM-262** · mis clientes de muestra llevaban teléfonos con pinta real. El rango imposible es
   `34 0XX XXX XXX` (ningún abonado español empieza por 0). Corregido.
2. **SCRUM-548** · escribí «2,8 s → 3,9 s; siguen siendo 11 guards» en un `//comentario` de
   `package.json`, que es justo la cifra que caduca con el commit de otro. Fuera; el comentario
   remite al comando. **Los números viven en esta entrada, que sí lleva fecha.**

---

## 9 · Huecos declarados

1. **Los 13 `.btn-sm` NO se arreglan**: excepción declarada, la retira el fundador.
2. **El scroll horizontal de 67 px** se mide y se reporta; no se corrige.
3. **La página del panel es marcado SERIALIZADO, no la app viva**: sirve para GEOMETRÍA, que es
   lo que mide este guard, y **no** para comportamiento. Escrito en el propio módulo.
4. **Sólo se cubre la lista de Clientes.** El resto del panel sigue sin medir — pero ahora el
   mecanismo existe y añadir una superficie es añadir una entrada.
5. **Sin verificar en yaqu.app** y sin capturas.
