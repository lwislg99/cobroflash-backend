# SCRUM-1185 · Trinquete de lo CONSTRUIDO Y SIN CONSUMIR

**Medido contra:** `origin/main` = `f0eac753c14885d78b754fdd578579e2b80223e2` · 2026-09-27T17:22:14Z

Sesión: S0 (s0-27b). Pedido por el orquestador tras el censo del 27-sep (tickets SCRUM-1180 a 1184).

## Qué entra

| fichero | qué es |
|---|---|
| `scripts/_censo-sin-consumir.mjs` | la sonda AST: lee el árbol (o un commit con `--ref`) y devuelve cada pieza sin consumir con una clave estable. Lleva DENTRO sus límites (`LIMITES`). |
| `scripts/_sin-consumir-declarados.json` | la lista del 27-sep, pieza a pieza (179): `clave`, `donde`, `carril`, `ticket`. Y `retiradas`, vacía. Una pieza por línea. |
| `tests/scrum1185-trinquete-sin-consumir.test.mjs` | el guard: 10 tests, ~8 s en local (una pasada de la sonda ≈ 5 s; la del commit histórico ≈ 4 s). |

## Cómo falla

1. **Pieza NUEVA** sin consumidor, o CIEGA sin clasificar → rojo. Se conecta en el mismo PR o se declara con carril y ticket.
2. **Pieza declarada que ya se consume** → rojo: pasa a `retiradas` con su motivo. La lista encoge sola.
3. **Pieza retirada que vuelve** → rojo: se arregla el código (regla 41), no se re-declara.

No es un suelo numérico: un número deja meter una pieza nueva y sacar otra sin que se note.

## Probado en rojo (27-sep, en el worktree, revertido después)

| mutación | test que cae |
|---|---|
| ruta nueva `GET /admin/metrics/mutante-s0` sin llamador | ① pieza NUEVA |
| entrada declarada que no existe (`ruta · GET /admin/ficticia`) | ② ya se consume |
| `jobs.csv` movida a `retiradas` sin estar conectada | ③ retirada que vuelve |

## Controles

- **Fabricados, uno por cada fallo de la propia sonda cazado al medir**, con negativo DERIVADO (el mismo árbol con el consumidor puesto):
  1. comentarios que nombraban funciones daban por usada una función muerta → tokens del AST;
  2. `'/admin/albaranes/' + id` casaba con `/admin/albaranes/consolidar` → emparejamiento segmento a segmento;
  3. `console.error('PUT …/:id')` y las listas `src/core/http/*Declarations.ts` contaban como llamadores → excluidos.
- **Positivo real, de git:** `f73e546d~1` (antes de SCRUM-988): `pintarRevisiones` en `window` sin llamador y el enlace `#/presupuestos/…` que el router no atiende.
- **Negativo real, hoy:** `POST /admin/jobs/:id/collect-rest`, `GET /admin/quotes/:id`, `pintarRevisiones`. `collect-rest` tiene llamador desde el 5-jul (`cc39cd71`); su defecto (SCRUM-1160) era de alcance condicional.

## Lo que NO ve (también en `LIMITES`, que el test imprime en cada tanda)

- Alcance condicional por flag o modo (el caso de `collect-rest`).
- URLs montadas con arrays o `.join`.
- Llamadas con URL opaca: 9 llamadas en 8 funciones, declaradas como `ciega-llamada-opaca`.
- Funciones muertas encadenadas de más de un nivel.
- Claves de cuerpo con llamador opaco: el respaldo es por fichero, y es DÉBIL.
- Consumidores fuera de `src/` y `public/` (Meta, correos, operación): las 5 rutas de operación van declaradas con carril `operación`.
- Los 99 «campos servidos no leídos»: fuera, sin método verificado (solo `firmasCompletas`, SCRUM-1181).

## Carriles de la lista (clasificación inicial por ruta de fichero)

| carril | piezas |
|---|---|
| J1 | 43 |
| S2 | 35 |
| S4 | 31 |
| S1 | 23 |
| J2 | 22 |
| S0 (ciegas por clasificar) | 16 |
| operación | 5 |
| J3 | 4 |

`ticket: SCRUM-1185` significa «sin ticket propio todavía».
