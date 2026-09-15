# SCRUM-822 · Un punto en la ruta del árbol, y el producto deja de servir sus páginas

**Fecha:** 7-sep-2026 · **Carril:** instrumentos · CI — **ARREGLO + GUARD** · **Gate:** sin gate (`npm test`)
**Medido contra:** `origin/main` = `d271d29aff85ed155d23397b7e6a1fca64a86bb0` · 2026-09-07T18:56:51+02:00
**Línea base (ANTES de tocar nada):** 4 tandas completas seguidas, idénticas —
`5909 tests · 5807 pass · 0 fail · 102 skipped` · **salida 0**
**Tanda de cierre (`npm test`, código de salida leído del propio comando):**
`5913 tests · 5811 pass · 0 fail · 102 skipped` · **salida 0** · 408 s

---

## 0 · La premisa del encargo, corregida por la medición

El encargo daba por sentadas dos cosas. La primera es cierta y la segunda no, y la diferencia
cambia dónde hay que mirar.

**✅ CIERTO — los dos guards fallaban, y por UNA sola causa.** `SCRUM-329 · cada enlace interno
responde 200 y con contenido` y `SCRUM-334 · ningun CTA lleva a un 404` caen los dos, y por lo
mismo. También era cierto que producción estaba sana.

**🔴 NO CIERTO — «el check obligatorio está ROJO en main».** No lo está por esta causa, y no
puede estarlo: la avería depende de DÓNDE vive el checkout, y el de CI no la puede sufrir
(§2). En este árbol, sobre `origin/main` PRISTINO, la tanda sale **verde 4 veces de 4**. Lo
que estaba rojo era el árbol de quien lo midió, no `main`.

**Y las dos causas que el encargo proponía tampoco son.** No es que «el banco no monte lo que
las sirve» (las monta, en las mismas líneas), ni que «la ruta sólo exista en producción» (es el
mismo código). Es una tercera, y no se ve leyendo la línea que falla.

---

## 1 · El mecanismo

`src/app.ts` servía tres páginas así:

```ts
app.get('/privacidad', (_req, res) => res.sendFile(path.join(publicDir, 'privacidad.html')));
```

`res.sendFile(rutaAbsoluta)` **sin `root`** entra en la rama `root === null` de `send`
(`node_modules/send/index.js:443-470`), que hace:

```js
parts = normalize(path).split(sep)   // ← la ruta ABSOLUTA entera, path de instalación incluido
if (containsDotFile(parts)) { ... case 'ignore': default: this.error(404) }
```

`containsDotFile` acusa a cualquier tramo que empiece por `.` y mida más de un carácter. Así que
**si el checkout vive bajo un directorio con punto** — `.claude/worktrees/…`, un `.tmp`, un árbol
desechable — esas rutas devuelven **404 con el fichero presente y legible**.

`express.static` no lo sufre porque SÍ pasa `root`: con `root`, `send` sólo inspecciona el tramo
RELATIVO. De ahí la firma que estaba a la vista y nadie miró: **la misma página respondía 200
como `/privacidad.html` y 404 como `/privacidad`.**

---

## 2 · La reproducción, con el `dist/` real y sin tocar una línea

Copia del `dist/` y `public/` de `origin/main` bajo un directorio llamado `.arbol-desechable`:

| ruta | quién la sirve | antes | después |
|---|---|---|---|
| `/index.html` | `express.static` | 200 | 200 |
| `/` | `express.static` | 200 | 200 |
| `/privacidad` | `res.sendFile` | **404** | 200 |
| `/terminos` | `res.sendFile` | **404** | 200 |
| `/precios` | `res.sendFile` | **404** | 200 |
| `/privacidad.html` | `express.static` | 200 | 200 |

La única variable entre un árbol verde y este es el punto del nombre de la carpeta.

**`/precios` también estaba roto** y ningún guard lo veía: no lo enlaza ninguna de las seis
páginas que el censo recorre. El defecto era mayor que su síntoma.

