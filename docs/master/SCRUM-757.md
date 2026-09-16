# SCRUM-757 · La declaración que nadie lee — el lector se callaba cuando no entendía

**Fecha:** 7-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — corre en `npm test`
**Medido contra:** `origin/main` = `7bcf417907020708b5824db42b7b867e0c7e01d2` · 2026-09-07T06:43:54+01:00
**Tanda (árbol ya mezclado):** **5816 pruebas · 5714 en verde · 0 rojas · 102 saltadas** · 147,7 s ·
salida 0. Los 102 saltos declaran motivo y **suman 102** (92 base · 9 `LIBRO_PG_URL` · 1 EPERM).

`npm run meta:mutaciones` → **131 vivas · 0 mudas · 0 ciegas · 0 ficheros muertos**, salida 0, con
las **cuatro** de este ticket entre las vivas.

> **`main` se movió y trajo SCRUM-810**, que deriva los suelos del arnés. **Comprobado por si era
> la condición de parada del encargo: NO lo es.** Entró como ficheros **nuevos**
> (`scripts/_suelo-contra-main.mjs` y su test) y **el diff de `scripts/meta-guard-mutaciones.mjs`
> entre mi base y `main` está VACÍO**: `SUELO_GUARDS`, `SUELO_DECLARACIONES`, `sueloDelCenso` y
> `sueloDeEjecucion` siguen intactos. El suelo de este ticket es nuevo y aparte, y conviven: el
> censo pasa a **45 guards · 134 declaraciones** y las dos familias de tests van en verde juntas.

> `mutacionesDeclaradas` sólo acepta `ts.isStringLiteralLike`. Cualquier otra forma —una
> concatenación `'…' + '…'`— **se descartaba**: la declaración desaparecía del recuento y **el
> guard que vigilaba quedaba sin vigilar**. No es un falso rojo: es un falso verde.
>
> 🔴 **Ha mordido a TRES sesiones en un día** (SCRUM-778, SCRUM-801 y una tercera), y las tres se
> enteraron **sólo porque reescribieron la declaración por otro motivo**. Sin tocarla, invisible.

---

## OBLIGACIÓN 0 · comprobado que no estaba hecho

`git ls-remote --heads origin` → **ninguna rama** de 757 · `git ls-tree origin/main` →
**no existe** `docs/master/SCRUM-757.md` **ni** ningún test de 757. Coincide con el censo del
tablero.

## 🔴 EL ROJO, PRIMERO · corriendo, no contándolo

Se coge una declaración REAL del árbol (`scrum784-el-cuarto-veredicto`, campo `a`) y se escribe la
**misma** como concatenación. Nada más.

```
ANTES     $ node scripts/meta-guard-mutaciones.mjs --solo-censo
          censo · 43 guards · 127 declaraciones (suelos 20 / 54)      EXIT=0

DESPUÉS   $ node scripts/meta-guard-mutaciones.mjs --solo-censo
          censo · 43 guards · 126 declaraciones (suelos 20 / 54)      EXIT=0
          ¿dice algo de la que falta? → 0 líneas.  SILENCIO ABSOLUTO.
```

**127 → 126, salida 0, ni una palabra.**

## ⚠️ Y UNA CORRECCIÓN AL ENUNCIADO, medida: no es silencio en TODAS partes

El encargo dice «ni error, ni aviso, ni recuento que no cuadre». **Medido: depende del camino.**

| camino | ¿qué hace con la declaración concatenada? |
|---|---|
| `--solo-censo` (el rápido, el que se usa para comprobar) | 🔴 **silencio total**, 127 → 126, salida 0 |
| `mutacionesDeclaradas()` — lo que ven todos sus llamantes | 🔴 **silencio**, devuelve N−1 |
| el recuento que alimenta el suelo del censo | 🔴 **silencio**, baja sin decirlo |
| la pasada COMPLETA (≈10 min) | ⚠️ **sí habla**: `? scrum784… · CIEGO (declaración incompleta)`, salida **2** |

O sea: el aviso existía, pero **sólo en el camino que tarda diez minutos**, y **decía una mentira**:

```
· scrum784-el-cuarto-veredicto.test.mjs · una declaración está INCOMPLETA (le faltan: a) …
```

**«le faltan: a» es falso**: el campo `a` está escrito, delante de los ojos de quien lo lea. Y no
daba **la línea**. Eso manda a buscar un campo ausente que está presente — que es exactamente por
qué las tres sesiones no lo entendieron hasta reescribir la declaración.

**Esto no rebaja el ticket: lo afila.** El defecto no era «no dice nada» sino **«se calla donde se
mira y miente donde no se mira»**.

## EL SUELO · lo que no se puede evaluar se DENUNCIA, con fichero y línea

Va **arriba del todo del bloque de arranque**, antes de que ningún camino se bifurque, así que lo
ven los dos. Y distingue **dos averías que antes salían por la misma puerta**:

| | qué significa | dónde manda a mirar |
|---|---|---|
| `faltan` | el campo **no está escrito**. Media declaración | a escribirlo |
| `noEvaluables` | el campo **está**, pero no en una forma legible | a esa línea, a cambiar la forma |

```
🔴 1 DECLARACIÓN(ES) QUE NO PUEDO EVALUAR. No se descartan en silencio: cada una es un guard
   que se queda SIN VIGILAR y un recuento que baja sin que nada lo diga.
   · scrum784-el-cuarto-veredicto.test.mjs:257 · el campo `a` (línea 261) ESTÁ, pero no es un
     literal: es BinaryExpression — `' return ' + 'false;'`

   Los cuatro campos van como UN literal de cadena. Ni concatenaciones, ni plantillas, ni variables:
     a: 'primera línea\nsegunda línea'   ← así
     a: 'primera ' + 'línea'          ← así NO

EXIT=2
```

