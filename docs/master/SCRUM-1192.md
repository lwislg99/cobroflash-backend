# SCRUM-1192 · El censo de lo sin consumir cierra el alcance POR MÓDULO desde `src/index.ts`

**Medido contra:** `origin/main` = `2bb2857144d7c80ee80bc780390d31f9ac8cfc7c` · 2026-09-28T14:01:04Z

Sesión: S0. Sigue de SCRUM-1185 (PR #1849). El caso lo midió S1 y lo pasó el orquestador.

## El defecto

`scripts/_censo-sin-consumir.mjs` daba por consumida una exportación en cuanto CUALQUIER fichero de `src/` la importaba, aunque a ese fichero no lo cargara nadie. Caso real: `src/modules/invoicing/domain/huecosSerie.ts::huecosDeLaSerie` (J1, SCRUM-291) solo la importa `src/modules/jobs/domain/albaranSerie.ts`, y a `albaranSerie.ts` no lo importa nadie. El censo la daba por viva. «Tiene consumidor» y «tiene consumidor vivo» no son lo mismo.

## Qué entra

| fichero | qué cambia |
|---|---|
| `scripts/_censo-sin-consumir.mjs` | `RAIZ = 'src/index.ts'`, la única raíz de producción (`start: node dist/index.js`). `alcanceDesde` recorre import (sin contar los de solo tipo), export-from, `import()` y `require` con literal. Un import solo cuenta como consumo si el fichero que importa es alcanzable. Hay una cifra nueva, `poblacion.alcanzables`, y el límite de `LIMITES` lleva el caso con nombre y ruta. |
| `scripts/_sin-consumir-declarados.json` | una pieza nueva declarada: `huecosDeLaSerie`, carril J1, ticket SCRUM-1192. |
| `tests/scrum1185-trinquete-sin-consumir.test.mjs` | SUELO: `alcanzables >= 250` (sin raíz, el cierre no mide y todo vuelve a contar como vivo). Control fabricado con su negativo derivado: el mismo árbol, con la raíz cargando el módulo muerto. |

Un árbol sin `src/index.ts`, como los fabricados de los tests, no tiene alcance que medir y cuenta todo, igual que antes. En el árbol real lo impide el SUELO.

## Medido

- De 304 ficheros de `src/`, 283 son alcanzables y 21 no. De esos 21, solo `huecosSerie.ts` tiene importador, y ese importador está muerto. Los otros 20 no los importa nadie y ya salían antes.
- **La lista pasa de 179 a 180.** A nivel de módulo, 179 no era un total, pero tampoco un suelo engañoso.
- Con el cambio, el guard cae solo en `huecosDeLaSerie` y en nada más, hasta que se declara.

## Probado en rojo

| mutación | resultado |
|---|---|
| el control fabricado nuevo contra el censo de `origin/main` (sin cierre) | no acusa `ayuda` y `alcanzables` sale `undefined`: caen sus dos asserts |
| sin la línea declarada en el JSON | cae ① con exactamente `huecosDeLaSerie` |

## Lo que sigue sin verse (declarado en `LIMITES`, no prometido)

- Una función muerta dentro de un módulo VIVO que es la única que llama a otra. Detectarlo pide un grafo de llamadas, que se vuelve ambiguo con callbacks y handlers de router.
- El front (`public/`): una función del panel llamada solo desde otra función muerta sigue saliendo viva.
