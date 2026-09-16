# SCRUM-677 · El vigía del despliegue

**Fecha:** 2-sep-2026 · **Carril:** S3
**Medido contra:** `origin/main` = `e96ca273cabd4cbbea7f7151ca36d7afca16b4fb` · 2026-09-02T18:05:11Z
**Rama:** `scrum-677-que-no-vuelva-a-pasar`

**La víctima:** todos. Producción estuvo **nueve días** sin desplegar. Treinta despliegues
fallaron el healthcheck porque se mergeó esquema sin aplicar su `ALTER` y `schemaDrift` se negó a
arrancar —correctamente—. Nadie se enteró: cuando un despliegue falla, Railway **mantiene vivo el
anterior**. La web funcionaba. **El síntoma era «no cambia nada», indistinguible de un día sin
cambios visibles.** Lo destapó el fundador preguntando, no un mecanismo.

---

## PASO 0

### ENTRADA

**Guard 1 — no había ninguna.** Nada en el árbol preguntaba qué está corriendo producción. Cero
apariciones. Por eso el incidente duró nueve días: no es que el instrumento fallara, es que no
existía.

**Guard 2 — la entrada existe y está medida:** el CI corre `npm test` en `pull_request` a `main`
(`.github/workflows/ci.yml`, jobs `test` y `guards-visuales`). **Sí hay sitio donde este guard
puede vivir antes del merge.**

### MECANISMO

**El hallazgo que hace posible el Guard 1 sin credenciales:**
`src/core/config/env.ts` pone `BUILD_ID = process.env.RAILWAY_GIT_COMMIT_SHA` y `GET /version` lo
publica. Ese endpoint es **público y declarado** en `publicAccessDeclarations.ts` («build id, sin
caché, sin PII»).

⇒ **El commit activo en producción se puede saber sin token de Railway, sin base de datos y sin
un solo secreto.** Comprobado en vivo: devolvió un sha40 que estaba en la historia de `main`. El
motor existía; el trabajo era darle superficie.

---

## GUARD 1 · CONSTRUIDO Y CABLEADO

### La magnitud, que es lo que evita el falso positivo

**No se mide «horas desde el último commit en `main`».** Con esa magnitud un sábado tranquilo
cantaría sin que hubiera pasado nada. Lo que se mide es **el HUECO**:

* sha de producción **==** HEAD de `main` → **verde, dé la hora que dé**. Nueve días de silencio
  con producción al día no son un fallo: son un puente.
* sha **distinto** → hay hueco, y **sólo ahí corre el reloj**: cuántas horas lleva abierto.

El falso positivo de fin de semana desaparece **por construcción**, no por ajustar un número.

### El margen: 6 h

Medido sobre los **1.832 commits** de `main` de los últimos 30 días: el hueco entre commits
consecutivos tiene **mediana 0,0 h y p99 5,5 h**. Justo por encima de la p99 → en marcha normal,
un commit que lleva más de 6 h sin llegar no es «un rato tranquilo»: es que el despliegue no pasa.
Y es **1/36** del incidente (216 h). El error barato —una mirada— frente al caro, que ya costó
nueve días.

### El mensaje OBSERVA, no afirma

`producción dice e96ca273 · main está en e96ca273 · sin hueco`. No dice «producción está
desplegada»: eso es una afirmación en presente sobre el mecanismo que no dice nada sobre si lo
está — el defecto nº 14, que nos ha mordido esta semana.

### Dónde corre, con su asimetría

| Dónde | Qué hace | Por qué |
|---|---|---|
| **Job en cada PR** | **informativo, `continue-on-error: true`** | si el vigía está en rojo, **el arreglo llega mergeando**. Un check bloqueante cierra la puerta justo a quien viene a arreglarlo: la rama que aplica el `ALTER` que falta no podría entrar porque producción sigue atrasada por no tenerlo. Un candado que se cierra por dentro |
| **Workflow programado, cada 2 h** | **falla, y ése es el aviso** | ataca la causa real: nueve días **en los que nadie mergeó nada**, y por eso nadie miró. GitHub ya notifica un scheduled workflow en rojo: cero dependencias nuevas (regla 36), cero canal que inventar |

Cadencia ≤ 2 h porque el peor caso del aviso es **margen + cadencia**: con 6 h de margen y un cron
cada 6 h, el aviso llegaría entre las 6 y las 12 horas. Cada 2 h lo acota a entre 6 y 8.

### Los suelos, y cada ceguera con su motivo

`no supe mirar` **no es** `al día`, y sale con **código 2**, distinto del 1 del hallazgo:

* no se pudo leer `/version`;
* **producción no publica un sha** — y esto **no es una hipótesis**: `env.ts` cae a
  `String(Date.now())` si `RAILWAY_GIT_COMMIT_SHA` no llega. Compararlo contra `main` daría «no
  está en la historia» y se leería como «va atrasadísima», cuando lo que pasa es que **no sabemos
  qué corre**;
* el commit de producción no existe en este repositorio (pasó de verdad mientras se construía
  esto: producción avanzó y el clon local no lo tenía. El vigía dijo «no supe mirar» en vez de
  adivinar);
