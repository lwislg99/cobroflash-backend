# SCRUM-617 · No había un sitio donde se decidiera cómo arranca el navegador

**Fecha:** 24-ago-2026 · **Carril:** B · **Gate:** sin gate — los nueve corren en el job de CI

**Medido contra:** `origin/main` = `61d35a741e92c0e987d70bc7dba5a0a8302a5630` · 2026-08-24T13:31:31+01:00

⚠️ **Y `origin/main` YA SE HA MOVIDO desde esa medición**: a las 13:31 estaba en `010c05d3`, tres
commits por delante. Se escribe el sha sobre el que se midió DE VERDAD, no el último, porque poner
el último sería declarar una medición que no se ha hecho. Quien mezcle esto vuelve a mirar.
**Y se mide contra `origin/main`, nunca contra `main` a secas:** el `main` local de este árbol
estaba en `11636c07`, y comparar contra él daba «le faltan 0 commits» — un instrumento que compara
contra una referencia vieja no dice «estoy desfasado»: dice que todo está al día.

---

## El defecto: la mentira era al revés de las que llevamos un mes catalogando

Llevamos semanas cazando protecciones que dan **verdes falsos**. Ésta daba lo contrario, y es peor.
Ante un navegador que se encuentra pero **no arranca**, esto es lo que decían los nueve guards
—medido lanzándolos contra un binario que no es un navegador—:

```
✖ guard:contraste        NO ARRANCA   ← el único que acierta
✖ guard:caja-avisos      CIEGO        ← miente: sí encontró el navegador
✖ guard:cls-barra-anuncio CIEGO
✖ guard:primera-pantalla CIEGO
✖ guard:vias-de-cobro    rojo(1)      ← MIENTE PEOR
✖ guard:aviso-bizum      rojo(1)
✖ guard:a11y-comparativa rojo(1)
✖ guard:a11y-landing     rojo(1)
✖ guard:objetivo-tactil  rojo(1)
```

**Cinco de los nueve reportaban un fallo de arranque como un defecto real.** No dicen «no pude
medir»: dicen «he encontrado un defecto». Eso manda a alguien a buscar en el CSS un contraste que
está bien; y cuando no lo encuentre, la conclusión cómoda es «este guard falla solo» — que es cómo
se desactiva una protección buena.

---

## 🔴 EL HALLAZGO, QUE VALE MÁS QUE EL ARREGLO: SE PROPAGÓ POR COPIA

La pregunta que decide si esto se repite era **por qué ocho tenían el flag de aislamiento y uno no**.
No se contestó a ojo: se midió con `git log -S'--no-sandbox'` por fichero, quedándose con el commit
más antiguo de cada uno.

| guard | cuándo entró `--no-sandbox` | commit |
|---|---|---|
| **contraste** | **nunca** | — (nace en SCRUM-368, el más antiguo de los nueve) |
| caja-avisos | 11-ago-2026 | `ee43deb5` (SCRUM-469) |
| vias-de-cobro | 19-ago-2026 | `b7b0fb47` (SCRUM-519) |
| aviso-bizum | 19-ago-2026 | `8dd29134` (SCRUM-515) |
| cls-barra-anuncio | 20-ago-2026 | `e8809e88` (SCRUM-544) |
| primera-pantalla | 20-ago-2026 | `19ac1253` (SCRUM-331) |
| a11y-comparativa | 20-ago-2026 | `320ae38a` (SCRUM-541) |
| a11y-landing | 20-ago-2026 | `2f5b0a40` (SCRUM-543) |
| objetivo-tactil | 20-ago-2026 | `c794c3e9` (SCRUM-542) |

Ninguno de esos ocho commits «decidió» el aislamiento: cada uno **nació ya con el flag dentro**, en
su commit fundacional, heredado del guard anterior.

> **No había un sitio donde se decidiera cómo arranca el navegador. SE PROPAGÓ POR COPIA.**

Eso explica la inconsistencia entera sin culpar a nadie, y explica por qué el que se quedó fuera fue
**justo el primero**: `guard-contraste` es anterior a la cadena de copias, así que no tenía de quién
heredarlo. Y explica lo que habría pasado sin este ticket: el décimo guard también habría copiado
del noveno, y el noveno del octavo.

**La próxima vez que algo esté en ocho ficheros y no en el noveno, ésta es la forma de averiguar
cómo se llegó ahí:** el commit fundacional de cada copia, no una revisión del estado final.

