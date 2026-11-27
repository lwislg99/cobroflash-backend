# SCRUM-1874 · Versión declarada: una línea en cada registro nuevo (D) y el cotejo de ronda sin-version (C)

**Medido contra:** `origin/main` = `PENDIENTE` · PENDIENTE

Versión: mantenimiento (SCRUM-1859)

A9: PENDIENTE

Puesto S5 (`scripts/equipo/**`, `.github/workflows/ci.yml` y `scripts/guards-entrada.mjs` son de S5, `docs/equipo/dos-equipos.md`
§3). Rama `scrum-1874-version-declarada`. Encargo del orquestador (26-nov, noche): construir **D + C** de la propuesta «PR sin
versión» de S5 (26-nov: 373 PR en 15 días, mediana apertura→merge 27 min, sólo 16 tickets con etiqueta `version-*`). A (mapa
obligatorio) sólo si C demuestra fugas frecuentes; B (token de Jira en el CI) no, mientras las etiquetas no sean la verdad.

## Qué hay

| Fichero | Qué es |
|---|---|
| `docs/equipo/version-en-curso` | UNA línea: `1.1 (SCRUM-1835)`. Cambia una vez por versión. No puede ser «mantenimiento». |
| `scripts/equipo/version-declarada.mjs` | D. Motor (`juzgarRegistro`, `registrosNuevos`, `medirRama`) + línea de órdenes. |
| `scripts/equipo/sin-version.mjs` | C. Cotejo de ronda: PR abiertos + ramas sin mergear contra la lista del orquestador. |
| `tests/scrum1874-version-declarada.test.mjs` | Los dos, en rojo primero; catálogo de 5 mutaciones. Entra en `guards:entrada`. |
| `.github/workflows/ci.yml` | Job nuevo `version-declarada` (informativo, `continue-on-error`). |
| `scripts/guards-entrada.mjs` | El test, en la lista (`MINIMO` 17 → 18). |

## D · la regla

Todo `docs/master/SCRUM-*.md` que la rama CREA lleva, al principio de una línea, `Versión: 1.1 (SCRUM-1835)` (la del fichero) o
`Versión: mantenimiento (SCRUM-1859)`. Se aceptan también `Versión: 1.1` y `Versión: mantenimiento` a secas, y la forma en negrita
`**Versión:**`. No pasan: sin línea, dos líneas, otra versión (una pieza atribuida a una versión cerrada falsea el panel igual que
una sin atribuir), la 1.1 con otro ticket, texto libre, y la línea citada en mitad de una frase.

«Nuevo» se le pregunta al CAMBIO, no al registro (la lección de SCRUM-1340): añadido desde la base de la rama (`baseDeLaRama`, el
motor de SCRUM-533/723) + sin rastrear. Un registro viejo con un tramo nuevo NO se acusa. Sin base resoluble: NO PUDE MIRAR, salida 2.

**INFORMATIVO hasta el 4-dic-2026.** La línea de órdenes sale 0 aunque falten líneas (en el CI, un `::warning` por fichero, que
GitHub enseña en el resumen del PR); el test sobre el árbol real sólo cuenta, como diagnóstico. Pasar a obligatorio es
`OBLIGATORIO = true` en `version-declarada.mjs`, en su PR, cuando se haya medido cuántos no declaran.

## C · el cotejo

    node scripts/equipo/sin-version.mjs --lista <fichero>  [--todas]

La lista la genera el orquestador de Jira: una línea por ticket, clave primero (`SCRUM-1835 1.1`), `#` y vacías se ignoran; una línea
sin clave es ERROR (salida 2), y una lista vacía también (todo saldría «sin versión» y sería la lista la que falla). Sin `gh`, salida 2:
no se informa sólo de ramas. Reusa `instantanea`/`alcanzabilidadDe`/`suelo` de `ramas:sin-mergear` y `numeroDeRama`. Salida en dos
bloques, PR primero: `PR #N (scrum-M) sin versión declarada, edad X`, con una columna de ayuda que dice si el registro de la rama
declara (D). Las ramas sin número salen aparte: no se pueden cotejar.

## Rojo

PENDIENTE

## Lo que NO dice esto

- Que la versión declarada sea la VERDADERA: el guard mide declaración, como `**Medido contra:**` (SCRUM-811 lo discute igual).
- Que los registros de antes estén atribuidos: la regla es para los nuevos.
- El cuerpo del PR no se mira: la línea va en el registro (decisión del orquestador).
