# SCRUM-821 · La lista que decide qué se mira era la única que nadie miraba

**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T19:09:57+02:00
**Rama:** `scrum-821-la-lista-que-decide-que-se-mira`

---

## 1 · Lo medido, antes de tocar nada

| | |
|---|---|
| el menú **OFRECE** | **17** pantallas |
| el barrido **FOTOGRAFÍA** | **12** (once del menú + `quotes-new`) |
| **sin fotografiar** | `jobs` · `albaranes` · `partes-oficina` · `cobros` · `libro-registro` · `plans` |

Son **la cadena Tecnosel entera** —trabajo, albarán, parte por valorar, cobro, libro de registro—:
el recorrido del único usuario real que tiene el producto.

🔴 **Y eso explica SCRUM-720**, que costó un día entero: la pantalla del parte llegó a producción
sin CSS y con 26 marcadores a la vista **con el recorrido diciendo 8/8**. Con seis pantallas fuera
del barrido, ese 8/8 no podía haber sido otra cosa.

### ⚠️ Y no eran seis: eran OCHO

`AUTH_VIEWS` se comparó también contra `HASH_VIEWS` —la lista que ya tiene cinco ficheros de tests
vigilándola— y aparecieron **dos más que el hallazgo no nombraba: `export` y `templates`**.

## 2 · El arreglo: derivar, no mantener

`AUTH_VIEWS` era **la cuarta lista mantenida a mano del árbol, y la que decide qué se mira**.
`HASH_VIEWS` tiene cinco guards; ésta tenía **cero**.

Ahora `capture-demo.mjs` **deriva** su lista de `HASH_VIEWS` (`scripts/_vistas-del-barrido.mjs`):

```
fotografía: 12 → 20     ·     pantallas del menú sin foto: 6 → 0
```

Los nombres de fichero también salen derivados (`01-home`, `02-cobros`, …): ni la lista ni la
numeración se mantienen a mano. **Nadie dependía de los nombres viejos** — comprobado: la única
mención estaba en el propio `capture-demo.mjs`.

⛔ `HASH_VIEWS` y sus cinco tests **no se tocan**: funcionan, y son el ejemplo que se copia.

## 3 · El guard · CONJUNTOS, no cuentas

`tests/scrum821-…` compara las dos poblaciones **por identidad**, que es la lección de SCRUM-727:
doce y doce puede ser doce aciertos o seis y seis. Se prueba con poblaciones inventadas **del mismo
tamaño** para que sólo pueda pasar comparando nombres.

| control | resultado |
|---|---|
| 🔴 **el rojo del mecanismo viejo** | con la lista a mano, el cotejo nombra **exactamente las seis**. Fijado como test con la lista vieja **como dato**: un guard que ya no puede ponerse rojo ante su propio caso es un comentario |
| ✅ **positivo enumerado** | las **17** una a una, más las seis y las dos nombradas por su nombre |
| ✅ **el contrapeso** | el barrido no visita nada que no sea navegable — si no, «no falta ninguna» se conseguiría fotografiando de más |
| ✅ **negativo** | quitando `partes-oficina` el cotejo cae **nombrándola**; quitando dos, salen **las dos** |
| ✅ **SUELO** | menos de 17 destinos y se declara ciego. Los suelos **lanzan**, y se prueba que lanzan |

## 4 · 🔴 El segundo agujero, que apareció al intentar el control por hash

El encargo pedía comprobar que **las que ya se fotografiaban salen igual, comparando por hash**.
Al medirlo apareció otra cosa:

**De las 12 antiguas, sólo 7 son DETERMINISTAS.** Capturadas tres veces cada una, con página
fresca y el mismo servidor:

```
✅ deterministas (7)   customers · invoices · reports · expenses · providers · team · settings
🔴 NO deterministas (5) home · quotes-new · quotes-list · products · quote-requests
```

Las cinco dan **hashes distintos entre capturas idénticas de sí mismas**. Y la primera vez que lo
medí saqué dos culpables distintos (`products` y `reports`), lo que me hizo mirar el instrumento
en vez de creerme el resultado: **la diferencia no venía del cambio, venía de la vista**.