**POR QUÉ CI NO PUEDE ESTAR ROJO POR ESTO.** `actions/checkout@v4` sin `path:` clona en
`$GITHUB_WORKSPACE` = `/home/runner/work/cobroflash-backend/cobroflash-backend`. Ningún tramo
empieza por punto. Producción, igual: Railway despliega en `/app`, y responde 200 en las tres
(comprobado en yaqu.app, sólo lectura, con `/privacidad` devolviendo exactamente lo mismo que
`/privacidad.html`).

---

## 3 · El arreglo

**Seis** `res.sendFile` en `src/`, **los seis sin `root`** — o sea, la misma avería en seis
sitios, no en dos. Los seis pasan a `res.sendFile(nombre, { root: carpeta })`:

| fichero | ruta HTTP | lo veía algún guard |
|---|---|---|
| `src/app.ts:287` | `/privacidad` | sí |
| `src/app.ts:288` | `/terminos` | sí |
| `src/app.ts:291` | `/precios` | **no** |
| `src/modules/jobs/app/routes/albaranes.routes.ts` | `/admin/albaranes/:id/pdf` | **no** |
| `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` | `/pay/quote/:token/pdf` | **no** |
| `src/modules/system/app/routes/quotesAdmin.routes.ts` | `/admin/quotes/:id/pdf` | **no** |

Se arreglan los seis y no sólo los dos que ponían la tanda roja: es UNA causa, y dejar cuatro
instancias vivas obligaría a que el guard nuevo las exceptuara — una lista de excepciones sin
más motivo que «el ticket no las miraba».

**No hay ninguno en el camino de emisión** (censo AST de `sendFile` sobre `src/` entero: cero en
`modules/invoicing/`), así que no aplica la STOP de AA1.4 / regla 29. Comportamiento idéntico
donde ya funcionaba; `root` además confina lo servido.

---

## 4 · Lo que NO se ha hecho

**No se ha relajado ni un guard.** Ni un umbral, ni una exclusión, ni una excepción declarada.
Los dos que estaban rojos siguen mirando exactamente lo mismo, y se comprueba en §5 que siguen
sabiendo ponerse rojos.

---

## 5 · Los controles

**① CONTROL POSITIVO (el que exigía el encargo).** Roto a propósito `href="/privacidad"` →
`href="/privacidad-rota"` en `public/index.html`, **los dos guards vuelven a caer y lo nombran**:

```
✖ SCRUM-329 · cada enlace interno responde 200 y con contenido
    /privacidad-rota → 404 (enlazado desde public/index.html)
✖ SCRUM-334 · ningun CTA lleva a un 404 ni a una pagina vacia
```

Árbol restaurado y verificado por contenido (`git status` limpio).

**② EL SUELO NUEVO · «no sé medir» ≠ «tu landing está rota».** Los dos guards piden ahora una
referencia que sirve el estático (`/index.html`) ANTES de acusar a ningún enlace. Provocado
—apuntando la sonda a una ruta que no existe— caen así:

```
🔴 CIEGO: el banco no sirve ni la página que siempre sirve el estático (`/index.html` → 404).
  NO se acusa a ningún enlace: con el servidor mudo, un «404» no distingue una landing
  rota de un arranque que no llegó a levantarse, y mandaría a buscar donde no está.
```

Es exactamente lo que faltó aquí: el guard acusó a la landing mientras el problema estaba en el
arranque, y mandó a esta sesión a buscar un enlace roto que no existía.

**③ EL GUARD NUEVO cae con la mutación que declara.** Revertida UNA de las seis llamadas a la
forma vieja, el censo cae y nombra la línea:

```
✖ SCRUM-822 · ningún `res.sendFile` del producto sirve sin `root`
  + "src/app.ts:288 · res.sendFile(path.join(publicDir, 'terminos.html'))"
```

**④ EL MECANISMO, provocado dentro de la tanda.** `tests/scrum822-el-arbol-con-punto.test.mjs`
monta el mismo banco en dos carpetas que sólo se diferencian en un punto y exige las cuatro
lecturas: sin punto las tres maneras dan 200; con punto, `sendFile` sin `root` da 404 y con
`root` da 200. Si el día de mañana `send` cambia su regla, el guard lo dice en vez de quedarse
como una norma de estilo huérfana.

