# SCRUM-393 · Ningún marcador de conflicto llega a un fichero publicado

**Fecha:** 7-ago-2026 · **Carril:** A · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `12adc4a08fc65022ac705b898e259a1fcbc0f596` · 2026-08-07T10:35:26+02:00

## De dónde sale

Resolviendo el conflicto de SCRUM-292 con SCRUM-386, `npm test` dio **exit 0 con dos marcadores
vivos** en `public/dashboard/js/jobDetailView.js`. Ningún guard los vio: **la suite entera pasa
sobre un árbol en conflicto**.

## Por qué urge, más allá de lo evidente

**En `public/` el JavaScript no se compila.** Un marcador en `src/` lo caza TypeScript al construir
y el fallo aparece en CI, donde arreglarlo es barato. En `public/` llega **al navegador del
profesional** y rompe la pantalla en ejecución.

Y toda la disciplina de merge de la casa se apoya en «después de resolver, se vuelven a correr los
rojos». **Esa regla no protege de esto**, porque el verde llega igual con el conflicto dentro — que
es exactamente lo que pasó.

## El alcance se DERIVA

No hay lista de directorios. Se recorre la raíz y se entra en todo lo versionable salvo lo que no lo
es (`node_modules`, `dist`, `.git`, …). **Una lista a mano deja fuera el próximo directorio que
alguien cree — y el próximo directorio es exactamente donde nadie mira.**

El suelo comprueba que la derivación ve ficheros en `public/`, `src/`, `tests/`, `docs/` y
`scripts/` **sin que esa lista sea el alcance**, y que barre el fichero exacto donde ocurrió el caso
que originó el guard: si dejara de barrerse, el guard perdería su motivo.

## ⚠️ El falso positivo que lo habría matado

`=======` aparece **legítimamente** en Markdown: es el subrayado de un encabezado *setext*. Y en
cualquier documento que hable de conflictos — **esta misma entrada lo hace**.

Por eso no se busca la cadena suelta: se exige la **forma completa** de un marcador de git — siete
caracteres **al principio de línea**, un espacio, y la rama detrás. Un guard que salta con
documentación normal se acaba silenciando, y un guard silenciado no protege nada.

Hay tabla explícita de lo que salta y lo que no, para que el criterio esté **escrito** y no deducido:
sangrado no salta, en medio de una frase no salta, seis caracteres no saltan, sin rama detrás no
salta.

## Auto-referencia, sin ALLOWLIST

Este fichero habla de marcadores, así que un guard de texto **se cazaría a sí mismo**. Los patrones
se **componen en tiempo de ejecución** (`'<'.repeat(7)`), de modo que la forma completa no aparece
escrita en ninguna parte del repo.

Eso evita una excepción — y una excepción que hay que mantener es una excepción que alguien acaba
ampliando.

## Los tres rojos

Marcador real inyectado en **los tres sitios**, no en uno:

| dónde | qué sale |
|---|---|
| `public/dashboard/js/jobDetailView.js` | 🔴 con fichero y línea (el caso que originó el ticket) |
| `src/modules/jobs/domain/albaran.service.ts` | 🔴 con fichero y línea |
| `docs/master/SCRUM-292.md` | 🔴 con fichero y línea |

Y los dos controles positivos: **el árbol de hoy pasa**, y un **Markdown normal** —subrayado setext,
marcadores citados en línea, regla horizontal— **no hace saltar el guard**, con su contraste para
que ese verde no sea por no detectar nunca.

## Verificación

- `npm run build` → **exit 0** y `npm test` → **exit 0**: **2097 tests · 2026 pass · 0 fail · 71
  skipped**.

## Lo que NO cubre, dicho claro

Corre en `npm test`, así que **caza el conflicto antes del merge, no antes del commit**. Si alguien
comitea y empuja sin pasar la suite, el marcador llega a la rama igual — lo que ya no puede es
llegar a `main` con CI en verde, que es donde estaba el agujero.