> 🔒 **El barrido visual produce imágenes que nadie puede comparar.** No sólo faltaban ocho
> pantallas: de las que sí se fotografiaban, cinco no se pueden diferenciar de sí mismas. Un
> diff de capturas las marcaría en rojo cada vez, y en dos semanas nadie miraría el diff.

Las 7 deterministas salen **byte a byte idénticas** antes y después: derivar la lista cambia
**qué** se fotografía, nunca **cómo** se pinta. Y de las 8 nuevas, siete pintan contenido; `plans`
sale con 2 nodos en el banco local por falta de datos de plan — **eso es lo que `HUECOS_DECLARADOS`
existe para recoger** el día que se confirme contra el despliegue real.

**No se arregla aquí**: la no-determinación de esas cinco vistas es otro ticket. Se declara, que es
la mitad del encargo — *un hueco declarado se ve; uno callado no*.

## 5 · Los huecos, declarados en vez de callados

`HUECOS_DECLARADOS` nace **vacío y a propósito**. Si mañana una pantalla no se puede barrer, va ahí
con su razón y el guard la cuenta como conocida en vez de enrojecer. Y hay control de las dos
direcciones: un hueco declarado **no** enrojece —si no, nadie declararía ninguno— y un hueco que
**ya no lo es** se nombra, para que la declaración no se pudra.

## ⛔ No tocado

`HASH_VIEWS` ni sus cinco tests · ningún rótulo · `prisma/schema.prisma` · el camino de emisión ·
las cinco vistas no deterministas (se declaran, no se arreglan aquí).

---

# APÉNDICE · 8-sep-2026 — EL ✅ POSITIVO QUE FALTABA: las que ya se fotografiaban, por HASH DE IMAGEN

**Medido contra:** el punto de partida de esta rama (`merge-base`, no `origin/main` — ver §C3)
**Rama:** `scrum-821-la-lista-que-decide-al-dia`, **derivada de**
`scrum-821-la-lista-que-decide-que-se-mira` con `main` mezclado (sin conflictos).

> ⛔ **NO SE HA REESCRITO NADA DE LA RAMA DE ORIGEN.** Ni un fichero suyo modificado: sólo `main`
> dentro y **un fichero de test nuevo**. Este apéndice se AÑADE al final, como manda la casa.

## C1 · 🔴 SU HALLAZGO ES CORRECTO, Y SE VERIFICA EJECUTÁNDOLO: eran OCHO, no seis

El cuerpo de este ticket dice **seis**. Medido con las poblaciones reales:

```
fotografiadas ANTES ......................... 12
vistas del MENÚ ............................. 17     navegables por HASH_VIEWS ... 20

faltaban contra el MENÚ (lo que dice el ticket) .... 6
   jobs · albaranes · partes-oficina · cobros · libro-registro · plans

faltaban contra HASH_VIEWS (lo que dice la rama) ... 8
   los mismos 6  +  export  ·  templates
```

**El ticket estaba corto**, y con esas palabras: nombró seis porque midió contra el menú. Contra la
lista que **sí está vigilada** —`HASH_VIEWS`, con sus cinco ficheros de tests— eran **ocho**. Las
dos que no nombraba son **`export`** y **`templates`**.

## C2 · LO QUE SE AÑADE, Y NADA MÁS

`tests/scrum821b-las-capturas-que-ya-existian.test.mjs` — el ✅ POSITIVO del ticket:

> «las 11 que ya se fotografiaban salen IGUAL, comparadas por hash» ← **hash de IMAGEN**

| caso | qué fija |
|---|---|
| 🔴 **SUELO** | se leen las dos cosas que se comparan —la lista vieja y las capturas— o se declara CIEGO |
| ✅ **hash de imagen** | las capturas commiteadas siguen **byte a byte** iguales a las del punto de partida. Con su propio suelo: exige **≥10 comparaciones**, porque un «ninguna cambió» sobre cero no es un cero |
| ✅ **ninguna se ha perdido** | cada URL que la lista vieja fotografiaba sigue fotografiándose, y con el **mismo `slug`** |

