# SCRUM-1481 · Los dos comentarios que seguían contando la regla vieja del ancla

**Medido contra:** `origin/main` = `e883e586d11298ca09d58cd3fa89937b7b0549bd` · 2026-10-07T15:55:01Z

A9: sin fallo que generalice — son dos líneas anexadas a dos comentarios y lo único que podía romperse (el helper que el censo muta) se midió por contenido antes y después; lo que no se pudo convertir en comprobación va dicho abajo, en «Lo que NO se ha hecho»

Sesión J4f (`jv-j4`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`).
Los dos censos de mudez se corrieron sobre `12ecc7bb3bad377e729a01b09fd755f978e125b9`; entre ese
commit y el del ancla `main` avanzó 23 commits y no tocó ninguno de los ficheros de este PR ni el
censo (`git diff --stat` sobre los cinco, vacío).

Se toca: un comentario de `tests/_guard-texto.mjs`, un comentario de `package.json`, este registro
y su carpeta de evidencias. **Ninguna línea ejecutable, ninguna aserción, ningún guard, ninguna
lista, ningún workflow.**

## ① Lo anexado

Lo que firmó SCRUM-719 no se reescribe: las dos frases viejas siguen donde estaban y la nueva va
debajo, fechada.

| Sitio | Qué decía (y sigue diciendo) | Qué se anexa |
|---|---|---|
| `tests/_guard-texto.mjs`, dentro de `leerFuente` | el `ancla` es opcional ahí, a propósito | 7-oct-2026 · SCRUM-1395: esa opcionalidad vale ya sólo para los heredados declarados en `tests/_filtro-sin-suelo-heredados.json`; un test nuevo da siempre el `ancla`, y dice qué caso lo exige |
| `package.json`, comentario `//censo:mudez` | la red que corre siempre es `scrum719`, «que vigila que los trece conserven su ancla» | ANEXO 7-oct-2026 · SCRUM-1395: esa red ya no es sólo la lista cerrada; lleva además el trinquete; un test nuevo da siempre el ancla; y sigue sin medir mudez |

`git diff --numstat` contra `12ecc7bb`: `tests/_guard-texto.mjs` 1 línea añadida y 0 quitadas;
`package.json` 1 y 1 (el comentario es una cadena JSON de una sola línea: el anexo va al final de la
misma cadena, y el texto anterior está entero delante). `package.json` sigue parseando.

## ② El censo de mudez, antes y después, y el contenido del helper

`tests/_guard-texto.mjs` es el fichero que `scripts/censo-mudez.mjs` muta. Se corrió el censo
ENTERO dos veces, con `docs/master/evidencias/scrum1481/censo-con-sha.mjs`, que lee el sha256 de
los bytes del helper antes de lanzarlo y después de que acabe (no se fía del `finally` del censo
ni de `git status`).

| pasada | sha256 del helper antes | sha256 después | idéntico | veredicto | segundos | salida |
|---|---|---|---|---|---|---|
| antes de editar | `c54651e7…6c57ad` | `c54651e7…6c57ad` | sí | 119 mirados · VIVO 109 · MUDO 0 · CIEGO 0 · NO APLICA 10 · YA ROJO 0 | 238 | 0 |
| después de editar | `08264861…5d94ea` | `08264861…5d94ea` | sí | 119 mirados · VIVO 109 · MUDO 0 · CIEGO 0 · NO APLICA 10 · YA ROJO 0 | 234 | 0 |

- `c54651e7…` es el mismo sha que midió J4c el 6-oct: el helper no había cambiado en `main` desde entonces.
- El sha cambia entre las dos filas porque el fichero se editó a propósito (una línea). Lo que se
  compara es cada pasada consigo misma.
- La salida del censo (todo lo anterior al envoltorio, 29 líneas) es **idéntica byte a byte** en las
  dos pasadas, incluidos los diez nombres de NO APLICA.
- Tras la segunda pasada y tras mezclar `main`: el helper sigue en `08264861…` y `git status` no
  lista ningún fichero seguido.

Salidas completas: `docs/master/evidencias/scrum1481/censo-mudez-antes.txt` y `censo-mudez-despues.txt`.

## ③ El número: el comentario anexado no lleva ninguno

Decisión: **el anexo de `//censo:mudez` no escribe cuántos heredados hay**; remite a
`TECHO_HEREDADOS_1395`, que vive en `scrum719` y ya está sujeto a la lista por un aserto. Motivo: un
número escrito en dos sitios sin nada que los compare diverge, y un guard que comparara un
comentario de `package.json` con una constante sería un guard nuevo para sostener una frase.

**Una corrección al enunciado, medida:** el «trece» del comentario viejo **no es** el 85 desfasado.
Son dos poblaciones distintas:

| número | qué cuenta | dónde vive | qué lo sujeta |
|---|---|---|---|
| 13 | los guards a los que SCRUM-719 puso suelo (`LOS_TRECE`) | `scrum719` | un aserto exige que la lista tenga 13 |
| 85 | los heredados que llaman al filtro SIN suelo | `tests/_filtro-sin-suelo-heredados.json` y `TECHO_HEREDADOS_1395` | el caso «SCRUM-1395 · ③» de `scrum719` |

El «trece» sigue siendo verdad hoy. Lo que dejó de ser verdad es que la red fuera sólo esa lista, y
eso es lo que dice el anexo. El «trece» del comentario no lo compara nada con `LOS_TRECE`; se deja
como está porque es texto de SCRUM-719 y no se reescribe.

## Los dos hermanos: ¿un criterio o tres? (medido, no construido)

Leídos SCRUM-1408 y SCRUM-1401 enteros y comprobado que los dos defectos existían en `12ecc7bb`
(sólo lectura; `prisma/schema.prisma` no se toca).

| | SCRUM-1481 | SCRUM-1408 | SCRUM-1401 |
|---|---|---|---|
| qué repite el comentario | una REGLA de uso | la EXISTENCIA de un guard, sin decir cuál | una lista de VALORES |
| dónde está la verdad | en un trinquete que ya corre | en ningún sitio encontrado | en el código (y, para estados, en el máster) |
| existe hoy | sí (arreglado aquí) | sí: la frase sigue en `src/core/documentos/asignacionDeDocumento.ts` y 0 ficheros de `tests/` nombran el módulo (control: `accesoALaFactura` da 4) | sí: `subscriptionStatus` conserva los dos comentarios que se contradicen y `BotSession.state` sigue sin `confirming_request` (2 de 14 mirados; los otros 12, sin repetir) |
| se puede comprobar con una máquina | no (es prosa) | sí, si el comentario nombra una ruta | sí, comparando conjuntos |
| quién tiene que decidir | nadie | alguien, ver abajo | el fundador: es el esquema, y hay estados cerrados |
| área | area-j4 | area-j2 | area-j5 |

**Lectura:** comparten el criterio de ESCRITURA y no el de CIERRE.

- El criterio común cabe en una frase: *un comentario no repite lo que decide el código o un guard;
  dice quién lo decide, por su nombre*. Con eso, 1481 remite al trinquete, 1408 nombraría su test y
  1401 remitiría a la fuente de cada lista.
- Pero cada uno se cierra distinto, y juntarlos escondería lo que pide decisión:
  - **1408 ya no se puede cerrar como está escrito.** Su comentario promete un guard de que nadie lee
    `quote_assignees` para decidir un acceso. Desde el 2-oct eso ocurre a propósito y con firma:
    `accesoALaFactura.ts` y `accesoAlPresupuesto.ts` leen la asignación para decidir si un Técnico VE
    el documento. Un guard con la propiedad literal nacería rojo. Lo más parecido que existe es un
    caso de comportamiento en `scrum597` («estar asignado no deja al técnico emitir, ni cobrar, ni
    asignar»), que no vigila la propiedad estructural. Antes de escribir nada hay que decidir qué
    propiedad queda (¿sólo EDITAR y EMITIR?).
  - **1401 no es sólo comentarios.** Su parte ⑤ (las 15 líneas `MAPA[clave] ?? defecto`) es
    comportamiento, y su caso ① toca estados del bot, que son cerrados (regla 27). Y todo lo demás es
    `prisma/schema.prisma`.

No medido: los 12 comentarios restantes de 1401, y si algún guard cubre 1408 por forma sin nombrarlo
(se buscó por nombre del módulo y por nombre de las tablas: 7 ficheros de `tests/` nombran las
tablas, ninguno afirma la propiedad; no se hizo un barrido por AST).

## Aceptación → dónde se ve

| lo que pide (literal) | dónde se ve |
|---|---|
| ① Anexar —no reescribir— una línea fechada en los dos sitios que quedan | `tests/_guard-texto.mjs`, dentro de `leerFuente` · `package.json`, `//censo:mudez` |
| ② volver a correr el censo de mudez entero y comprobar el sha256 del fichero antes y después | `docs/master/evidencias/scrum1481/censo-mudez-antes.txt` y `censo-mudez-despues.txt` (sus últimas líneas) · el instrumento, `docs/master/evidencias/scrum1481/censo-con-sha.mjs` |
| ③ o el comentario no lleva número, o algo comprueba que los dos coinciden | el anexo de `//censo:mudez` no lleva número y remite a `TECHO_HEREDADOS_1395`; el «trece» anterior es otra población (§③) |

## Lo que NO se ha hecho, y lo que no se ha medido

- **Nada impide que esto se repita.** Un comentario que cuenta una regla no lo compara nadie con la
  regla. No hay comprobación nueva, y no se ha fingido una.
- **El envoltorio no se ha visto en rojo.** `censo-con-sha.mjs` sale con 3 si el sha cambia; no se ha
  matado un censo a mitad para verlo.
- **El veredicto del censo no nombra a los VIVO**, sólo los cuenta: «idéntico» es por conjunto para
  los diez NO APLICA y por recuento (109) para los VIVO.
- **Memoria:** las dos pasadas se lanzaron con 1.094 MB libres medidos antes de la primera. El censo
  corre un fichero cada vez, no es una tanda completa, y acabó las dos veces con sus 119; pero el
  umbral de la casa para una tanda completa (2.200 MB) no se cumplía.
- **Corrido en local, tras mezclar `main` y con este registro escrito:** 12 ficheros de guards
  (`scrum267`, `scrum1294`, `scrum525d`, `scrum719`, `scrum589`, `scrum237`, `scrum976`, `scrum1415`,
  `scrum480`, `scrum850`, `scrum864c`, `scrum942`), 119 tests, 119 pasan, 0 saltos; y `guards:entrada`,
  13 guards y 158 tests en verde.
- **No corrida:** la tanda completa; nada en navegador (no hay pantalla).
- El `dist/` local es de `tsc --noCheck`: el bueno es el del CI.
