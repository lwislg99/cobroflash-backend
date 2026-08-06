# SCRUM-387 · El censo: `main` contra Jira, las ramas vivas, y la procedencia de «aprobado»

**Fecha:** 6-ago-2026 · **Carril:** herramienta de reparto · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `93e924e12c321c4a27749b249aaa17056e88d512` · 2026-08-06T12:10:00+02:00
**Tanda:** 1906 tests, 1839 pass, 0 fail, 67 gateados a staging

> La causa era de reparto: **Jira no se transiciona al mergear**, así que dice «por hacer» de cosas
> que llevan un día en `main` — y el reparto se hace desde Jira. `main` sabe qué está **hecho**;
> Jira sabe qué hay que **hacer**; nadie las cruzaba. Esto es el cruce.

## Lo que se entrega

| Pieza | Dónde | Qué responde |
|---|---|---|
| La derivación | `scripts/_censo-reparto.mjs` | funciones puras; **una sola fuente** para el CLI y la suite |
| El censo | `scripts/censo-reparto.mjs --jira <f.json>` | las listas **con nombres**, y código de salida |
| Guards del censo | `tests/scrum387-censo-reparto.test.mjs` (13) | suelo, controles, rojo por el mecanismo |
| Guard de procedencia | `tests/scrum387-procedencia-aprobacion.test.mjs` (5) | «aprobado» tiene que decir **dónde consta** |

El JSON de Jira **no se cachea en el repo** a propósito: un censo guardado envejece y vuelve a ser
la foto vieja que causó el problema. Se genera fresco cada vez que se va a repartir.

## ① El resultado de hoy: 11 desfases, con nombre

`SCRUM-212` · `SCRUM-244` · `SCRUM-291` · `SCRUM-300` · `SCRUM-302` · `SCRUM-305` · `SCRUM-308` ·
`SCRUM-313` · `SCRUM-337` · `SCRUM-339` · `SCRUM-378` — todos con entrada en `main` y abiertos en
Jira. **No son los del enunciado.** 304, 319 y 367 ya se cerraron entre que se escribió el ticket y
hoy; el censo mide el presente, no repite la foto que lo motivó.

Control positivo poblado: **62** tickets con entrada en `main` y ya cerrados. Si ese cubo saliera
vacío, el cruce no estaría cruzando.

## ② 21 alarmas de rama eran ruido; las de verdad son 7

La primera versión contaba «dos ramas con el mismo número» y daba **21 alarmas, ninguna
accionable**. Medido: de las **143** ramas de `origin`, **99 ya están en `main`** — residuo que
nadie borró.

> **Existir no es estar viva.** Una rama mergeada no es trabajo en paralelo, es basura; y contarla
> ahoga la señal. Una alarma que casi siempre es falsa deja de leerse, que es como se pierde un
> guard sin desactivarlo.

Con la clasificación, las alarmas reales son **7**: `SCRUM-284` (3) · `SCRUM-300` (3) ·
`SCRUM-304` (3) · `SCRUM-205` · `SCRUM-216` · `SCRUM-240` · `SCRUM-368`.

Y lo **indeterminado nunca se cuenta como mergeado**: si `merge-base` no puede responder, la rama
sigue pesando en la alarma. Este ticket nació precisamente de leer un vacío como si fuera un hecho.

## ③ «Aprobado por el fundador» ahora tiene que decir dónde consta

Hoy es una cadena que puede escribir cualquiera y, una vez escrita, es **indistinguible de una
aprobación real**. Ya produjo la contradicción del enunciado: seis ids marcados como aprobados el
6-ago frente a cinco distintos aprobados ese día, y cuatro de cinco sin coincidir.

El guard **no valida que la aprobación sea cierta** —eso no lo puede saber un test— sino que sea
**rastreable**: un `SCRUM-<n>` o un `docs/…` en el mismo bloque de comentario. **Una fecha sola no
vale**: «aprobado el 5-ago» no dice dónde mirar, y es exactamente la forma que tenían las seis
marcas contradictorias.

