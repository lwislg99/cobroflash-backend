# SCRUM-841 · Albaranes tiene las MISMAS cinco columnas de congelado que Invoice y el MISMO hueco: no las escribe nadie

**Fecha:** 15-sep-2026 · **Carril:** documento entregado (albarán, NO fiscal) · **Gate:** medición + arreglo

**Medido contra:** `origin/main` = `07ccd16c92e37350e785526232d03b7f0c637684` · 2026-09-09T16:03:28Z
**Rama:** `scrum-841-escritor-congelado-albaran` · base = ese mismo SHA (distancia a main: 0)

**Preámbulo (norma A1):** `./node_modules/.bin/prisma generate` rc=0 · `npm run build` rc=0 ·
`git rev-list --count HEAD..origin/main` = **0** · árbol limpio.

> Este ticket lo dejó escrito SCRUM-729 en su propio expediente, al cerrar el lado factura:
> *«**`albaranes`** tiene las mismas cinco columnas y el mismo hueco. **Va al PR siguiente**»*
> (`docs/master/SCRUM-729.md`). Esto es ese PR.

---

## 0 · Obligación 0 — no había rama viva

El ticket constaba «en curso» desde el 9-sep. **No existía nada que retomar**, y se separaron las
dos causas antes de construir:

| Comprobación | Resultado |
|---|---|
| `git ls-remote --heads origin \| grep scrum-841` | **vacío** |
| `git log origin/main --grep=scrum-841` | **vacío** (no es «se mergeó y el autoborrado la quitó») |
| `docs/master/` en `origin/main` | **sin `SCRUM-841.md`** |
| `git grep -i SCRUM-841 origin/main` | **cero apariciones** |
| Ramas locales en los 26 worktrees | **ninguna** |

Causa **(a)**: nunca se empujó rama. Se construye desde cero.

---

## 1 · PASO 0 — el defecto vive HOY, y se midió CORRIENDO

Norma A2: no leyendo. Se invocó el handler **real** de `POST /admin/albaranes/:id/emitir` con
`prisma` de doble (patrón SCRUM-302 / SCRUM-263 / SCRUM-257b), con la ficha del cliente **puesta y
disponible** para que nadie pueda decir que no había nada que copiar:

```
CODIGO DE RESPUESTA: 200
DATA QUE LLEGO A albaran.update: {"estado":"emitido"}

CAMPOS CONGELADOS ESCRITOS AL EMITIR: 0/5
🔴 DEFECTO CONFIRMADO HOY: se emite el albaran y NO se congela ni un dato del cliente.
```

Las cinco columnas (`customer_name`, `customer_legal_name`, `customer_tax_id`, `customer_email`,
`customer_phone`) **existen** en las tres bases —ALTER aplicado y verificado el 8-sep— y viven en
`prisma/schema.prisma` con su `@map` desde `fbed5f4d` (SCRUM-729 paso 6, ya en `main`). Lo que
faltaba era el escritor.

### El daño, dicho en una línea

Un albarán **emitido y todavía sin firmar** reimprime el cliente de HOY. Si el cliente corrige su
razón social o su NIF después de que se le entregara el parte, el papel que se reimprime ya no es
el que se entregó — y nadie tocó el documento.

---

## 2 · 🔴 NO ES STOP, y está MEDIDO, no afirmado (regla 38)

La pregunta que decidía la tanda: **¿el escritor cae dentro del camino de emisión fiscal?**

Sonda **AST** (nunca `grep`, SCRUM-203) sobre el handler, **con control positivo**: si no
encuentra la ruta se declara ciega en vez de devolver un «no llama a nada» que no ha comprobado
nada. Probada contra una ruta inventada → `SONDA CIEGA`, y listó los 17 handlers que sí ve.

```
HANDLER /:id/emitir — cuerpo empieza en linea 843
LLAMADAS (10):
  canTransitionAlbaran · console.error · findAlbaran · prisma.albaran.update
  res.json · res.status · res.status(409).json · res.status(500).json
  res.status(found.status).json · serializeAlbaran

PRIMITIVAS FISCALES ALCANZADAS DIRECTAMENTE: NINGUNA
```