---

## 6 · El `.catch` que faltaba (SCRUM-637 lo dejó anotado y nadie lo recogió)

El commit `a37427f0` de `main` dejó escrito: *«su línea 165 no lleva el `.catch` que sí lleva la
88»*. Sin él, una petición que no llega tumbaba el **fichero entero** con un `fetch failed` sin
nombrar ruta — un rojo de la tanda de todo el mundo que no dice nada. Ahora una petición que no
se hizo se declara CIEGA en vez de sostener un «no instala cookies» que nadie midió.

---

## 7 · Lo que queda declarado, y no arreglado

- **Los 9 subtests gateados por `LIBRO_PG_URL`** los corre CI y aquí SKIPean con su motivo
  declarado. No se han ejercitado en esta sesión: hace falta un Postgres desechable. Si CI
  sigue rojo tras esto, **ahí es donde hay que mirar** — no en SCRUM-329/334.
- **`SCRUM-775 · POSITIVO: con el censo SIN encoger el CLI sigue saliendo con 0`** cayó UNA vez
  con `status: null` (proceso matado) tras 22,8 min, en una tanda que entera tardó 26,8 min
  frente a los 3,9 min de la línea base. Pasa 9/9 en aislado (16,8 s ese caso) y pasó 4/4 antes
  de tocar nada. **Es contención, no lógica**, y la sesión se declara sospechosa de haberla
  causado: había dejado un *junction* a `node_modules` bajo `%TEMP%`. **Retirado, y confirmado:**
  sin él la tanda de cierre baja de 26,8 min a 6,8 min y ese caso pasa en 12 s. Era mío, no del
  test — y por eso se dice aquí en vez de llamarlo flake ajeno.

---

## 8 · Las otras dos preguntas del encargo

**«¿Desde cuándo están en rojo?»** La pregunta no tiene respuesta en el calendario, y eso ES la
respuesta. La ruta `/privacidad` existe SIN TOCAR desde `b98e0238` (3-jun-2026) y los guards
desde el 10 y el 20-ago-2026. Ninguno cambió. Lo que decide el color no es CUÁNDO se corre sino
DÓNDE: en un árbol con un punto en la ruta llevan rojos desde el día que se escribieron; en uno
sin punto, verdes desde el mismo día. Por eso no hay «rojos legítimos ignorados mientras tanto»
que contar: la tanda de `main` nunca estuvo roja en un árbol normal.

**«¿Hay MÁS guards en rojo permanente?»** Sobre `origin/main` PRISTINO: **cero**, medido cuatro
veces. El encargo ponía suelo a esa respuesta —«si el barrido devuelve cero, está roto»— y el
suelo se satisface por el otro lado: **este barrido NO está ciego, y se demostró en vivo.** En
cuanto la rama introdujo un problema real (un fichero con CRLF en disco), la MISMA tanda lo
cazó y lo nombró — `SCRUM-533`, con fichero y recuento. Un barrido que caza el primer rojo de
verdad que se le pone delante no es un barrido ciego: es que no había nada más que cazar.

Los 102 SKIP no son rojos escondidos: **todos declaran su motivo** (66 `QA_DB_TEST`, 9
`LIBRO_PG_URL`, el resto con su razón escrita). Un hueco declarado se ve.

---

# SCRUM-822 · FASE 2 · el guard que fallaba COMO SI FUERA UN 404 cuando no podía conectar

**Medido contra:** `origin/main` = `f0ec26e86a04a21e9e60b748b4c7c5c2c83bace9` · 2026-09-08T09:24:13+02:00
**Carril:** verificación (S5) · `HEAD..origin/main` = 0 tras mezclar sus 134 commits.

La fase 1 arregló el 404 de verdad (un punto en la ruta del árbol). Queda la otra mitad, que es
la que convirtió aquel incidente en un ticket Highest contra un sistema sano.

## El hecho, y esta vez reproducido a voluntad