**Medido: 23 marcas · 13 con procedencia · 10 sin.** Las 10 se congelan en un trinquete
bidireccional (`SIN_PROCEDENCIA = 10`) porque **no se pueden arreglar aquí**: reescribir una
atribución de aprobación es afirmar algo sobre el fundador que esta sesión no sabe (regla 30). Las
diez, nombradas:

`portonDocumento.ts:45` · `quotesAdmin.routes.ts:240` · `botFlow.service.ts:1` y `:125` ·
`albaranDetailView.js:66` · `jobRailBlocks.js:19` · `productsView.js:740` y `:776` ·
`quoteMargen.js:64` · `settingsSubmenus.js:36`

> **Se miran COMENTARIOS, no el fichero entero.** Un `grep` sobre el fuente casaría «presupuesto
> aprobado», que es lenguaje de dominio de este producto y no tiene nada que ver — decenas de
> falsos positivos, y un guard que da falsos positivos acaba silenciado. Se extraen con el escáner
> de TypeScript, y hay test de que esa frase **no** cuenta como marca.

## Verificado en rojo

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Marca nueva sin procedencia | 🔴 «antes: 10 · ahora: 11 · `homeView.js:1267`» |
| 1b | **La MISMA marca, pero con `(SCRUM-330)`** | ✅ pasa — el guard mide procedencia, no la frase |
| 2 | Se arregla una y no se baja el número | 🔴 «se han arreglado (10 → 9) y el número no se ha bajado» |
| 3 | Se quita una entrada de `docs/master/` | el ticket **cambia de cubo nombrado**, no desaparece |

El **1b es el que da valor al 1**: sin él, el guard podría estar cazando la palabra en vez de la
ausencia de procedencia, y sería verde para siempre en cuanto alguien reformulara la frase.

> **El trinquete me cazó a mí el primer día.** Puse `SIN_PROCEDENCIA = 18` a ojo; el lado «no baja
> en silencio» falló diciendo `18 → 10`. Un trinquete de una sola dirección habría aceptado mi 18
> y habría dejado hueco para ocho marcas nuevas sin que nada avisara.

## El suelo, que es la parte seria

**«Cero desfases» y «no supe leer el directorio» son el mismo número con significados opuestos.**
El censo se declara **no fiable** —y sale con código != 0 sin informar de nada— si falta cualquiera
de las tres fuentes: entradas en `docs/master/`, tickets de Jira, o ramas. Cada motivo dice **dónde**
no ha mirado.

Y tiene hermano positivo: con las tres pobladas, `motivosParaNoFiarse` devuelve `[]`. Sin ese test,
los tres suelos pasarían aunque la función devolviera siempre algo — y el censo no informaría nunca.

## Lo que NO hace, y es deliberado

- **No cierra tickets.** Produce la lista; el cierre lo hace el fundador con su comentario de
  evidencia. Una herramienta que cierra tickets por su cuenta es la misma clase de afirmación sin
  respaldo que este ticket persigue.
- **No borra ramas.** Las 99 de residuo se cuentan y se ofrece el comando; borrarlas es una acción
  del fundador sobre trabajo ajeno.
- **El punto 4 del ticket** —que la entrada en `docs/master/` dispare el cierre en Jira— queda
  fuera: escribe en Jira, y el encargo de esta sesión era producir la lista.
- **No decide qué lista de ids de `firmadoPorCalidad` gana.** Es del fundador y va aparte.

Ficheros: `scripts/_censo-reparto.mjs` (nuevo — la derivación) ·
`scripts/censo-reparto.mjs` (nuevo — el CLI) ·
`tests/scrum387-censo-reparto.test.mjs` (13, nuevo) ·
`tests/scrum387-procedencia-aprobacion.test.mjs` (5, nuevo).
