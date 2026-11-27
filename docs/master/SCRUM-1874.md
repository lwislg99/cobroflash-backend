# SCRUM-1874 · Versión declarada: una línea en cada registro nuevo (D) y el cotejo de ronda sin-version (C)

**Medido contra:** `origin/main` = `b627357327a4d595c8116baa38183ca967160fda` · 2026-11-27T08:12:16Z

Versión: mantenimiento (SCRUM-1859)

A9: sin fallo que generalice — el guard se vio nombrar al registro nuevo sin línea antes de darlo por bueno, y cada mutación tumbó su caso y sólo el suyo (5 de 5 VIVAS).

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
| `tests/scrum1874-version-declarada.test.mjs` | Los dos, en rojo primero; catálogo de 5 mutaciones. Corre en la tanda del obligatorio, como todo `tests/*.test.mjs`. |
| `.github/workflows/ci.yml` | Un PASO informativo en el job obligatorio (`continue-on-error` de paso), antes de `npm ci`. |

**Dos cambios sobre el encargo, y por qué:**

- **No es un job aparte, es un paso.** El vigía de `main` lee de `ci.yml` qué jobs son informativos (`jobsInformativosDelCI`,
  SCRUM-1643) y su test fija que son dos; un job nuevo obligaba a tocar el vigía y su lista. En el obligatorio ya están
  `fetch-depth: 0` y `origin/main`, que es lo que hace falta para saber qué registro es nuevo. Visto: con el job, `scrum1643`
  cayó (1 de 141); con el paso, los vecinos de `ci.yml` 97/97.
- **No está en `guards:entrada`.** `scripts/guards-entrada.mjs` es de **J3** (`docs/equipo/dos-equipos.md:201`, decisión del
  fundador en SCRUM-1556). Se escribió la línea, el carril lo dijo y se deshizo sin commitear. Queda pedido a J3 por el
  orquestador: añadir `tests/scrum1874-version-declarada.test.mjs` a `GUARDS` y `MINIMO` 17 → 18 (tarda ~1,6 s, sin `dist` ni
  base). Mientras, antes de empujar: `node scripts/equipo/version-declarada.mjs`.

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

Los casos de repositorio corren en `os.tmpdir()` (fuera del árbol, SCRUM-824) con un `main` propio. El que decide: una rama que
crea `SCRUM-9.md` (commiteado, sin línea), `SCRUM-10.md` (bien) y `SCRUM-11.md` (sin rastrear, sin línea), y toca el viejo
`SCRUM-1.md`. La línea de órdenes, con `GITHUB_ACTIONS=true`, sale 0 (informativo) y escribe `registros NUEVOS ... 3 · declaran 1 ·
sin declarar 2` y un `::warning file=docs/master/SCRUM-9.md::SCRUM-1874 · sin línea «Versión:»…` (y otro para el 11); al viejo no
lo nombra. Sin `main` ni `origin`: NO PUDE MIRAR, salida 2. CONTROL: una rama sin registros nuevos da 0 y sale 0.

Mutaciones: catálogo → tests/scrum1874-version-declarada.test.mjs

| # | Mutación | Cae (sólo ése) |
|---|---|---|
| ① | `--diff-filter=A` → `AM` (el viejo tocado cuenta como nuevo) | «un registro NUEVO sin línea se NOMBRA; uno viejo tocado, no» |
| ② | los sin rastrear se pierden | el mismo |
| ③ | no se compara QUÉ versión | «juzgarRegistro: sin línea, otra versión…» |
| ④ | sin base, «0 nuevos» en vez de ciego | «sin base de la rama: NO PUDE MIRAR» |
| ⑤ | la rama pisa la fila del PR abierto | «cotejar: PR y rama se cuentan UNA vez…» |

Base sin mutar: 0 caídos. Las 5 VIVAS, cada ancla casa una vez, restauradas y comparadas byte a byte (guion de un solo uso en el tmp
del job, no en el árbol), sobre el commit `b537907a0`; repetidas tras la cura de abajo, mismo resultado. Tanda del fichero: 9/9,
~1,6 s.

De paso, cazado por `guards:entrada` antes del push: `scrum723` (referencia MÓVIL) acusó al test y al script por NOMBRAR la punta
de `main` en dos cadenas (un `rev-parse` en el caso del árbol real y el texto del motivo de «sin base»). Curado sin tocar el
guard: el caso pregunta a `baseDeLaRama` y las dos cadenas ya no nombran la referencia. Después: `guards:entrada` 17/17 (186
tests); los 5 de árbol entero de SCRUM-1560, 38/38; `meta-guard-mutaciones --solo-censo`, salida 0.

Ensayo de C contra el remoto real (27-nov, lista de 2 tickets): 12 PR abiertos, 166 ramas sin mergear, 8 s. De ahí el orden de la
salida: los 11 primeros «sin versión» eran ramas de más de 120 días que tapaban los PR; ahora salen en dos bloques, PR primero.

## Lo que NO dice esto

- Que la versión declarada sea la VERDADERA: el guard mide declaración, como `**Medido contra:**` (SCRUM-811 lo discute igual).
- Que los registros de antes estén atribuidos: la regla es para los nuevos.
- El cuerpo del PR no se mira: la línea va en el registro (decisión del orquestador).
- Huecos de carril que no puedo cerrar yo: `docs/equipo/version-en-curso` no tiene fila en §3 (`carriles.mjs de` → «nadie lo
  reclama»), y SCRUM-1874 no lleva etiqueta `area-…`, que es lo que da el dueño de su test (§3, «el test de un ticket»). Las
  dos van al orquestador.
