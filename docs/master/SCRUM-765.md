# SCRUM-765 · La puerta que nunca casaba, y los dos suelos que el instrumento no se exigía

**Fecha:** 6-sep-2026 · **Carril:** instrumentos · **Gate:** sin gate — el guard corre en `npm test`

**Medido contra:** `origin/main` = `590e019d2dedb4a951237e37396d7b0c265bef23` · 2026-09-05T18:41:33+01:00

---

## PASO 0 — EL CONTROL QUE DECIDE, ANTES DE TOCAR NADA

`scripts/meta-guard-mutaciones.mjs` sostiene el requisito de entrega de toda la casa. Copiado a
otro nombre en el mismo directorio y ejecutado, **con el árbol de hoy y sin arreglar nada**:

| invocación | exit | reloj | mutaciones ejecutadas | líneas de salida |
|---|---|---|---|---|
| `node scripts/_copia-medicion-765.mjs` | **0** | **0,28 s** | **0** | **0** |
| `node scripts/meta-guard-mutaciones.mjs` | 0 | 76,0 s | **31** | 33 |

**Los dos salen con 0.** Un verde de tres décimas sobre un trabajo de 76 segundos, sin una sola
línea que lo delate.

---

## EL DEFECTO

El bloque de arranque preguntaba «¿me han ejecutado a mí?» así:

```js
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('meta-guard-mutaciones.mjs')) {
```

Medido con una sonda ejecutada en este árbol, en **las cuatro formas de invocación**:

```
argv[1]                : C:\Users\Javier Pereira\cobroflash-b5\scripts\_sonda-puerta-765.mjs
import.meta.url        : file:///C:/Users/Javier%20Pereira/cobroflash-b5/scripts/_sonda-puerta-765.mjs
'file://'+argv1        : NO CASA
'file://'+argv1 (\->/) : NO CASA      ← la variante de scripts/backfill-job-assignees.mjs
pathToFileURL(argv1)   : CASA
```

**Tres diferencias a la vez**: la tercera barra, el sentido de las barras y el `%20` del espacio.
La primera mitad de la condición **no casa nunca en Windows**, así que el script arrancaba **sólo
por el respaldo** — y el respaldo compara por **nombre de fichero**.

🔴 **El respaldo no era una red: era lo que tapaba la avería.** Mientras estuvo puesto, la puerta
rota no se notaba, y por eso vivió desde el día que se escribió.

---

## LO QUE SE HIZO

### ① La puerta, comparando lo mismo con lo mismo

`pathToFileURL(argv[1]).href` construye la URL con las mismas reglas con las que Node compone
`import.meta.url`. **No se inventa nada:** seis scripts del árbol ya usaban esa forma
(`citar-*.mjs`, `diagnostico-dependencias.mjs`, `registro-de-lo-aprobado.mjs`). Esto unifica en la
forma que la casa ya había acertado, y vive en un sitio —
[scripts/_puerta-de-entrada.mjs](scripts/_puerta-de-entrada.mjs) — en vez de copiarse.

**El respaldo `endsWith()` se va con la avería.**

### ② SUELO ① — el censo no puede encoger en silencio

SCRUM-745 ya denunciaba la declaración **coja** (a la que le falta un campo). No cubría la
**borrada entera**: eso saca al guard del censo, el recuento baja de N a N-1 y el verde de al lado
se lee igual. Ahora hay trinquete: **15 guards · 36 declaraciones**, números que **sólo suben**.

Si alguien retira cobertura a propósito, baja el suelo **en el mismo commit** y el diff lo dice.

### ③ SUELO ② — cero mutaciones ejecutadas es CIEGO, no verde

Es lo que de verdad cierra el agujero, porque **arreglar la puerta no basta**: cualquier otro
camino que llegue al final sin mutar nada seguiría saliendo con 0.

**EJECUTADAS = VIVAS + MUDAS.** Las CIEGAS se descartaron *antes* de tocar el árbol: contarlas
convertiría «no supe medir» en «he medido».

### ④ `--solo-censo`

Abre la misma puerta y aplica los suelos **sin mutar nada**, en ~6 s. Existe para que se pueda
comprobar que la puerta abre sin pagar los minutos del trabajo entero — y es lo que ejercita el
test de punta a punta. **`npm run meta:mutaciones` no lo pasa:** el modo del CI sigue siendo el
trabajo completo, y el modo censo lo dice en voz alta en su última línea.

---

## LA VERIFICACIÓN QUE PIDE EL TICKET

| control | resultado |
|---|---|
| 🔴 **El que decide** — copia renombrada, ANTES | exit **0** en **0,28 s**, **0** mutaciones |
| ✅ **Positivo** — por su nombre real, ANTES | **31 vivas · 0 mudas · 0 ciegas**, 76,0 s |
| ✅ **Positivo** — por su nombre real, DESPUÉS | **31 vivas · 0 mudas · 0 ciegas**, 235,8 s |
| ✅ **Contraste** — importado como módulo, ANTES | **no arranca** (8 exports, ninguna mutación) |
| ✅ **Contraste** — importado como módulo, DESPUÉS | **no arranca** (13 exports, ninguna mutación) |

Y la MISMA copia renombrada que antes salía en 0,28 s con la boca cerrada, después del arreglo
**arranca**: 1,60 s y 9 líneas de censo (medido con `--solo-censo`, que abre exactamente la misma
puerta). La puerta ya no casa por el nombre, sino por el fichero — que es la prueba directa de que
el respaldo se ha ido.

