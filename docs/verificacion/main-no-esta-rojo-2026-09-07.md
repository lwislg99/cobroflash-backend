# SCRUM-822 · Medido: `main` NO está rojo, y el 404 no se reproduce

**Medido contra:** `origin/main` = `6cbb60fd593f1418c293f68f36689df0fbe33c1c`, en checkout DETACHED
sobre esa punta, árbol limpio (`git status --porcelain` = 0). **Fecha:** 2026-09-07.

## 1 · La tanda entera sobre main pristino

```
# tests 5909 · # pass 5807 · # fail 0 · # skipped 102 · exit=0
```

Y los **102 saltados no se dejan como agujero**: 80 son de staging y 9 son los del banco
`LIBRO_PG_URL` que CI sí ejecuta. Se levantó un Postgres 16.4 portable, se creó `yaqu_libro_test`,
se aplicó el esquema (`migrate diff --from-empty`, 29.044 bytes, 27 tablas) y se corrieron:

```
# tests 48 · # pass 48 · # fail 0 · # skipped 0
```

> 🔒 Sin esos 9, «exit 0» habría sido un verde con un hueco del tamaño exacto de lo único que CI
> corre y yo no. El hueco se cierra o se declara; no se calla.

## 2 · El 404 NO se reproduce

Las rutas existen en `src/app.ts:271-272` y los ficheros están en `public/`. Levantando la app en
proceso, igual que hace el test:

```
200 /             87.533 b     200 /precios          7.181 b
200 /privacidad    9.009 b     200 /terminos         6.385 b
200 /privacidad.html 9.009 b   200 /terminos.html    6.385 b
```

Producción también: `https://yaqu.app/privacidad` sirve «Política de Privacidad» completa.

## 3 · Pero los dos guards SÍ saben caer — control positivo

Rompiendo a propósito `href="/privacidad"` → `href="/privacidad-roto"` en `public/index.html`:

```
✖ SCRUM-329 · cada enlace interno responde 200 y con contenido
      /privacidad-roto → 404 (enlazado desde public/index.html)
✖ SCRUM-334 · ningún CTA lleva a un 404 ni a una página vacía
```

**Son exactamente los dos nombres reportados y exactamente la forma 404.** Revertido: 14/14 verde.
O sea: el informe describía bien un árbol con un enlace legal roto — pero ese árbol no es
`6cbb60fd`. Los guards están vivos y vigilando; no hay nada que declarar ciego.

## 4 · El único rojo real era de MI rama, y era otro

`SCRUM-723 · quién compara contra una referencia MÓVIL`. Mis dos scripts consultan la punta de
`origin/main` —su pregunta es literalmente «¿esta rama ya está DENTRO?»— y entraron en ese censo
en silencio. Declarados con motivo (commit `a37427f0`), no relajados: el guard sigue cayendo ante
un caso directo y ante uno indirecto sin declarar.

`SCRUM-329 · visitar la página pública no instala NINGUNA cookie` cayó UNA vez con `fetch failed`
en la primera pasada completa y no en la segunda; a solas y bajo carga, 0 de 12. Es la familia que
**SCRUM-560 ya arregló para el 334** («2 abortos en 10 pasadas antes, 0 en 20 después»,
`efe1004f`, 20-ago-2026) retirándole el `fetch`. El 329 sigue usándolo en dos sitios, y su línea
165 no lleva el `.catch` que sí lleva la 88. No es un 404 ni un rojo fijo: es un aborto de
conexión bajo concurrencia.

## 5 · ¿Hay más guards en rojo permanente?

Dentro de `npm test`, **cero** — y el suelo que lo respalda: el mismo comando reportó 2 fallos en
la pasada anterior sobre el merge, y el control positivo del punto 3 lo pone rojo a voluntad. Un
cero de un instrumento que acaba de demostrar que sabe decir «rojo» sí es un cero.
Fuera de la tanda quedan los 13 guards de navegador de `guards:visuales`, que corren en su propio
paso de CI y NO se han medido aquí. Declarado, no contado como verde.
