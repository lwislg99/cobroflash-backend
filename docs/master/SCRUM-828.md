# SCRUM-828 · El mensaje que mandaba a mirar donde no es

**Fecha:** 8-sep-2026 · **Rama:** `scrum-828-el-mensaje-que-manda-a-mirar-donde-no-es`

**Medido contra:** `origin/main` = `61d14a15bd414116a69ed8f6a8f88367164bff65` · 2026-09-08T09:54:22+01:00

> ⚠️ La entrega se hizo antes en `automerge-el-mensaje-que-manda-a-mirar-donde-no-es` @ `dd686572`,
> cuando este ticket todavía no tenía número. La rama nueva sale de **esa misma punta**: no se
> reescribió historia y la vieja no se borró — la borra el fundador cuando ésta esté.
>
> Y el nombre no es cosmética: el candado de `pr-automatico.yml` sólo coge ramas `scrum-*`, así que
> con el nombre viejo **este arreglo no pasaba por su propio workflow**.

---

## El defecto

`.github/workflows/pr-automatico.yml`, paso «Armar el auto-merge», fallaba contra el **PR #1181**
con:

```
GraphQL: Resource not accessible by integration (enablePullRequestAutoMerge)
```

…y su propio mensaje decía:

> *«Dos causas probables, las dos en Settings del repositorio: Allow auto-merge desactivado ·
> --merge no permitido»*

**Se dejaba fuera la causa que el propio error nombra.** «Resource not accessible by integration»
es el lenguaje de GitHub para **permiso insuficiente del token**, no para una opción desactivada.

🔴 **Es el defecto 6 de la casa dentro de nuestro propio workflow: una hipótesis con forma de
diagnóstico.** Dos causas de tres, presentadas como «probables» sin ninguna medición detrás. Estuvo
semanas mandando al fundador a mirar donde no era.

## Los tres literales, medidos — y de dónde sale cada uno

| causa | lo que dice GitHub | fuente |
|---|---|---|
| **A · permisos del token** | `Resource not accessible by integration (enablePullRequestAutoMerge)` | **documentación oficial** de GitHub |
| **B · auto-merge desactivado** | `Auto merge is not allowed for this repository (enablePullRequestAutoMerge)` | salida real reproducida en `cli/cli#13398` |
| **C · método de merge no permitido** | `The selected merge method (…) is not allowed` | ⚠️ informes de usuarios, **no** documentación |

La cita de **A**, entera, porque es la que decide:

> *«If you are using a GitHub App or fine-grained personal access token and you receive a "Resource
> not accessible by integration" … error, then your token has insufficient permissions.»*
> — GitHub Docs · REST API · *Troubleshooting the REST API*

**El literal que salió en el #1181 es el A** — la única causa que el mensaje viejo no nombraba.

### 🔴 LOS DOS LÍMITES. Si se pierden, alguien volverá a ordenar por probabilidad

Van escritos porque **no se midió más que esto**, y porque son la razón de que el mensaje mande
COMPARAR en vez de rankear:

**① El literal de C no está confirmado en documentación oficial.** Sale de informes de usuarios y
en el sitio donde se vio era la interfaz web, no esta mutación de GraphQL. El propio mensaje lo dice
en voz alta: *«si tu error de arriba no se parece a ninguno de los tres, no lo metas a la fuerza en
esta casilla: dilo y se vuelve a medir.»*

**② Hay más literales que NO son ninguno de los tres.** Medidos también:

```
Pull request User is not authorized for this protected branch (enablePullRequestAutoMerge)
    → «Restrict who can push to matching branches» en la protección de rama
Pull request Protected branch rules not configured for this branch (enablePullRequestAutoMerge)
```

Es decir: **el espacio de causas está abierto.** Una lista ordenada por probabilidad da a entender
lo contrario —que son éstas y en este orden—, y eso es exactamente lo que hizo perder semanas. Un
mensaje que entrega el CRITERIO (compara tu literal con estos) sigue siendo útil cuando aparece el
cuarto; uno que rankea, no.

## El mensaje nuevo

Corrido de verdad con un `gh` de mentira que devuelve el error del #1181 — rojo con el diagnóstico
completo — y con uno que responde bien — verde y `exit 0`. Va en este orden:

1. **Qué falló, exactamente.** El comando, la respuesta **verbatim** de GitHub —que antes se perdía
   entre el ruido, y es el único dato que decide— y **qué token actuó** (App en modo COMPLETO o
   `GITHUB_TOKEN` en DEGRADADO). Ese dato el workflow SÍ lo sabe, y cambia la ruta de Settings
   entera.
2. **Qué se sabe y qué NO se sabe.** *«Un workflow no puede leer Settings, así que este mensaje NO
   PUEDE decirte cuál de las causas es la tuya, y no va a fingir que sí.»* Lo que sí entrega es el
   criterio para decidirlo en diez segundos.
3. **Las rutas COMPLETAS**, las tres causas y sin ordenar. Incluida la que todo el mundo olvida:
   `Settings → Applications → Installed GitHub Apps → tu App → Configure`, porque **una App no gana
   permisos hasta que la instalación los acepta** — sin ese paso el fundador cambia el permiso, no
   pasa nada, y vuelve a preguntar.
4. **El aviso del squash.**

## 🔴 El aviso del squash: por qué es lo más importante del fichero

> Si el repo **no** admite commits de merge, **la salida NO es pasar a squash**. Con squash el
> commit de una rama nunca llega a `main`, y `git merge-base --is-ancestor <sha> origin/main` — que
> es la **OBLIGACIÓN 0 de las seis sesiones** — pasaría a decir «SIN MERGEAR» para todo, siempre.
>
> **No fallaría a gritos: daría una respuesta plausible y falsa**, que es el peor modo de fallo que
> hay.

Cambiar a squash es **romper el instrumento con el que medimos si el trabajo existe**. La decisión
es del fundador y va escrita.

## El control

`tests/pr-automatico-el-mensaje-del-automerge.test.mjs`, 6 casos.

🔴 **Mira el GUIÓN EJECUTABLE, no el fichero.** El comentario que encabeza ese paso EXPLICA el
defecto y por tanto contiene los mismos literales que se persiguen: un guard de texto sobre el
fichero entero se cazaría a sí mismo y daría verde **con el mensaje borrado**. Es la lección de
SCRUM-349, y aquí estaba servida. Hay un suelo que comprueba esa separación —exige que el literal
del comentario esté en el fichero y NO en lo acotado—, así que si alguien cambia el acotador, cae.

**Ocho mutaciones, cada una verificada presente en el disco antes de correr, todas caen:** borrar
cada una de las seis rutas de Settings, borrar una sola línea del aviso del squash, y devolver el
texto viejo («dos causas probables»). **Control negativo:** tocar sólo un comentario no tumba nada.

## 🕳️ Hueco declarado

El mensaje no puede leer Settings y no lo pretende. Si aparece un literal que no es ninguno de los
tres, **este documento y ese mensaje quedan cortos a propósito**: lo que piden entonces es volver a
medir, no ampliar la lista de memoria. Ampliarla sin medir sería repetir el defecto 6 con una
casilla más.