---

## EL CENSO DE PUERTAS FRÁGILES (punto 3 del ticket)

Por **AST, no por `grep`**: la cabecera de `_puerta-de-entrada.mjs` escribe la forma prohibida
varias veces para poder explicarla, y un censo de texto se cazaría a sí mismo en su propia prosa
(el defecto de SCRUM-614/617).

**Población: 886 ficheros** `.mjs`/`.js` de `scripts/` y `tests/`. **Tres puertas frágiles**, una
de ellas la de este ticket:

| fichero | forma | respaldo | consecuencia medida |
|---|---|---|---|
| `scripts/meta-guard-mutaciones.mjs` | plantilla | `endsWith()` | **arreglada aquí** |
| `scripts/_prisma-sync.mjs` | plantilla | `endsWith()` | arranca sólo por el respaldo |
| `scripts/backfill-job-assignees.mjs` | plantilla + `.replace(\\→/)` | **ninguno** | su bloque de arranque **no se ejecuta nunca** en Windows |

**Control positivo del censo:** encuentra las tres formas fabricadas (plantilla, suma, y la
variante con `.replace()` dentro), **no** marca la forma buena, y **no** se caza en un comentario.
Y **seis** scripts del árbol ya usaban `pathToFileURL`, que es la prueba de que el censo distingue
lo frágil de lo sano en vez de marcar todo lo que se le parece.

### 🔴 Por qué las otras dos NO se han tocado (reglas 9 y 37)

`backfill-job-assignees.mjs` **escribe en una base de datos**. Arreglarle la puerta no es
cosmética: es **encender un backfill que hoy está apagado**. Eso lo decide el fundador con el diff
delante, no una sesión que venía a otra cosa. `_prisma-sync.mjs` es del mismo carril de BD.

Quedan **reportadas y bajo techo**: el guard exige que el árbol **no gane** puertas frágiles
(`TECHO_PUERTAS_FRAGILES = 2`, un número que **sólo baja**) y que el meta-guard no vuelva a ser una
de ellas. No es una lista blanca: nadie ha aprobado esas dos, están contadas.

---

## EL COSTE — Y POR QUÉ ESTE NÚMERO NO SE PUEDE DAR

Primera lectura: el trabajo completo pasaba de **76,0 s** a **235,8 s**, y eso parecía el precio del
cambio. **No lo es.** Repetido sobre el árbol final, con el mismo código y sin tocar nada entre
medias:

| pasada | mutaciones | reloj |
|---|---|---|
| antes del cambio | 31 | **76,0 s** |
| después, 1.ª medición | 36 | **235,8 s** |
| después, pasada 1 | 36 | **95,2 s** |
| después, pasada 2 | 36 | **239,0 s** |

**Dos pasadas del MISMO código sobre el MISMO árbol: 95,2 s y 239,0 s.** La dispersión de esta
máquina es más grande que la diferencia que se le quería atribuir al cambio, así que **con estos
números el coste del cambio no es medible**. El mismo censo de la frontera ha tardado hoy entre
**1,6 s y 12,7 s** sobre el árbol quieto: misma señal.

Lo que sí está medido es la cota superior del trabajo añadido: **5 de 36 mutaciones** tocan
TypeScript, y emitir un fichero cuesta **~6 ms** (1,7 s los 269). O sea **decenas de milisegundos**,
no minutos. Pero eso es aritmética sobre una parte, no la medición del total, y va dicho así.

---

## TESTS

- [tests/scrum765-la-puerta-y-el-suelo.test.mjs](tests/scrum765-la-puerta-y-el-suelo.test.mjs)

Los cuatro pares `argv[1]` / `import.meta.url` que usa son **los que imprimió la sonda real** en
este árbol, guardados como dato: así el guard no depende de que la máquina donde corra reproduzca
las cuatro formas. Y el último test **arranca el script de verdad** (`--solo-censo`), porque los
tests de función no habrían visto nunca una puerta que no abre.

## MUTACIONES DECLARADAS

| mutación | qué prueba |
|---|---|
| devolver la puerta a `` `file://${argv1}` `` | el defecto entero del ticket |
| aflojar `sueloDelCenso` a `>= 0` | que un guard menos no pasa en silencio |
| que `sueloDeEjecucion` acepte `>= 0` | que cero ejecutadas no sale verde |

---

## HUECOS DECLARADOS

- **El coste del cambio NO es medible con estos números.** Ver arriba: dos pasadas del mismo código
  sobre el mismo árbol dan 95,2 s y 239,0 s.
- La puerta se ha medido en **Windows**, en las cuatro formas de invocación de esta máquina. **No
  se ha medido en Linux ni en el CI**, donde `import.meta.url` y `argv[1]` no tienen las tres
  diferencias que causan el defecto — o sea que allí la forma vieja probablemente casaba, y por eso
  esto no se había visto nunca en un job.
- **No se ha medido** el caso de invocar el script a través de un enlace simbólico o de una ruta
  con distinta capitalización de unidad que la resuelta por Node: los dos valores salen de la misma
  cadena, así que deberían seguir casando, pero **eso es una predicción, no una medición**.
- Las dos puertas frágiles de `scripts/` **siguen rotas**: reportadas, contadas y bajo techo. La de
  `backfill-job-assignees.mjs` deja su script sin arrancar nunca en Windows.