* hay commits por delante y no se les pudo poner fecha.

Y un caso que **no es atraso**: producción corriendo un commit **fuera de la historia de `main`**.
Es otra cosa y se arregla de otra forma, así que se dice distinto.

### Los rojos y los controles

| Prueba | Resultado |
|---|---|
| **POSITIVO** · sha de producción de hace 9 días, contra un servidor de mentira | **saltó**: `222,6 h de hueco · 283 commits · salida 1`. El incidente reproducido |
| **NEGATIVO DURO** · mismo sha que `main` con **222 h de silencio** | **no canta**. Es la comprobación de que el margen se aplica a la magnitud correcta |
| negativo · merge de hace 10 min, 3 commits por delante | no canta: un despliegue en curso se lee así |
| el job del PR pasa a bloquear | cae el trinquete del cableado |
| checkout superficial (`fetch-depth: 1`) | cae: con el clon por defecto, un commit de hace nueve días **no está**, y el vigía se quedaría ciego **justo en el caso que persigue** |
| el cron pasa a cada 12 h | cae |

19 tests, todos en `npm test`: sin red, sin git y **sin reloj de pared** — el reloj se inyecta.

---

## 🛑 GUARD 2 · PARADO EN LA ENMIENDA 3, Y ES LO QUE MANDABA EL ENCARGO

**La opción D está adoptada y el diseño está cerrado** (subconjunto calculado en producción,
`information_schema` leído en la petición, `comparadas: N` con su suelo). Lo que **no** se ha
construido es el endpoint, y el motivo es exactamente el que el encargo mandaba comprobar antes de
proponer nada.

### Lo medido sobre el acceso

| Superficie | ¿Sirve desde CI? |
|---|---|
| `/version` y `/health` tal como están hoy | **públicos**, y sólo publican `{version: BUILD_ID}` / `{ok, service, version, db}`. Nada de esquema |
| camino `/admin/*` | `requireAuth` con cookie de sesión de magic link. **CI no puede obtenerla sin credenciales** |
| `requireInternalSecret` (`src/core/http/internalAuth.ts`) | existe y es el único auth de máquina. Cabecera `x-internal-secret`, y al de fuera le devuelve **404** |
| secretos que el CI ya tiene | **CERO**. `grep -c "secrets\." .github/workflows/ci.yml` → **0** |

### 🔴 Por qué eso es un PARO y no un «lo cuelgo de ahí»

Dos cosas, las dos medidas:

1. **`INTERNAL_SECRET` es aleatorio por proceso** por defecto (`crypto.randomBytes(32)`). **Nadie
   fuera del proceso lo conoce**, tampoco el fundador. Para que CI pudiera usarlo habría que
   fijar `INTERNAL_API_SECRET` en el entorno de producción **y** meterlo en los secretos de
   GitHub. Eso es **un secreto nuevo**, y es paso del fundador.
2. **Y ese secreto abre además `/charges` y `/invoice`** — los caminos del dinero. Dárselo a CI le
   daría la capacidad de marcar cobros como pagados. Aunque el fundador quiera hacerlo, la
   pregunta de si reutilizar ése o crear uno **de sólo lectura** es suya, no de la sesión.

**No se escribe, no se inventa, no se pone uno de ejemplo y no se deja el endpoint abierto
«mientras tanto».** *Prefiero el guard sin entregar a un endpoint abierto entregado.*

**Lo que hace falta para desbloquearlo, en una línea:** decidir qué secreto autentica a CI contra
producción —el interno que ya existe, o uno nuevo de sólo lectura— y colocarlo. Con eso, el
endpoint y su guard son un rato de trabajo: el diseño ya está cerrado y las tres enmiendas
entendidas.

---

## 🕳️ HUECOS DECLARADOS

1. **El agujero que deja la enmienda 1, y es real:** con `{faltan, comparadas}`, la lista de
   columnas de producción **se puede enumerar sondeando**, preguntando de una en una. Es más lento
   y mucho más ruidoso que un volcado, pero existe. Por eso la enmienda 3 no es opcional.
2. **`schedule` de GitHub no es puntual ni eterno:** puede retrasarse en horas de carga, y en un
   repositorio sin actividad de 60 días GitHub **lo desactiva**. Las dos cosas hacen que este
   vigía pueda callar sin que nadie se entere — **el mismo modo de fallo que viene a resolver**.
   No hay hoy nada que vigile al vigía.
3. **El vigía cree lo que producción dice de sí misma.** Si `/version` mintiera —una instancia
   vieja sirviendo, una caché por delante— el vigía diría verde. No se puede comprobar desde
   fuera con lo que hay.

## Lo que NO se ha tocado

`schemaDrift` — hoy fue **lo único que funcionó**: se negó a arrancar y nombró tabla y columna, y
por eso se cerró en un turno en vez de en una semana. La alternativa a no arrancar es reventar
delante de un cliente · `prisma/schema.prisma` · `src/lib/invoicing.ts` · `guards-visuales.mjs` ·
`customersView.js` · el exportador de CSV.

**Fuera de alcance declarado:** que `schemaDrift` no mire tipos, claves ajenas ni índices está
anotado y **no es este ticket**.
