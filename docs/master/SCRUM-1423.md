# SCRUM-1423 · Las claves de base de datos de todos los árboles, por destino y con un comando

**Medido contra:** `origin/main` = `b06d474d32e59e2bb04b62fa7fcaf5c3c84fb486` · 2026-10-02T12:57:04Z

A9: comprobación → `tests/scrum1423-claves-bd-de-todos-los-arboles.test.mjs`

Carril S0 (`scripts/` de verificación, `tests/`, `docs/`). **No toca `CLAUDE.md` ni ningún fichero de entorno.**

`node scripts/claves-bd-de-todos-los-arboles.mjs`

## Por qué

`CLAUDE.md` (regla 3) afirma, con una medición del 10-ago-2026 sobre cuatro árboles, que ningún árbol de
trabajo apunta a producción. `scripts/comprobar-claves-bd.mjs` solo mira el árbol desde el que se lanza, y
además imprime el host. La frase no se podía volver a medir. Este comando barre todos los árboles que git
conoce y deja la frase lista con su fecha y su población.

## Qué hace y qué no

| | |
|---|---|
| decide qué es producción | NO él: `comprobarCredencialDeProduccion` de `scripts/_clave-vs-destino.mjs` (SCRUM-418) |
| decide qué valor es una cadena de conexión | NO él: `clavesDeConexion`, del mismo módulo. Los demás valores del fichero no se miran |
| imprime | cuentas, el árbol, el NOMBRE del fichero y el NOMBRE de la variable. Ningún valor, ni recortado, ni el host |
| mira | los árboles de `git worktree list`; la RAÍZ de cada uno; ficheros `.env` y `.env.<algo>` |
| NO mira | copias que no sean un árbol de git · subcarpetas · ficheros con otro nombre |
| sale | 0 ninguna apunta a producción y se pudo mirar todo · 1 alguna apunta · 2 sin hallazgo, pero algo no se pudo mirar (`veredictoDe`, la función común) |

## Medido el 2-oct-2026 (a mano, ANTES de que existiera este script)

Con un barrido temporal que usaba el mismo módulo de decisión e imprimía lo mismo que este:

| | |
|---|---|
| árboles de trabajo | 314 · 0 sin poder abrir |
| sin fichero de entorno en su raíz | 312 |
| con alguno | 2 |
| ficheros de entorno | 3: dos `.env.local` y un `.env.prod.guardado` |
| cadenas de conexión | 5 · 4 no son producción · **1 apunta a producción** · 0 sin decidir |

**La que apunta a producción:** checkout compartido (`D:/MILLONARIO/cobroFlash/cobroflash-backend`) ·
fichero `.env.prod.guardado` · variable `DATABASE_URL`. Ignorado por git (`.gitignore:70`), no rastreado,
y nada lo carga por ese nombre: es una credencial en reposo. `docs/master/SCRUM-650.md:514` lo nombra como
un `.env` renombrado en una tanda anterior. **No se tocó. Está en manos del fundador** (borrarlo y rotar la
contraseña son decisiones suyas).

**No he vuelto a correr la medida con el script del repositorio:** hacerlo es leer otra vez ese fichero, y
la orden es no leerlo. El script está probado con casos fabricados; la cifra de arriba es la del barrido
temporal.

## Lo que esto corrige del relato

- **`CLAUDE.md`, regla 3, tres frases que hoy no se sostienen:** «ninguno apunta a producción» (uno sí) ·
  «ninguno tiene `DATABASE_URL`» (la tiene ese fichero; en ningún fichero que se CARGUE, eso sí) · «no
  existe ningún `.env.local`» (existen dos; sus cadenas no son de producción).
- **El «11 de 199» del commit de `scrum-418-puerta-de-produccion` (11-ago) ya no es cierto: hoy es 1 de
  314.** Alguien limpió entre medias. Esa rama describía un problema real que se ha encogido mucho, y su
  urgencia baja: sigue siendo decisión del fundador, pero ya no son once árboles apuntando a producción.

## La propuesta para `CLAUDE.md` — REDACTADA, NO APLICADA

Es un cambio de un derivado del máster (regla 35) y la frase correcta depende de lo que el fundador decida
sobre el fichero. Dos redacciones, según el caso; en las dos sustituye a la frase «REGISTRO MEDIDO el
10-ago-2026 (SCRUM-418)…» de la regla 3:

**Si el fichero se borra y la pasada sale 0:**

