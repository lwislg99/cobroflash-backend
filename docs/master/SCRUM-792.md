# SCRUM-792 · CONT-09 — La barra de selección, alcanzable en móvil

**Fecha:** 6-sep-2026 · **Carril:** producto / accesibilidad · **Rama:** `scrum-792-barra-alcanzable-en-movil`
**Medido contra:** `origin/main` = `ff4e1c4a14f474d0fb4095cb0643e069388e4935` · 2026-09-06T12:36Z
**Worktree:** `cobroflash-backend` · **Tanda:** 5680 · 5588 pass · **0 fail** · 92 skip (5588+92 = 5680, cuadra)

> 🖋️ **FIRMADO POR EL ASESOR, Y SIN LITERAL NUEVO.** A ≤640 px la barra se muestra siempre, también
> con cero. Con cero dice **«Seleccionar todos»** — el literal que **ya existe y ya está aprobado**
> (`FC.TEXTOS_SELECCION.todos`, hoy el `aria-label` de esa misma casilla). Desde uno, el contador lo
> sustituye. **En escritorio no cambia nada.**

> ⚠️ **Esta rama va SOBRE `scrum-783`**, que sigue pendiente de merge y toca los mismos ficheros.
> Se apila para no dejar un conflicto: **merge 783 primero**.

---

## 1 · EL ROJO, EN NAVEGADOR, ANTES DE TOCAR NADA

```
── 390 px · CERO seleccionados ──
   thead visible: false · barra visible: false · texto: "0 clientes seleccionados"
   vía CABECERA <th> OCULTA
   vía BARRA <div>   OCULTA
   → vías de «seleccionar todo» ALCANZABLES: 0   🔴 NINGUNA
── 390 px · UNO seleccionado ──
   vía BARRA <div>   VISIBLE · área de toque 50.4 px  ✅ AB6   → ALCANZABLES: 1
── 929 px · CERO ──  cabecera VISIBLE 45 px · barra OCULTA     → ALCANZABLES: 1
── 929 px · UNO  ──  cabecera 45 px · barra 51 px              → ALCANZABLES: 2
```

**Cero vías a 390 con cero seleccionados.** Y es el peor sitio posible para el defecto, porque **la
barra se escribió exactamente para esto** — lo dice su propio comentario: *«en el móvil la casilla
de seleccionar todos DESAPARECE. Sin esta barra, un profesional en el móvil sólo podría marcar de
una en una: justo el que más lo necesita.»* Existía para resolverlo y no lo resolvía porque nacía
escondida.

### El verde, con el mismo instrumento

```
── 390 px · CERO ──  thead false · barra VISIBLE · texto "Seleccionar todos"
                     vía BARRA 50.4 px ✅ AB6   → ALCANZABLES: 1        ← ERA 0
── 390 px · UNO  ──  vía BARRA 50.4 px ✅        → ALCANZABLES: 1        ← igual
── 929 px · CERO ──  cabecera 45 px · barra OCULTA → ALCANZABLES: 1     ← IGUAL QUE ANTES
── 929 px · UNO  ──  cabecera 45 px · barra 51 px  → ALCANZABLES: 2     ← IGUAL QUE ANTES
```

✅ **El positivo se cumple: en escritorio no se movió nada.** Y **AB6 medido, no supuesto**: la
casilla cambia de contexto de maquetado al hacerse visible con cero, y sigue en **50,4 px** de área
de toque —por `elementsFromPoint`, no por caja.

---

## 2 · CÓMO, Y POR QUÉ EL UMBRAL NO SE REPITE

**El `display` de la barra sale del JS y se va al CSS.** No es cosmética: la decisión depende del
**ancho**, y un ancho sólo se pregunta desde una `@media`. Un `style.display` en línea gana a
cualquier regla, así que mientras viviera en el JS la barra no podía comportarse distinto en móvil.

```css
/* fuera de toda @media — escritorio, como siempre */
.barra-seleccion { display: flex; }
.barra-seleccion.barra-seleccion--vacia { display: none; }

@media (max-width: 640px) {
  .table--stack-mobile thead { display: none; }     /* la que ESCONDE la cabecera */
  …
  .barra-seleccion.barra-seleccion--vacia { display: flex; }   /* la que ABRE la barra */
}
```

🔴 **LAS DOS REGLAS COMPARTEN BLOQUE, Y ESO ES MEDIO TICKET.** Un `@media` no admite variables ni
custom properties, así que **la co-locación es la derivación más fuerte que existe en CSS plano**:
si el umbral cambia, cambia para las dos a la vez. Repetirlo en dos bloques es la regla 2 esperando
a morder — el día que uno se moviera, en el móvil volverían a ocultarse las dos vías y no lo cazaría
nada.

**Hay un test que CAE si alguien las separa**, y su mutación lo demuestra: sacar la regla a un
`@media` propio **con el mismo número** no cambia el comportamiento de hoy, así que sólo la
co-locación lo detecta.

**Y una clase, no un `data-`:** la verdad sigue siendo `seleccion` (SCRUM-783). La clase es su
reflejo, se reescribe en cada refresco y **no se lee nunca** — hay un test que lo exige, porque la
diferencia entre reflejo y almacén es exactamente **quién pregunta**.

---

## 3 · EL TEXTO CON CERO: DERIVACIÓN, NO INVENCIÓN

`FC.TEXTOS_SELECCION.todos` ya existe y ya está aprobado: es el `aria-label` de esa misma casilla.
Hacerlo **visible** es derivar. «0 clientes seleccionados» sería una frase que **hoy no ve nadie**
—con cero la barra no se abre en escritorio, y en móvil no se abría en absoluto— y que en el móvil
ocuparía el sitio del control que hay que pulsar.

