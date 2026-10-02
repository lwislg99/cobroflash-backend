# SCRUM-1374 · El detalle abierto del albarán se entera de que su firma ha subido (mitad S4 de «el detalle abierto no se entera de que la cola subió»)

**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:25:11Z
A9: sin fallo que generalice — la tanda no tuvo tropiezo propio; el hueco que queda (el pad abierto en el momento del aviso) está declarado abajo, no arreglado
**Skill UI:** cargada

2-oct-2026 · **S4** (`s4-2octa`). Es la otra mitad de SCRUM-1373 (S2): la cola avisa con
`window.alConfirmarseFirmas(fn)` y aquí se consume. El contrato se leyó de `docs/master/SCRUM-1373.md`.

## PASO 0 · el defecto existía

Con la mitad de S2 puesta y sin esta, `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs` seguía
midiendo `el-detalle-abierto-no-se-entera-de-que-la-cola-subio` (14 pasan de 14 con el defecto
declarado). Con el oyente escrito y la entrada aún en la lista: 13 pasan de 14, y el que cae dice
«este defecto ya NO se observa: BORRA su entrada».

## Qué cambia

`public/dashboard/js/albaranDetailView.js`, sólo lógica: sin marcado, sin estilos y **sin texto**.

- Al pintarse, si el albarán no está firmado, la ficha se suscribe a `alConfirmarseFirmas`.
- Cuando llega un aviso, repinta (`recargar()`) sólo si se cumplen las tres:
  1. la ficha sigue siendo la que está en pantalla (si no, se desuscribe sola);
  2. en la lista viene **su** albarán: `tipo === 'albaran'` y el mismo id, comparado como texto;
  3. **no hay pad de firma abierto** (`[data-sp-aviso]` en el documento).
- Cada pintado suelta la escucha del pintado anterior: hay una sola viva para esta vista.

`scripts/_defectos-viaje-firma-declarados.json`: se retira
`el-detalle-abierto-no-se-entera-de-que-la-cola-subio`. Queda una entrada
(`cerrar-sesion-borra-la-cola-sin-avisar`, de S2), así que no hace falta `vacio_a_proposito`.

`scripts/_sin-consumir-declarados.json`: `colaDeFirmas.js::alConfirmarseFirmas` pasa de `piezas` a
`retiradas` (la declaró S2 el 2-oct mientras no tenía consumidor; el trinquete de SCRUM-1185 exige
moverla al conectarla).

## Tests

En `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`, cuatro nuevos «SCRUM-1374 · …», con el
drenado, la cola y el almacén reales. 18 pasan de 18.

| aceptación | test |
| --- | --- |
| 1 · vuelve la red → «firmado» solo y deja de ofrecer firmar | «detalle abierto + firma en la cola + vuelve la red…» |
| 2 · con el pad abierto no se repinta | «con el pad de firma ABIERTO no se repinta» |
| 3 · el aviso de otro documento no repinta | «el aviso de OTRO documento no repinta…» (otro albarán y un parte con el mismo número) |
| 4 · la entrada se retira en el mismo commit | «los defectos del viaje son EXACTAMENTE los declarados» |
| se desuscribe al dejar de estar montada | «una ficha que ya no está en pantalla no se repinta…» |

Cada «no se repinta» lleva su suelo: el drenado subió y el aviso salió (se escucha con un segundo
oyente y se compara la lista).

**Vistos en rojo, por mutación** (base sin mutar: 18 de 18; cada mutante aplicado y restaurado):

| se quita | cae |
| --- | --- |
| la guarda del pad abierto | el test del pad, y sólo ése |
| mirar de quién es el aviso | el de «otro documento» |
| mirar el `tipo` | el de «otro documento» |
| mirar si la ficha sigue en pantalla | el de «ya no está en pantalla» |
| la escucha entera | el de la aceptación 1 y el de los defectos declarados |

## Lo que NO hace, declarado

- **Si el aviso llega con el pad abierto, la ficha no se repinta después al cerrarlo.** El pad
  (`signaturePad.js`) no avisa de que se cierra y ese fichero no es de este carril. La ficha queda
  como antes de este ticket hasta que se reabre. El caso habitual —firmar sin red, cerrar el pad,
  recuperar la señal después— sí queda cubierto.
- No está visto en un navegador: el banco no dibuja. Falta verlo en yaqu.app tras el despliegue.
- Depende de SCRUM-1373 (PR #2101): la rama nace encima de la de S2.
