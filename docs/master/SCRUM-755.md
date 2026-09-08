# SCRUM-755 · El contador que cuadró solo, y el trinquete que no lo miraba

**Fecha:** 7-sep-2026 · **Carril:** microcopy · instrumentos · **Gate:** sin gate
**Medido contra:** `origin/main` = `7bcf417907020708b5824db42b7b867e0c7e01d2` · 2026-09-07T03:30:00+01:00
**Tanda:** 5816 tests, 5714 pass, 0 fail, 102 skipped · `EXIT_REAL=0` · y los saltados SUMAN: 5714 + 102 = 5816
**Meta-guard:** vivas 132 · mudas 0 · ciegas 0 · ficheros muertos 0 · `exit 0` (tras mezclar main y RECOMPILAR)
**Tanda (1ª vuelta):** 5789 tests, 5687 pass, 0 fail, 102 skipped · `EXIT_REAL=0` (fichero y $? aparte, nunca al final de una tubería) · tras mezclar main

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

---

# SEGUNDA VUELTA · los que pintan y no cuentan

> **Y lo primero es una corrección de mi propia cifra.** Dije «15 ficheros, 10 sin contador». Es
> **12 y 7**: mi lector contaba como ranura pintada la **exportación** de la constante
> (`module.exports = { …, MARCA_ASIGNADOS }` en `jobAsignados.js`, `MICROCOPY_PENDIENTE` en
> `patronDetalleAcciones.js`, y la tabla de `settingsSubmenus.js`). Exportar una constante no la
> pinta en ninguna pantalla. Arreglado el lector, esos tres ficheros **salen del censo enteros** y
> `switchFormaJuridica.js` baja de 5 sitios a 4. Un instrumento que cuenta de más asusta con
> ficheros que no pintan nada, y el susto se paga desactivándolo.

## Obligación 1 · los siete, uno a uno — y ninguno estaba desnudo

Los leí uno a uno, y la respuesta no es la que esperaba: **los siete están en el censo de
SCRUM-402**, comprobado leyendo SUS claves y no copiándolas. Y cada uno tiene además al menos un
test que lo nombra *y* habla del marcador.

| fichero | sitios | por qué no lleva contador |
|---|---|---|
| `exportView.js` | 2 | son literales dentro del HTML de la vista; SCRUM-402 los ve uno a uno |
| `libroRegistroView.js` | 1 | **la pantalla entera va marcada por decisión escrita en su cabecera**, y `scrum296-pantalla-libro` la compara ranura a ranura |
| `parteDetailView.js` | 1 | su propio comentario dice que entra en el censo de SCRUM-402 con su número |
| `providersView.js` | 3 | mensajes de error y respaldo de último recurso; `scrum644` los vigila |
| `settingsView.js` | 2 | el rótulo del modo de emisión, cubierto por `scrum298-modo-visible` |
| `switchFormaJuridica.js` | 4 | los rótulos del control, cubiertos por `scrum574` |
| `tipoDestinatarioPendiente.js` | 2 | el aviso **es** la ranura; `scrum615` y `scrum622` la sujetan |

**Lo que sí les faltaba** —y es lo único que este ticket añade— es que el censo de SCRUM-402
cuenta **literales**, así que en los que pintan a través de una constante su número es el de la
**declaración** y no se mueve al añadirle usos. Por ahí entraba una ranura nueva sin que nadie la
viera.

Los motivos ya no viven en mi informe: viven en el propio guard, en `PINTAN_Y_NO_CUENTAN`, con un
test que exige que ninguno esté en blanco. **Un hueco sin motivo se lee como un olvido.**

## Obligación 2 · la recomendación, con la unidad delante

**El cuadro entero, medido:** 84 ficheros en el panel · 9 declaran contador · 12 pintan marcador.

| grupo | cuántos | qué instrumento puede verlos |
|---|---|---|
| ① pintan y **no** cuentan | **7** | el árbol: se derivan sus sitios |
| ② cuentan y **no** pintan | **4** | **sólo un contador**: en el árbol no hay nada que leer |
| ③ cuentan **y** pintan | 5 | los dos |

