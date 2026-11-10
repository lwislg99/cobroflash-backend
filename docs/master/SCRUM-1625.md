# SCRUM-1625 · ¿Por qué el brazo CON de scrum1405c ④ pierde ahora en el 7,8 % de las pasadas y no en el 3,4 %? (J3, solo medir)

**Medido contra:** `origin/main` = `c992358dc42fa7407e2960f826bd36d68bc3d47e` · 2026-10-27T15:57:48Z (sesión `jv-j3by`, puesto J3 del equipo de Javier, por encargo del orquestador `cobroflash-backend-8b`. La hora es la cabecera `Date:` de GitHub al escribir. Lo medido son logs de CI ya hechos, del 14 al 27-oct; la rama salió de `ce1111a68`. No toco el test, la tubería ni ninguna constante: regla 41.)

A9: aviso → A10 «El código de salida es el del último tramo de la tubería.» — no se pudo comprobar: el recolector salió 0 dos veces sin haber hecho nada (la guarda de `main` comparaba una ruta con «%20» y nunca arrancaba; y la primera pasada iba con `| tail` y una ruta mal), y eso es cómo lanzo un guion puntual fuera de la tanda, que ningún test del árbol ve; lo que queda es que `covariables.mjs` imprime «CONTROLES · 7 de 7» antes de nada y su salida se lee entera.

**Lo pide:** la descripción de SCRUM-1625 (abierto por el orquestador por decisión del fundador del 27-oct). **Entrega en Jira:** SCRUM-1625 c.21102.

## Población e instrumento

- **No hay censo nuevo.** La pérdida por pasada sale de los dos que existen: 1405d (`evidencias/SCRUM-1405/j3n-1405d/censo.tsv`, en `main`; 302 jobs, 14-oct 07:59Z → 20-oct 15:35Z) y 1405f (`evidencias/SCRUM-1405/j3bw-1405f/censo.tsv`, rama `scrum-1405f-cuarto-desde-1574` @`67e6cf729`, sin PR al medir; 440 jobs, 21-oct 13:18Z → 27-oct 15:27Z). **742 jobs, 2.968 pasadas del brazo CON.**
- `evidencias/SCRUM-1625/covariables.mjs` baja otra vez el log de esos 742 jobs y saca lo que los censos no guardaron: versión del runner y de su imagen, región, node, nº de tests de la tanda, duración de la tanda y de ④, y qué versión de ④ corrió. **Positivo en cada log:** la lista «con» del log tiene que ser la del censo, o la fila sale CIEGO. Siete controles fabricados, entre ellos el log vacío (→ CIEGO) y una lista que no casa.
- La primera pasada dio **38 CIEGO**: los 38 jobs de 1405d con ④ en rojo, cuya lista sólo va en el `AssertionError`. Corregido el lector (control ③ter, calibrado con el job `115746857769`): **742 de 742 legibles** (`cov.tsv`).
- **El hueco entre los dos censos** (`--hueco 2026-10-20T15:35:35Z 2026-10-21T13:18:42Z`): 19 runs, 4 sin el job obligatorio, 15 con veredicto, 14 con ④ legible (`hueco.tsv`). Aquí la lista sale del propio log: no hay censo con que cruzarla, y la fila lo dice (`fuente = log`).

## 1 · Escalón, no rampa

| tramo (742 jobs en orden de tiempo, partidos por el mejor corte) | pasadas CON | pierden | % |
|---|---|---|---|
| antes · 1.ª mitad | 616 | 21 | 3,4 |
| antes · 2.ª mitad | 616 | 20 | 3,2 |
| después · 1.ª mitad | 868 | 82 | 9,4 |
| después · 2.ª mitad | 868 | 55 | 6,3 |

- Por día: del 14 al 20-oct, del 1,4 % al 5,0 %; del 22 al 27-oct, del 5,1 % al 9,6 %. No sube dentro de ninguno de los dos periodos.
- **Mejor corte único:** entre el job `119268334041` (21-oct 14:03:34Z, `e43d28cfb`) y el `119268912386` (14:05:03Z, `86296fe9f`); 41/1.232 (3,3 %) → 137/1.736 (7,9 %); 2·g = 28,5, con χ²₁ al 0,1 % = 10,8. **La posición es imprecisa:** entre el 20-oct 15:35Z y el 21-oct 12:21Z no hay ningún job, y los primeros de 1405f pierden 0.

## 2 · ¿Con qué? Dos sospechosos confundidos; no lo demuestro

En el hueco cambian a la vez:

| qué | antes | después |
|---|---|---|
| runner de GitHub | 2.337.0 en los 302 jobs | 2.338.0 en los 440 y en los 15 del hueco |
| ④ | la de 1405c (`e2be1c9fd`): la sonda se mide **al cargar el fichero** y ④ se salta si da 0 | #2634 (1405d, `1e00b1b9d`, 12:43:49Z) y **#2638 (1574, `b10c9b6ca`, 13:18:39Z)**: la sonda (un hijo que escribe 1 MiB a una tubería) se mide **al principio de ④, justo antes de los dos brazos** |