Contrastado contra `allocateInvoiceNumber`, `emitInvoice`, `crearFacturaEmitida`,
`ensureInvoiceForCharge`, `sellarTrasEmision`, `computeVeriFactuHash`, `invoice.create`,
`sellarAlbaran`, `computeAlbaranContentHash` y `getEmissionMode`.

**Conclusión:** el albarán es documento **NO fiscal** por definición del modelo (SCRUM-14, regla
24: jamás VeriFactu, serie fiscal, QR ni la palabra «factura»), y esta ruta **no crea factura, no
numera y no sella**.

> ⚠️ **El matiz que no se esconde:** `albaranes.routes.ts` **sí** contiene dos caminos de emisión
> fiscal —`/consolidar` (C7a) y `/:id/facturar-parcial` (C7b), `SEMAFORO_MAPA_EMISION.md` §2.3—.
> Son **otras rutas del mismo fichero** y **no se ha tocado ninguna**: el diff entero cae dentro
> del handler `/:id/emitir` y de un módulo nuevo.

---

## 3 · El arreglo: el congelado no depende de que alguien se acuerde

`src/modules/jobs/domain/albaranEmision.ts` (nuevo) saca `estado: 'emitido'` **y los cinco campos
juntos**, con el cliente como parámetro **obligatorio**. Es el mismo mecanismo que
`crearFacturaEmitida` en SCRUM-729 §2, a la escala que pide el problema: allí había **siete**
`invoice.create` y hubo que crear la línea única; aquí hay **un solo** emisor de albaranes, y lo
que este módulo impide es que aparezca el segundo por la puerta de atrás.

**ROJO ENSEÑADO** — quitando el argumento al emisor:

```
src/modules/jobs/app/routes/albaranes.routes.ts(884,13): error TS2554: Expected 1 arguments, but got 0.
BUILD rc=2
```

Fuente restaurada **byte a byte** (`Buffer.compare === 0`, 85295 = 85295).

### Se REUTILIZA `congelarCliente`, no se copia

El helper de SCRUM-729 se usa sin una línea nueva: ya filtra por merchant (regla 2), ya lanza si
la ficha no está, y su tipo `ClienteCongelado` **ya lleva el nombre exacto de la columna** —su
propio comentario nombra `Invoice`/`Albaran`—, así que el objeto se derrama tal cual dentro del
`data`. Copiar sus cinco asignaciones aquí habría sido la segunda fuente que acaba divergiendo.

### Coste, medido y dicho

La ruta pasa de **2 viajes a 4** (leer el `Job` para el `customerId` + leer la ficha) y **sigue sin
abrir transacción**: el congelado viaja dentro del `update` que ya se hacía. El congelado va
**después** de la comprobación de transición —un 409 no debe costar dos viajes— y **antes** del
único `update`.

---

## 4 · El control · `tests/scrum841-el-escritor-del-albaran.test.mjs`

**7 pruebas, sin gate y sin base.** Invocan el handler REAL; ni una firma se cambió para mirar.

| # | Qué comprueba |
|---|---|
| ① | emitir escribe los **cinco**, con los valores de la ficha de entonces |
| ② | los nombres se **derivan** de `CAMPOS_CONGELADOS`, no se copian aquí |
| ③ | 🔴 el comprobador de ① **distingue**: contra el `data` de antes del ticket, cae |
| ④ | 🔴 **el que decide**: el segundo POST **no re-congela** con la ficha de hoy |
| ⑤ | la ficha se lee filtrando por merchant (regla 2) |
| ⑥ | por AST: ningún otro `albaran.update` de `src/` pone `estado: 'emitido'` a mano |
| ⑦ | control positivo de ⑥: sobre fuente sintética con la fuga dentro, **la ve** |

**Por qué ④ es el que decide.** `/emitir` es idempotente. Si el reintento volviera a congelar, el
retrato pasaría a ser el de HOY y el documento cambiaría solo — el defecto entero colado por la
puerta del reintento, y encima sin que nadie emita nada.

