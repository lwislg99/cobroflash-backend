# SCRUM-520 · El guard de topología deja de depender del reloj

**Medido contra:** `origin/main` = `5091091c973d631f22c3ceb15fdd091aebeed389` · 2026-09-02T12:10:14+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-520-topologia-sin-reloj` · 205 arboles

## 1 · QUE QUERIA MEDIR DE VERDAD — leido del codigo, no del nombre

El aserto retirado era:

```js
const t0 = process.hrtime.bigint();
const t = topologia({ cwd: RAIZ });
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
assert.ok(ms < 2000, `ha tardado ${Math.round(ms)} ms. Un comprobador que se nota en la tanda se
                      desactiva al primer roce, y entonces no comprueba nada.`);
```

**El mensaje del propio aserto dice que el tiempo no era el hecho.** Lo que se queria sostener es
*«que el comprobador haga POCO TRABAJO»*; el reloj era el proxy. Y el proxy esta roto: mide la
maquina, no el comprobador.

Leido el metodo (`scripts/topologia-node-modules.mjs`), el trabajo real es **subir por el arbol de
directorios**: un `lstat` por ancestro hasta dar con un `node_modules`, y un `realpath` cuando lo
encuentra. Eso es acotado y deterministico. **La unica forma de que este comprobador «se note» es
que empiece a RECORRER `node_modules` por dentro** — decenas de miles de ficheros. Ese es el hecho,
y se cuenta; no se cronometra.

## 2 · SALIDA ELEGIDA: (b), medir la topologia. Y el motivo va EN EL CODIGO

* **(a) subir el limite** — descartada, y no por gusto: **es relajarlo**. No arregla nada, mueve el
  punto donde vuelve a fallar. Con cuatro sesiones lanzando la suite, vuelve la semana que viene.
* **(c) sacarlo del camino critico** — habria sido aceptable si de verdad se quisiera medir tiempo.
  No es el caso: el hecho esta disponible directamente.
* **(b) medir el gasto** — ✅. **No se ha subido ningun limite.**

## 3 · LO QUE SE MIDE AHORA (cuatro hechos, ninguno con reloj)

| # | hecho | por que ES el mismo hecho que se queria |
|---|---|---|
| 1 | **cero operaciones DENTRO de un `node_modules`** | recorrerlo es lo unico que lo vuelve caro. Para decir quien comparte con quien basta con RESOLVER la ruta |
| 2 | el gasto cabe en su **TECHO ESTRUCTURAL** | el techo **no es un numero elegido a ojo**: es `lstat` por ancestro de cada ruta + el `realpath`, calculado de las rutas reales |
| 3 | el gasto **no crece con el TAMAÑO** de `node_modules` | 200 entradas cuestan lo mismo que 1. Si costara mas, creceria con el proyecto |
| 4 | dos pasadas seguidas dan el **mismo numero** | condicion de cierre del ticket |

**Medido hoy:** 205 arboles · **545 operaciones** (364 `lstat` + 181 `realpath`) · **2,66 por
arbol** · **0 dentro de `node_modules`**. Dos pasadas seguidas: identicas.

## 4 · ⚠️ LIMITE DECLARADO DEL INSTRUMENTO, y como se tapa

El contador parchea `fs` (`lstat`, `stat`, `readdir`, `readFile`, `opendir`, `realpath.native`) y lo
ve todo... **menos el `spawnSync` de git**. Comprobado: `import { spawnSync }` crea un binding que
ya no mira el objeto del modulo, asi que parchear `child_process` desde fuera **no lo intercepta**.

No se deja el hueco abierto: un proceso por arbol serian **cientos** de procesos y eso si se nota
en la tanda. Se tapa **por AST** —los comentarios no son nodos, asi que el guard no se caza a si
mismo explicandose (SCRUM-203)—: `spawnSync` se llama **una vez** y **desde `worktreesDelRepo`**,
no desde `resolverNodeModules`, que corre por arbol.

## 5 · SUELO DE CEGUERA

Si el contador no ve **ni una** operacion, el test **falla declarandose ciego**. Es el peor cero
posible: un `0` se leeria como «topologia perfecta» cuando significa que el parche no llego al `fs`
que usa el script — y entonces los asertos de coste pasarian **sin haber medido nada**. Va en los
tres tests que cuentan operaciones, no solo en uno.

## 6 · 🔴 TRES COSAS QUE ENCONTRO LA TANDA DE ROJOS, Y NINGUNA LA VI ANTES

### 6.1 · El primer rojo del mecanismo era FALSO: mataba el instrumento, no lo probaba

Degrade el `node_modules` de wt-226 —junction rota— y el test salio en rojo. **Y no valia**: cae el
fichero ENTERO en 50 ms, sin un solo `AssertionError`. El motivo es que el test importa
`typescript`, que vive en `node_modules`: al romperlo, **el test no llega ni a cargar**.

> Un rojo que sale porque el instrumento ha muerto no prueba que el guard vigile. Es la version
> con exit code del verde hueco.

Se degrada ahora un worktree **de usar y tirar** (`git worktree add --no-checkout`, para no pagar
un checkout de 1.709 ficheros), que deja intacto el `node_modules` desde el que corre el test. Asi
el rojo sale **por el aserto** y **nombra lo degradado**:

    🔴 hay árboles que no se han podido leer:
       `…\wt-520-degradado\node_modules` existe pero no se puede resolver

### 6.2 · Mi regla de «entrar en node_modules» dejaba pasar la degradacion cara

La escribi como *«la ruta lleva algo detras»*, razonando que mirar el propio directorio es legitimo.
**Y lo es para `lstat` y `realpath`, pero no para un listado.** El rojo lo destapo: inyecte un
`readdirSync(node_modules)` —que es EXACTAMENTE la degradacion que esto vigila— y **paso en verde**,
porque la ruta del listado es el propio directorio.

Entrar tiene **dos** formas y yo solo miraba una:

| forma | ruta | ¿cuenta como entrar? |
|---|---|---|
| mirar algo que cuelga de el | `node_modules\algo` | si |
| **LISTARLO** (`readdir`, `opendir`) | `node_modules` | **si — y esto se me escapaba** |
| `lstat` / `realpath` sobre el directorio | `node_modules` | no: es lo que el comprobador viene a hacer |

### 6.3 · Mi test de determinismo tenia LA MISMA ENFERMEDAD que el cronometro

Comparaba dos pasadas sobre los worktrees del repo. **Con cuatro sesiones trabajando, si una crea o
quita un worktree entre las dos pasadas, el conjunto cambia, el numero cambia y el test da rojo por
algo que no es el comprobador.** Habria cambiado «falla cuando la maquina esta cargada» por «falla
cuando otra sesion abre una rama»: el mismo defecto con otra cara.

Partido en dos:

* **conjunto FIJO** (banco propio de tres arboles) → determinismo duro, nada se mueve por debajo;
* **arbol real**, reintentando hasta que dos pasadas midan **el mismo conjunto**. Si en tres
  intentos no coinciden, falla **diciendo que es trasiego de worktrees**, no no-determinismo.
  Callarlo seria un verde hueco.

## 7 · LA CONDICION DE CIERRE, MEDIDA

Con seis procesos peleando por CPU y disco contra el mismo `node_modules`:

| | operaciones | reparto | arboles | reloj |
|---|---|---|---|---|
| maquina vacia | **545** | `lstat 364 · realpath 181` | 205 | 219 ms |
| maquina cargada | **545** | `lstat 364 · realpath 181` | 205 | 244 ms |
| cargada, 2ª pasada | **545** | `lstat 364 · realpath 181` | 205 | 243 ms |

**La medida nueva no se movio ni una operacion.** Y no es suerte: cuenta operaciones que dependen
solo del conjunto de rutas y de su estado en disco — no hay ninguna entrada temporal.

⚠️ **Lo que mi carga sintetica NO demuestra:** solo movio el reloj **x1,1** (219 → 244 ms), muy
lejos de los 3.508 ms de la suite completa. Asi que la fragilidad del cronometro sigue apoyandose
en **la medicion del fundador**, no en esta. Lo que esta medicion si demuestra es la otra mitad, que
es la que me tocaba: **la medida nueva es identica en los dos regimenes**.

## 8 · ROJOS: 7/7, POR CODIGO DE SALIDA

| # | rojo inyectado | cae |
|---|---|---|
| 1 | **MECANISMO**: junction ROTA en un worktree real → el guard cae **nombrandolo** | 🔴 |
| 2 | el comprobador LISTA el `node_modules` (la degradacion cara) | 🔴 |
| 3 | el gasto pasa a depender del TAMAÑO de `node_modules` | 🔴 |
| 4 | la medida deja de ser DETERMINISTA | 🔴 |
| 5 | un PROCESO POR ARBOL: git se cuela en el recorrido | 🔴 |
| 6 | **SUELO**: el contador se queda ciego y el test lo declara | 🔴 |
| 7 | **CONTROL NEGATIVO del techo**: deja de contar los ancestros | 🔴 |

El nº 1 va detras de un `--mecanismo` a proposito: degrada la topologia **de verdad** y eso lo ven
las otras tres sesiones, asi que se lanza una vez y no en cada repeticion.

⚠️ **Y ese worktree efimero NO se quita con `git worktree remove`**: al no tener checkout, git lo ve
«con ficheros modificados» y pide `--force`, que AA2 prohibe. Se quita a mano —borrar su `.git`,
borrar el directorio, `prune`— y el arnes **comprueba que la topologia vuelve a 205 arboles**. La
primera vez no lo comprobaba, se quedo listado, y lo vi por el mensaje del propio arnes.

## 9 · Hallazgo de higiene (regla 9): dos worktrees mios abandonados

`wt-main-check` y `wt-main-480`, que cree para medir contra `origin/main` en SCRUM-507, seguian en
`git worktree list` — y **entran en el censo de este guard**. Quitados: 206 → 205 arboles. Mismo
sintoma que arriba: `git worktree remove` no puede con ellos.


## 10 · Lo que NO se ha tocado

Ningun otro guard, `prisma/schema.prisma`, el camino de emision, ningun flag, ninguna base, y nada
de trabajos / presupuestos / firma (sesiones 1, 2 y 3).
