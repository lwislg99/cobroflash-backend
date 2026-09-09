# SCRUM-835 · El historial de un repositorio público, barrido — y cero credenciales

**Medido contra:** `origin/main` = `ee13c63f6d904fed6abda667db4e96fab4e24e93` · 2026-09-09T11:20:00+02:00
**Rama:** `scrum-835-credenciales-en-el-historial`

> El repo **sigue siendo público** por decisión del 9-sep-2026: pasarlo a privado costaría ~150 $/mes
> de CI. Así que el riesgo no se cierra cerrando el repo. **Se cierra mirándolo, y mirándolo cada vez.**

---

## 1 · La respuesta: **cero credenciales**

| | |
|---|---|
| commits alcanzables | **4.632** |
| blobs ALCANZABLES desde alguna ref | **9.862** |
| leídos | **9.862** — ninguno saltado por tamaño |
| binarios (NUL en los primeros 8 KB), contados y declarados | 387 |
| objetos sueltos del clon, NO barridos y por qué (§4bis) | 301 |
| tamaño de `.git` | 158 MB |
| **credenciales encontradas** | **0** |

Se barre el **historial**, no el árbol de hoy: una clave que se subió y se borró al día siguiente
**sigue publicada**, porque el commit que la introdujo continúa siendo alcanzable desde `main`.

## 2 · 🔴 Y el cero está respaldado: el control positivo va SEMBRADO

Un cero sin control positivo es una pregunta sin responder. El guard **crea un repositorio
temporal, comitea una credencial sintética, la BORRA en el commit siguiente y comprueba que el
barrido la sigue viendo**:

```
repo limpio          → 0 hallazgos   (si acusara aquí, acusaría a cualquier cosa)
tras comitearla      → cadena-de-conexion + stripe-secreta
tras BORRAR el fichero, con HEAD ya sin él → sigue saliendo
```

Esa última línea es la premisa del ticket, demostrada: **borrar no despublica.**

⚠️ Se siembra en un repositorio **temporal**, no en éste, y no por comodidad: para que el blob
sembrado desapareciera de aquí haría falta `git gc --prune=now`, y este `.git` lo **comparten seis
worktrees** — eso les borraría a las demás sesiones su red del reflog (la lección de A15, otra vez).

Y así queda **repetible**, no como una comprobación de una tarde.

## 3 · 🔴 El instrumento mintió antes que el árbol

La primera pasada dio **12 hallazgos**, todos de tipo «cadena de conexión». **Ninguno lo era.**

Al resolverlos —sin imprimir ni un valor, tachando por programa y mirando sólo la FORMA— dos de
ellos tenían por contraseña un **`${…}`**: una interpolación de plantilla, o sea el NOMBRE de una
variable. El detector leía `usuario:${SECRETO}@host` y cantaba credencial.

> 🔒 Una plantilla no es un valor. Un detector que no distingue el hueco de lo que va dentro
> **acusa justo al código que hace las cosas bien** — que es el que usa variables.

Los otros diez eran rellenos (`user:pass@localhost`) dentro de tests que existen **precisamente
para vigilar fugas de credenciales**. Por eso `esHueco` va antes que cualquier veredicto, y el
control negativo lleva las cinco formas de hueco del árbol: `${x}`, `$X`, `%X%`, `<x>`, `{{x}}`.

### Cómo se investigó sin publicar nada

Ni un valor salió por la salida estándar en ningún momento:

1. el barrido devuelve **sólo `{oid, tipo}}`**;
2. para juzgar contexto, un visor que **tacha por programa** la credencial antes de imprimir;
3. para decidir fixture vs real, **propiedades**: entropía por carácter, composición, número de
   etiquetas del host y **en cuántos blobs del historial aparece** — una credencial real vive en uno
   o dos sitios, un fixture se copia por medio repositorio (uno de ellos salía en **5.551**);
4. y por último la FORMA por clases (`letras→a`, `dígitos→9`), que fue la que destapó el `${…}`.

## 4 · Lo construido

| fichero | qué |
|---|---|
| `scripts/_credenciales-en-texto.mjs` | el detector: 17 formas + la cadena de conexión, con `esHueco` delante. **Señales partidas** para que el propio fichero no sea un hallazgo |
| `scripts/_barrido-de-credenciales.mjs` | el barrido sobre el *object store*, en **flujo** |
| `tests/scrum835-credenciales-en-el-historial.test.mjs` | el guard: 5 tests, con el control sembrado y **lo que NO cubre declarado dentro** |

**Detector y barrido van separados** para que el detector se pueda ejercitar sin git y el barrido
sin inventar credenciales.

### Coste, medido