> **Claves de BD — MEDIDO el `<fecha de la pasada>` sobre `<N>` árboles de trabajo (SCRUM-1423):
> ninguna cadena de conexión de ningún árbol apunta a producción.** Se mide con
> `node scripts/claves-bd-de-todos-los-arboles.mjs`, que barre todos los árboles que git conoce (solo su
> raíz, solo ficheros `.env` y `.env.<algo>`) y no imprime ningún valor. Quien lo vuelva a medir, que
> copie aquí la frase fechada que el comando imprime. `node scripts/comprobar-claves-bd.mjs` sigue siendo
> el de UN árbol: comprueba que sus claves apuntan a donde su nombre promete.

**Si el fichero sigue ahí:**

> **Claves de BD — MEDIDO el 2-oct-2026 sobre 314 árboles (SCRUM-1423): UNA cadena apunta a producción,**
> en el checkout compartido, en un fichero que nada carga (`.env.prod.guardado`). Ningún fichero de
> entorno que se cargue apunta a producción. Existen dos `.env.local`, y `loadEnv.ts` les da prioridad.

En las dos, la frase «no existe ningún `.env.local`» se retira: hoy es falsa.

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Un comando barre TODOS los árboles que git conoce y dice, por destino, a dónde apuntan sus cadenas de conexión: cuántos árboles, cuántos ficheros de entorno, cuántas cadenas, cuántas apuntan a producción y en qué árbol · fichero · variable. | `scripts/claves-bd-de-todos-los-arboles.mjs` · `tests/scrum1423-claves-bd-de-todos-los-arboles.test.mjs` («se CAZA, con árbol · fichero · variable») |
| No imprime ningún valor, ni entero ni recortado ni enmascarado: solo cuentas, nombre de fichero y nombre de variable. El test lo comprueba con un valor fabricado que no puede aparecer en la salida. | `tests/scrum1423-claves-bd-de-todos-los-arboles.test.mjs` («NO IMPRIME NINGÚN VALOR») |
| Fail-closed: un árbol que no se puede abrir, un fichero que no se puede leer y una cadena cuyo destino no se puede decidir se cuentan aparte y se dicen; nunca se suman a «ninguno». Con alguno de ellos la pasada sale 2. | `tests/scrum1423-claves-bd-de-todos-los-arboles.test.mjs` («fail-closed», «con hallazgo Y ciegos manda el hallazgo») — ver la nota de abajo |
| La decisión «¿es producción?» es la de `scripts/_clave-vs-destino.mjs`, no un criterio nuevo. | `scripts/claves-bd-de-todos-los-arboles.mjs` (importa `comprobarCredencialDeProduccion` y `clavesDeConexion`) |
| El test se prueba FALLANDO primero, con un caso fabricado en el temporal que apunta al host de producción. Nunca contra un fichero real. | `tests/scrum1423-claves-bd-de-todos-los-arboles.test.mjs` («el lector de verdad, sobre carpetas FABRICADAS») · «Probado en rojo», abajo |
| La salida trae la frase fechada, lista para copiar: qué se midió, cuándo y sobre cuántos árboles, y sus límites (solo la raíz de cada árbol, solo ficheros `.env` y `.env.<algo>`, solo árboles que git conoce). | `tests/scrum1423-claves-bd-de-todos-los-arboles.test.mjs` («el negativo») |
| Queda redactada, SIN APLICAR, la propuesta de cambio de la frase de `CLAUDE.md`. | `docs/master/SCRUM-1423.md` («La propuesta para `CLAUDE.md`») |

**Nota a la tercera fila:** la aceptación dice «con alguno de ellos sale 2». Lo construido usa
`veredictoDe`, la función común de los guards: si ADEMÁS hay una cadena de producción, sale 1 y dice que la
lista no es completa. Con ciegos y sin hallazgo, sale 2. No escribí una tercera forma de decidir un veredicto.

## Probado en rojo

Diez mutaciones sobre el script, con la base sin mutar en verde; las diez tumban el test: no caza la de
producción · imprime el valor · imprime el valor recortado · un árbol sin abrir cuenta como «sin fichero» ·
un fichero ilegible cuenta como «sin cadenas» · lo indecidible cuenta como «no es producción» · sin árboles
sale verde · una carpeta `.env` se trata como fichero · una ruta que no existe es un árbol limpio · solo
mira `.env` a secas.

## Mis errores

1. **Mi caso de «cadena indecidible» no lo era.** Usé `postgresql://sin-barra` dando por hecho que el módulo
   no sabría leerla, y el módulo la da por «no es producción». El test falló a la primera y lo dijo. →
   comprobación: el caso usa `postgresql://[`, medida antes contra el módulo.
2. **Lo que el módulo considera legible es más ancho de lo que yo suponía**, y eso no es de este ticket:
   una cadena con un host que no es el de producción sale «no es producción» aunque le falte la base. No lo
   he tocado ni lo propongo cambiar; lo dejo dicho porque el cubo «no son producción» de este script
   hereda ese criterio.
