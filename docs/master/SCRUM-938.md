# SCRUM-938 · La lista real como fixture — censado, no arreglado

**Medido contra:** `origin/main` = `2242683172bad64e4cc9f591e5c81b43fe5dc52e` · 2026-09-17T21:38:32+01:00
**Rama:** `scrum-938-la-lista-como-fixture`
**Carril:** instrumentos · **Gate:** el censo vive fuera de `npm test`; su red corre siempre

> ⛔ **NINGÚN TEST ARREGLADO.** Reescribir un fixture sin saber su clase convierte un falso verde
> en un verde de verdad sin haber probado nada.
> ⛔ **Ninguna lista real del árbol vaciada.** La prueba que decide trabaja sobre una copia.
> ⛔ Ni una línea de `src/`. Ningún flag. Ninguna base.

---

## 1 · El defecto, y por qué miente en las dos direcciones

Un test que alimenta sus casos con **la misma lista que su guard consulta para decidir** mide el
**contenido** de la lista creyendo medir el **funcionamiento** del guard.

- **Falso verde** — el caso pasa porque la lista tiene contenido, no porque el guard sirva.
- **Falso rojo** — el día que alguien **vacía** la lista, que es el objetivo de toda lista de
  excepciones, caen de golpe. **Castiga a quien hace el trabajo bien.**

Medido el 17-sep-2026 en SCRUM-813: al retirar la última excepción, **seis casos cayeron a la vez**
y ninguno estaba roto.

    🔒 Un caso que se queda sin sujeto cuando el defecto se arregla estaba atado al defecto,
       no al mecanismo.

## 2 · El censo · población y veredicto

**Reutiliza `censarExcepciones` de SCRUM-927** en vez de escribir un segundo censo de listas.

| | |
|---|---|
| listas de excepciones declaradas | **132** (censo de SCRUM-927) |
| pares (lista × fichero que la consume) examinados | **156** |
| candidatos por análisis estático | **61** — (a) 10 · (b) 51 |
| **CONFIRMADOS** por la prueba que decide | **35** |
| absueltos (la lista vacía **no** los tumba) | **15** |
| **NO DECIDIBLES** (cuentan del lado malo) | **11** |

Los **15 absueltos son la justificación de la prueba que decide**: el análisis estático los
acusaba y el comportamiento los absolvió. Sin ella, este censo habría entregado 61 acusados con
un 25 % de ruido.

## 3 · El criterio es de FLUJO, y la forma ③ es la que no se ve

No basta con que el fichero **mencione** una lista. La pregunta es si el valor que alimenta el caso
sale de la misma constante que el guard consulta:

| forma | cómo se detecta |
|---|---|
| ① la constante se pasa como entrada a una llamada | AST: identificador en `arguments` |
| ② se llama omitiendo el parámetro, así que decide el valor por defecto | la lista real es el default |
| ③ 🔴 **un LITERAL escrito a mano que es un elemento de la lista** | comparar literales con los elementos |

**③ es la que me pasó a mí**: el fixture era `'scrum659/'`, copiado del contenido. **No hay import
que lo delate** — sólo se ve comparando el literal con los elementos reales.

## 4 · 🔴 Mi primera versión cometió el error que el ticket persigue

Emparejaba consumidores **por mención del nombre**: acusaba a **118 de 833**, y el primero de la
lista era `scrum405` acusado por una lista declarada en `scrum226` — dos ficheros que no se
importan. `EXCEPCIONES`, `EXENTAS` y `DECLARADOS` son nombres **genéricos** que se repiten por toda
la casa.

Es exactamente acusar por la **forma** (aparece la palabra) en vez de por el **flujo** (el valor
llega al caso): el defecto de este ticket, cometido por su censo. Y un censo que acusa al 14 % de
la casa se desactiva la primera semana.

Arreglado resolviendo el consumidor **por el import**, leído por AST — estático y dinámico, porque
así carga `dist/` esta casa. **118 → 61 candidatos.**

    🔒 Un prefijo no es un nombre, y un nombre repetido no es una referencia.