El guard entero, **~11 s**: 3,4 s en enumerar los objetos alcanzables, ~6 s en leerlos y 2 s el
control sembrado. La primera versión lanzaba un `git cat-file blob` **por objeto** y no terminó en
15 minutos; con `--batch` y un solo subproceso son ~6,7 s. Y la enumeración se hace **una sola vez**
para toda la tanda: por test le sumaba siete segundos a cada `npm test` sin medir nada nuevo.

## 4bis · 🔴 MI PROPIO GUARD ME CAZÓ A MÍ, Y ME OBLIGÓ A CORREGIR UNA DECISIÓN

Al mezclar main y correr la tanda, el guard se puso ROJO señalando **su propio fichero**:
`clave-privada-pem en tests/scrum835-credenciales-en-el-historial.test.mjs`.

No había ninguna credencial: era la **cabecera de un bloque PEM**, sin material de clave. Escribí
siete de los ocho ejemplos partidos y ése entero — y en cuanto se comiteó, el barrido encontró el
fichero del barrido. **La trampa está documentada en la cabecera de ese mismo fichero y aun así
caí en uno de los ocho.**

### Y detrás había una decisión mal tomada

Arreglar el fichero no bastaba: **el blob ya estaba comiteado**, que es literalmente la premisa de
este ticket. Eso me obligó a mirar por qué el barrido leía `--batch-all-objects` —TODOS los objetos
del almacén, alcanzables o no— con el argumento «un blob suelto también está publicado».

🔴 **Es falso.** Lo publicado es lo que se EMPUJÓ, y eso es lo alcanzable desde una ref. Un objeto
suelto de un clon de trabajo es basura LOCAL —un commit enmendado, una rama descartada— que nunca
salió de esta máquina. Contarlo tenía dos costes y ninguna ventaja:

1. **acusa de publicar algo que no se publicó**, y obliga a `git gc --prune=now` para limpiarlo —
   sobre un `.git` que aquí comparten seis worktrees (A15);
2. **no es lo que ve CI**, que clona y sólo recibe lo alcanzable. Un guard que en local mide otra
   población que en CI produce rojos que no se reproducen, y ésos se acaban apagando.

Aquí eran **301 objetos** de diferencia (10.163 → 9.862). El caso del ticket **no se pierde**: una
clave metida en un commit y borrada en el siguiente sigue saliendo, porque ese commit sigue siendo
alcanzable — y eso es justo lo que fija el control sembrado.

> 🔒 «Publicado» no es «está en mi disco»: es «cuelga de una ref que alguien puede clonar».

El commit con el blob malo **no se había empujado**, así que se rehízo con `reset --soft` y se
volvió a comitear limpio: sin reescribir nada que hubiera salido de aquí (AA2).

## 5 · ⛔ Lo que este guard NO cubre — declarado dentro del propio fichero

Un guard que promete más de lo que hace es peor que uno que promete poco: el primero se convierte en
la razón por la que nadie vuelve a mirar.

1. **No detecta un secreto sin FORMA reconocible.** Una contraseña suelta en `const clave = '…'` no
   se distingue de cualquier otra cadena. Se cazan prefijos de proveedor, bloques PEM y
   `usuario:clave@host`.
2. **No lee blobs de más de 2 MB ni binarios.** Se **cuentan y se declaran**; no se callan.
3. **No mira los mensajes de commit**, ni nombres de rama, ni etiquetas: sólo contenidos de fichero.
4. **No mira objetos que sólo existan en el remoto** y no se hayan traído. Mide este clon.
5. **No valida si la credencial sigue siendo válida.** Una clave revocada sigue saliendo, y está
   bien: revocarla es la respuesta, no dejar de verla.
6. **Una credencial partida en dos trozos** y unida en ejecución no tiene forma, y no sale.
7. **No mira los objetos sueltos de este clon** (§4bis). Y su cara mala, dicha: un blob que SÍ se
   empujó y luego quedó inalcanzable en el remoto (un `push --force`) sigue en GitHub y este clon
   ya no lo tiene. Eso no se ve desde aquí.

## 6 · Verificación

| | |
|---|---|
| ✅ **positivo (unidad)** | las 8 formas sintéticas se detectan, y las señales declaradas no pueden encoger sin que se diga |
| ✅ **positivo (sembrado)** | credencial comiteada en un repo temporal → cazada; borrada → **sigue cazada** |
| 🔴 **negativo** | las cinco formas de hueco, más rellenos, hosts inofensivos, una URL sin credenciales y la palabra «contraseña» en prosa: ninguno acusa |
| 🔴 **suelo** | menos de 5.000 blobs ⇒ **CIEGO**, no «no hay»; y `leídos + saltados` tiene que cuadrar con el total |

## ⛔ No tocado

Ningún secreto, real o de ejemplo, en el informe, el código, los comentarios ni los mensajes de
commit · el historial **no se reescribe** (no hizo falta, y no des-publicaría retroactivamente) ·
`src/` · ningún rótulo.
