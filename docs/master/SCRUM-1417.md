# SCRUM-1417 · `guards:entrada` salía verde con marcadores de conflicto en el árbol

**Rama:** `scrum-1417-marcadores-antes-de-empujar` · **Carril:** S5 · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `d7eea47a07176d5c4cfc1b39dea93e1d85481961` · 2026-10-02T12:18:01Z

A9: comprobación → `tests/scrum393-marcadores-de-conflicto.test.mjs`

Carril S5: `scripts/guards-entrada.mjs`. Aprobado por el orquestador el 2-oct-2026. Es aditivo: no
toca `ci.yml` ni el check obligatorio.

## El caso

El 2-oct-2026 empujé a #2134 un merge con los marcadores de conflicto dentro de
`docs/equipo/00-normas-siempre.md` (`f33d2914`): mi guion de resolver usó una ruta relativa y no tocó
el fichero. Lo que corrí antes de empujar salió verde. Corregido en `2c99bb69`.

El guard que lo ve existe desde SCRUM-393 y está en la tanda del obligatorio: lo habría parado el CI,
después del push. El hueco era CUÁNDO se corre.

## El cambio

`tests/scrum393-marcadores-de-conflicto.test.mjs` entra en `GUARDS` de `scripts/guards-entrada.mjs`
como decimotercero, y `MINIMO` sube con él de 12 a 13 (es el suelo de la lista: si no sube, quitar la
línea nueva no haría saltar nada). El techo NO se toca: siguen siendo 90 s.

Cumple el criterio escrito en el propio script para entrar: pasa sin `dist` ni base, cabe bajo el
techo, y lleva al lado el caso que el comando no cazó.

## Medido

Marcadores puestos a propósito al final de A10 (líneas 110 y 114) y fichero restaurado después;
comprobado que quedó idéntico.

| Sonda | Árbol sano | Con marcadores |
|---|---|---|
| `guards:entrada` ANTES del cambio (sobre `a096c7fa`) | salida 0 · 12 guards, 152 tests · 15,1 s | **salida 0** · 12 guards, 152 tests · 16,5 s |
| `guards:entrada` CON el cambio | salida 0 · 13 guards · 32,1 s | **salida 1** · 27,5 s |
| `tests/scrum1294-a9-leccion-en-a10.test.mjs` | salida 0 | salida 0 (no mira marcadores, ni tiene por qué) |
| `tests/scrum393-marcadores-de-conflicto.test.mjs`, solo | salida 0 · 6 tests · 3,2 s | salida 1 |

Lo que dice el rojo, literal:

    🔴 HAY MARCADORES DE CONFLICTO EN EL ÁRBOL:
        docs/equipo/00-normas-siempre.md:110  <<<<<<< HEAD
        docs/equipo/00-normas-siempre.md:114  >>>>>>> origin/main

Fichero y línea ya los daba SCRUM-393; no he tocado ese test.

Los once tests que nombran `guards-entrada` (entre ellos `scrum976`, que lanza el comando de verdad y
lo cronometra, `scrum711`, `scrum812` y `scrum928`): 103 tests, 103 pasan, 0 saltados.

## El coste, dicho

El comando tardó el doble en esta máquina: de 15–16 s a 27–32 s. Es UNA pasada de cada caso, con
otras sesiones trabajando: no es una mediana. Solo, `scrum393` tarda 3,2 s; dentro del comando su
test marca unos 10 s, porque recorre el árbol entero mientras corren los otros doce. Sigue lejos del
plazo de 90 s. El presupuesto lo juzga `scrum976` en CI, donde la carga es constante: ese número no
lo tengo hasta que corra.

## Lo que NO he comprobado

- El check obligatorio de esta rama: sin empujar a la hora del ancla.
- Cuánto tarda el comando con trece en CI.
- La dirigida entera no la he corrido: sólo los once ficheros que nombran `guards-entrada`.
- Nada obliga a correr `guards:entrada` antes de empujar: quien no lo corra sigue pudiendo empujar
  marcadores, y lo parará el CI como hasta hoy.
