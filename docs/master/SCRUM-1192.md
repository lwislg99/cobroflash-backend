# SCRUM-1192 · El censo de lo sin consumir cierra el alcance POR MÓDULO desde `src/index.ts`

**Medido contra:** `origin/main` = `31688d6b550ea0bbc1b99b381fdf857b821bdec9` · 2026-10-01T13:26:58Z

A9: comprobación → `tests/scrum1185-trinquete-sin-consumir.test.mjs`

Sesión: S0. Sigue de SCRUM-1185 (PR #1849). El caso lo midió S1 y lo pasó el orquestador. El trabajo se
hizo el 28-sep y se quedó SIN COMITEAR en un árbol tres días; se retoma el 1-oct sobre `main` de hoy.

## El defecto

`scripts/_censo-sin-consumir.mjs` daba por consumida una exportación en cuanto CUALQUIER fichero de `src/`
la importaba, aunque a ese fichero no lo cargara nadie. «Tiene consumidor» y «tiene consumidor vivo» no son
lo mismo.

## Qué entra

| fichero | qué cambia |
|---|---|
| `scripts/_censo-sin-consumir.mjs` | `RAIZ = 'src/index.ts'`, la única raíz de producción (`start: node dist/index.js`). `alcanceDesde` recorre import (sin contar los de solo tipo), export-from, `import()` y `require` con literal. Un import solo cuenta como consumo si el fichero que importa es alcanzable. Cifra nueva: `poblacion.alcanzables`. |
| `scripts/_sin-consumir-declarados.json` | dos piezas pasan de `retiradas` a `declaradas` (abajo). |
| `tests/scrum1185-trinquete-sin-consumir.test.mjs` | SUELO: `alcanzables >= 250` (sin raíz, el cierre no mide y todo vuelve a contar como vivo). Control fabricado con su negativo derivado: el mismo árbol, con la raíz cargando el módulo muerto. |

Un árbol sin `src/index.ts`, como los fabricados de los tests, no tiene alcance que medir y cuenta todo,
igual que antes. En el árbol real lo impide el SUELO.

## Medido el 1-oct, sobre `main` de hoy

- De 312 ficheros de `src/`, **292 son alcanzables** desde `src/index.ts` y 20 no.
- **El caso que abrió el ticket ya no existe.** El 28-sep, `huecosSerie.ts::huecosDeLaSerie` solo la
  importaba `albaranSerie.ts`, y a ése no lo importaba nadie. Desde SCRUM-1184, `albaranes.routes.ts`
  importa `albaranSerie.ts`: la pieza está viva y no hay nada que declarar.
- **El cierre destapa otro caso, de hoy.** `sif.cola.ts::decidirTrasEnvio` y `::recuperarEnviadoSinCierre`
  estaban en `retiradas` desde SCRUM-1296 como «conectada en `sif.procesador.ts`». A `sif.procesador.ts`
  no lo importa ningún fichero de `src/` (`git grep sif.procesador -- src` da su propia cabecera y un
  comentario), y su única exportación, `procesarObligado`, está DECLARADA sin enchufar a propósito (decisión
  D2 del orquestador: hace falta el certificado). O sea: el registro decía a la vez «el procesador no está
  enchufado» y «estas dos están conectadas… al procesador». Con el cierre, el guard ③ («una pieza retirada
  no puede VOLVER») cae exactamente en esas dos.
- Vuelven a `declaradas`, carril J1, con el motivo escrito. No es un defecto de J1: es lo que el censo no
  sabía ver. Se retiran el día que se enchufe `procesarObligado`.

## Probado en rojo

| mutación | resultado |
|---|---|
| el control fabricado nuevo contra el censo sin cierre | no acusa `ayuda` y `alcanzables` sale `undefined`: caen sus dos asserts (28-sep) |
| el censo con cierre y el JSON de `main` sin tocar | cae ③ con exactamente `decidirTrasEnvio` y `recuperarEnviadoSinCierre`; ① pasa (1-oct) |
| con las dos líneas movidas | 11 de 11 |

## Mi error

Dejé esto tres días sin comitear en un árbol. No se perdió, pero el caso que justificaba el ticket cambió
debajo, y nadie lo habría sabido si el árbol se hubiera borrado. La norma ya lo dice (A17: se empuja el
mismo día); la comprobación que lo ve es el hook de cierre de SCRUM-1356, que mira lo empujado, y aquí no
había nada empujado que mirar: un trabajo sin comitear no lo ve ningún instrumento de hoy.

## Lo que sigue sin verse (declarado en `LIMITES`, no prometido)

- Una función muerta dentro de un módulo VIVO que es la única que llama a otra. Detectarlo pide un grafo de
  llamadas, que se vuelve ambiguo con callbacks y handlers de router.
- El front (`public/`): una función del panel llamada solo desde otra función muerta sigue saliendo viva.
- Un módulo cargado por algo que no sea `src/index.ts` (un script de operación, un cron externo) sale como
  no alcanzable. Hoy `package.json` solo arranca `dist/index.js`.
