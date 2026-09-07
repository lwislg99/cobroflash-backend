# SCRUM-755 · El contador que cuadró solo, y el trinquete que no lo miraba

**Fecha:** 7-sep-2026 · **Carril:** microcopy · instrumentos · **Gate:** sin gate
**Medido contra:** `origin/main` = `6fb51ab77713af1261dcf2e3f7819545c57c35b6` · 2026-09-07T02:40:00+01:00
**Tanda:** 5789 tests, 5687 pass, 0 fail, 102 skipped · `EXIT_REAL=0` (fichero y $? aparte, nunca al final de una tubería) · tras mezclar main

> **Obligación 0 · NO estaba hecho.** Comprobado antes de empezar: `INV_SIN_APROBAR` sigue en
> `main` sin que ningún test lo mire, no existe `docs/master/SCRUM-755.md`, y de las **536** ramas
> remotas ninguna es este ticket (las dos que llevan «contador» en el nombre son de plazas y de
> modo offline). Ninguna rama mergeada con cero commits vivos lo trae.

---

## La respuesta, en dos líneas

**No se puede derivar** —y está medido, no razonado—, así que se construye lo de la obligación 2.
Y por el camino se cae una premisa: **hay un trinquete que ya vigila los marcadores** (SCRUM-402
R4). Lo que no vigila, y ahí estaba la grieta, es el marcador puesto **a través de su constante**,
que es exactamente la forma que tiene el fichero del incidente.

---

## Obligación 1 · ¿se puede derivar? NO, y por dos motivos medidos

### ① El contador y el árbol cuentan UNIDADES DISTINTAS

| fichero | sitios que pintan marcador | lo que dice su contador |
|---|---|---|
| `quotesView.js` | 3 (líneas 890, 1363, 1398) | `FORMA_DE_PAGO_SIN_APROBAR = 1` |
| `productsView.js` | 3 | `PV_SIN_APROBAR = 2` |
| `invoicesView.js` | 1 | `INV_SIN_APROBAR = 1` |

Y los dos primeros **tienen razón**: el mismo rótulo pendiente se pinta en tres sitios, pero es
**una ranura**. Derivar el contador de los sitios daría otro número y rompería lo que hoy está
bien. Es la misma familia que midió SCRUM-714: instrumentos contando microcopy en unidades
distintas.

### ② Hay ranuras pendientes SIN marcador en pantalla

`filtroClientes.js` declara **7** pendientes y no pinta **ninguno**; `jobDetailView.js`, **2** y
ninguno. Eso es una decisión de cada ticket y **no deja rastro en el árbol**: no hay nada que leer.

**Conclusión:** el contador se queda. Lo que se construye es que estrenar una ranura sin decirlo
ponga algo en rojo.

---

## Obligación 3 · el censo, y lo que enseñó

Nueve contadores `*_SIN_APROBAR`, encontrados **por su forma** y no enumerados (AST sobre los
ficheros del panel). La pregunta del encargo no era cuántos hay, sino cuántos pueden
desincronizarse en silencio:

- **6 de 9 no los mira ningún test.** (De los 3 restantes, los tres se llaman `SIN_APROBAR` a
  secas y mi detector los da por «mirados» porque un test nombra ese identificador — **límite
  declarado**: no distingue cuál de los tres sujeta cada aserción.)
- Y el hallazgo más grande, que no buscaba: **15 ficheros del panel pintan el marcador y 10 de
  ellos no declaran contador ninguno.** No es que su contador esté mal: es que no hay contador.

No se les inventa uno: cuántas RANURAS son es un juicio humano —una ranura puede pintarse en tres
sitios— y eso no lo decide quien programa. Lo que sí se puede es **impedir que la lista crezca**.

---

## La premisa del encargo, corregida a medias

El encargo decía «hoy no pone nada en rojo». **Con una ranura escrita como LITERAL, sí pone**:
salta el trinquete de SCRUM-402 R4, que censa marcadores por fichero. Lo descubrí porque mi primer
control inyectó un literal y R4 se me puso rojo.

Pero eso no era reproducir el incidente. `invoicesView.js` **no escribe el literal**: referencia
`INV_MARCADOR_MICROCOPY`, y el único literal del fichero es la **declaración** de esa constante —
que no se mueve por añadirle usos. R4 lo dice de sí mismo, por escrito: *«este censo —que cuenta
LITERALES por AST— no lo ve, y con razón»*.

**Reproducido con la forma real —un uso más de la constante, contador quieto— R4 se queda VERDE.**
La premisa se sostiene donde importa.

---

## 🔴 EL CONTROL QUE DECIDE, los dos sentidos pegados

Tres inyecciones distintas en `invoicesView.js`, cada una con su guard al lado:

```
[sin tocar]                              601: verde · 402: verde · el mío: verde
(a) una LINEA INOCUA: un comentario      601: ROJO  · 402: verde · el mío: verde
(b) un const cualquiera SIN marcador     601: ROJO  · 402: verde · el mío: verde
(c) un USO del marcador (la ranura)      601: ROJO  · 402: verde · el mío: ROJO
```