**ROJO ENSEÑADO, dos veces:**

```
# con el escritor revertido al mundo de antes (data: { estado: 'emitido' })
not ok 1 - ① emitir un albarán escribe los CINCO campos del cliente
not ok 2 - ② los cinco nombres se DERIVAN, no se copian
not ok 6 - ⑥ ningún otro sitio de src/ emite un albarán a mano     <- caza la puerta lateral REAL
# pass 4 · fail 3

# mutando la salida idempotente para que RE-CONGELE
not ok 4 - 🔴 ④ el segundo POST NO re-congela: un albarán ya emitido no se toca
    🔴 EL REINTENTO REESCRIBE. [...] 1 !== 0
# pass 6 · fail 1
```

Fuente restaurada byte a byte tras cada mutación (`Buffer.compare === 0`).

`node --test --test-reporter=tap tests/scrum841-el-escritor-del-albaran.test.mjs` →
**7 pass, 0 fail, `# skipped 0`**.

---

## 5 · Lo que este PR **NO** hace, dicho en voz alta

1. **No toca el sellado de la firma.** El sobre **v:3** (SCRUM-438) congela su propio `cliente`
   —`legalName || name`— dentro de `evidenciaFirma`, y lo hace **AL FIRMAR**, no al emitir. Son
   dos congelados en dos instantes **legítimamente** distintos. Unificarlos exige mover a la vez
   sellador y verificador: `albaran.service.ts` avisa de que esa expresión está **sujeta por un
   guard a otra en otro fichero**, y eso es trabajo del ticket que toque el sellado (regla 29).
2. **No hay lector todavía.** El PDF sigue resolviendo por `contenidoSegunVersion` exactamente
   igual que ayer: **ni un byte cambia en ningún documento ya generado**. Cablear los lectores a
   la columna es el paso siguiente, y es el delicado — hacerlo a medias reabriría **SCRUM-452**
   (el papel diciendo una cosa y el sello certificando otra).
3. **Sin backfill: ni una fila.** Por la razón de SCRUM-729 §5: escribir hoy la ficha de hoy en un
   documento emitido en marzo no es un relleno, es fabricar un dato que aquel día no constaba.
   `NULL` en las cinco significa **«anterior al escritor»**, y sólo mientras nadie lo invente.
4. **No toca `prisma/schema.prisma`.** El ALTER y las diez líneas ya estaban (SCRUM-729 paso 6).
5. **Ni un estado, ni un flag, ni un texto de usuario nuevos** (reglas 27 y 30). La FSM
   `borrador | emitido | firmado` queda intacta.

---

## 6 · Hallazgo que se REPORTA y no se arregla (norma A7)

`POST /admin/albaranes/:id/emitir` **no aplica el filtro de rol** `seesOnlyOwnJobs` que sí aplica
el `GET /admin/albaranes/:id` de este mismo fichero (SCRUM-467). Un técnico con rol restringido
podría emitir el albarán de un Trabajo que no es suyo. **Es anterior a este PR y no se ha tocado**:
arreglarlo cambia el control de acceso de una ruta, que es otro carril y otra decisión.

---

## 7 · Verificación

- `npm run build` rc=0
- `npm test` → **6484 tests · 0 fallos · 110 saltos** (los gateados de siempre; este fichero
  declara `# skipped 0`). ⚠️ `npm test` usa el reporter `spec`, que **no imprime los SKIP**: el
  recuento de saltos sale del TAP, como avisa `CLAUDE.md`.
- `npm run guards:entrada` → pegado en el PR.
- **No se ejecutó nada contra producción ni contra staging**, ni con `--dry-run`.

## 8 · Documentos consultados

`docs/YAQU_MASTER.md` (Parte I, reglas 24/27/29/30/38) · `docs/master/SCRUM-729.md` ·
`docs/master/SCRUM-602.md` · `docs/legal/SEMAFORO_MAPA_EMISION.md` ·
`docs/equipo/00-normas-comunes.md` · `CLAUDE.md`