## 5 · La prueba que decide, y cómo no toca el árbol

Se copia el fichero que declara la lista a un **hermano temporal** —hermano para que sus rutas
relativas sigan resolviendo— con la lista **vaciada**, y se corre esa copia.

- El nombre **no acaba en `.test.mjs`** a propósito: así `npm test` no la recoge nunca, ni aunque
  quedara suelta.
- Borrado en `finally`, **con aviso si no se pudo borrar**. Verificado: **0 sondas sueltas** tras
  las tres pasadas completas.
- **Límite declarado:** sólo decide cuando la lista vive **en el propio fichero**. Si vive en un
  módulo aparte, haría falta copiar también ese módulo y reescribir el import: eso sale
  **NO DECIDIBLE** y cuenta del lado malo. Son los 11.

## 6 · Las clases, y el remedio propuesto — SIN implementar

| clase | qué significa | remedio propuesto |
|---|---|---|
| **(a) MIENTE** · 10 candidatos | la lista es la **única** fuente de los casos | **banco fabricado**: una lista de prueba local. El caso pasa a medir el mecanismo y sobrevive a que la real llegue a cero |
| **(b) DEGRADA** · 51 candidatos | alimenta un caso entre otros fabricados | igual, **por caso**: sólo el que se alimenta de la real. Los demás no se tocan |
| **(c) LIMPIO** | el test **declara** que mide el contenido (trinquete de conjunto o de tamaño) | **no se toca**. No es este defecto |

**El remedio general es banco fabricado**, y así se hizo en SCRUM-813: una `LISTA_DE_PRUEBA`
sintética dejó el amparo probado **aunque la lista real esté a cero**, que es el estado al que se
quiere llegar.

**Si un caso necesita el elemento real, se declara por qué.** Hay un motivo legítimo: cuando lo que
se mide es la *integración* con ese elemento concreto y no el mecanismo. Pero entonces el caso
tiene que decirlo, porque **volverá a caer el día que la lista encoja** — y quien lo pague tiene
derecho a saber que era esperado.

## 7 · Los controles

- **🔴 EL POSITIVO — y por el eje correcto.** Se lee de git (`2b317011`, antes del arreglo) porque
  hoy ya está arreglado en `main`: un positivo sobre el código de hoy saldría limpio y no probaría
  nada. Resultado: el censo lo caza por la **forma ③**, y su prueba **nombra el literal**
  (`"scrum659/"`), no el fichero.
- **✅ EL NEGATIVO.** Un trinquete de contenido sale **LIMPIO**. Es el que tenía que salir verde:
  acusarlo marcaría todos los trinquetes de la casa. Y un **fixture fabricado** tampoco se
  denuncia, aunque el fichero cite la lista — si no, el censo castigaría el arreglo que propone.
- **SUELO.** Cero listas ⇒ **CIEGO** (salida 2), no «árbol limpio». Hoy ve 132.
- **`MUTACIONES_QUE_ME_TUMBAN`**: dos, una por cada eje que puede apagarse — el consumidor por
  import y el corte de la prosa.

## 8 · Dos errores propios más, además del de §4

1. **Mi umbral mínimo hacía invisible un elemento corto.** Exigía 3 caracteres, así que `'a/'` no
   se veía: una lista de elementos cortos habría salido limpia sin serlo. Lo cazó **mi propio
   test**. Bajado a 2, y el límite de 1 carácter queda **declarado** en el código con su motivo.
2. **La puerta de entrada reventaba al importar el módulo** (`process.argv[1]` undefined), y era
   además la comparación que **SCRUM-765 ya dejó medida como inservible en Windows**. Sustituida
   por `pathToFileURL(argv[1]).href`, que es el patrón que esta casa ya tenía probado — lo reusé en
   vez de inventar el mío, que es lo que debí hacer desde el principio.

## 9 · Lo que NO se ha hecho

- ⛔ **Ningún test arreglado.** El censo entrega clase y prueba; el arreglo es otra tanda.
- ⛔ **Los 11 NO DECIDIBLES no se han forzado.** Copiar el módulo del guard y reescribir imports es
  un instrumento nuevo, y de momento cuentan del lado malo.