---

## Lo que cambia

**① Los nueve arrancan por el mismo sitio.** `lanzarNavegador` en `scripts/_navegador.mjs` es ahora
el ÚNICO lugar donde se decide cómo arranca el navegador. Los ocho pasan por él;
`guard-contraste` **no se toca**: ya lo usaba desde SCRUM-522 y es el modelo.

**② El aislamiento sale de los ocho ficheros y vive condicionado a `CI`.** `--no-sandbox` estaba
puesto **global** —también en local—, que es justo lo que la regla fijada en SCRUM-522 no quiere: un
flag que relaja el aislamiento del navegador puesto por defecto es un cambio que nadie pidió y que
no se nota. Ahora sólo lo añade `argsDeAislamiento()` cuando `process.env.CI` está puesta.

**③ Salen dos copias del suelo.** `guard-a11y-comparativa`, `guard-a11y-landing` y
`guard-objetivo-tactil` llevaban su propio `if (!fs.existsSync(EDGE))` — una segunda comprobación de
lo mismo que el módulo común ya garantiza. Dos sitios comprobando lo mismo divergen; se quedan uno.

**④ `--disable-dev-shm-usage` NO se mueve.** Lo llevan `vias-de-cobro` y `aviso-bizum`, y es de
ESOS dos guards, no de la política de aislamiento. Moverlo al helper cambiaría cómo arrancan los
otros siete en local sin que nadie lo haya pedido. Queda anotado como el siguiente candidato si
algún día se quiere una política de arranque entera en un solo sitio.

---

## Los tres controles

**🔴 EL QUE DECIDE — el mismo experimento, antes y después.** Los nueve contra un binario que no es
un navegador:

| | antes | después |
|---|---|---|
| dicen `NO ARRANCA` | **1** de 9 | **9** de 9 |
| dicen `CIEGO` (mienten: sí lo encontraron) | 3 | 0 |
| dicen `rojo(1)` (mienten peor: «hay un defecto») | 5 | 0 |

**✅ EL POSITIVO, que es el caro y el que evita cambiar un defecto por otro.** Con Edge real, los
**nueve siguen verdes**, 51,4 s en serie, la puerta sale con **0**. Ninguno de los ocho portados se
cayó: siguen midiendo exactamente lo que medían.

**🔴 EL SEGUNDO, el que evita el falso positivo AL REVÉS.** Distinguir dos casos incluye no
confundirlos en la otra dirección: un defecto REAL tiene que seguir saliendo como `rojo(1)` y no
como `NO ARRANCA`. Se rompió de verdad algo que vigila uno de los cinco —los cuatro
`<button class="ibtn">` de la landing forzados a 12 px— con el árbol COMMITEADO antes de inyectar
(`0a2cca20`):

- `guard-objetivo-tactil` → **`rojo(1)`**, nombrando el defecto:
  `12.6px < 44 · [iscreen] BUTTON.ibtn.ibtn--wa «Enviar por WhatsApp» (caja CSS 12px)`.
  Dice «he encontrado un defecto», que es lo correcto.
- `guard-vias-de-cobro`, que NO vigila eso → **verde, exit 0**. Los que no son el roto no se
  denuncian.

**Reversión byte a byte:** `Buffer.compare(disco, testigo) === 0`. Los bytes de partida se guardaron
ANTES de tocar, y no por rutina: `npm run cr:tecnica public/index.html` confirma que ese fichero es
**CASO B — normalizado por `.gitattributes`**, o sea que el blob NO habría servido de referencia.

---

## Hallazgo de rebote, anotado y sin arreglar

Durante el control apareció un **tercer sabor de la misma confusión**, y conviene que quede escrito:
al encadenar dos pasadas de la puerta seguidas, `guard-vias-de-cobro` cayó en 0,3 s con
`EADDRINUSE` sobre el puerto 4403 —sockets en `TIME_WAIT` de la pasada anterior— y la puerta lo
pintó **`rojo(1)`**. O sea: «no pude levantar mi servidor» reportado como «he encontrado un
defecto», exactamente el defecto que este ticket cierra, pero un paso más arriba.

Se detectó porque el TIEMPO no cuadraba —0,3 s frente a los 6,4 s que tarda cuando mide— y no
porque nadie lo vigilara. No se arregla aquí: un guard que no consigue su puerto debería declararse
CIEGO, y eso es otro ticket.

---

