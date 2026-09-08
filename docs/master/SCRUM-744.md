# SCRUM-744 · El guard miraba cómo se escribe el comando, no qué hace — y su lista tenía dos entradas

**Fecha:** 4-sep-2026 · **Carril:** guard `guard-dangerous` (AA2) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `a84680db458feb0db41fdd63e227bb22ea012daf` · 2026-09-04T22:49:46+01:00
**Medido en:** host `DESKTOP-A24926K` · rama `scrum-744-guard-por-la-accion`

**Tanda:** **5.368 pruebas · 5.280 en verde · 0 fallos · 88 saltadas**, con `main` ya mergeado
dentro y medida DESPUÉS del último cambio, entrada incluida.

La base sobre `main` limpio, medida al empezar sobre un worktree recién nacido de
`4204e7813d399fe00d0db98c61c92dfa70cf0d9b`, daba **5.345 · 5.257 · 0 fallos · 88 saltadas**.
**Los +23: 7 son de este ticket** (medidos corriendo el fichero solo) y **16** vienen del `main`
nuevo que se mergeó dentro —SCRUM-740 y SCRUM-742—. **No hay comparación de fan-out nombre a
nombre**, así que ese reparto es aritmética, no medición.

---

## 🔴 EL ROJO, PRIMERO Y CON EL HOOK REAL: OCHO ACCIONES DESTRUCTIVAS NO SALTABAN

El encargo lo pidió así —*«escribe la invocación por `require.resolve` de un comando destructivo y
comprueba que HOY NO SALTA. Sin ver ese verde falso no sabrás si lo arreglaste»*— y se hizo antes de
tocar una línea, contra `evaluar()` del hook de verdad y con el sentinel ausente.

**Ocho de veintiuna formas medidas pasaban.** Y no son un defecto con ocho caras: son **DOS
defectos distintos**, y el segundo no estaba en el encargo.

### ① LA FORMA — el patrón describía una manera de teclear

```
prisma[^"]{0,40}db +push
```

Exigía los dos verbos **separados por espacios**, a **menos de 40 caracteres** del nombre y **sin
una comilla por medio**. Eso no es la acción: es una ortografía. La casa lanza el CLI de otra —
`spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push'])`, en cuatro
sitios— y ahí los verbos van en un array, con comillas y comas entre ellos.

Y encima **`node -e` no estaba en la lista de envoltorios**. Como todo su contenido viaja
entrecomillado, el árbitro de SCRUM-454 —*«una coincidencia sólo cuenta si toca al menos un
carácter que no venía de dentro de unas comillas»*— lo descontaba entero **como mención**.

### ② LA LISTA — y esto es lo que el encargo mandaba censar

> *«Si la lista sólo tiene uno, ése es el hallazgo.»*

Tenía **dos**: `migrate dev` y `db push`. O sea que **`npx prisma migrate reset` —que BORRA Y
RECREA LA BASE ENTERA— pasaba**. Y `db execute`, que ejecuta contra la base el SQL que le des sin
clasificarlo, tampoco estaba.

🔴 **`migrate reset --force` sí caía, pero por la regla de `--force`.** Por accidente, no porque
nadie lo hubiera considerado. Un guard que sólo para el caso peligroso cuando además lleva otra
bandera no sabe lo que protege — y el que lo lea creerá que sí.

## PASO 0

**ENTRADA.** No hay pantalla. El hook es `PreToolUse` y está enganchado en `.claude/settings.json`
a Bash y PowerShell: entra **cada comando que teclea cualquiera de las sesiones**, hoy nueve
árboles a la vez. La víctima es la base de datos del fundador, y el guard existe por el
casi-accidente del 7-ago-2026.

**MECANISMO.** Estaba casi todo construido y es bueno: tokenizado con máscara de comillas
(SCRUM-454), recursión en envoltorios, sustitución de comandos, sentinel de un solo uso para
`db push`. **No hacía falta un mecanismo nuevo: faltaba una entrada en su lista de envoltorios y
le sobraba una manera de escribir en su patrón.**

## El arreglo, en dos piezas

**① `BANDERAS_DE_CODIGO`** — un mapa programa → banderas cuyo argumento **es código**: `node` →
`-e`, `--eval`, `-p`, `--print`. Su payload se analiza además con **la máscara a cero**.