- ⛔ **Los elementos de un solo carácter no se ven** (declarado en §8).
- 🟠 **La clase (a)/(b) la decide el número de formas detectadas**, que es una aproximación: un
  caso con una sola forma pero que sea la única fuente saldría como (b). La prueba que decide da el
  dato que importa —cuántos casos caen de cuántos— y ahí se ve: `1 de 6` es (a) de hecho.

---

# SCRUM-938b · La clase (a) no tenía ningún fixture que arreglar: el censo acusaba guards que funcionan

**Medido contra:** `origin/main` = `41bad7c83d84ba2cddcf267480bbd7bcd9bc0b2c` · 2026-09-18T09:23:01+01:00
(la evidencia corrió dos veces, la segunda terminada a las 10:13; misma base).
**Al cerrar:** `origin/main` = `e60cc9156f8b81b571e440aebbf85abda6388e05` (10:14, +10 commits, integrado).
Ninguno toca los 8 ficheros ni el censo, pero la población pasa de **133 a 135 listas**:
`FALSAS_DECLARADAS` (`scrum939b`) y `OBLIGATORIAS_CONOCIDAS` (`censo-afirmaciones-de-skills`)
nacieron después de la medición. **No están medidas aquí**, y quedan fuera de la excepción.
**Rama:** `scrum-938b-banco-fabricado`
**Carril:** instrumentos (S3) · **excepción de carril** declarada por el asesor para la S1, sólo para
esta fase b y sólo el 18-sep-2026, con comentario en SCRUM-938. Alcance: los 35 clasificados.

> ⛔ **NINGÚN TEST TOCADO, NINGÚN BANCO FABRICADO.** Esta vez no es cautela, es el resultado: medido
> caso a caso, **ninguno de los 8 pares de clase (a) es un fixture atado a la lista.** Fabricar el
> banco en cualquiera de ellos habría cambiado un guard que mira el árbol real por uno que mira un
> sintético — aflojar el guard, que la regla 41 prohíbe.
> ⛔ Ni una línea de `src/` ni de `tests/`. Ninguna lista real vaciada: todo sobre copias.

## 1 · PASO 0, corrido

- **Los seis de scrum-813 ya están arreglados en `main`**: `LISTA_DE_PRUEBA` entró en `7ba206d9`
  (17-sep, 19:51), ancestro de `origin/main`. El censo de hoy ni siquiera los propone. **No son un
  control positivo vivo: hoy no caen.** Su positivo sigue siendo el que ya usó la fase a, leído de git
  en `2b317011`, anterior a ese arreglo.
- **El censo, hoy:** **133 listas · 157 pares · 62 candidatos → 36 CONFIRMADOS · 15 absueltos ·
  11 NO DECIDIBLES** (ayer: 132 · 156 · 61 → 35 · 15 · 11). El suelo del encargo —encontrar los 35—
  se cumple.
- **El +1 es `scrum929-el-total-del-borrador` (`LINEA_SIN_IVA`, clase b)**, un fichero que no existía
  en la base de ayer (`2242683`). Los otros 35 viven en ficheros que no se han tocado desde esa base.
  ⚠️ **No es una comparación de conjuntos, y es culpa mía:** el registro de la fase a dio los 35 como
  cifra, sin nombres, así que hoy no hay con qué comparar nombre a nombre. Lo que se afirma es sólo lo
  que se ha medido: un par nuevo en un fichero nuevo, y el resto en ficheros quietos.

## 2 · LO QUE DECIDE: qué nombra el fallo al vaciar la lista

Vaciar la lista y ver caer el test no distingue dos cosas que se parecen mucho:

| | su entrada es… | al vaciar la lista… |
|---|---|---|
| **el defecto** | un caso SINTÉTICO que copió un elemento de la lista | se queda sin sujeto y su fallo nombra **el fixture** |
| **el guard funcionando** | el **árbol real** (ficheros, esquema, el PDF que se genera) | la excepción real queda sin declarar y el guard **cae nombrándola** — que es su trabajo |

