# SCRUM-1359 · Los cuatro tests de S5 dejan de prestarle el entorno a su hijo

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T12:03:50Z

A9: comprobación → `tests/scrum1349-entorno-prestado-solo-baja.test.mjs`

Carril S5. La rama sale del commit de SCRUM-1358 (`07354dff`), no de `main` a secas: los dos tocan
`scripts/_entorno-prestado-declarados.json`, y dos ramas hermanas sobre esa lista es justo lo que
puso `main` en rojo hoy.

## Lo que entra

SCRUM-1349 (S3) declaró cuatro tests de S5 que lanzan un `node` hijo con variables del padre.

| Fichero | Qué le faltaba | Qué cambia |
|---|---|---|
| `tests/scrum1123-vigia-despliegue-aviso.test.mjs` (2 llamadas) | las tres | `correrCli` y el caso sin `VIGIA_MARCA` borran `FORCE_COLOR`, `NODE_OPTIONS` y `NODE_TEST_CONTEXT` |
| `tests/scrum932-el-turno-tiene-mecanismo.test.mjs` | `NODE_OPTIONS` | se borra |
| `tests/scrum946-censo-de-huerfanos.test.mjs` | `NODE_OPTIONS` | se borra |
| `tests/scrum966-censo-ve-las-ramas.test.mjs` | `NODE_OPTIONS` | se borra |

Y sus cuatro entradas se BORRAN de `scripts/_entorno-prestado-declarados.json` en este mismo commit.
La lista queda en 6: dos dudosos de S5 (`confirmado: false`), uno de S1 y tres de S0.

## Comprobado

| Qué | Antes | Después |
|---|---|---|
| Los cuatro tests | 43 tests, 43 pasan | 43 pasan |
| Los cuatro + el trinquete de 1349 | — | 51 tests, 51 pasan: el censo ya no los acusa y la lista coincide |
| `tests/scrum836-ancla-de-mutacion-viva.test.mjs` | — | 17 tests, 16 pasan. El que cae nombra solo 3 anclas de `scrum608` a ficheros de `dist/`, y este árbol no tiene `dist`: no es de este cambio |

El control de que el trinquete SALTA si se arregla sin borrar la entrada no lo he repetido: es
exactamente lo que cayó en `main` (SCRUM-1358, medido 6/8 → 8/8).

No he corrido la tanda completa en local (memoria: ~2 GB libres de 15,9). El veredicto es el del CI.

## Mis errores

1. **Los cuatro pasaban antes y pasan después: el cambio no tiene un rojo propio.** Lo que mide que
   estaban mal es el censo, no los tests. No he provocado el daño (un `NODE_OPTIONS` con un reporter
   que rompa al hijo) para ver caer a los cuatro; desde #2000 los reporters ya no viajan ahí, así que
   hoy no hay con qué provocarlo sin fabricarlo.

## Lo que NO entra

`scrum899d-aviso-de-uso` y `node-p-capturado-sin-color` siguen declarados con `confirmado: false`:
nadie ha confirmado que sean de S5.
