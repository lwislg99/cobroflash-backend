# SCRUM-1249 · La descarga de facturas recibidas: existía en el servidor y ninguna pantalla la ofrecía

**Fecha:** 28-sep-2026 · **Carril:** J1 (`area-j1`) · **Sesión:** J1, relevo de `jv-j1`
**Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `f20e25d4ae8644a6440e166914355d049bce2017` · 2026-09-28T20:35:00Z

Sale del censo de SCRUM-1195, veredicto (a) DEFECTO.

## PASO 0 · el defecto seguía vivo (re-medido, no heredado)

Medido sobre `e5acad15`. `main` se movió después a `75a56429` y a `f20e25d4`, y ninguno de los dos
cambios toca estos ficheros (`git diff --name-only`).

| sonda | población | resultado |
|---|---|---|
| censo AST de SCRUM-1185 (`censar(cargarArbol('.'))`) | 304 ficheros de `src/`, 98 JS de `public/`, 239 rutas, 713 consumidores | `ruta · GET /admin/libros/recibidas.csv` sale **sin consumir** |
| control por mutación, con la misma sonda | el mismo árbol en memoria, sin la llamada de `exportView.js` | `expedidas.csv` pasa a salir **sin consumir** (la sonda ve el consumo cuando existe) |
| barrido de URLs montadas a trozos (escáner de TypeScript, solo literales, sin comentarios) | 98 ficheros JS, 10.196 literales, más los `.html` | ningún literal monta `libros/…recibidas.csv` |

No estaba hecho bajo otro número: la sonda busca la ruta, no el ticket.

## Rojo primero

`tests/scrum1249-descarga-recibidas-alcanzable.test.mjs`, commit `b715e0a7`. Monta las dos pantallas
candidatas en el banco del panel, pulsa **cada** control con oyente de `click` y anota cada URL que
sale por la red.

- «Facturas recibidas»: pulsa 1 control y pide dos veces `recibidas.json`, nunca `recibidas.csv` → **ROJO**.
- «Exportar», el control positivo: pulsa 3 controles y pide `expedidas.csv` → verde.

⚠️ **Error mío, confesado.** En la primera pasada el control positivo salió **CIEGO**: con 3 pulsados
no apareció `expedidas.csv`, aunque existe. Causa: el `fetch` de `_banco-vistas.mjs` solo llama a
`datos(url)` cuando alguien lee `.json()`, y una descarga (`descargarBinario`) nunca lo lee. El
pulsador no veía **ninguna** descarga. Si no hubiera habido control positivo, el rojo de recibidas
habría parecido una medición, y era un instrumento que no podía ver lo que buscaba. Arreglo:
envolver `banco.ctx.fetch` para anotar toda URL. Con eso el control sale verde y el rojo se mantiene.

## Dónde se ofrece, y por qué: solo en «Facturas recibidas»

- Esa pantalla ya tiene el selector de periodo de este libro.
- Su tabla (`recibidas.json`, SCRUM-1040) y el CSV (`recibidas.csv`, SCRUM-426) salen del **mismo
  motor**, `leerLibroRecibidasDelTrimestre`, con el mismo contrato de periodo.
- Pulsar «Descargar CSV» **recarga la tabla con el mismo periodo** que el fichero. Así el fichero y la
  pantalla no pueden enseñar trimestres distintos, aunque el profesional cambie el año sin pulsar
  «Consultar». Esto es lo que hace verdadero el texto `descargaVacia` (ver la dependencia, abajo).
- «Exportar» (`exportView.js`) es de **S2**, del equipo de Luis (`dos-equipos.md` §3.2: «todo lo
  demás de `public/`»), y se tocó el 22 y el 26 de septiembre. Ponerla también allí sería pisar un
  carril ajeno por una comodidad. Si se quiere en las dos pantallas, es un ticket de S2.

Aprobado por el orquestador en el comentario 17432.

## Lo que se cambió