Y la respuesta a las dos preguntas del encargo:

**¿Los siete llevan contador? NO.** Un contador cuenta RANURAS, que es un juicio humano —una
ranura puede pintarse en tres sitios, y `quotesView` lo demuestra—. Ponerles siete números a mano
sería multiplicar por siete el defecto que abrió este ticket: siete cosas más que pueden
desincronizarse y volver a cuadrar solas. Lo que esos siete necesitaban era que sus sitios se
**derivaran**, y eso ya está.

**¿Un contador único? Tampoco, y es peor.** Perdería el fichero —el rojo dejaría de poder decir
dónde— y seguiría siendo un número a mano. Además no arregla ② : el caso `filtroClientes`, **7
ranuras pendientes y cero marcadores**, no lo ve ningún instrumento derivado, ni por fichero ni
global.

**Lo que se recomienda:** que cada instrumento cubra la unidad que puede medir. El árbol da
sitios y los cubre el censo de este ticket, para los doce. El contador se queda **exactamente
donde es irremplazable**: los cuatro ficheros que declaran ranuras y no pintan nada. Ahí no sobra;
ahí es el único testigo que hay. Y los cuatro tienen ahora su propio test, para que ese grupo no
cambie en silencio.

## Obligación 3 · lo construido en esta vuelta

Ni un literal nuevo, ni estado nuevo: sólo `tests/`.

- El lector deja de contar exportaciones como ranuras (`esFontaneria`).
- `PINTAN_Y_NO_CUENTAN` — los siete **con su motivo escrito**, y un test que rechaza un motivo en
  blanco.
- Un test que comprueba que **ninguno está desnudo**: todos tienen que estar en el censo de
  SCRUM-402, leído de su fichero. Si mañana aparece uno que ni cuenta ni está censado, ése es el
  caso peor y sale nombrado.
- `CUENTAN_Y_NO_PINTAN` — el otro lado del hueco, con su test: es el argumento de por qué los
  contadores no sobran.

**No se duplica SCRUM-402:** aquél cuenta literales y sigue siendo el dueño de esa forma; éste
cuenta SITIOS —literal y constante— y es el único que ve la segunda.

## Los tres controles de esta vuelta

```
[sin tocar] mi guard: VERDE ✅

════ 🔴 EL QUE DECIDE, repetido sobre los ficheros NUEVOS ════
   ✅ exportView.js                  ranura nueva -> ROJO · restaurado byte a byte
   ✅ libroRegistroView.js           ranura nueva -> ROJO · restaurado byte a byte
   ✅ providersView.js               ranura nueva -> ROJO · restaurado byte a byte
   ✅ tipoDestinatarioPendiente.js   ranura nueva -> ROJO · restaurado byte a byte

════ ✅ EL POSITIVO — los cinco que HOY están bien ════
   ✅ con el árbol tal como está, mi guard sigue VERDE

════ ✅ LA DISCRIMINACIÓN — no marcar todo lo que se mueve ════
   ✅ un COMENTARIO                      -> verde (esperado verde)
   ✅ un const cualquiera SIN marcador   -> verde (esperado verde)
   ✅ un USO del marcador (la ranura)    -> ROJO ✅
```

**Y el arnés se cazó a sí mismo dos veces, otra vez de la misma familia.** La primera pasada dio
dos rojos en `providersView.js`: uno porque mi «ranura» era un `const` **sin marcador** —o sea,
ninguna ranura, y el guard tenía razón en quedarse verde— y otro porque el ancla del tercer caso
no existía en el fichero. El arnés **dijo que no había podido correr el control** en vez de
contarlo como verde, que es exactamente para lo que se escribió esa línea.

---

# TERCERA VUELTA · mis dos declaraciones estaban CIEGAS