## Recuento de la suite

**total 4019 · pass 3942 · fail 0 · skipped 77**

| saltos | motivo declarado |
|---|---|
| 65 | `sin QA_DB_TEST=1 · npm run test:staging:gated` |
| 9 | `sin LIBRO_PG_URL` (banco local / desechable) |
| 1 | `sin BOT_SUITE_TEST=1` |
| 1 | `sin A55_DB_TEST=1` |
| 1 | EPERM de Windows creando un enlace a fichero (el mismo mecanismo lo cubre un control positivo portable que sí corre) |

`npm run guards:entrada` en verde (21 tests, 4 guards).

⚠️ **Lo que esta entrada NO afirma:** que el job de CI pase. Ninguna sesión puede ver un job de
GitHub (SCRUM-618), así que lo de arriba está medido en local. Lo que sí queda probado es que el
veredicto de los nueve ya no depende de con qué se hayan escrito.

---

# SCRUM-617 · APÉNDICE (2ª vuelta) · El CI dijo NO ARRANCA, que es el ticket funcionando

**Fecha:** 24-ago-2026 · **Carril:** B · **Gate:** sin gate — pasada de MEDICIÓN, no de entrega

**Medido contra:** `origin/main` = `61d35a741e92c0e987d70bc7dba5a0a8302a5630` · 2026-08-24T14:05:26+01:00

⚠️ `origin/main` ya está en `b8ea7364` — se ha movido dos veces mientras se escribía esto. Va el
sha sobre el que se MIDIÓ, no el último.

## Lo primero: esto no es el ticket roto

En el runner, `guard-contraste` salió con **`NO ARRANCA`** y el mensaje «el navegador ESTÁ y no
levanta». Es la primera vez que esa frase se ve en un entorno real, y **antes de este ticket ese
mismo fallo habría salido como `rojo(1)`** — un guard que no midió nada, leído como un hallazgo, con
el PR entrando en verde. Lo que 617 cerró es CÓMO SE REPORTA. Lo que queda abierto —y estaba tapado
hasta hoy— es POR QUÉ ESE ARRANQUE NO LEVANTA EN CI.

## Las tres hipótesis, y qué queda de cada una SIN tocar el CI

La hipótesis del fundador (**A · arranque en frío**) venía marcada como hipótesis, y no se hereda
como dato. Se contrasta con algo que ya estaba medido: **la misma serie, mismo orden, corrida en
local esta mañana.**

| puesto | guard | local | CI | delta |
|---|---|---|---|---|
| 1 | contraste | 7,5 s | **30,4 s** | **+22,9** ← murió en el tope: 30,4 es CENSURADO, no el coste real |
| 2 | caja-avisos | 2,9 s | **22,7 s** | **+19,8** |
| 3 | cls-barra-anuncio | 16,3 s | 16,3 s | 0,0 |
| 4 | primera-pantalla | 6,1 s | 5,7 s | −0,4 |
| 5 | vias-de-cobro | 6,4 s | 6,2 s | −0,2 |
| 6 | aviso-bizum | 4,8 s | 4,5 s | −0,3 |
| 7 | a11y-comparativa | 2,4 s | 2,2 s | −0,2 |
| 8 | a11y-landing | 2,1 s | 1,6 s | −0,5 |
| 9 | objetivo-tactil | 2,9 s | 3,9 s | +1,0 |

**No es una curva descendente: es un ESCALÓN de dos puestos.** Del 3 al 9 los dos entornos coinciden
dentro de **1,0 s**; sólo el 1º y el 2º pagan, y pagan **+22,9 y +19,8**. Eso cambia la forma del
problema: no hay un gradiente que se aplana, hay un coste de una vez que se termina de pagar en dos.

Y una segunda medición local, nueva, con el instrumento de esta pasada — **el arranque separado del
total**: en local **los nueve arrancan en 0,4–0,5 s**, `contraste` incluido (0,5 s).

### Veredicto por hipótesis

- **A · arranque en frío del runner — EN PIE, y es la única.** Compatible con todo lo medido: el
  sobrecoste existe sólo en CI, sólo en los dos primeros puestos, y desaparece del tercero en
  adelante. **Pero NO está confirmada**, y no se puede confirmar desde aquí: los 30,4 s del puesto 1
  son un dato **censurado** —el guard murió en el tope—, así que el coste real de ese arranque es
  desconocido y sólo se sabe que es ≥ 30,4 s.