| fichero | qué |
|---|---|
| `public/dashboard/js/facturasRecibidasView.js` | botón `#facturas-recibidas-descargar` y 5 ranuras de copy firmadas; cabecera corregida |
| `docs/master/SCRUM-1040.md` | corrección **anotada encima**, sin borrar la frase falsa (AA1.7) |
| `scripts/_sin-consumir-declarados.json` | `ruta · GET /admin/libros/recibidas.csv` pasa de `declaradas` a `retiradas` con su motivo. Es lo que exige el trinquete ② de SCRUM-1185 cuando algo se conecta |
| `tests/scrum1040-pantalla-facturas-recibidas.test.mjs` | constante **aparte**, `APROBADAS_CON_FIRMA` (ver abajo) |
| `tests/scrum1249-descarga-recibidas-alcanzable.test.mjs` | el rojo, el control positivo y el guard de la dependencia |
| `docs/microcopy/2026-09-28-SCRUM-1249-descarga-recibidas.md` | el registro de la firma |

**No tocado:** la ruta, el generador del CSV, `pay`/`unpay` ni el camino de emisión.
`docs/master/SCRUM-323.md:112` dice «`recibidas.csv` no se puede pedir». Era verdad cuando se midió
y deja de serlo con este ticket. Es un registro histórico de otra medición, así que no lo reescribo.

## Las dos afirmaciones falsas

1. **`facturasRecibidasView.js:3-4`** decía que, hasta esa pantalla, el libro «solo salía como
   descarga CSV». Falso: ninguna pantalla lo pedía. Se reescribió con la nota de corrección.
2. **`docs/master/SCRUM-1040.md:12-14`** decía que el autónomo no podía mirar el libro «sin bajarse el
   fichero», y tampoco podía bajárselo. Se anotó la corrección debajo del párrafo, dejándolo visible.

## Texto y firma

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1249 comentario 17432.

Los 5 literales se firmaron sin cambios: `Descargar CSV`, `Preparando la descarga…`, `No hay facturas
recibidas en este periodo.`, `Descarga lista.` y `No hemos podido preparar la descarga. Inténtalo otra vez.`

**La condición de la firma.** El guard de copy de SCRUM-1040 eximía ranuras con una lista pelada de
nombres (`DECLARADAS_FUERA`), donde nadie distingue una ranura aprobada de una que una sesión se
eximió a sí misma. Las cinco de este ticket **no entran en esa lista**. Van en una constante aparte,
`APROBADAS_CON_FIRMA`, y cada entrada lleva la ranura, el **literal firmado** y la firma (ticket,
comentario y fecha). La exención solo vale si el literal de la pantalla es **exactamente** el
firmado. Si alguien lo cambia, el guard vuelve a pedir marcador o firma nueva. Y una firma que ya no
ampara nada sale en rojo como «huérfana», para que no quede como un permiso esperando.

No es ensanchar el guard (regla 41). El propio guard dice «salvo lo reutilizado o ya aprobado», y
esto es lo aprobado, con su prueba.

## ⚠️ Dependencia declarada: `descargaVacia`

«No hay facturas recibidas en este periodo.» afirma un hecho sobre los datos del profesional porque
el fichero llegó con `X-Yaqu-Filas: 0`. Es cierto **solo mientras** se cumplan dos cosas:

1. el fichero y la tabla salgan del mismo motor;
2. la descarga recargue la tabla con el mismo periodo.

Si alguien las desacopla, el texto miente: tres facturas en pantalla y un aviso diciendo que no hay
ninguna. **Entonces vuelve a firma.** La segunda condición la vigila un test (pulsar solo «Descargar
CSV» tiene que pedir `recibidas.csv` y `recibidas.json` del mismo periodo). La primera se vigila en
`scrum1040-facturas-recibidas-servidor.test.mjs`, que compara el JSON y el CSV como conjunto.

## Verificación

- Rojo: `b715e0a7`. Con el arreglo, en verde el test de 1249 y los guards que tocan esta superficie:
  1040 pantalla, 1185 trinquete, 402 marcadores, 601 copy, 405 ×2 descargas, 628 cobertura visual,
  755 contador, 237 y 976. Los números, en el informe de entrega.
- No hay verificación en yaqu.app todavía: se hace cuando el PR entre en `main` y despliegue.