**Y el dato que faltaba en mi entrega anterior era justo ése.** Traje `npm test` en verde y no
traje `vivas · mudas · ciegas`. No corrí el meta-guard antes de empujar, así que entregué media
medición y el rojo lo encontró CI.

```
? scrum755-el-contador-que-cuadro-solo.test.mjs · CIEGO   (×2)
vivas 127 · mudas 0 · ciegas 2 · exit 2
```

## Las tres causas, discriminadas — no me creí la hipótesis, la medí

El propio meta-guard lista tres posibles. Las tres, con su prueba:

| causa | veredicto | cómo se midió |
|---|---|---|
| el fichero no llegó a ejecutarse (`dist/` sin compilar) | **falsa** | con main mezclado y **recompilado**, el fichero corre y sus 8 tests salen **en verde** |
| ese test ya fallaba | **falsa** | no puede fallar lo que no existe: ninguno de los dos nombres aparecía como `test()` |
| el nombre de la declaración caducó | **ÉSA ERA** | comparados carácter a carácter: los dos `cae` no casaban con ningún `test()` del fichero |

El mecanismo, leído en el propio meta-guard y no supuesto: decide CIEGA **por línea base** — si
el test que la declaración nombra no aparece en verde en la pasada limpia, **ni siquiera muta**.
Por eso CIEGO no es MUDO: no dice que el guard no sirva, dice que no se pudo medir.

## Y no me limité a renombrar

Renombrar habría bastado para que el rojo desapareciera, y habría sido un falso verde con otra
forma: **mis dos mutaciones decían medir cosas distintas** —una añade un uso en un fichero YA
censado, la otra estrena un fichero nuevo— y las dos caían en el mismo test, «EL QUE DECIDE».
Apuntando las dos al mismo nombre, el meta-guard habría dicho VIVA dos veces sin distinguir qué
mide cada una.

Se parte el test en **sus dos ramas**, con los nombres que las declaraciones ya decían:

- `🔴 EL ÁRBOL PINTA MÁS MARCADORES DE LOS DECLARADOS` — la rama `distintos` + el total.
- `🔴 UN FICHERO NUEVO EMPIEZA A PINTAR MARCADOR` — la rama `nuevos` + la mitad que aprieta
  cuando un fichero deja de pintar.

**Comprobado que cada una sigue midiendo lo suyo**, y no sólo que «tumba algo»:

```
   ✅ invoicesView.js
      declara que cae: SCRUM-755 · 🔴 EL ÁRBOL PINTA MÁS MARCADORES DE LOS DECLARADOS
      cayó SU test   : SÍ · y sólo ése
      por la rama    : EL ÁRBOL YA NO PINTA LO QUE EL CENSO DICE
   ✅ homeView.js
      declara que cae: SCRUM-755 · 🔴 UN FICHERO NUEVO EMPIEZA A PINTAR MARCADOR
      cayó SU test   : SÍ · además cayeron 2 colaterales
      por la rama    : FICHEROS QUE EMPIEZAN A PINTAR MARCADOR
```

Los dos colaterales de la segunda son esperables y se dicen: un fichero nuevo que pinta cambia
también el total de sitios y la lista de los que pintan sin contar. Las dos restauradas byte a
byte.

## El veredicto

```
vivas 129 · mudas 0 · ciegas 0 · ficheros muertos 0 · exit 0
  ✔ scrum755 · SCRUM-755 · 🔴 EL ÁRBOL PINTA MÁS MARCADORES DE LOS DECLARADOS
  ✔ scrum755 · SCRUM-755 · 🔴 UN FICHERO NUEVO EMPIEZA A PINTAR MARCADOR
```

127 → **129**: las dos que no se podían medir ahora se miden, y ninguna sale muda.

> **Lo que me llevo, y no es la primera vez esta sesión:** mi propio arnés me había impreso la
> prueba dos vueltas antes —`esperaba: … / cayó: …`, con nombres distintos— y seguí adelante. El
> instrumento no falló; falló que leí su salida buscando el ✅ en vez de leer lo que decía.
