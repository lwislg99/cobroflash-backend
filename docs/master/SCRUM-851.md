# SCRUM-851 · el job de guards de navegador por fin le da a `guard:lista-trabajos` algo contra lo que comparar en un PR

**Medido contra:** `origin/main` = `658976f0a28cd3192c11ddd4040ca934c6a686f7` · 2026-09-15T12:14:00+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-851-guards-ven-origin-main-en-pr`
**Carril:** CI · `.github/workflows/ci.yml` — **excepción de carril declarada por el fundador**: el directorio es de la Sesión 5, que en esta tanda no toca `ci.yml`.

## La víctima

Quien lee el CI de un PR. `guard:lista-trabajos` salía **CIEGO en todo `pull_request`**, así que el job
«guards de navegador» no podía estar verde en ningún PR. No frena nada —ese job **no es obligatorio**
en la protección de `main`, y el #1248 entró con él en rojo—, pero un check que no puede estar verde
enseña a ignorar la suite.

## De dónde sale: el log, no una deducción

Encontrado cerrando SCRUM-843. En main el guard ya salía verde (run 34953539600), y en el PR de ese
mismo arreglo salía ciego (run 34952731138). **No era el mismo ciego.** El del PR ni llegaba a las
calibraciones: se paraba en el primer `if` del bloque ⑥.

```
🔴 NO SUPE MIRAR: no pude resolver el punto de partida de la rama (`merge-base`).
```

El checkout del job, en el log del PR:

```
git fetch --depth=1 origin +85437228…:refs/remotes/pull/1250/merge
```

Una sola ref, un solo commit. `baseDeLaRama` prueba `origin/main`, `origin/HEAD` y `main`: no existe
ninguna y devuelve `null`. En push a main el mismo checkout crea `refs/remotes/origin/main`
(`+2b3c1bd6…:refs/remotes/origin/main`), la base resuelve y el guard llega a medir.

**Desde siempre, no desde SCRUM-843.** Mismo mensaje en el PR que trajo el guard (#1214, run
34331100821) y en #1248 (run 34952894830). El bloque ⑥ **no se había medido nunca en un PR**. La
cabecera de `tests/_base-de-la-rama.mjs` dice «EN CI TAMBIÉN VALE», y es cierto en el job de tests
(`fetch-depth: 0`) y falso en el de guards.

## El cambio: dos piezas copiadas, y nada más

En el job `guards-visuales`, y sólo ahí:

```yaml
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Traer `main` (guard:lista-trabajos compara contra su punto de partida)
        run: git fetch --no-tags --prune --no-recurse-submodules origin +refs/heads/main:refs/remotes/origin/main
```

Es **la receta que ya llevan** los jobs `meta-mutaciones` y `vigia-despliegue`, y ya explicada en
`ci.yml` con su tabla medida: hacen falta **las dos cosas**. Con historia pero sin la ref,
`origin/main` no existe; con la ref pero sin historia, no hay antepasado común que encontrar. El
comando de `git fetch` es carácter por carácter el de `meta-mutaciones`.

⛔ **El guard no se toca (regla 41).** Ni una línea de `scripts/`.

## Verificado antes de empujar

| | resultado |
|---|---|
| `npm test` | **6.553 tests · 0 fail** — incluidos los once ficheros de la tanda que leen `ci.yml` |
| guards de entrada | **22/22** |
| sangría del YAML | idéntica a la de los tres jobs que ya lo llevan (`with:` a 8, `fetch-depth` a 10) |

No hay parser YAML en el árbol (ni `yaml` ni `js-yaml` en `node_modules`, ni PyYAML), así que la
validez del fichero **la dicta el propio CI del PR**: un workflow que no parsea no falla, no corre, y
eso se ve.

## 🔴 Lo que el log del PR NO puede enseñar, y por qué

El criterio de cierre pide ver en el log del job que el bloque ⑥ **llegó a medir**. Hay un límite que
está en el runner, no en el guard: `scripts/guards-visuales.mjs` sólo reproduce la salida entera de
los guards **que no están verdes** (`:453-457`). De uno verde imprime una línea:

```
✔ guard:lista-trabajos        9.5 s   (arranque: ?)   verde
```

O sea: **si este arreglo funciona, el log no trae ninguna línea del bloque ⑥.** Lo que sí trae, y
basta para descartar las dos formas de verde vacío que preocupan:

- el paso «Traer `main`» ejecutado → `origin/main` existe en ese clon;
- la ausencia de «no pude resolver el punto de partida» — que es el `if` que da **salida 2**, no 0;
- la línea `verde`: salida **0**, que en el bloque ⑥ sólo es alcanzable si la base resolvió **y**
  las calibraciones Ⓐ y Ⓑ pasaron, porque todas las demás ramas llaman a `nosupe` (salida 2).

La evidencia de CI de este PR y la del main posterior se dejan en SCRUM-851: el PR se auto-mergea en
cuanto pasa «build + tests», así que puede entrar antes de que acabe su propio job de guards.