Fichero, **línea del objeto**, **línea del campo**, qué campo, **qué forma tiene** y su texto. Y
sale con **2**.

**El bucle viejo de `incompletas` se deja a propósito**, con un comentario: ya no debería
alcanzarse —las dos mitades derivan de `censoDeDeclaraciones()`—, así que llegar ahí significa que
alguien movió o aflojó el suelo nuevo, y entonces sigue habiendo segunda línea en vez de un verde.

## ④ EL IMPACTO, MEDIDO **ANTES** DE CONECTARLO

| | |
|---|---|
| objetos de declaración en el árbol | **127** |
| campos que **no** son literal único | **0** |
| guards afectados | **0** |

**Cero.** Conectar el suelo no podía poner rojo a `main`, y se comprobó antes de conectarlo, no
después. *(Tras añadir este ticket son **131** en **44** guards —las 4 que declara su propio test—
y, ya con `main` mezclado y SCRUM-810 dentro, **134** en **45**.)*

## ③ ¿SE ACEPTA ADEMÁS LA CONCATENACIÓN? — **NO**, y el argumento

Antes del argumento, un hecho que salió midiendo y que **corrige lo que yo daba por supuesto**:
una **plantilla sin sustituciones** —`` `así` ``— **ya se lee**, porque `isStringLiteralLike`
incluye `NoSubstitutionTemplateLiteral`. El contrato real no era «comillas simples», sino **«un
literal sin nada que evaluar dentro»**. Estaba sin escribir; ahora lo fija un test.

**No se acepta la concatenación, por tres motivos y ninguno es de gusto:**

1. **El valor tiene que casar con el fichero BYTE A BYTE.** Un literal único enseña los bytes
   exactos en un sitio; una concatenación los parte e invita a razonar sobre la unión — y ése es
   justo el punto donde se pierde un espacio. Es un argumento de corrección, no de estilo.
2. **La pendiente.** `'a' + 'b'` está a una tecla de `'a' + variable`, que **no** es evaluable sin
   ejecutar. Aceptar la primera hace creer que la familia entera funciona, y devuelve el agujero
   por la puerta de al lado.
3. **Demanda medida: 0 de 127.** Nadie lo escribe hoy. Los tres casos que mordieron fueron sesiones
   **escribiendo**, y con el suelo puesto se enteran en el acto, con fichero, línea y la forma
   correcta delante.

**Y el suelo va igual, se acepte o no** —que es lo que pedía el encargo—: mañana aparecerá una
tercera forma. **Revertir esta decisión es barato**: plegar concatenaciones de literales son ~8
líneas y el suelo seguiría cubriendo el resto. La decisión de aceptarlas es del asesor; lo que no
puede volver es el silencio.

## Controles

* 🔴 **EL QUE DECIDE:** la misma declaración concatenada → **antes** desaparece callando (127→126,
  salida 0); **después** denuncia con fichero y línea y sale con 2. Los dos sentidos, corridos.
* ✅ **POSITIVO:** el censo del árbol da **127**, exactamente lo mismo que antes de tocar nada, y
  **cero ilegibles**. Si al cerrar el hueco hubiera cambiado esa cifra, se habría roto algo más.
* ✅ **NEGATIVO:** un fichero lleno de objetos raros —`{ fichero: 'x' + 'y', … }`, plantillas con
  sustitución, un `OTRA_COSA = [{ a: 'x' + 'y' }]`— **no se denuncia**: sólo se mira dentro de
  `MUTACIONES_QUE_ME_TUMBAN`. Marcar todo lo que no se entiende convierte el suelo en ruido, y el
  ruido se aprende a ignorar.

## Ficheros

| fichero | qué cambia |
|---|---|
| `scripts/meta-guard-mutaciones.mjs` | el lector distingue `faltan` de `noEvaluables` y apunta fichero, línea y forma; el **suelo nuevo** en el arranque, antes de que los caminos se bifurquen; el bucle viejo, reescrito como segunda línea |
| `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs` | **nuevo** · 9 pruebas: el rojo, la caída con el mecanismo viejo, los dos controles positivos (incluido el del árbol real), el negativo, la distinción `faltan`/`noEvaluables`, los cuatro campos uno a uno y el hecho de la plantilla. Declara **4** mutaciones, todas con `a` como **literal único** |
| `docs/master/SCRUM-757.md` | **nuevo** · esta entrada |

**⛔ No se ha tocado:** `cayo()`, `murioElFichero()`, `MUERTE_CUENTA_COMO` ni ningún veredicto ·
`SUELO_GUARDS`, `SUELO_DECLARACIONES`, `sueloDelCenso` ni `sueloDeEjecucion` — los suelos del arnés
que **SCRUM-774 está derivando ahora mismo**. El suelo de este ticket es **nuevo y aparte**, y no
lee ni modifica ninguno de ésos.

## Huecos declarados

1. **El suelo dice que no puede evaluar, no evalúa.** Si mañana alguien quiere concatenaciones, hay
   que plegarlas; hoy sólo se denuncian.
2. **Sólo mira los cuatro campos del contrato.** Una clave de más en el objeto —`porque: …`— se
   ignora en silencio, como antes. No es este ticket, pero es la misma familia.
3. **La segunda línea (el bucle viejo) no está ejercitada**, porque el suelo sale antes. Se sabe
   que es inalcanzable por construcción, no porque se haya visto correr.
4. **No se ha medido si otros lectores de la casa** tienen el mismo patrón de «descartar lo que no
   entiendo». Este ticket cierra el de las declaraciones de mutación; nadie ha censado los demás.
