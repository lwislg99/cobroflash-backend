# SCRUM-405 · una sola forma de descargar, y un guard para que no nazca la quinta

**Fecha de esta constancia:** 9-ago-2026 · **Escrita por:** sesión 3 · **Código escrito aquí:** ninguno
**Medido contra:** `origin/main` = `8037a7a30049a442eb857733832c9eca0bf99ec2` · 2026-08-09T19:51:07+02:00

> ⚠️ **ENTRADA DE CONSTANCIA, NO DE TRABAJO.** El mecanismo lo construyó otra persona y esta
> entrada solo lo DEJA ESCRITO, citando su commit. No se reconstruye ni se interpreta.

**Commit:** `7b322a9f8edecf3b3f44a91d7ee4f0369ba92a89` · 2026-08-07 20:48 +0100 · Javier Pereira Fernández
*«fix(SCRUM-405): una sola forma de descargar, y un guard para que no nazca la quinta»*

## Mecanismo, en `main`

* `public/dashboard/js/api.js` (+91) — la forma ÚNICA de descargar.
* `public/dashboard/js/exportView.js` (+?/−98) y `reportsView.js` — pasan a usarla.

## Guard

`tests/scrum405-descarga-verificada.test.mjs` (+233 líneas, nacido en ese commit). El propio
mensaje declara su propósito: **que no nazca la quinta forma de descargar**.

## Estado

**HECHO.** ⚠️ Hay **dos ramas gemelas** vivas: `origin/scrum-405-descarga-verificada` y
`origin/scrum-405-descarga-verificada-rebasada`. La mergeada fue la `-rebasada` (PR #546); la otra
conviene cerrarla para que nadie la retome creyendo que está pendiente.

---

# TRAMO 2 — la microcopy aprobada, y las dos causas que pintaban el mismo texto

**Medido contra:** `origin/main` = `2bab2e582f6d54419394e9c0205685308c1f9b1b` · 2026-08-10T18:21:46+01:00

El mensaje llevaba el marcador `[PENDIENTE microcopy oficial · propuesta: …]` **corchetes**
**incluidos, enseñado tal cual al profesional**, y en un mensaje de error, que es donde peor
sienta. Lo reportaron dos sesiones por separado el mismo día.

## Lo que el PASO 0 destapó, y no era el marcador

`descargarBinario` falla con `esHtml || !cuadra` — **dos causas distintas**— y las dos pintaban el
MISMO texto: el del portal cautivo. Cuando la causa era la segunda, ese mensaje **mentía**: culpaba
a la wifi de la obra y mandaba al profesional a gastar datos móviles para arreglar algo que estaba
en el servidor. El error ya llevaba `tipoRecibido`, pero **nadie lo miraba**.

Y un quinto sitio que **no es una descarga**: `exportView.js:185` está en `refrescarInfo()`, que
pide el recuento con `apiRequest` — y `ERROR_NO_ES_FICHERO` sólo lo asigna `descargarBinario`. La
rama es hoy inalcanzable. **Se conserva** con el motivo escrito: quitar una rama defensiva porque
hoy nadie la alcanza es como se pierden los mensajes el día que alguien la vuelve a alcanzar.

## Los dos textos — APROBADOS (asesor, 10-ago-2026, regla 30)

> **CASO A · portal cautivo** — «Esta red ha devuelto su pantalla de acceso en vez de tu archivo.
> Prueba con datos móviles u otra red.»
>
> **CASO B · tipo inesperado** — «Lo que ha llegado no es tu archivo. Vuelve a intentarlo; si sigue
> pasando no es tu conexión, es cosa nuestra.»

⚠️ **Son la SEGUNDA redacción, y la primera se cayó por medirla montada.** La aprobada al principio
tenía 157 y 163 caracteres: unos 9,5 s de lectura en un toast que se va a los 5 s. El profesional
lo veía desaparecer **justo antes de la parte que dice qué hacer**. El asesor las acortó a 101 y
109 — por debajo del toast de error más largo del producto (137). Lo que se cayó es la explicación
de POR QUÉ, que en un toast no la lee nadie.

## Las dos capas del guard

* **Primera** — fija el LITERAL contra el fuente. Si el texto cambia, cae.
* **Segunda** — la que sobrevive a que alguien reescriba la primera «de buena fe»: **el CASO B no
  puede hablar de la red del profesional**, se redacte como se redacte. Con hermano positivo (el
  detector reconoce ese vocabulario en el CASO A, que sí habla de la red con razón) para que su
  silencio sobre el B signifique algo. Y una tercera afirmación: los dos textos **caben** en el
  toast.

## Verificado en rojo — con la inyección comprobada EN DISCO

| inyección | lo que dijo |
|---|---|
| cruzar los dos textos | *«SE PINTÓ EL MENSAJE EQUIVOCADO… se pintó / tocaba»*, y en el CASO B añade que el pintado **es el del portal cautivo, echándole la culpa a la wifi** |
| devolver el marcador | 402: *«api.js: 0 → 1»* · 405: *«vuelve a haber un marcador PINTABLE en api.js»* |
| renombrar el literal | *«CIEGO: no se encuentra el literal… comparar contra nada da un verde que no significa nada»* |
| **reescribir el CASO B** metiéndole «comprueba tu wifi» | *«EL CASO B HA VUELTO A CULPAR A LA RED… no puede volver por una reescritura»* |

## El censo de SCRUM-402

`api.js` **sale** del censo (−1). La entrada se BORRA en vez de bajar a 0, siguiendo lo que dejó
escrito SCRUM-424 allí mismo. **R4b sigue verde con `api.js` fuera**, que era la pregunta abierta
desde ese ticket: `censoActual()` enumera el directorio, así que salir del censo no saca de la
vigilancia.

## 🔴 Lo que NO se ha hecho, y por qué

**El toast de error sigue en 5 s.** El asesor lo aprobó a 10 s con una condición: comprobar antes
si el toast se puede cerrar a mano. **Medido: NO se puede** — `showToast` no registra ningún
listener, no pinta botón de cierre y no tiene `cursor:pointer`. Diez segundos de pastilla fija
encima del contenido, sin forma de quitarla, es otra decisión y queda para el fundador.

Con los textos cortos el desajuste baja de ~9,5 s a ~6,2 s de lectura sobre 5 s de toast: **sigue
existiendo, pero ya no se pierde la parte accionable**.
