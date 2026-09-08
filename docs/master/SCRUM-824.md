# SCRUM-824 · El vigía que no deja pasar

**Fecha:** 8-sep-2026 · **Rama:** `scrum-824b-el-vigia-que-no-deja-pasar`

**Medido contra:** `origin/main` = `f0ec26e86a04a21e9e60b748b4c7c5c2c83bace9` · 2026-09-08T09:11:55+01:00

> ⚠️ Es el `merge-base` real de esta rama, no el `origin/main` del momento de escribir: mientras se
> trabajaba esto, `main` ya iba por `ac0c71fa`. Se ancla contra lo que se midió.

---

## 🔴 EL SÍNTOMA, Y POR QUÉ COSTÓ DOS SESIONES

`tests/scrum716c-la-memoria-del-vigia.test.mjs` fallaba en CI **de forma intermitente** y bloqueó
tres ramas: **626** (`:255`), **527** (`:255` y `:291`) y **632b** (`:291`, y su re-run salió
verde). Dos sesiones no lo reprodujeron: worktree limpio sobre `origin/main`, fichero suelto, tanda
entera — **8/8 verde siempre**.

Y ahí está la trampa. Con un fallo de **1 de cada 43**, ocho pasadas verdes no son evidencia de
nada: la probabilidad de no verlo en ocho intentos es del **83 %**. Las dos sesiones anteriores
midieron bien y concluyeron mal, porque *N* era demasiado pequeño para la moneda que estaban
tirando. **El tamaño de la muestra era el problema, no la agudeza de nadie.**

## ✅ LA CAUSA, con N=200 y correlación perfecta

```
                                    el test pasa      el test FALLA
    8 primeros del sha TODO DÍGITOS      0                 6
    8 primeros con alguna letra        194                 0
```

Cero excepciones en las dos casillas que importan. La cadena, eslabón a eslabón:

1. El fixture crea **commits vacíos fechados a partir de `Date.now()`**, así que su sha es distinto
   en cada pasada.
2. `constanciaDeEjecucion` escribe en el historial `prod=` con los **ocho primeros**
   (`corto()`, `scripts/_vigilante-de-despliegue.mjs:240`).
3. `shaLegible` (`scripts/_ritmo-de-despliegue.mjs:76`) **rechaza a propósito lo que sea todo
   dígitos**: sin `RAILWAY_GIT_COMMIT_SHA`, producción publica `String(Date.now())` y trece dígitos
   son hexadecimal válido.

`(10/16)^8 = 2,3 %`. Medido: **6/200 = 3,0 %**.

### 🔴 El vigía no se equivoca ni una vez

Hace exactamente lo que dice que hace, y **el precio está declarado por escrito en su propio
módulo** desde antes de este ticket:

> *«un sha abreviado que salga todo dígitos también se rechaza. Con 8 caracteres eso pasa en torno
> al 2 % de las veces ((10/16)^8) … Se acepta a propósito porque el error va en la dirección
> segura: callar de más, nunca inventar un movimiento que no se ha medido.»*

Quien asumía era **el fixture**, que daba por hecho que un sha de git siempre se puede leer.

## ⚠️ LAS DOS HIPÓTESIS QUE SE CAYERON, medidas y no descartadas de palabra

**① El botón «Update branch» de GitHub.** Era la hipótesis viva, y era razonable: el fundador vio
la correlación con sus propios ojos. No se sostiene:

| | pasadas | fallos |
|---|---|---|
| rama **CON** commit de merge de `main` encima | 100 | **6** |
| `origin/main` **limpio**, sin merge | 100 | **6** |

El mismo número exacto. Lo que hacía el botón era **tirar el dado otra vez**: cada pulsación lanza
un CI nuevo, y más tiradas es más probabilidad de ver un 1-de-43. La correlación que se percibió
era real; la causa, no.

⚠️ Y el primer intento de medirlo **no medía nada**: `git checkout -b prueba origin/main~5 && git
merge origin/main` hace **fast-forward** y no crea ningún commit de merge. Hubo que darle a la rama
un commit propio primero. Se anota porque el experimento parecía correcto y no lo era.