`scrum329-legal-pagina-publica` pedía con `fetch` sobre su propio `app.listen(0)`. **Medido antes
de tocar nada, con 24 instancias en paralelo y 12 procesos quemando CPU: 24 de 24 abortaban, con
72 `fetch failed`.** A una sola instancia no se reproduce NUNCA —0 de 20— y por eso vivió meses.

> 🔒 Un defecto que sólo aparece bajo concurrencia no es «raro»: es **invisible en la única
> condición en la que la gente lo prueba**, y visible justo en la que decide el merge.

## 🔴 Y lo grave no era el aborto: era CÓMO lo contaba

En el bucle de enlaces, un `status: 0` —no pude conectar— caía en el **mismo cubo** que un 404, y
el assert lo publicaba como *«enlaces públicos rotos»*. O sea: **el instrumento, cuando no podía
mirar, acusaba al producto**. Es la misma familia que «un cero no es *está limpio*, es *no he
mirado*», y el precio está medido: una tanda entera perdida y un Highest abierto contra una
landing sana.

El suelo `bancoMudo()` no bastaba: mira UNA ruta al principio, así que si el servidor enmudecía a
mitad del bucle, **todos** los enlaces siguientes salían acusados.

## Lo que se hace

1. **Fuera `fetch`**, con el patrón que SCRUM-560 ya dejó probado en `scrum334` (`efe1004f`):
   `http.request` con `agent: false` — sin pool, cada petición abre y cierra su conexión.
2. **Dos cubos separados**, petición a petición: `sin-respuesta` (CIEGO, no se acusa a nadie) y
   `roto`/`vacio` (defecto real). La decisión vive en `clasificar()`, una función pura y
   exportada, para que se pueda probar sin levantar nada.
3. `scrum329` **sale de `CON_EL_PATRON_YA`** en este mismo commit, como su guard exige: *«una
   lista que sobrevive a su causa deja de ser una fecha y pasa a ser un permiso»*. Era el
   «segundo que aborta» que aquella lista se dejó anotado como condición para reabrirse.

## Verificación

| | antes | después |
| --- | --- | --- |
| 24 instancias en paralelo + 12 quemando CPU | **24 de 24 abortan** (72 `fetch failed`) | **0 de 24** |
| una sola instancia | 0 de 20 | 0 de 20 |

* ✅ **CONTROL POSITIVO:** roto `href="/privacidad"` → `href="/privacidad-roto"` en `index.html`,
  **los dos guards siguen cayendo** y nombrando `/privacidad-roto → 404 (enlazado desde
  public/index.html)`. Dice **404**, no «sin respuesta»: la distinción aguanta en los dos sentidos.
* 🔴 **CONTROL NEGATIVO, el corazón:** contra un puerto **muerto de verdad** —se abre uno, se lee
  su número y se cierra— el estado es `0`, `clasificar` lo manda a `sin-respuesta`, y su mensaje
  **no contiene la cadena «404»**. Y con su mitad positiva pegada: un 404 real sigue siendo
  `roto`, una legal casi vacía sigue siendo `vacio`, y una legal con contenido sigue siendo `ok`.
  Sin esa mitad, un clasificador que dijera «sin-respuesta» a todo habría pasado — y sería un
  guard apagado.
* 🔴 **El guard hermano probado EN ROJO:** devuelto un `fetch` DENTRO DE UN BUCLE a `scrum329`,
  SCRUM-560 cae nombrando fichero y motivo; retirado, vuelve a verde. Y al primer intento **NO**
  cayó porque puse un `fetch` suelto: el umbral son 3 sueltos o 1 en bucle. El caso estaba mal
  elegido, no sobraba el guard.

## Nota sobre el número, que no decido yo

`SCRUM-822` nombra ya tres cosas: el título en Jira (*«dan 404 en local»*, premisa que resultó
falsa), la fase 1 de este mismo fichero (*«un punto en la ruta del árbol»*) y esta fase 2 (*la
intermitencia*). Las tres pertenecen al mismo incidente, así que conviven aquí con su fecha; pero
es la forma exacta que `scripts/verificacion-s5/enlace-ticket-rama.mjs` marca como AMBIGUA, y lo
hará en cuanto se refresque la foto de asuntos. Jira lo lleva el asesor.
