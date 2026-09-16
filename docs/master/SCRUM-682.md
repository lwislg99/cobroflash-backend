# SCRUM-682 · el número de rutas del precache — medido, y por qué no hay nada que construir

**Medido contra:** `origin/main` = `795e9c289e7028c33f37df258b3a7611a5a29e02` · 2026-09-02T17:49:28+02:00

**Titular: los puntos 2 y 4 del encargo ya están hechos, y el punto 3 parte de una premisa falsa.
El número nunca estuvo mal: cambia casi cada vez que alguien añade una pantalla.**

---

## 1 · Quién depende del número, y PARA QUÉ

Barrido: `tests/`, `scripts/`, `docs/`, `public/` · 1.222 ficheros · toda cifra de 2-3 dígitos a
menos de 60 caracteres de `rutas|entradas|precach|SHELL|addAll`.

| quién | qué hace con el número | ¿valida? |
|---|---|---|
| `tests/scrum274-shell-alineado.test.mjs:51` · `MINIMO_SCRIPTS = 45` | **suelo** `>=`, contra el escáner ciego | no: es un mínimo, no un recuento |
| `tests/scrum274-huella-estaticos.test.mjs:35` · `MINIMO_SCRIPTS = 31` | **suelo** `>=`, mismo papel | no |
| `tests/scrum274-shell-alineado.test.mjs:165,184` | compara **poblaciones** índice ↔ SHELL | sí, y **sin número**: cuenta las dos listas al ejecutarse |
| `tests/scrum274-shell-alineado.test.mjs:218` | cada ruta del SHELL **existe en disco** | sí, y **sin número**: itera la lista real |
| `tests/scrum453-precache-con-huella.test.mjs:139` | «los 51 scripts» en un **mensaje de error** | no: prosa |
| comentarios `:57`, `:122`, `:248` y ~14 entradas de `docs/master/` | **solo documentan** | no |

> 🔴 **NADIE valida ni itera sobre un número.** Los dos únicos números vivos son **suelos de
> ceguera** (`>=`), deliberadamente holgados y con su motivo escrito en el sitio
> (`scrum274-shell-alineado.test.mjs:44-51`): *«se exige el MÍNIMO, no el número exacto, para que
> añadir una pantalla no obligue a tocar el guard — uno que estorba en cada PR acaba desactivado»*.
> SCRUM-450 ya los recalibró una vez (31 → 45) **a conciencia**. No se tocan.

**Punto 2 del encargo: no hay nada que quitar.** Ya se cuenta la lista al ejecutarse.

---

## 2 · 🔴 El punto 3 parte de una premisa falsa: el número no ha «derivado»

Se contó el `SHELL` **en cada uno de los 61 commits que tocaron `public/sw.js`**, no se heredó de
ningún informe:

```
2026-05-22   —  →  16    PWA instalable
2026-07-16  16  →  31    SCRUM-45 · cache-busting
2026-08-03  31  →  34    SCRUM-274
   … 43 valores distintos, en 46 cambios …
2026-09-02  73  →  74    merge de SCRUM-670
```

**Cada documento que dice 31, 50, 51, 54 o 69 era CORRECTO EL DÍA QUE SE ESCRIBIÓ.** `SCRUM-652.md`
dice 69 y el `SHELL` tenía exactamente 69 en el commit que lo escribió (`fb21d558`, 2-sep). El 71
de las notas del fundador también fue real (`45768e6d`, 2-sep, SCRUM-609). Hoy son 74.

Lo que hay no es un número mal mantenido: es un número que **cambia casi cada vez que nace una
pantalla**, y que en prosa caduca en horas. Reescribir los 43 valores históricos sería falsear
registros fechados que eran ciertos.

> **La conclusión operativa, y es la única acción de este ticket:** el recuento **no se escribe
> como hecho vivo** en ningún documento nuevo. Se recuenta cuando se necesita, y cuesta 0,05 s:
>
> ```
> node -e "const s=require('fs').readFileSync('public/sw.js','utf8');const b=s.match(/const SHELL = \[([\s\S]*?)\];/);console.log([...b[1].matchAll(/'([^']+)'/g)].length)"
> ```
>
> **El daño real de este número en prosa ya está documentado:** el encargo de SCRUM-653 llegó con
> la coordenada `sw.js:95` sacada de `SCRUM-652.md:170`, donde era cierta. Hoy `:95` es una ruta
> cualquiera del array y el `addAll` está en `:115`. Una coordenada vieja no se distingue de una
> equivocada.

---

## 3 · Punto 4 — «lo que de verdad protege» — YA EXISTE, y muerde

`tests/scrum274-shell-alineado.test.mjs:218`, *«toda entrada del SHELL resuelve a un fichero del
árbol»* (SCRUM-274 +302 +450 +453). No se leyó: **se ejecutó**, sobre `795e9c28`, con el árbol
limpio antes de cada inyección.

| caso inyectado | resultado | quién cae |
|---|---|---|
| `/dashboard/js/parteDeTrabajoView.js` (no existe, **es** `.js`) | 🔴 **2 caen, exit 1** | `:184` y `:218`, **nombrando la ruta** |
| `/icons/icon-512-nuevo.png` (no existe, **no es** `.js`) | 🔴 **1 cae, exit 1** | solo `:218` — y es correcto: `:184` solo compara scripts |
| **reordenar las 74** (misma población, orden invertido) | ✅ **23 pass, 0 fail, exit 0** | nada de población vigila la secuencia |
| romper el formato del array (`const SHELL = [].concat([`) | 🔴 **5 caen, exit 1** | «🔴 ESCÁNER CIEGO: no encuentro `const SHELL`…» |

El mensaje que da al caer ya explica la atomicidad:

> *«`cache.addAll` es ATÓMICO: con UNA sola que no resuelva, el `install` falla entero y NADIE
> tiene offline — sin error visible en ninguna parte. Con red no se nota.»*

Y trae lo que un guard así necesita para sobrevivir: **lista de excepciones declarada**
(`SERVIDAS_POR_EL_SERVIDOR`, hoy vacía), **control negativo sobre corpus sintético** —porque una
lista vacía hace verdad cualquier afirmación sobre sus elementos— y el test de que la excepción
**no es una puerta trasera** (`:284`).

**Construir esto otra vez habría sido el segundo extractor de SCRUM-670: dos mecanismos para lo
mismo, y el que acusa en falso se desactiva.**

---

## 4 · Lo que NO se hizo, y es deliberado

* **No se tocan los dos suelos** (45 y 31). Son holgados a propósito, con su motivo escrito, y
  SCRUM-450 los recalibró a conciencia. Apretarlos al número exacto los convertiría en el estorbo
  que su propio comentario dice que acaba desactivado.
* **No se reescriben los números históricos** de `docs/master/`. Eran ciertos con su fecha.
* **No se construye guard nuevo**: `:218` ya cubre `.js` y no-`.js`, con suelo y control negativo.
* **No se tocó el orden del `SHELL`** ni `prisma/schema.prisma`.

## 5 · Hallazgo de otro carril, reportado y no arreglado (regla 9)

`docs/master/SCRUM-652.md:170` da `sw.js:95` como la línea del `addAll`; hoy el `addAll` está en
`:115`. Era cierto al escribirse. **No se corrige aquí**: es el registro fechado de otro ticket, y
la lección de este es justamente que no se reescriben. Queda dicho para quien lo lea.
