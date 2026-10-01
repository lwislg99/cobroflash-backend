# SCRUM-1362 · La lista de defectos del viaje de la firma sale del test a un JSON

**Medido contra:** `origin/main` = `e4ebbfc8e6c63554206be600006c3bad21c50166` · 2026-10-01T12:22:32Z
A9: comprobación → `tests/scrum1362-cargador-de-defectos-del-viaje.test.mjs`

1-oct-2026 · **S4**, por encargo del orquestador. Rama apilada sobre SCRUM-1353 (#2081).

## El fallo

`DEFECTOS_DECLARADOS` vivía dentro de `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs`, y la
puse yo ahí el mismo día. El test le dice a quien arregla un defecto «borra su línea en el mismo
commit», y esa línea estaba en un fichero de test: a S2, que había arreglado dos, se le denegó la
edición. Una lista declarada dentro de un test convierte cada arreglo ajeno en una petición de
permiso. SCRUM-1293 ya había resuelto lo mismo para los marcadores y no lo apliqué.

## Qué entra

| Fichero | Qué es |
| --- | --- |
| `scripts/_defectos-viaje-firma-declarados.json` | los datos: id del defecto → dónde vive y de quién es (cuatro hoy) |
| `tests/_defectos-viaje-firma.mjs` | el cargador, que falla cerrado |
| `tests/scrum1362-cargador-de-defectos-del-viaje.test.mjs` | 13 tests: los controles del cargador |
| `tests/scrum1351-viaje-firma-sin-red-albaran.test.mjs` | lee la lista del JSON; las aserciones no cambian |

## Lo que NO cambia

La garantía. No se puede borrar una entrada si el defecto sigue ahí: el test cae por «no estaba
declarado». Y no se puede dejar una entrada de un defecto arreglado: cae por «ya NO se observa».
Lo único que cambia es qué fichero se edita.

## El cargador falla cerrado

Diez formas de JSON roto, cada una con su test, y todas dan `ok: false` con el motivo: fichero que
no existe, JSON inválido, sección que falta, sección que es una lista, valor vacío, valor que no es
texto, clave repetida, sección vacía sin motivo, motivo en blanco, y motivo de vacío con la sección
llena. Para el test del viaje cualquiera de ellas es un error «CIEGO», nunca una lista.

Borde distinto al de SCRUM-1293: aquí la lista **puede** llegar a cero legítimamente, el día que se
arregle el último. Vacía sólo vale si alguien escribe `vacio_a_proposito` con el motivo.

Y uno que 1293 no necesitaba: una **errata** en una clave del JSON se leería a la vez como un
defecto «arreglado» y otro «nuevo». El test del viaje compara las claves contra los seis defectos
que sabe medir y dice «errata» antes de medir nada.

## Prueba en rojo (`rojo1362.mjs`, fuera del árbol; restaura lo que toca)

| Caso | Resultado |
| --- | --- |
| base | 13 pasan de 13 |
| defecto presente, borrado del JSON | 12 de 13, cae por «no estaba declarado» |
| defecto arreglado (mutación local de `colaDeFirmas.js`) y aún en el JSON | 12 de 13, cae por «ya NO se observa» |
| errata en una clave | 12 de 13, cae por «no sabe medir» |
| JSON vaciado sin motivo | 0 de 1, «CIEGO» |
| JSON ausente | 0 de 1, «CIEGO» |
| restaurado | 13 pasan de 13 |

## Para quien arregle un defecto del viaje

Borra su entrada de `scripts/_defectos-viaje-firma-declarados.json` en el mismo commit que el
arreglo. No hay que tocar ningún test. Si era la última, deja `"defectos": {}` y añade
`"vacio_a_proposito": "<en qué ticket se arregló el último>"`.

# SCRUM-1362 · Apéndice (1-oct-2026, S4): la rama apilada heredaba `public/` de la de abajo

**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T13:09:14Z
A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`
**Skill UI:** no cargada · este PR no cambia ningún fichero de `public/` (JSON, cargador y dos tests); lo que el guard vio era `albaranDetailView.js`, heredado de la rama de SCRUM-1353 sobre la que estaba apilada

El check obligatorio de `ac49e37e` cayó (9.730 tests, 2 fallos) por el guard de SCRUM-1340: mide el
PR entero contra su base, y esta rama llevaba debajo los commits de SCRUM-1353, que sí tocan
`public/`. La comprobación previa («1362 no toca `public/`») era cierta del commit y falsa del PR.
Con `main` fusionado (#2081 ya dentro) el PR vuelve a ser sólo sus cinco ficheros.

El segundo fallo (`SCRUM-976 ④`, presupuesto de `guards:entrada`) no se ha tocado: se juzga en el
CI de este empujón, ya con #2069 y #2089 dentro.