🔴 **Y NO es meter `node` en `ENVOLTORIOS` a secas.** Eso reabriría el falso positivo exacto que
SCRUM-454 midió y cerró: `node medir.mjs "git push --force origin main"`. **La diferencia no es el
programa: es la bandera.** `-e` lleva código; un argumento posicional lleva datos. Hay una mutación
dedicada a esto (⑤) que lo demuestra cayendo.

**② `subcomando(a, b)`** — tolera lo que separa a los dos verbos (`'db','push'`, `db  push`) y
ensancha la distancia hasta el nombre, porque `require.resolve('prisma/build/…')` ya se come esos
40. **Lo que NO se toca es el árbitro de la máscara**, así que
`git commit -m "no ejecutes prisma db push"` sigue pasando.

**La lista pasa de 2 a 7 subcomandos**, y cada uno de los cinco nuevos con su uso **medido en el
árbol** —barrido sobre `package.json`, `scripts/`, `src/` y `.github/`—:

| subcomando | por qué | ¿lo usa alguien? |
|---|---|---|
| `migrate reset` | borra y recrea la base entera | **nadie** |
| `db execute` | ejecuta el SQL tal cual, sin clasificarlo | sólo dentro de `scripts/aplicar-sql-dev.mjs`, que es el camino bueno |
| `migrate deploy` | aplica migraciones, y no existe `prisma/migrations` | **nadie** — y aparecía en `preflight-schema-drift.mjs` sólo **dentro de un comentario** que dice *«cero `db push`, cero `migrate deploy`»* |
| `migrate resolve` | escribe la tabla de migraciones | **nadie** |
| `db pull` | **REESCRIBE `prisma/schema.prisma`**, que es del fundador | **nadie** |

**Bloquearlos no le quita el camino a nadie**, y eso está medido, no supuesto. `migrate deploy` es
el aviso de siempre: mencionar no es usar.

## El censo, que es el entregable y no un detalle

`tests/scrum744-el-guard-mira-la-accion.test.mjs` no lleva una lista de casos: lleva **los 19
subcomandos hoja que publica el CLI instalado** (9 de primer nivel + 4 de `db` + 6 de `migrate`,
sacados de su propio `--help`), cada uno con **veredicto y motivo**, y se prueban **por las cuatro
formas** de lanzarlo que existen en esta casa. Son **76 comprobaciones** de un vistazo.

Si Prisma añade un subcomando, el suelo cae y alguien tiene que clasificarlo. **Es la única forma
de que la lista no vuelva a envejecer hasta tener dos.**

**Los tres que NO se bloquean, con su motivo escrito para poder discutirlo:** `db seed` y `studio`
tienen camino declarado en `package.json`; `format` sólo reformatea y la palabra es demasiado común
para arriesgar el falso positivo.

## 🔴 Y UNA MUTACIÓN ENCONTRÓ UN DEFECTO EN MI PROPIO TEST

La mutación ② —*«el payload de `-e` vuelve a contar como mención»*— **no caía**. La tanda seguía
verde con la mitad del arreglo desactivada.

El motivo: **todos mis casos llevaban el comando en un ARRAY**. En `[…,'db','push']` los
separadores `','` quedan **fuera** de las comillas, así que la coincidencia toca texto no
enmascarado y cuenta igual sin necesidad de vaciar la máscara. Era una regla que siempre pasaba.

El vaciado **sí** hace falta para la forma más natural de todas: el comando entero dentro de **una
sola cadena**. Medido con el hook, con la línea y sin ella:

| | sin vaciar la máscara | vaciándola (el arreglo) |
|---|---|---|
| `node -e "execSync('npx prisma migrate reset')"` | **🔴 pasa** | BLOQUEA |
| `node -e "…[…,'db','push'])"` | BLOQUEA | BLOQUEA |

Se añadieron los dos casos que faltaban. **Sin la mutación, esa línea del arreglo habría entrado
sin que nada demostrara que sostiene algo** — y la habría borrado el primero que pasara por aquí
buscando simplificar.

## Verificado en rojo — siete mutaciones

Cada una guarda los BYTES, comprueba que cambió **ese** fichero, corre **los cuatro** ficheros de
test que vigilan este guard (176, 176b, 454 y el nuevo), restaura y verifica con `Buffer.compare`.