Así que a cada par se le ha exigido, **corriendo**, que su fallo nombre lo que se leyó en el fuente.
`docs/master/evidencias/scrum938b/el-que-decide.mjs`, salida en `salida-el-que-decide.txt`:

| par | caen | el fallo nombra | qué es |
|---|---|---|---|
| `scrum405` · `EXCEPCIONES` | 1 de 6 | `settingsView.js:1534` | guard sobre el árbol real: el `.blob()` de settingsView queda sin amparo |
| `scrum419` · `GATEADOS_DECLARADOS` | 2 de 8 | el inventario real de gateados (`"scrum324-cadena-hasta-el-libro.test.mjs":2`, …) | trinquete (c): el inventario real contra el declarado |
| `scrum491` · `A_MANO_SIN_METODO` | 2 de 12 | «ESCÁNER CIEGO: sin facturas marcadas a mano SIN método» | **no es una lista de excepciones**: banco ya fabricado, y cae su suelo |
| `scrum497` · `FUERA_DE_ANONIMIZADO` | 1 de 8 | `product.name` | guard sobre el esquema real |
| `scrum497` · `SIN_DECIDIR` | 2 de 8 | `teamMember.name`, … | guard sobre el esquema real + trinquete (c) de quince |
| `scrum624b` · `DIVERGENCIAS_DECLARADAS` | 3 de 5 | «IMPRESO EN EL PAPEL: 36,26» | guard sobre el PDF real + trinquete (c) de tamaño |
| `scrum629` · `RECORTES_DECLARADOS` | 1 de 7 | `tests/scrum578-duplicados-identificador.test.mjs` | guard sobre el árbol real (y además la sonda: §3) |
| `scrum644` · `CENSO_HEREDADO` | 2 de 13 | `public/dashboard/js/albaranDetailView.js:305`, … | trinquete (c) de techos sobre el dashboard real |

**Los 8 caen porque tienen que caer.** Siete son un guard o un trinquete sobre algo real que, sin la
lista, señala la excepción real **por su nombre**. El octavo, `scrum491 · A_MANO_SIN_METODO`, ni
siquiera es una lista de excepciones: es un **banco ya fabricado** (tres facturas sintéticas), y lo
que cae es el suelo que avisa de que el banco está vacío.

Y ese mismo diferencial es el **rojo real** que pedía el encargo, sin inyectar nada: al quitar la
declaración, cada guard cae y nombra el sitio real. El diferencial «antes caía / después no cae» no
aplica: no hay ningún arreglo que medir.

## 3 · 🔴 Tres defectos de MI censo de ayer (A9)

1. **La forma ③ contaba los literales de la PROPIA declaración.** Contaba cualquier literal que fuera
   elemento de la lista y tuviera una llamada por encima, y `Object.freeze({ 'settingsView.js': 1 })`
   —el estilo de la casa— pone esa llamada encima de la declaración misma. Medido: de los **42**
   candidatos con forma ③, en **22** la ③ es SÓLO el literal de su propia declaración; al quitarla,
   **8 pasan de (a) a (b)** y **14 de (b) a LIMPIO**. El detector se controla con dos pares
   conocidos: `scrum405·EXCEPCIONES` sale como autodeclaración y `scrum413·TIPOS_DECLARADOS` no. Es
   decir: **el «(a)» de 8 de los 10 candidatos (a) lo producía la declaración de la lista**, no un uso.
2. **La prueba que decide no separaba «fixture sin sujeto» de «guard que caza lo real».** Vaciar una
   lista de excepciones sin arreglar el árbol TIENE que tumbar a un guard que mira el árbol. Por eso
   «CONFIRMADO» significaba «la lista alimenta algún caso que cae», no «el caso miente». La columna
   que faltaba es la de §2: qué nombra el fallo.
