# SCRUM-687 · Guard 2 · la constancia del `ALTER`

**Fecha:** 2-sep-2026 · **Carril:** S3
**Medido contra:** `origin/main` = `ecda7ddd4b974269411315d6983e12c17b415d78` · 2026-09-02T19:09:44Z
**Rama:** `scrum-687-constancia-del-alter`

**La víctima, y no es hipotética:** producción estuvo **nueve días** sin desplegar. Tres veces se
mergeó el esquema (paso ③) sin haber aplicado el `ALTER` en las bases (paso ②), y `schemaDrift` se
negó a arrancar —correctamente—. Nadie lo vio: un healthcheck fallido deja vivo el despliegue
anterior, así que el síntoma es «no cambia nada». **Durante nueve días, todo lo que el equipo
mergeó no llegó a ningún fontanero.**

SCRUM-677 vigila que producción no se quede por detrás de `main`. **Esto vigila lo que lo causó:
el `ALTER` que nadie aplicó** — y lo vigila ANTES de mergear.

---

## PASO 0

**ENTRADA: no existe ninguna.** Cero apariciones de `SCHEMA_CHECK_SECRET` o de cualquier cosa
parecida en `src/`, `scripts/` y `.github/`. Hoy nadie pregunta esto desde ningún sitio.

**MECANISMO: existe, y por eso no se rehace.** `src/core/db/schemaDrift.ts` ya lee
`information_schema` y ya compara **esperado ⊆ real** — es exactamente el mismo cálculo. La
diferencia es *cuándo* y *quién pregunta*: allí, al arrancar, y sólo después de mergear y esperar
cinco minutos de healthcheck; aquí, desde CI y antes de mergear. El trabajo era **darle superficie
a ese cálculo**, no inventar otro.

⚠️ `schemaDrift.ts` **no se toca** (es el arranque, y hoy fue lo único que funcionó). Se lee, no se
modifica — que es la distinción que la casa ya tiene escrita.

## Lo construido

| Pieza | Qué es |
|---|---|
| `src/core/db/constanciaDelAlter.ts` | el comparador **PURO** y la consulta al catálogo |
| `src/core/http/schemaCheckAuth.ts` | el guard del secreto, **fail-closed** |
| `POST /schema-check` en `src/app.ts` | la superficie, declarada en `publicAccessDeclarations.ts` como `internal` |
| `scripts/constancia-del-alter.mjs` | el lado de CI: deriva lo esperado del DMMF, pregunta y **comprueba `N`** |
| job `constancia-del-alter` en `ci.yml` | **informativo, `continue-on-error: true`** |

### La dirección, que es la enmienda que hace tolerable la superficie nueva

**CI manda el conjunto esperado; producción responde `{faltan, comparadas}`.** No se publica la
lista real de tablas y columnas: sólo **el espejo de lo que le mandan**. Quien pregunta no se lleva
nada que no trajera ya.

### `information_schema` se lee EN LA PETICIÓN

Nunca un fichero del repo, nunca `deriva-prod.sql`, nunca `schema.prisma`. Ese fichero **se genera
desde el esquema**, así que preguntarle si el `ALTER` está aplicado es consultar justo el valor que
el defecto falsifica — la opción B, descartada midiendo.

### El secreto: propio, y su valor no lo conoce esta sesión

`SCHEMA_CHECK_SECRET`, **exclusivo de este endpoint**. No se reutiliza `requireInternalSecret`
porque ese mismo secreto abre `/charges` e `/invoice`, y **un secreto que pasa por los logs de un
runner de CI no puede ser el que abre los cobros**.

**No se escribe, no se imprime, no se inventa y no hay ninguno «de ejemplo»** — tampoco en los
tests, que generan uno de usar y tirar en el entorno de su propio proceso. Hay un test que lo
vigila sobre los tres ficheros.

### Fail-closed, con tres desenlaces distintos