**Probado en rojo, dos mutaciones:** alterar un byte de `06-customers.png` → cae el hash
nombrándola; hacer que la derivación pierda `customers` → cae el segundo caso. Restauradas con
`Buffer.compare` → 3/3.

### ⚠️ QUÉ PRUEBA ESE HASH Y QUÉ NO — dicho para que nadie lea de más

`capture-demo.mjs` necesita **navegador y `https://yaqu.app`**. Esta tanda no arranca navegador y
no toca producción, así que **no re-fotografía**. El hash compara las capturas **commiteadas**
contra las del punto de partida: prueba que **este arreglo no las ha tocado**, que es lo que estaba
en riesgo. **No** prueba que una re-captura futura salga idéntica píxel a píxel — para eso hace
falta el navegador, y eso es otra pasada.

## C3 · 🔴 EL ANCLAJE: contra el PUNTO DE PARTIDA, nunca contra `origin/main`

La primera versión de este test leía `origin/main:…`, y **el guard de SCRUM-723 la tumbó**:

> «o compara contra su punto de partida (`merge-base`), o se declara aquí con el motivo. Lo que no
> puede es entrar en silencio: acusará a una rama limpia el día que otro PR toque su fichero.»

Tenía razón, y el arreglo fue del código: se importa `baseDeLaRama` de `_base-de-la-rama.mjs` —el
motor de la casa, no un segundo `merge-base`—. Para los PNG hace falta leer **bytes** y no texto,
así que se usa `baseDeLaRama` directamente con `git show` sin encoding, y queda dicho en el fichero.

Y para lo que este test afirma es **mejor**, no sólo más correcto: «el arreglo no cambió las
capturas» significa *respecto a donde arrancó esta rama*.

## C4 · HALLAZGO: la derivación RENUMERA 9 de las 12 — se reporta, no se arregla

Medido comparando la lista vieja con la derivada:

```
/dashboard/#quotes-list      05-quotes-list     → 03-quotes-list
/dashboard/#customers        06-customers       → 05-customers
/dashboard/#products         07-products        → 06-products
/dashboard/#reports          09-reports         → 11-reports
/dashboard/#quote-requests   10-quote-requests  → 13-quote-requests
/dashboard/#expenses         11-expenses        → 09-expenses
/dashboard/#providers        12-providers       → 07-providers
/dashboard/#team             13-team            → 16-team
/dashboard/#settings         14-settings        → 17-settings
                                                  (9 de 12)
```

**El `slug` se conserva en las doce** —`customers` sigue siendo `customers`— y por eso el ✅ de
arriba pasa: cada captura apunta a la MISMA pantalla. Lo que cambia es el **prefijo numérico**, que
es POSICIÓN dentro de la lista, y la lista pasó de 12 a 20 entradas: **renumerar es la consecuencia
esperada de añadir ocho, no un defecto.** Por eso **no se ha tocado la derivación** ni se ha puesto
un rojo.

**Pero tiene una consecuencia que conviene decidir**, y es de otro carril (regla 37): al
re-fotografiar, las nuevas se escriben con nombres nuevos y **las 9 viejas se quedan en el repo
como evidencia obsoleta**, indistinguibles de las frescas. Alcance medido: **1 cita** afectada —
`05-quotes-list.png`, en `docs/SPRINT_DEMO_READY_EXT.md`.

Dos salidas, y son del fundador: conservar el prefijo por `slug`, o regenerar el directorio entero
borrando las 9 huérfanas y actualizando esa cita.

## C5 · VERIFICACIÓN

- **Su tanda de 9 + mis 3 → 12/12.**
- **Tanda completa:** `npm test` → **5988 tests · 5883 pasan · 0 fallos · 105 saltados** · exit
  code **0**, leído de fichero y NO a través de `head`/`tail`.
- `npm run guards:entrada`: 4/4.

---

# SCRUM-821c · El espejo que se mueve — el rojo fijo que bloqueaba todos los merges

**Fecha:** 08-sep-2026 · **Carril:** instrumento · **Gate:** ninguno — no toca producto

**Medido contra:** `origin/main` = `da938ba0cee102b560edc7f4d935d7b0f67c1f14` · 2026-09-08T03:32:55+01:00