3. **La sonda vivía siempre en `tests/`**, aunque el comentario dijera «hermano, para que sus rutas
   relativas sigan resolviendo». Faltaba el control de la **copia idéntica**, y corrido da:
   **3 de 46** copias idénticas caen sin vaciar nada, y arrastran **5** de los 36 pares confirmados (0 copias sin ningún caso):
   - `scrum629` barre `tests/` y **acusa a la propia sonda** (sus `.slice(2)` de control, copiados).
     En `RECORTES_DECLARADOS` la lista TAMBIÉN lo tumba —al vaciarla el fallo nombra además
     `scrum578`—, pero con esta sonda el instrumento no puede separar una causa de la otra.
   - `scripts/guard-objetivo-tactil.mjs` y `docs/master/evidencias/SCRUM-863/censo-region-863.mjs`
     no viven en `tests/`: la copia no resuelve sus imports, y su «caen 1 de 1» era **el fichero
     reventando**, no la lista.

Y uno heredado: la población de SCRUM-927 reconoce una lista por su **nombre**
(`NOMBRE_DE_EXCEPCION` casa con `SIN_`), así que los bancos fabricados entran como si fueran listas
de excepciones. Medido en `A_MANO_SIN_METODO`; por el nombre, también `CTX_SIN_CHARGE`,
`LINEA_SIN_IVA`, `SIN_VALORAR` y `FINCAS_SIN_TILDE` tienen pinta de serlo — **sin medir**.

    🔒 Que al vaciar la lista el test caiga dice que la lista le llega. Lo que dice si miente es
       QUÉ nombra al caer: si nombra lo real, es el guard haciendo su trabajo.

## 4 · Qué queda de las cifras de la fase a

- **«35 CONFIRMADOS» no son 35 fixtures que mienten.** Son 35 pares en los que la lista alimenta
  algún caso que cae al vaciarla, y eso incluye guards que funcionan. **Dejan de usarse como
  población del defecto.**
- **La clase (a): 0 fixtures que sustituir** entre los 8 confirmados. Los otros dos candidatos (a)
  son `scrum748` (absuelto) y `scrum480` (NO DECIDIBLE, no se ha tocado).
- **La clase (b) no se ha medido**, y el ⛔ del encargo sobre ella descansaba en la misma etiqueta:
  14 de sus candidatos salen LIMPIOS en cuanto la forma ③ deja de contar la declaración. Si alguien
  quiere trabajar la (b), **el primer paso es arreglar el instrumento, no los tests.**
- **Los 11 NO DECIDIBLES**, sin tocar.

## 5 · Lo que NO se ha hecho, y quién lo hace

- ⛔ **El censo no se ha arreglado.** Es el instrumento, está fuera de la excepción (sólo se autorizó
  la fase b) y es carril de la S3. Lo que habría que hacerle, escrito y **sin implementar**:
  1. que la forma ③ excluya los literales de la propia declaración;
  2. que la sonda sea hermana DE VERDAD del original (su mismo directorio), y que cada par corra
     también la copia idéntica: si esa ya cae, el par sale NO DECIDIBLE;
  3. que el veredicto lea qué nombra el fallo, y sólo acuse cuando nombre algo que no está en el
     árbol real.
- ⛔ **Ningún test de la clase (b) re-clasificado ni tocado.**

## 6 · Hallazgos de paso — leídos, NO corridos, y sin víctima hoy (A7: no son ticket)

Tres de la misma familia que «una condición que su propio código hace inalcanzable»: el mensaje dice
cómo ponerlo en verde, y hacer lo que dice no lo pone en verde.

- `scrum624b` · los dos casos del papel acaban en un `assert.fail` **incondicional** cuando el PDF ya
  imprime el guardado. Borrar la entrada, como pide el mensaje, no los pone en verde. Correrlo
  exigiría cambiar el camino de emisión: no se ha hecho.
- `scrum624b` · «las divergencias son EXACTAMENTE dos» dice «sólo puede menguar» y assertea `=== 2`:
  menguar también lo tumba.
- `scrum644` · el suelo exige `hallazgos.length > 0` y su mensaje dice que, si están todos
  arreglados, hay que vaciar la tabla. Vaciarla no cambia `hallazgos`: seguiría en rojo.
