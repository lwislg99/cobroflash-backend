# SCRUM-1113 · El trinquete de las skills caía solo en las Windows con `gh`: RUTA_ABS lee la plataforma

**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T15:12:27Z

**Puesto:** J3 (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1113-ruta-abs-lee-plataforma`

**Decisión, ya tomada en el ticket (opción ii, del orquestador):** `RUTA_ABS` lee la plataforma. En un
disco que no es Windows, una ruta `C:\…` sale NO COMPROBABLE, no FALSA. Además se retira la entrada de
`gh` de `FALSAS_DECLARADAS`, que era falsa ella misma, y se sube el tope de `scrum702` **a propósito**.
`.claude/skills/cerebro-yaqu` **no se toca**: esa línea dice dónde está `gh` en el arranque de las
sesiones. Esta sesión no tenía Jira; la decisión le llegó por el orquestador.

## 1 · PASO 0 — el defecto existe hoy (medido corriendo)

En esta máquina `C:\Program Files\GitHub CLI\gh.exe` **existe**. `scrum939b` dio 15 pass y 3 fail:

- el control «la ruta de gh sale CIERTA y esa ruta no existe»;
- «EL TRINQUETE TIENE QUE BAJAR: 1 declarada ya no sale FALSA»;
- y la gemela de «EL QUE DECIDE».

`scrum702` estaba verde, con el tope en 17.

## 2 · Lo que se hace

| fichero | cambio |
|---|---|
| `scripts/censo-afirmaciones-de-skills.mjs` | `verificar(a, linea, arbol, disco)`. `disco = {plataforma, existe}` toma por defecto `process.platform` y `fs.existsSync`. Con una ruta `X:\` y una plataforma distinta de `win32` sale **NO COMPROBABLE**. En Windows, el disco decide entre CIERTA y FALSA. |
| mismo, `controles()` | Se **rehace** el control de `gh`. Ahora prueba las tres combinaciones con el disco fijado: win32 sin fichero da FALSA, win32 con fichero da CIERTA y linux da NO COMPROBABLE. Se añade el **control positivo sobre el disco real**: una ruta inventada da FALSA en win32 y NO COMPROBABLE en linux, nunca CIERTA. |
| `tests/scrum939b-…` | Se retira la entrada de `gh` de `FALSAS_DECLARADAS`, con el motivo escrito en su lugar. Se añade un caso con nombre: la misma ruta es CIERTA en Windows y NO COMPROBABLE fuera, las dos, más el positivo de la ruta inventada. |
| `tests/scrum702-…` | `TOPE_LEEN_EL_ENTORNO` pasa de **17 a 18**, con el motivo escrito junto al número. **No se ha subido ningún otro tope.** |

Las dos mitades se prueban **en cualquier máquina**, porque el disco se inyecta. Así se evita que el
propio test lea la plataforma, que habría sido otro fichero más en el tope de `scrum702`.

## 3 · Verificación

| pasada | resultado |
|---|---|
| base de la rama: `939b` + `702` + `921c` + `864c` | **36 pass · 0 fail** |
| `702` antes de subir el tope | 1 fail: **18** frente a 17, exactamente el +1 declarado |
| M1 · se quita la rama de plataforma (`&& false &&`) | **2 fail**: el caso SCRUM-1113 y los controles de 939b |
| M2 · se apaga el detector (RUTA_ABS siempre NO COMPROBABLE) | **2 fail**: los mismos. La ruta inventada deja de salir FALSA |

`npm test` completo en la rama: **8.314 tests · 8.179 pass · 1 fail · 134 skipped**.

- El único fallo es SCRUM-804b, que en SCRUM-1105 ya se midió fallando **igual en la base**: es ajeno.
- Los 3 fallos de `939b` de la tanda anterior ya no están.

Censo real en esta máquina: 49 afirmaciones, sin ceguera.

- `cerebro-yaqu:79` `C:\Program Files\GitHub CLI\gh.exe` sale **CIERTA** («existe en el disco»).
- FALSAS: solo las dos `.xsd` de `verifactu`, que son las declaradas.

**Suelo declarado:** el lado Linux del censo real, es decir que la línea de `gh` salga NO COMPROBABLE
sobre las skills de verdad, solo lo confirma CI (ubuntu). Aquí está probado con el disco inyectado.
Queda un efecto que es verdad y no un defecto: en una máquina **Windows sin `gh`**, esa línea sale
FALSA y el trinquete cae como «nueva». Ahí la skill afirma algo que en ese disco es falso.
