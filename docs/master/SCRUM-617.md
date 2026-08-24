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
