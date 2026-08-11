# SCRUM-447 · autopsia del censo de SCRUM-428 — no midió mal: no midió

**Medido contra:** `origin/main` = `9093c11017e52fcb0e7b085e5054fb8505168f43` · 2026-08-10T20:34:53+02:00

**10-ago-2026** · sesión 1 · **cero cambios de producto**

La víctima no es un profesional: somos nosotros. Un censo que mide mal produce tickets sobre
defectos que no existen, y cada uno se lleva una sesión antes de que alguien lo pare. Con éste pasó
una vez.

## PASO 0

* **`docs/master/SCRUM-447.md` no existía en `main`** (censo de SCRUM-388: `NADA`, tres fuentes
  medibles).
* **La premisa del encargo SIGUE SIENDO CIERTA**: la conclusión falsa continúa en el árbol, en
  `docs/master/SCRUM-428.md:147`. `SCRUM-436` arregló el producto y no tocó la afirmación.
* **ENTRADA:** no hay pantalla. Es un defecto de nuestro registro.
* **MECANISMO:** el guard por AST de `SCRUM-436` (`tests/_censo-formato-euros.mjs`) ya existe y
  corre verde. Aquí no había que construir motor: había que averiguar por qué el número era falso.

## ① Dónde vive el censo — de los tres sitios posibles, el tercero

No es un fichero del árbol ni un script del scratchpad: es **una afirmación escrita a mano dentro
de una entrada de máster**, en la sección «Hallazgo de otro carril» de `SCRUM-428.md`.

Y eso decide cómo se corrige: **una entrada de máster no se reescribe ni se borra** (AA1.7). Se le
pone encima una corrección fechada que la desmiente, dejando el original a la vista. Así queda el
error **y** la corrección, que es lo que permite entender cómo se llegó a él.

## ② 🔴 Por qué dio ese resultado — y no es lo que parecía

La hipótesis del encargo era que el censo fuera un `grep` mal apuntado: del símbolo €, o que sólo
barriera `public/dashboard/js/` dejando `api.js` fuera.

**Las dos son falsas, y `api.js` está DENTRO de `public/dashboard/js/`.** Medido sobre el árbol de
aquel commit (`fac68c44`), con tres técnicas:

| técnica | ficheros | ¿incluye `api.js`? |
|---|---|---|
| `grep` de `Intl.NumberFormat` | **2** | **SÍ** |
| `grep` del símbolo `€` | **16** | **SÍ** |
| censo de DEFINICIONES de formateador | **9** | **SÍ** |

> **Ninguna técnica reproducible da «cuatro».** Y las tres encuentran `api.js`.

Y el control que no se hizo, sobre ese mismo árbol: **`fmtMoneyEs` se llamaba 60 veces desde 19
ficheros**, estaba en `window`, y **la llamaban ya `jobsView.js` (4 veces) y `reportsView.js` (11)**
— los mismos ficheros que el hallazgo citaba como si no tuvieran a qué recurrir.

### La conclusión, que es incómoda y es la útil

**El censo no midió mal: no midió.** No hubo técnica defectuosa que arreglar. Hubo una observación
hecha de pasada mientras se trabajaba en otra cosa —«he tenido que añadir un formateador»— escrita
con la **forma** de una medición: negrita, un número y tres `fichero:línea`.

Eso es lo que la hizo creíble. Un `fichero:línea` parece una medición aunque nadie haya barrido
nada, y en este repo esa forma es precisamente la que se ha ganado la confianza.

## ③ ¿Hay más censos con la misma técnica?

**No se puede contestar con un derivador, y decirlo es la respuesta honesta.**

Se buscaron afirmaciones cuantificadas en secciones de «Hallazgo» de las entradas de máster: salen
**33 candidatos**, y la inmensa mayoría no son censos («dos lados», «dos veces», «dos horas»). Un
detector así **marcaría casi todo**, y un guard que marca todo no marca nada — que es el criterio
que este mismo repo aplica a sus guards.

**La causa no es una técnica que se pueda buscar, es una práctica**: escribir una observación con
la forma de una medición. Lo único que se sostiene sin ruido es una regla de redacción:

> Un hallazgo con NÚMERO cita **cómo se contó**. Si no hay cómo, no lleva número: se escribe «he
> visto varios» y se deja para que alguien lo mida.

No se convierte en guard porque no se puede distinguir automáticamente «cuatro formateadores» de
«dos lados» sin leer la frase. **Queda como regla escrita, no como mecanismo**, y se dice para no
vender vigilancia que no existe.

## Lo entregado

* **La corrección donde vive la conclusión**: bloque fechado sobre `SCRUM-428.md:147`, con el
  original intacto debajo.
* **La corrección donde se citó**: `SCRUM-436.md` ya la desmentía desde su primera línea (*«el
  encargo decía cuatro formateadores y ninguno compartido. Falso»*), así que **ya no viaja a ningún
  sitio sin su corrección al lado**. Medido: son los dos únicos puntos del árbol donde aparece.

## Lo que NO se ha construido, y por qué