- **El mío sólo se enciende con (c)**, la ranura. Con un comentario y con un `const` cualquiera se
  queda verde: no marca todo lo que se mueve.
- **SCRUM-402 no ve ninguna de las tres**, incluida la ranura de verdad. Es la grieta.
- **SCRUM-601 se enciende con las tres, hasta con un comentario** — y eso es otro defecto, mío,
  registrado abajo.

Y la suite entera, con la ranura dentro y **sin** mi guard: ningún test la nombra.

---

## Lo construido

- **`tests/_ranuras-con-marcador.mjs`** — el lector. Deriva del árbol los sitios que pintan el
  marcador, por las DOS vías que usa la casa (literal y constante), con su línea para poder
  nombrarlos.
- **`tests/scrum755-el-contador-que-cuadro-solo.test.mjs`** — 6 tests: el censo congelado por
  fichero (patrón del ratchet de SCRUM-243), el trinquete de los huérfanos, el suelo del lector,
  el límite declarado y el lector oficial del meta-guard.

**Qué cubre:** cualquier ranura nueva que pinte el marcador, por literal **o por constante**, en
cualquier fichero del panel — también en los que no cuentan nada.
**Qué NO cubre, dicho en el propio fichero:** una ranura pendiente que nazca **sin** marcador. Eso
no deja rastro mecánico, y decir lo contrario sería vender cobertura que no existe.

---

## Controles

**✅ POSITIVO:** con el árbol tal como está, verde — y los seis tests corren en `npm test` sin BD
ni servidor.

**✅ MUTACIONES_QUE_ME_TUMBAN, declaradas y COMPROBADAS una a una:**

```
declaradas: 2
[sin tocar] mi guard: VERDE ✅
   ✅ ME TUMBA · public/dashboard/js/invoicesView.js   (uso de la CONSTANTE)
        SCRUM-402 con esta misma mutación: VERDE (no la ve)   ← la grieta
   ✅ ME TUMBA · public/dashboard/js/homeView.js       (literal en un fichero nuevo)
        SCRUM-402 con esta misma mutación: ROJO (también la ve)  ← solape, declarado
[al final] mi guard: VERDE ✅
```

Las dos restauradas byte a byte. El campo `a` de cada una va como literal único, sin concatenar,
y el sexto test comprueba que **el meta-guard de la casa las VE**: una declaración con forma propia
sale invisible y pasaría por cobertura sin serlo.

---

## Dos veces me equivoqué de pregunta, otra vez

Las dos las cazó el mismo tell —un número que no encajaba con lo que decía medir— y las dos van
escritas porque el método es lo que se está construyendo:

1. **El lector contaba mal, en las dos direcciones a la vez.** `.includes()` daba **1** para un
   literal con dos marcadores dentro (contestaba «¿hay?» a la pregunta «¿cuántos?»), y contaba como
   ranura la **declaración** de las constantes cuyo nombre no seguía el patrón de la casa
   —`MARCADOR`, `PENDIENTE_MODO_EMISION`—. Se arregló contando ocurrencias y detectando las
   constantes **por su valor**, nunca por su nombre.
2. **Un control mío comparó dos unidades distintas** y concluyó «la declaración se está contando»
   cuando los sitios ni siquiera caían en su línea. La pregunta directa —¿algún sitio cae en la
   línea de la declaración?— dice que no.

Y una tercera, de manual: un arnés lanzó `tests/scrum601-el-documento-y-el-flag.test.mjs`, que **no
existe**. El runner devolvió «rojo» con **cero fallos**, y esa incoherencia —rojo sin un solo
fallo— fue lo que lo delató. Con el nombre bueno, la línea base sale limpia.

---

## Lo que este ticket destapa y NO arregla

- **`P1-GUARD-601-LINEA`** en `docs/BUGS.md`: SCRUM-601 se pone rojo si alguien inserta **una línea
  cualquiera** en `invoicesView.js`, porque ancla a la línea 223 a pelo, y encima con un mensaje
  que suena a defecto de producto. Es un guard **mío** y es el antipatrón que yo mismo cité en dos
  censos. No se arregla aquí: este ticket va de contadores.
- **Los 10 ficheros huérfanos** quedan bajo trinquete —la lista no puede crecer— pero sin contador
  propio. Ponerles uno exige decidir cuántas ranuras son, y eso es del fundador.
- **SCRUM-737 me cazó** al escribir esto: dos cifras de recuento sin ancla en mis comentarios.
  Aplicada la jerarquía de la casa (② reformular), no «actualizadas».

## Prohibiciones del encargo, respetadas

- **No se ha «corregido» ningún contador a mano.** Ninguno cambia de valor en este ticket.
- **No se ha tocado ninguna firma ni ningún texto aprobado**, ni los marcadores fiscales aparcados.
- **Ni una línea de `src/` ni de `public/`**: sólo `tests/` y `docs/`. Por eso no hay superficie
  pública nueva que declarar ante SCRUM-98 ni SCRUM-243.
- **Nada en paralelo con `meta:mutaciones`**, y el campo `a` de las dos mutaciones es literal único.
- **Cero producción y staging**; este ticket no toca base de datos.
- **La tanda no se canalizó por una tubería**: fichero y `$?` aparte.
