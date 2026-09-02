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

## 6 · Lo que NO se ha tocado

Ningun otro guard, `prisma/schema.prisma`, el camino de emision, ningun flag, ninguna base, y nada
de trabajos / presupuestos / firma (sesiones 1, 2 y 3).