**② El nombre de la rama por defecto de `git init`.** Aquí es `master` —con mi configuración y con
`HOME` vacío, comprobado—, pero el fixture crea `refs/remotes/origin/main` **a mano** con
`update-ref` y el vigía sólo hace `git rev-parse origin/main`. El nombre local nunca entra.

## 🔴 EL RELOJ SÍ ENTRABA — pero no por donde se miró

La pregunta era si los huecos de «48.0 h» y «60.0 h» se calculan contra `now`. **Se calculan, y por
eso NO dependen del reloj:** las fechas son «ahora menos 72/60/48 h», así que el hueco sale
constante. Medido:

```
base 2020-01-01T00:00:00Z → hueco 72.0 h
base 2026-09-08T03:00:00Z → hueco 72.0 h
base (ahora)              → hueco 72.0 h
```

Donde el reloj sí entra es en el **sha**, y es función pura de él:

```
misma base de tiempo, dos repos distintos → 8c1d9da1589e5abd7954a75d9e1b5ac737359faa
                                          → 8c1d9da1589e5abd7954a75d9e1b5ac737359faa   IDÉNTICOS
```

Ése es el acoplamiento que nadie tenía: **el reloj no mueve el hueco, aleatoriza el sha.** Y explica
el último detalle suelto — por qué 527 falló en `:255` **y** `:291` a la vez: dos tests que arrancan
en el mismo milisegundo generan **el mismo sha**, así que o caen los dos o no cae ninguno. Se
observó dos veces en la tirada de 200 (`00578033` y `65762544`, cada uno repetido).

## ✅ EL ARREGLO

El fixture **mina** el commit: si los ocho primeros salen todo dígitos, lo repite con la fecha
corrida **un segundo** hasta que salga legible. Un segundo no mueve un hueco de 48 h ni en la
primera decimal, y el reintento **amenda** en vez de añadir, para que `commits=` siga siendo el que
los casos esperan. El tope de reintentos **peta** en vez de devolver el malo en silencio.

### Lo que NO se ha hecho, punto por punto

- ⛔ **No se toca el vigía.** Ha acertado las tres veces.
- ⛔ **Ningún caso baja a `skip`.** El fichero pasa de 8 a 13 tests, `skipped 0`.
- ⛔ **El margen de 6 h y el veredicto `NO_SE_SABE` siguen intactos.**
- ⛔ **El rechazo de los todo-dígitos NO se anula.** Tiene su propio control, el ⑤.

### ✅ EL NEGATIVO, que es lo que impide que esto sea un apagado

`SCRUM-824 · ⑤` siembra en el historial una constancia con `prod=` de ocho dígitos —**pedida al
formateador de verdad, no copiada a mano**— y exige que el vigía **siga contestando NO SE SABE, exit
2, diciendo por qué**. Eso no es el defecto: es su trabajo. Lo que se ha quitado es que el fixture
lo pisara por azar; ahora está **fijado** en vez de ocurrir por sorpresa una vez de cada 43.

## Verificación

**Cinco mutaciones, cada una comprobada PRESENTE EN EL FICHERO con su huella antes de correr:**

| | mutación | cae |
|---|---|---|
| M1 | el detector nunca ve un prefijo ilegible | ① ② ③ |
| M2 | el detector ve todo como ilegible | ① ② ④ ⑤ y los dos controles de 716c |
| M3 | el minero reintenta sin mover la fecha | ② |
| M4 | al agotar el tope devuelve el sha ilegible | ③ |
| M5 | **al vigía** se le quita el rechazo de los todo-dígitos | ① ⑤ |

M5 es la que importa para no engañarse: prueba que el negativo ⑤ vigila **la regla del vigía**, no
una copia suya.

**Y el antes/después, con el mismo comando y el mismo fichero:**

```
SIN el arreglo · rama con commit de merge · 100 pasadas → 6 fallos
SIN el arreglo · origin/main limpio       · 100 pasadas → 6 fallos
CON el arreglo · origin/main limpio       · 100 pasadas → 0 fallos
```

## 🕳️ Hueco declarado

El minero elimina el 1-de-43 **de este fixture**, no la propiedad general: cualquier otro sitio que
guarde un sha abreviado y lo relea con `shaLegible` tiene la misma moneda encima. No se ha barrido
el repo buscándolos —queda fuera de este encargo— y se dice en vez de dejarlo implícito.