- **B · `guard-contraste` hace algo más pesado al arrancar — MUY DEBILITADA.** Es cierto que es el
  único con `--disable-gpu`, `--hide-scrollbars` y `headless: true` (los demás van con `'new'` o sin
  nada). Pero **eso no cuesta nada medible**: su arranque local es 0,5 s contra 0,4 s de los otros
  ocho, y su total local (7,5 s) es menos de la mitad del guard más caro (`cls-barra-anuncio`,
  16,3 s), que en CI cuesta exactamente lo mismo que en local. No queda descartada del todo —el
  coste podría ser específico de Linux— pero la evidencia está en contra.
- **C · el más pesado cae en el primer puesto por casualidad — MUERTA.** El más pesado de la serie
  NO es `contraste`: es `cls-barra-anuncio`, que ocupa el puesto 3 y **no paga sobrecoste ninguno**
  en CI. Si el puesto no importara, `contraste` (7,5 s en local) no debería saltar a ≥ 30,4 s.

## Lo que se ha construido, y dónde

**En `scripts/_navegador.mjs`, el sitio único.** Es el hallazgo del propio ticket: si el tope o el
precalentamiento se ponen en un guard, se reabre el agujero que se cerró esta mañana.

- **`TOPE_ARRANQUE_POR_DEFECTO = 30_000` — el de siempre, SIN TOCAR.** Los 30 s no los pusimos
  nosotros: es el defecto de puppeteer. Ponerlo aquí no lo sube; lo hace visible y ajustable desde
  un solo sitio. Lo sostiene un test: si alguien cambia ese número, cae.
- **`topeDeArranque()`** lo sube por entorno (`NAVEGADOR_TIMEOUT_MS`) **sólo para medir**, y cae al
  valor de siempre ante cualquier basura (vacío, texto, `0`, negativo) — un tope de 0 sería
  «arranque imposible» y se leería como otra cosa.
- **El ARRANQUE se mide y se publica aparte del total**, para los NUEVE. Hacía falta: el total
  mezcla arrancar y comprobar, y con un solo número no se sabe cuál de las dos se disparó. La puerta
  lo lee de una marca y lo enseña en su tabla — si el guard lo imprimiera y ya, sólo se vería el del
  que falla, porque la puerta únicamente vuelca la salida de los no-verdes.

**NO se ha hecho:** subir el tope por defecto, reintentar, ni bajar `guard-contraste` de la serie.

## La pasada de medición, y su fecha de caducidad

`.github/workflows/ci.yml` pasa `NAVEGADOR_TIMEOUT_MS=120000` al job **sólo para esta pasada**, con
el motivo escrito al lado y marcado para retirarse. Lo que conteste el log:

| lo que se vea | qué significa |
|---|---|
| `contraste` arranca en ~35-45 s y el resto en ~0,5 s | **A confirmada**: arranque en frío del runner |
| `contraste` arranca en ~0,5 s | el tope no era la causa; hay que mirar otra cosa |
| vuelve a agotar el tope, ahora a 120 s | **no es tiempo**: ese arranque concreto no levanta |

🛑 **Cuando llegue el log, esa línea se va.** Si se queda, habremos comprado el verde con un número
más grande — que es lo que este ticket no quiere.

## El control positivo, con el criterio de esta mañana

Se ha tocado el camino de arranque, así que se vuelve a pasar entero. Sigue siendo cierto:

- **binario que no levanta** → los **9 de 9** dicen `NO ARRANCA`, con **arranque 0,0 s**;
- **pantalla rota de verdad** (los cuatro `.ibtn` de la landing a 12 px) → `guard-objetivo-tactil`
  dice **`rojo(1)`** nombrando el defecto (`12.6px < 44 · BUTTON.ibtn--wa`), con **arranque 0,4 s**.

Y la columna nueva los separa de un vistazo: **0,0 s = no levantó · 0,4 s = levantó y encontró
algo.** Reversión de la avería con `Buffer.compare(disco, testigo) === 0`.

## Recuento de la suite

**total 4021 · pass 3944 · fail 0 · skipped 77** — mismos motivos declarados que en la entrada de
arriba (65 `QA_DB_TEST`, 9 `LIBRO_PG_URL`, 1 `BOT_SUITE_TEST`, 1 `A55_DB_TEST`, 1 EPERM de Windows).
`npm run guards:entrada` en verde (21 tests, 4 guards).