## La causa: era (b), y sola

El encargo planteaba dos hipótesis. Medidas las dos, con su comando:

**(b) — CONFIRMADA.** `AUTH_VIEWS` **sí existe** en `origin/main`, pero ya no es un array literal:

```
$ git show origin/main:scripts/capture-demo.mjs | grep -n "AUTH_VIEWS"
35:const AUTH_VIEWS = vistasDelBarrido(RAIZ).map((v) => [v.nombre, v.url]);
81:  for (const [name, url] of AUTH_VIEWS) await shoot(page, name, url);
```

El test buscaba la cadena `const AUTH_VIEWS = [`. Al mergearse SCRUM-821 —cuyo ticket era
justamente que *la lista dejara de mantenerse a mano*— ese literal desapareció. **La premisa del
test murió con su propio ticket**, y toda rama nacida después nace con un punto de partida donde
no está.

**(a) — DESCARTADA.** El job de tests ya clona entero:

```
$ sed -n "93,112p" .github/workflows/ci.yml
      - uses: actions/checkout@v4
        with:
          …
          fetch-depth: 0
```

El clon superficial no era la causa, y el rojo se reproduce **en un árbol completo**.

## 🔴 Rojo reproducido ANTES de tocar nada

Rama nueva desde `origin/main`, árbol completo:

```
$ node --test tests/scrum821b-las-capturas-que-ya-existian.test.mjs   → exit 1 · 3 fallos
🔴 CIEGO: no se pudo leer la lista vieja de `origin/main`: no encuentro `AUTH_VIEWS` en la
   versión de origin/main
```

Mensaje idéntico al del runner.

## El defecto de fondo, y la mitad que NO daba rojo

El espejo se movía en **dos** sitios:

1. **La lista vieja** — dejó de poder leerse. Es el rojo visible.
2. **Los hashes de imagen** — y éste era peor, porque estaba **verde**. `bytesEnLaBase` comparaba
   cada captura contra el punto de partida de la rama, y una vez 821 mergeado ese punto **ya
   contiene las capturas de hoy**: se comparaba cada fichero **contra sí mismo**. Verde garantizado
   sobre nada. Un guard silenciosamente vacío — exactamente lo que ese test existe para no dejar
   pasar.

Arreglar sólo ① habría devuelto el job a verde dejando ② hueco.

## El arreglo: trinquete

`tests/_foto-antes-de-821.mjs` congela, commiteadas, **las 12 vistas** que `AUTH_VIEWS` enumeraba a
mano **y el `sha256` de la captura de cada una**, leídos de `6cbb60fd` (`a902726c^`, el commit
anterior a que 821 derivara la lista). El test compara el presente contra esa foto: no depende de
git, ni de la profundidad del clon, ni de si la base ya se mergeó, ni del runner. Mismo patrón que
el número congelado a mano de `scrum522`.

## Verificación

| Control | Resultado |
|---|---|
| 🔴 **ROJO reproducido** antes de tocar, en árbol completo, con el mensaje del runner | ✅ |
| ✅ **POSITIVO**: no se reduce lo vigilado | **12 comparadas por hash de verdad** (antes: 0 reales, cada fichero contra sí mismo) · barrido derivado hoy **21** vistas |
| ✅ **NEGATIVO**: quitar `providers` de `HASH_VIEWS` → cae **nombrándola** (`12-providers (/dashboard/#providers)`) | ✅ |
| ✅ **SUELO**: con la foto vacía se declara **CIEGO**, no verde | ✅ |

El negativo hubo que repetirlo: la primera vez perturbé `data-view=` en `index.html` y el test
siguió verde — porque el barrido deriva de `HASH_VIEWS` en `app.js`, no del menú. Perturbada la
fuente correcta, cae y la nombra. Queda dicho porque un control negativo que apunta al sitio
equivocado **da un verde que parece una prueba y no lo es**.

⛔ No se tocó `AUTH_VIEWS` ni `HASH_VIEWS` (las perturbaciones del control negativo se restauraron y
se verificó con `git status`), ni el mensaje de CIEGO, ni el `fetch-depth` del workflow, ni se bajó
ningún test a `skip`.
