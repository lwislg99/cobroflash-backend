# SCRUM-471 · la suite se declara ciega en vez de dar cinco rojos que parecen del producto

**Medido contra:** `origin/main` = `dd5416f04ed1b8d80a403a9525fab33437fe8b03` · 2026-08-11T21:12:46+01:00

**11-ago-2026** · sin gate, corre en `npm test`

> ⚠️ **Entrada escrita a posteriori, y por otra sesión.** El trabajo es de la sesión que commiteó
> `b5a45714` el 11-ago-2026 a las 17:32 +0200; su entrada de máster nunca se creó, y SCRUM-351 lo
> anotó como hueco. La escribe SCRUM-476 al reconciliar los dos censos. **Se documenta lo que hay
> en `main`: no se firma como propio, no se juzga y no se toca ni un assert.** Lo único que este
> ticket ha cambiado en el fichero es la cabecera, y solo para que su recuento diga de qué
> población habla — ver `docs/master/SCRUM-476.md`.

## El defecto

**DOS sesiones distintas reportaron cinco rojos de la cola offline como un fallo del producto, y se
abrió un ticket sobre un defecto que no existía.** Los cinco eran lo mismo: un `node_modules`
instalado ANTES de que `main` estrenara `fake-indexeddb` (SCRUM-455).

El código estaba bien. Lo que faltaba era una dependencia — y **lo que falta no se ve mirando el
código**. Cinco fallos de tests no dicen «te falta un paquete»: dicen que cinco tests fallan, y de
ahí a «main está roja» hay un paso que dos sesiones dieron.

## Lo construido — `tests/_desfase-node-modules.mjs`

Cuatro funciones sobre **un árbol que se le pasa**, sin estado global ni censo de nada:

| función | qué contesta |
|---|---|
| `exigidasPorElLock(raiz)` | qué versión resuelve el lock para cada dependencia **directa** |
| `instalado(raiz, nombre)` | qué versión hay de verdad, leyendo el `package.json` del paquete |
| `diagnosticar(raiz)` | `{faltan, distintas, miradas}` — o `{ciego}` si no ha podido mirar |
| `avisoDeDesfase(raiz)` | el aviso en palabras, o `null` si el árbol está al día |

**No se comparan hashes de fichero, y eso es una decisión, no un detalle.**
`node_modules/.package-lock.json` y `package-lock.json` tienen formatos distintos: su hash SIEMPRE
difiere. Compararlos daría «desfasado» en el 100 % de los árboles y **parecería una medición**.

## El suelo

* sin `node_modules` → **ciego**, no «al día»;
* sin `package-lock.json` o sin `package.json` → **ciego**;
* un lock que no declara ni una dependencia directa → **ciego** («o está vacío o no se supo leer»);
* control positivo del lector: `typescript` tiene que aparecer, o lo de abajo no mide nada.

El aviso del ciego empieza por `NO SE PUEDE COMPROBAR`, que es una frase distinta de la del
desfase: **un árbol sin nada que comparar y uno correcto no pueden dar el mismo verde.**

## Los tests — `tests/scrum471-node-modules-al-dia.test.mjs` (5, en `npm test`)

* **SUELO** — lee el lock, con control positivo, y un árbol sin lock **se declara ciego**;
* **CONTROL NEGATIVO** — un árbol al día **no dice nada**. Si saltara siempre nacería en rojo y
  entrenaría a ignorarlo, que ya se rechazó en SCRUM-412 y SCRUM-446;
* **🔴 rojo por el mecanismo** — sobre un árbol de mentira con el lock real al que le falta
  `fake-indexeddb`, el aviso **la nombra**. Es el ticket entero;
* una **versión distinta** también cuenta, y el aviso dice cuál hay y cuál se pide;
* el aviso **no recomienda `rmdir /s`**, que es lo único de esta zona que hace daño irreversible y
  que ya arrasó el `node_modules` compartido dos veces (`docs/ERRORES_ASESOR.md`).

### Lo medido con un junction de juguete

Borrar `node_modules` cuando es un junction **retira el enlace y deja el destino intacto**. Así que
`npm ci` en un árbol enlazado **no arrasa el compartido: te saca de él**. Lo que sí lo arrasa es
`rmdir /s` sobre el junction, y el aviso lo advierte con esas palabras.

## El censo del PASO 0 — y de qué población habla

La cabecera del test declara, **fechado el 11-ago-2026 y sobre la máquina de aquella sesión**:

| | |
|---|---|
| dependencias directas que `main` exige | 27 |
| árboles | **200** |
| sin `node_modules` | 53 |
| con `node_modules` | 147 — **91 de ellos por junction** |
| al día / desfasados | **3 / 144** |
| 🔴 el que decide el tamaño | **el compartido de los junctions está DESFASADO** (le falta `fake-indexeddb`): los 91 enlazados arrastran el hueco de golpe |

**Ese recuento no es reproducible en `DESKTOP-A24926K`**, y no porque nadie se equivocara: aquí hay
cuatro árboles y **cero enlaces de ningún tipo**, así que ningún subconjunto de este disco puede
dar 91 junctions. Son dos poblaciones distintas. La reconciliación, con la prueba, está en
`docs/master/SCRUM-476.md`.

**Lo que el comprobador necesita no es ese censo.** Necesita **un árbol**: el suyo. El censo
describía el tamaño del problema el día que se escribió, no calibra nada — medido sobre el cuerpo
de las funciones en `tests/scrum476-reconciliar-censos.test.mjs`, no leído en el comentario.

## Huecos declarados

1. 🔸 **El comprobador no corre solo.** Vive en `tests/`, así que solo se ejercita cuando alguien
   lanza la suite — y el caso que motiva el ticket es precisamente el de una sesión que lanza la
   suite y no entiende los rojos. Hay una rama sin mergear, **`scrum-471-pretest-antes-de-la-suite`**
   (`a9a93fc5`, un commit, `package.json` + `scripts/_node-modules-al-dia.mjs`), que lo mueve a
   `pretest` para que el aviso caiga ANTES que los cinco rojos. **No está en `main` y este ticket no
   la toca.**
2. 🔸 **Solo mira dependencias DIRECTAS** (las 27 de `package.json`). Una transitiva desfasada no la
   ve. Es una decisión de coste, no un descuido: es donde caen los fallos que motivaron el ticket.