| Situación | Respuesta | Por qué |
|---|---|---|
| sin secreto configurado | **404** | el endpoint NO EXISTE. Un endpoint que anuncia que está apagado es un endpoint que anuncia que existe |
| secreto **demasiado corto** | **404** | se trata como no configurado. Aceptarlo sería la puerta cerrada con un pestillo que se abre soplando |
| secreto incorrecto | **401** | y sin una palabra sobre el esquema |
| catálogo ilegible | **503**, `comparadas: 0` | 🔴 **no** `faltan: []`. Un fallo con cuerpo vacío se leería como «no falta nada», que es el verde más caro que se puede dar |
| pregunta inválida | **400** | cero esperadas o forma mala **no** es un hallazgo del esquema y no puede leerse como uno |

Y en el lado de CI: **404, 401 o red caída salen con 2, «no pude preguntar» — que NO es verde.**

## Los tres controles obligatorios

| Control | Qué comprueba |
|---|---|
| **POSITIVO** | una columna que existe + una inventada → devuelve **exactamente** la inventada, y `comparadas` = total enviado |
| **SUELO** | con **cero** esperadas no puede decir «todo bien». «No hay columnas que falten» y «no me han preguntado por ninguna» son el mismo `faltan: []` con significados opuestos |
| **NEGATIVO** | una columna que existe **no aparece jamás** en `faltan` |

Y dos suelos más que no estaban pedidos y hacían falta: **el catálogo vacío no se lee como «faltan
todas»** (mismo criterio que `schemaDrift`), y `comparadas` cuenta columnas **distintas**, no líneas
del cuerpo — si CI manda una repetida, `N` dejaría de cuadrar con lo enviado.

## 🔴 El trinquete de la copia

`schemaDrift.ts` **no exporta** su consulta y **no se puede tocar**, así que la copia está
**forzada**. Se paga con un trinquete: un test lee las dos cadenas —de los dos ficheros— y **cae si
divergen**, con suelo (comprueba además que la consulta nombra `information_schema.columns` y
`current_schema()`, para que dos cadenas vacías no pasaran por iguales).

Sin él, esta constancia podría mirar un esquema distinto del que mira el arranque, y las dos darían
verdes que no significan lo mismo — **y el verde de aquí es el que deja mergear**.

## Los rojos, probados rompiendo el mecanismo

| Rotura | Qué cayó |
|---|---|
| sin secreto, el guard deja pasar | «SIN secreto configurado, el endpoint NO EXISTE (404)» |
| se quita el suelo de cero esperadas | «SUELO: con CERO esperadas NO puede decir todo bien» |
| el mensaje pasa a decir «el esquema está aplicado» | «el mensaje OBSERVA, no afirma» |
| **control negativo** · cambiar un comentario | **nada** |

**Y un rojo que me cazó a mí:** el test que prohíbe escribir secretos **se cazó a sí mismo** en su
propio control positivo, que llevaba la cadena prohibida literal. Es la lección de SCRUM-349 —el
fichero que prohíbe escribir un secreto no puede escribir uno para demostrar que sabe verlos— y se
pagó en el primer intento. El cebo ahora se **compone**, no se escribe.

## 🕳️ HUECOS DECLARADOS

1. **`SCHEMA_CHECK_SECRET` puede no estar instalado todavía** en Railway ni en los secretos del
   repositorio. **No bloquea**: el endpoint es fail-closed sin él y los tests inyectan el suyo.
   Mientras no esté, el job dirá «no pude preguntar» y saldrá con 2 — que es lo correcto: no se ha
   comprobado nada. **El endpoint no se ha ejercitado contra producción**, sólo su lógica.
2. **El endpoint sigue siendo ENUMERABLE POR SONDEO**, ahora con secreto: preguntando de una en
   una se puede reconstruir la lista. Es más lento y mucho más ruidoso que un volcado. Declarado,
   no resuelto — ya estaba en el ticket.
3. **El `schedule` de GitHub se retrasa con carga y se desactiva tras 60 días sin actividad.**
   Nada vigila al vigía. Recogido del ticket, no re-descubierto.
4. **No se comprueban TIPOS de columna.** `schemaDrift` tampoco lo hace y ampliarlo es otro ticket.
   Va como línea en el informe.

## Lo que NO se ha tocado

`schemaDrift.ts` y el arranque · el Guard 1 de SCRUM-677 · `prisma/schema.prisma` · ninguna
dependencia nueva (regla 36).