| se rompe a propósito | cae por |
|---|---|
| ① se quita `node -e` de las banderas de código (el defecto original) | «lo destructivo cae ESCRIBA COMO SE ESCRIBA» |
| ② el payload de `-e` vuelve a contar como mención | «`node -e` se analiza como CÓDIGO» ← **la que encontró el hueco de mi test** |
| ③ el patrón vuelve a exigir espacios | «lo destructivo cae ESCRIBA COMO SE ESCRIBA» |
| ④ se vacía la lista de subcomandos nuevos | las tres del censo |
| ⑤ se mete `node` en `ENVOLTORIOS` a secas —el arreglo «obvio»— | **SCRUM-454**: «medir el propio guard pasándole el comando como argumento» |
| ⑥ **CONTROL NEGATIVO**: se reescribe un comentario del hook | **no cae** |
| ⑦ el censo del test pierde una entrada | «SUELO: el censo cubre los subcomandos del CLI instalado» |

La ⑤ es la que más vale: el arreglo equivocado y evidente **rompe un test ajeno de hace un mes**,
que es exactamente lo que tiene que pasar.

## Ficheros

`.claude/hooks/guard-dangerous.mjs` (`BANDERAS_DE_CODIGO`, la recursión por bandera, `subcomando()`,
cinco entradas nuevas y la lista de HUECOS puesta al día) ·
`tests/scrum744-el-guard-mira-la-accion.test.mjs` (**nuevo**, 7 tests / 76 comprobaciones) ·
`docs/RUNBOOKS.md` (§R20: el guard ya mira esta forma) · esta entrada.

**No se ha tocado:** ningún test existente —los 3 que ya vigilaban el guard pasan sin cambios—  ·
`prisma/schema.prisma` · `package.json` · `.claude/settings.json` · sin dependencias nuevas
(regla 36) · el suelo de la tanda.

## Estado del árbol

* Rama nacida de `origin/main` = `4204e7813d399fe00d0db98c61c92dfa70cf0d9b`. Durante la sesión
  `origin/main` avanzó a `a84680db` —con el merge de SCRUM-742, que trae el §R20 que este ticket
  cita—: se **mergeó `main` DENTRO** y se repitió la verificación entera sobre el árbol mezclado.
* Mientras R20 no estaba en `main`, las referencias a él se escribieron **nombrando los cuatro
  ficheros** en vez de citar una sección que aquí no existía; se cerraron al mergear.
* Cero CR en disco en los tres ficheros tocados, medido por **BYTES**.
* `npm run guards:entrada` en verde.

## 🔴 Los huecos que declaro

1. **Un script del repo que por dentro lance algo destructivo sigue pasando.** El hook ve
   `node scripts/x.mjs`, no lo que ese fichero hace. Es DELIBERADO —los scripts pasan por PR— y
   `scripts/aplicar-sql-dev.mjs` vive justo ahí a propósito. Pero es un hueco real: quien quiera
   saltarse el guard sólo tiene que escribir un fichero.
2. **`BANDERAS_DE_CODIGO` sólo cubre `node`.** `python -c`, `perl -e`, `ruby -e` o `deno eval`
   tienen el mismo agujero. No se añaden porque no aparecen en este repo y cada uno necesita su
   propio control de falso positivo; queda escrito para que no sorprenda.
3. **No he probado el hook END-TO-END**, lanzado por Claude Code con stdin real: se prueba
   `evaluar()`, que es su función exportada. El cableado en `.claude/settings.json` no lo verifica
   este ticket.
4. **La ofuscación sigue sin cubrirse** (variables, concatenación, base64), como ya estaba
   declarado desde SCRUM-176. Ensanchar el patrón no cambia eso.
5. **`db seed`, `studio` y `format` quedan fuera por decisión mía**, con su motivo en el censo. Si
   el fundador prefiere bloquearlos, es una línea — pero es su decisión, no la mía.
6. **El censo de 19 subcomandos es de `prisma` 6.18.0.** Si se sube de versión, ese número cambia y
   el suelo lo dirá; lo que no dirá es si un subcomando **existente** cambió lo que hace.

## HALLAZGOS FUERA DE CARRIL — una línea cada uno

* `bash scripts/db-push-prod` y `npm run db:seed` llegan al hook como el nombre del script, así que ninguna de las dos rutas declaradas pasa por la comprobación del sentinel: es el hueco 1 con nombre y apellidos, y son las dos rutas que de verdad tocan producción.
* El sentinel `.claude/allow-db-push` **se consume aunque el usuario deniegue después el permiso** en el prompt de Claude Code — está declarado en el propio hook como residuo conocido, y sigue ahí: un OK del fundador se puede gastar sin que se ejecute nada.
* La tanda de `main` limpio sigue en **CERO fallos** (5.345 · 5.257 verde · 88 saltadas), segunda medición limpia consecutiva de esta máquina.