**Ningún censo ni guard nuevo.** El guard de `SCRUM-436` ya afirma exactamente lo que este ticket
pedía comprobar, y corre verde hoy (6/6):

* *«nadie formatea dinero por su cuenta fuera del formateador de la casa»*
* *«los mismos importes dan el MISMO texto en las cuatro pantallas»*
* *«el AUSENTE y el CERO siguen siendo afirmaciones distintas donde lo eran»*
* más dos SUELOS y un control negativo propios.

Añadir un segundo censo de lo mismo habría sido **repetir el error que este ticket viene a
corregir**: construir sin comprobar antes qué existe.

## Estado de hoy, medido con el criterio fino que faltó

Distinguiendo **alias** (delega en el compartido) de **copia** (reimplementa el formato), por AST:

```
COMPARTIDAS (2): api.js:233 fmtMoneyEs · api.js:271 fmtMoneyEsOAusente
ALIAS         (8): expensesView · homeView · invoiceDetailView · invoicesView ·
                   quotesDetailView · quotesListView · quotesView · reportsView
🔴 COPIAS     (0)
CONTROL POSITIVO · llamadas a la familia compartida: 67
```

**Cero copias.** Las ocho definiciones locales que quedan son alias de una línea que delegan, no
duplicados — distinción que el hallazgo original no hizo y que es la que convertía nueve en «hay un
problema» o en «no lo hay».

## Lo que no se ha tocado

El guard de `SCRUM-436` · el formateador compartido · ninguna pantalla · `prisma/schema.prisma` ·
el camino de emisión. **Cero líneas de producto.** Los derivadores de esta autopsia viven en el
scratchpad y no se añaden al árbol: son de medición puntual, no de vigilancia.


---

> **Apéndice.** Otra sesión, mismo ticket. Nada de lo anterior se toca (SCRUM-273).

# SCRUM-447 (parte 2) · el byte invisible que hacía pasar siempre a un guard

**Fecha:** 11-ago-2026 · **Carril:** B · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `8a57b9cd` · 2026-08-11T02:20:00+02:00

## El ticket se abrió por una premisa que ya no era cierta

Decía que el censo de SCRUM-428 **mide mal** y sigue en el árbol. **Medido: no mide mal hoy.** El
patrón de `scrum428-terminado-sin-cobrar.test.mjs:161` usa `[^A-Za-z0-9_]`, casa, y funciona. Alguien
lo arregló y dejó el episodio escrito.

Lo que sobrevivía era **el comentario que lo explica, con los dos bytes 0x08 dentro** (L157-158).

## El defecto, que no es un typo

`\b` escrito en una cadena de shell —o en un literal de JS, **donde `"\b"` ES el backspace**— no
llega como el metacarácter: llega como el **byte 0x08**. El patrón resultante **no casa nunca**, y
un patrón que no casa nunca devuelve cero… **que se lee igual que «no hay nada»**.

**No se rompe: contesta bien a la pregunta equivocada.** El guard de SCRUM-428 habría pasado
SIEMPRE, y lo delató **inyectarle el rojo**, no leerlo.

## ¿Se extendió la técnica? Un número, no un miedo

| | |
| --- | --- |
| ficheros leídos de `tests/` y `scripts/` | **526** |
| líneas con el byte 0x08 | **2** — las dos en el mismo comentario |

Buscado **por el byte compilado, no por el texto `\b`**: buscar el texto habría sido cometer el
mismo error dentro de la búsqueda del error, y habría marcado en rojo cada regex correcta del repo.

## Lo entregado

1. **Los dos 0x08 del comentario → `\b` escapado.** Cosmético salvo por el motivo real: **ese
   párrafo es el que alguien copiará** la próxima vez que explique el fallo, y copiaría el byte.
2. **El guard de la CAUSA**, `tests/scrum447-byte-invisible-en-patrones.test.mjs` — 4 tests.

| Test | Qué impide |
| --- | --- |
| **SUELO** — el censo lee >100 ficheros | el ticket entero: cero hallazgos y «no miré» dan el mismo verde |
| ningún fichero lleva el byte | el defecto, en toda la familia |
| **CONTROL NEGATIVO** — el texto `\b` bien escapado NO cae | lo que separa este guard del error que persigue |
| ROJO por el mecanismo sobre fichero de mentira | que el detector no vea el byte donde SÍ está |

**Nace verde y con sentido** (526 leídos, 0 afectados). Un guard que nace rojo no protege: entrena
a ignorarlo.

Rojo probado **sobre el árbol real**, con la mutación confirmada y retirada:

```
tests/scrum428-terminado-sin-cobrar.test.mjs:158   ← lo nombra con fichero y línea
```

## El tropiezo, porque es el mejor ejemplo del ticket

El primer intento de arreglo **no aplicó**: usé `"\b"` en un `node -e` y el resultado siguió siendo
0x08. **Reintroduje el defecto dentro de su propio arreglo.** Lo cazó el contador que puse antes de
afirmar nada (`antes: 2 · después: 2`). Por eso el script definitivo construye la sustitución con
`String.fromCharCode(92) + 'b'`: **escribirlo como literal vuelve a producir el byte.**
