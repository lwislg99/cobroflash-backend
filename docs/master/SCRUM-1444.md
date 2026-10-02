# SCRUM-1444 · Censo del patrón gemelo en `src/`: existe un helper y hay sitios que no lo usan

**Medido contra:** `origin/main` = `d73c5ad9102dc0c5aba8a7ec4ea37ac383db06b0` · 2026-10-02T17:25:00Z

A9: aviso → cicatriz S1 «Antes de abrir un ticket o subir una pregunta, se busca en el repositorio si ya está contestada.» — no se pudo comprobar: `ya-esta` mira un número de ticket, no una pregunta, y nada obliga a correrlo

Sesión S1 (`s1-2octe`) · rama `scrum-1439-sondas-como-evidencia`. **Sólo evidencia.** Las líneas de cada
familia, con su carril, están en la descripción del ticket en Jira; aquí va el método y el instrumento.

## El método, antes de la cifra

`docs/master/evidencias/SCRUM-1444/censo-gemelos.mjs`:

    node censo-gemelos.mjs <repo> origin/main                      los recuentos
    node censo-gemelos.mjs <repo> origin/main --lineas <familia>   las líneas

Para cada familia, `git grep -n -E` en `src/` del helper y de la forma cruda, quitando las líneas que
son sólo comentario. **Es texto, no sintaxis.** Se queda fuera: un crudo partido en dos líneas, un crudo
escrito de otra forma que el patrón, `public/` entero, y las familias que no se me ocurrieron (las elegí
yo). **Es un suelo, no un techo.** «Lo lee una persona» se decidió leyendo la línea, sin abrir el fichero.

⚠️ No lo corre nadie: ni la tanda ni CI. Es evidencia de una medición, no un guard. Los dos guards que
saldrán de aquí (un `#${…id…}` en un texto que sale hacia fuera y un `toFixed(2)` pegado a una moneda)
son de S3 y van por AST.

## Lo que salió (2-oct-2026)

| Familia | Helper | Sitios en crudo que lee una persona |
|---|---|---|
| Número del presupuesto | `displayQuoteNumber`, 4 usos, todos en `quotes.routes.ts` | unos 31 |
| Importe | `formatMoneyEs` y familia | 7 |
| Aritmética de línea | `calcTotal`, `lineasQueSuman`, `precioConDto` | 6 (SCRUM-1442) |
| Fecha | `zonaDelMerchant`, `diaNaturalEn` | los que imprimen: ya censados en SCRUM-1093h (SCRUM-1445) |
| «Aceptado» | `presupuestoAceptado`, 2 usos | 16 comparaciones a mano: un gemelo dormido, no se toca |
| Id de columna | `cabeEnColumnaInt` | 34 en J1 y J2 (SCRUM-1379) y 3 en SCRUM-1441 |

**Tres nombres para un documento:** el mismo presupuesto se llama con su número de serie
(`displayQuoteNumber`), «#secuencia» en casi todo, y «#id global» en el correo de aceptación por el bot
(`whatsappIncoming.routes.ts` le pasa `quote.id` a `sendMerchantQuoteAcceptedEmail`).

## La víspera

`docs/master/evidencias/SCRUM-1444/sonda-fechas-vispera.cjs` (sin argumentos) ejecuta las mismas
expresiones `toLocaleDateString` que usa `src/`, en un proceso con `TZ=UTC` y en otro con
`TZ=Europe/Madrid`. Con UTC, un instante de las 00:30 de Madrid se pinta con la fecha del día anterior.

## Errores propios

- Escribí que para las fechas «no existe helper». Existe (`zonaDelMerchant`, `diaNaturalEn`) y lo usa la
  numeración; salió en mi propio grep y no lo até.
- Abrí SCRUM-1445 preguntando por la zona de producción. `docs/master/SCRUM-643.md` ya decía que es UTC,
  y SCRUM-1093h ya tenía el censo de fechas por AST. El ticket se reescribió el mismo día.

## Lo que NO está hecho

No se ha abierto cada sitio · `public/` sin mirar · ninguno visto en pantalla ni en un correo de verdad.