Un test comprueba el camino de **ida y vuelta**: de cero a uno manda el contador; al soltar el
último **reaparece el literal**. Sin la vuelta, el cambio podría ser de una sola dirección y la
barra se quedaría sin rótulo para siempre.

---

## 4 · LOS CONTROLES

`tests/scrum792-barra-alcanzable-en-movil.test.mjs` — **6 tests, 6 verdes** (`grep -c '^test('`).

| control | qué exige |
|---|---|
| 🔴 el umbral | las dos reglas en el **mismo** `@media`, con suelo y control positivo del lector |
| 🔴 el `display` | no vuelve al JS en línea (con hermano del token) |
| 🔴 con cero | clase `--vacia` + literal ya aprobado |
| ✅ desde uno | manda el contador, y **al volver a cero reaparece el literal** |
| 🔴 la clase | se escribe en **un** sitio y **nunca** se lee |
| ✅ escritorio | la regla base sigue cerrando la barra vacía fuera de toda `@media` |

**`meta:mutaciones` (corredor oficial): `vivas 79 · mudas 0 · ciegas 0`**, con las dos mías dentro.
Y el rebote: los **7** de SCRUM-783 siguen verdes, incluido el que **cuenta** que el contador no
miente. `guard:objetivo-tactil` (landing + panel), verde.

---

## 5 · 🔴 TRES VECES ME MINTIÓ MI PROPIO INSTRUMENTO, Y LAS TRES SE ESCRIBEN

**① El `classList` del banco era un no-op.** `{ add(){}, remove(){}, toggle(){}, contains: () => false }`:
cuatro llamadas que no hacían nada y un `contains` que **decía que no siempre**. El marcado
serializado salía sin la clase, así que mi primera medición dio **«929/cero → barra VISIBLE»** y yo
estuve a punto de tocar el CSS para arreglar un defecto que no existía. Es el mismo hueco que
`prepend` (460), `parentNode` (609), `insertAdjacentHTML` (698) e `insertAdjacentElement` (760):
**se corrige en el banco, no se rodea desde el test.** Ahora `classList` es real, respeta el
segundo argumento de `toggle` —sin él, `toggle(x, false)` AÑADIRÍA la clase— y se apoya en
`className`, que es de donde lee el resto del banco. **Nada más de la suite se movió**: los únicos
dos rojos fueron los dos tests míos que aún miraban `style.display`.

**② Mi lector de CSS se tropezó con mi propio comentario.** El comentario que explica la regla
**cita** el texto `@media (max-width: 640px)`; el lector lo encontró **dentro del comentario**,
empezó a contar llaves ahí y se comió el resto de la hoja. El test salió **rojo sobre un CSS
correcto**, y encima acusando al sitio equivocado («falta la regla base»). Es el clásico: **un guard
de texto se caza a sí mismo en el comentario que explica lo que vigila.** Se quitan los comentarios
antes de leer, una vez, para los dos lectores.

**③ Y una expresión regular que no aguantaba el anidamiento** para quitar los `@media`. Sustituida
por el mismo lector por conteo de llaves que ya existía: dos formas de leer lo mismo es la regla 2
otra vez.

---

## 6 · Y una cifra mía que estaba mal

La entrada de **SCRUM-783** decía «**8** tests» y son **7**. La conté a ojo. Corregida allí con el
`grep -c` delante, y anotado que dos de sus aserciones cambiaron aquí (miraban `style.display`, que
ya no existe; ahora miran la clase).

---

## 7 · Lo que este PR toca, y lo que no

| fichero | qué |
|---|---|
| `public/dashboard/css/styles.css` | reglas base + la del móvil, **dentro** del bloque del `thead` |
| `public/dashboard/js/customersView.js` | clase en vez de `display` en línea; literal aprobado con cero |
| `tests/_banco-vistas.mjs` | `classList` de verdad (add/remove/toggle/contains) |
| `scripts/_pagina-panel.mjs` | opción `seleccionar:false` (el defecto no cambia) |
| `tests/scrum792-…test.mjs` | **nuevo** · 6 controles, 2 mutaciones |
| `tests/scrum783-…test.mjs` | 2 aserciones pasan de `style.display` a la clase |
| `docs/master/SCRUM-783.md` | corrección del recuento |

⛔ **No se tocó:** ningún literal nuevo · el comportamiento en escritorio · el mecanismo de
selección ni su persistencia · ninguna acción en bloque · `.btn-sm` ni `EXCEPCIONES_PANEL` ·
`productsView`, `providersView`, `quotesView` ni `jobDetailView`.

---

## 8 · Huecos declarados

1. **La visibilidad real no la juzga la suite**: el banco no evalúa CSS. Los cuatro casos están
   medidos en navegador y pegados en §1, pero **no hay guard permanente** que los repita. Lo que sí
   queda protegido en la suite es el umbral único y el contrato del JS.
2. **Sólo la lista de Clientes.** Otras tablas `table--stack-mobile` (Proveedores, Plantillas,
   Equipo) no tienen barra de selección, así que no aplica — pero si mañana alguna la estrena, este
   arreglo no se le aplica solo.
3. **Sin verificar en yaqu.app** y sin capturas.
4. **`classList` real puede cambiar lo que miden otros bancos en el futuro**: hoy no movió nada
   (tanda completa verde), pero ahora las clases que las vistas añaden por `classList` **sí** llegan
   al `className`. Es más fiel, y por eso puede destapar cosas que antes no se veían.