- Lo que NO cambia: `brazo()`, la cobaya y `scripts/tuberia-bloqueante.mjs` (último cambio, `e2be1c9fd`, 14-oct).
- Merges de `main` en el hueco: `fe65a8b7f` (#2625, 20-oct 15:35:30Z) · `e2cd370cc` (#2632) · `1e00b1b9d` (#2634) · `b26de3f68` (#2630) · `67dde0caf` (#2635) · `321ce160b` (#2637) · `3c60a7fd0` (#2631) · `b10c9b6ca` (#2638, 13:18:39Z). Salvo #2634 y #2638, ninguno toca el test, el módulo, `scripts/tanda-con-veredicto.mjs`, `ci.yml` ni `package.json` (`git log` de esas rutas).
- **La única pata que los separa es el hueco:** 13 jobs con el runner nuevo y el ④ viejo (6 de 1405c, 7 de 1405d) → **2 de 52 pasadas pierden (3,8 %)**, como antes del escalón. Apunta a 1574 y no al runner, **pero no decide**: con el 7,8 % se esperarían ~4, y P(≤2) ≈ 0,2. **Correlación, no causa.**

## 3 · Lo que no es (medido)

- **Nº de tests y duración** (crecen con el tiempo, así que se miran dentro de 1405f, donde el escalón ya no está): por terciles, más tests → 8,5 % / 8,1 % / 6,9 %; tanda más larga → 9,2 % / 8,3 % / 5,8 %; ④ más largo → 9,8 % / 7,8 % / 5,8 %. Van al revés de «la tanda crece y pierde más».
- **Node y la imagen**, el mismo día con dos valores: 22-oct, 24.21.0 → 10,6 % (104 pasadas), 24.22.0 → 5,3 % (76), 24.22.1 → 8,3 % (24); 27-oct, 24.21.0 → 10,7 % (84), 24.22.1 → 5,0 % (20). La versión nueva no pierde más.
- **Región y evento:** sin patrón (tabla entera en `analiza-salida.txt`).
- **La selección de 1405d:** dejó fuera 14 jobs con la sonda a 0, y en 1405f los jobs con la sonda a 0 pierden menos (3 de 108, 2,8 %, frente a 134 de 1.652, 8,1 %). Haberlos incluido habría bajado la cifra vieja.

## 4 · El tope de 15 por pasada parece estructural (inferido, sin demostrar)

Las 178 pasadas que pierden, en los dos periodos, pierden de 1 a 15 casos, repartidas casi por igual, y ninguna 16. Cada caso de la cobaya escribe unos 4,1 KB; el búfer de una tubería en Linux (65.536 B) son 15,98 casos. Si es eso, ④ no va a caer por «más de 15 en una pasada»: lo que arriesga es el tope de **2 pasadas por job**. Con el 7,9 %, P(≥3 de 4) ≈ 0,19 % por job, **uno de cada ~540**; con el 3,4 %, uno de cada ~6.700. Observado: 0 de 440. Los 14 jobs con 2 pasadas que pierden casan con pasadas independientes (se esperan 13,9).

## ✅/❌ para el fundador

1. ✅/❌ No se toca ninguna constante (regla 41): es un escalón estable y ④ no ha caído. Recomiendo ✅.
2. ✅/❌ Experimento que separe los dos sospechosos: ④ con la sonda donde estaba (a la carga del fichero) y donde está, N pasadas cada uno, en el mismo runner. Cambia el test en una rama que no se mergea (y quizá un workflow, que es de S5): no lo he hecho.
3. ✅/❌ Si es 1574: o se acepta la sonda dentro de ④ con ~1 rojo por cada ~540 jobs, o se vuelve a medir la cifra de 1405d con el código de hoy.
4. ✅/❌ Si es el runner: nada que arreglar en el repo; se re-mide la constante con el runner nuevo.

## Reproducir

`E=docs/master/evidencias/SCRUM-1625` · `node $E/covariables.mjs <censo 1405d> <censo 1405f> --logs <carpeta FUERA del árbol> --salida cov.tsv` (los censos tienen que estar en carpetas `j3n-1405d/` y `j3bw-1405f/`: la columna `censo` sale del nombre de la carpeta) · `node $E/covariables.mjs --hueco 2026-10-20T15:35:35Z 2026-10-21T13:18:42Z --logs <carpeta> --salida hueco.tsv` · `node $E/analiza.mjs $E/cov.tsv $E/hueco.tsv` (salida en `analiza-salida.txt`). Las columnas `version` y `fuente` de `covariables.mjs` se añadieron después de la pasada grande: en `cov.tsv` no están (todos los de 1405d corrieron el ④ de 1405c y todos los de 1405f el de 1574, según la columna `sonda`).
