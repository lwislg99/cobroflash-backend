# SCRUM-1408 · El guard que un comentario prometía y que no existía

**Medido contra:** `origin/main` = `0fd400cbc3dddf2d7d55573014937b53dc499edc` · 2026-10-07T18:03:08Z

A9: aviso → cicatriz J2 «Cambié un comentario de `src/core/documentos/`, que es carril de S1, sin mirar antes de quien era el fichero: me fie de la etiqueta `area-j2` del ticket y de que dos sesiones de J2 ya lo habian tocado.» — no se pudo comprobar: la cerradura de carril lo para con salida 2 para un nombre `j2-…`, pero no reconoce los nombres `jv-jN` de este equipo (SCRUM-1498, carril de S5)

Sesión J2 (`jv-j2`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`). La
medición previa es de J4f y está en el comentario 18763 del ticket: se leyó y no se repitió.

Se añade: `tests/scrum1408-asignar-no-es-un-permiso.test.mjs`, este registro, dos guiones y sus
salidas en `docs/evidencias/scrum1408/`, y una línea en `docs/equipo/cicatrices/J2.md`.
**No se toca nada de `src/`** (`git diff --stat` de `src/` contra el ancla, vacío).

## ① El guard no existía — medido por cuatro vías

`src/core/documentos/asignacionDeDocumento.ts:13` dice «este fichero no exporta nada que responda
"¿puede?", y hay un guard que lo comprueba».

| vía | lo medido | control |
|---|---|---|
| por nombre | 0 ficheros de `tests/` nombran `asignacionDeDocumento` | `accesoALaFactura`: 4 · un nombre inventado: 0 |
| por concepto | 5 ficheros de `tests/` nombran `quoteAssignee` y 3 `invoiceAssignee`; por los nombres de sus casos, todos son comportamiento o «las rutas pasan por la puerta» | una tabla inventada: 0 |
| por forma | el único censo genérico que alcanza el módulo es el de exportaciones sin consumir (`tests/scrum1185-trinquete-sin-consumir.test.mjs`): caza un export SIN llamador; un «¿puede?» con llamador le pasa limpio | — |
| por origen | el commit que escribió la frase (`e69ec1537`, 7-sep-2026, SCRUM-597) no trajo ningún test estructural | — |

La promesa nació sin guard. Lo más parecido era el caso NEGATIVO de `scrum597` (seis acciones dan
403), que es de comportamiento.

No medido: el cuerpo de esos tests. Se leyeron los nombres de sus casos, no sus aserciones.

## ② Qué se construyó, y por qué eso

La frase prometía dos cosas. La segunda («nadie lee `quote_assignees` para decidir un 403») dejó de
ser verdad a propósito el 2-oct-2026: `accesoALaFactura.ts` y `accesoAlPresupuesto.ts` leen la
asignación para decidir si un Técnico VE el documento (fundador, SCRUM-1390 c.17962; SCRUM-1397 y
SCRUM-1403). Un guard con la propiedad literal nacería rojo.

Se construyen las formulaciones A y B de c.18763, con el visto bueno del orquestador del 7-oct:

- **A** · el módulo exporta exactamente una lista cerrada (hoy 6 nombres) y ninguna función
  exportada devuelve `boolean`, `Promise<boolean>` ni un predicado. Sin tipo de vuelta escrito
  también cae: lo que no se puede leer no se da por bueno.
- **B** · la asignación al documento sólo la tocan 6 ficheros de `src/`, cada uno declarado con su
  papel, y por la relación `asignados` sólo se llega desde las dos puertas. Se comparan conjuntos:
  un fichero nuevo cae, y uno declarado que ya no la toca también.

El test sólo LEE `src/`, por AST (regla 38: no es STOP). No necesita `dist/` ni base. Población que
imprime: 320 ficheros `.ts` leídos, 6 tocan la asignación.

La formulación C (ampliar `scrum597` a presupuestos y a cada ruta de escritura) NO se hace: es otro
tamaño y pide banco.

### Lo que el guard NO ve

- **Dentro de las dos puertas no distingue VER de EDITAR.** Si alguien reutiliza su `where` en una
  ruta de escritura, calla. Es el límite de B, y es justo lo que cubriría C.
- Los dos ficheros de rutas reciben la lista de asignados para pintarla. Si un día la usan en un
  `if`, calla: se mira quién la pide, no qué hace con ella. Las cuatro llamadas no se han leído una
  a una (tampoco en c.18763).
- Un acceso con el nombre calculado (`prisma[nombre]`) no tiene literal que encontrar.
- `normalizarAsignados` se reexporta desde los Trabajos: se mira su nombre, no su tipo.

## ③ Visto en rojo primero

`node docs/evidencias/scrum1408/rojo-primero.mjs` inyecta en `src/`, corre el test en un proceso
aparte y restaura. Salida en `rojo-primero.salida.txt`:

| inyección | cae |
|---|---|
| I1 · `export function puedeEditarElDocumento(…): boolean` en el módulo | el caso A, y sólo ése |
| I2 · `leerAsignadosDeDocumento` pasa a devolver `Promise<boolean>` (mismo nombre) | el caso A, y sólo ése |
| I3 · un tercer fichero filtra por `asignados: { some: … }` | el caso B, y sólo ése |
| I4 · un fichero lejano lee `prisma.quoteAssignee` | el caso B, y sólo ése |

Base antes y después: 4 de 4. Árbol intacto por sha256 del módulo. La mitad «uno declarado que ya
no la toca» no se inyectó: la sostiene que la comparación es de conjuntos, no una pasada en rojo.

## ④ El censo: cuántos comentarios más prometen un guard sin nombrarlo

`node docs/evidencias/scrum1408/censo-promesas.mjs --todas`, sobre los 320 `.ts` de `src/`, con cinco
controles que corren antes del recuento (dos a cero, tres positivos):

| clase | promesas |
|---|---|
| nombra un fichero, un script o un `npm run` | 5 |
| sólo nombra un número de ticket | 5 |
| **no nombra nada** | **9** (una es la de este ticket) |
| total | 19, en 18 ficheros |

Es un SUELO: casa por la forma de la frase («hay un guard…», «un test lo comprueba…»). Una promesa
escrita de otra manera no sale. Y de las otras 8 sin dirección no se ha comprobado si su guard
existe: sólo que el comentario no dice cuál. No se arregla ninguna. La lista, con fichero y línea,
está en `censo-promesas.salida.txt`.

## ⑤ Lo que NO se ha hecho

**El comentario sigue sin decir dónde está el guard.** `src/core/documentos/**` es carril de S1
(`docs/equipo/dos-equipos.md` §3.1), el cruce no está declarado en §3.4, y la cerradura de carril
contesta salida 2 para J2 sobre ese fichero (comprobado dándole el nombre `j2-prueba`; con
`src/integrations/whatsapp.ts`, que es de J2, salida 0). Desde este PR la primera mitad de la frase
ya es verdad: el guard existe. Lo que falta es que lo nombre. Texto propuesto a S1, tres líneas por
las tres de hoy (13 a 15), para no mover las que hay debajo:

    // Por eso este fichero no exporta nada que responda «¿puede?». Lo comprueba, y dice quién SÍ
    // decide con la asignación, `tests/scrum1408-asignar-no-es-un-permiso.test.mjs` (SCRUM-1408):
    // un export nuevo aquí, o un fichero más que lea la asignación, cae ahí y pide una decisión.

Y de paso, en la línea 19 del mismo comentario: dice que la lectura para VER «vive en
`accesoALaFactura.ts`», y desde SCRUM-1403 vive también en `accesoAlPresupuesto.ts`.

Tampoco: la formulación C; las 8 promesas sin dirección del censo; nada visto en yaqu.app (no hay
nada que ver: no cambia ningún comportamiento).

## Errores propios

1. El de la línea A9. Edité las tres líneas del comentario antes de mirar de quién era el fichero.
   Lo vi al cargarse la regla del carril tras la edición, lo confirmé con la cerradura y lo deshice
   antes de empujar. El orquestador había dicho sí a «el comentario pasa a nombrar ese test» con mi
   dato delante, y mi dato no decía que el fichero era de otro equipo.
2. El hook de inicio de sesión dijo «SIN IDENTIDAD… no construyas» porque no reconoce el nombre
   `jv-j2`. Seguí por indicación del orquestador («mi ficha es tu identidad»), y queda escrito aquí
   para que conste que se decidió pasar por encima. Es el mismo hueco que hizo posible el error 1.
3. El primer borrador del test llevaba un quinto caso («el comentario nombra este fichero») que
   sólo podía pasar editando el fichero de S1. Se retiró con la edición.

## Aceptación → dónde se ve

El ticket no trae una lista bajo «Aceptación»; trae «Lo que pide», en cuatro puntos.

| lo que pide (resumido del ticket) | dónde se ve |
|---|---|
| ① comprobar si algún guard lo cubre sin nombrarlo, por forma y por concepto | este registro, apartado ① |
| ② si lo cubre, el comentario dice cuál | NO HECHO → S1: el fichero es de su carril; texto propuesto en ⑤ |
| ③ si no lo cubre, escribir el guard o quitar la promesa; si se escribe, verlo fallar | `tests/scrum1408-asignar-no-es-un-permiso.test.mjs` · `docs/evidencias/scrum1408/rojo-primero.salida.txt` |
| ④ el recuento de comentarios que prometen sin nombrar | `docs/evidencias/scrum1408/censo-promesas.salida.txt` |
