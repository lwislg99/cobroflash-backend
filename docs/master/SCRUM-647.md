# SCRUM-647 · El presupuesto también deja de decir «IVA»

**Fecha:** 2-sep-2026 · **Carril:** documento (representación) · **Gate:** sin gate — corre en `npm test`

**Medido contra:** `origin/main` = `03c5bce4ed5b37bb68a38d03bb27a6c8887783ed` · 2026-09-02T04:33:29+01:00

**Tanda:** 4255 tests, 4176 pass, 0 fail, 79 skipped

> ⚠️ **ESTA RAMA NO SALE DE `main`, Y HAY QUE SABERLO.** El ancla de arriba es el `main` vigente
> cuando se midió, pero la rama sale de **`scrum-623-desglose-por-tipo` = `925fb32c9313b01df3e2b8de6480ba24ec532c31`**,
> que **sigue sin mergear**, porque reusa su mecanismo (`NOMBRE_IMPUESTO_POR_DEFECTO`, el parámetro
> `taxName`) en vez de copiarlo. **Si 623 no entra, esto hay que rebasarlo.** `origin/main` avanzó a
> `164971db` mientras se cerraba; **ninguno de esos commits toca los tres ficheros de aquí**, así que
> la medición no caduca.

---

## El defecto: el mismo papel con los dos criterios

| dónde | qué hacía |
|---|---|
| la tabla de líneas (`:733`) | `'IVA%'` **grabado** |
| el bloque de totales (`:853`) | `locale.vatName`, resuelto **por país** |

Y es el documento que **más se envía**: va por WhatsApp y es el primer papel que ve el cliente.

---

## 🔢 EL CENSO — cuánto habrá que desmontar el día del IGIC

Barrido de **316 ficheros y 78.832 líneas** de `src/` y `public/`:

| | sitios |
|---|---:|
| **A)** consumidores de `locale.vatName` (el **nombre**, por país) | **2** |
| **B)** consumidores de `locale.defaultVat` (el **tipo**, por país) | **10** |

**✅ Control positivo:** el barrido encuentra el consumidor que yo ya conocía (`pdf.service.ts`) y el
registro de locales; si no viera alguno de los dos, aborta con código 2 en vez de imprimir números.

### Los dos de (A), uno por uno

* `pdf.service.ts:853` — **el que este ticket retira.**
* `public/dashboard/js/app.js:100` — **no es un consumidor: es una SEGUNDA DEFINICIÓN.** Es el
  respaldo de `window.appLocale` cuando el servidor no manda locale, con `vatName: 'IVA'` y
  `defaultVat: 0.21` escritos a mano en el front.

**Así que tras este ticket, `locale.vatName` no lo consume nadie**; sólo queda definido (dos veces,
en dos árboles).

### 🔴 Y (B) es peor, porque escribe DATO y no un rótulo

`products.routes.ts:47` — `const vat = getLocale(merchant.country).defaultVat;` — la carga del
catálogo por gremio **estampa el tipo por país en cada producto**. A un merchant canario le pondría
**0,21** en todo el catálogo. Es el mismo defecto una capa más abajo, y no deja un rótulo mal: deja
filas mal en la base. **Es lo que SCRUM-646 tendrá que mirar primero.**

---

## Lo construido

El mismo mecanismo de la factura, **reusado y no copiado**: `taxName?: string | null` en
`generateQuotePdf`, resuelto **una vez** arriba —`params.taxName || NOMBRE_IMPUESTO_POR_DEFECTO`—
y usado en los **dos** sitios. Dentro del documento ya no queda ni `'IVA'` grabado ni
`locale.vatName`: **un solo criterio**.

### ⚠️ Pero `locale.vatName` no se borró sin más, y esto es lo que lo decidió

Medido **antes** de tocar: los **tres** llamantes pasan `country`, y `locale.vatName` vale **`IGV`
en Perú**. Quitarlo a secas habría hecho que un presupuesto peruano dejara de decir IGV — una
**regresión en un mercado que el registro declara**.

Así que la resolución por país **no desaparece: sube al llamante**, donde el país ya está a la
vista y donde SCRUM-646 la sustituirá:

```ts
country: merchant.country,
taxName: getLocale(merchant.country).vatName,   // ← aquí, visible, en 3 sitios grepeables
```

**El documento deja de decidir; quien sabe, pasa.** Y como eso abre la puerta a que un llamante se
olvide y Perú regrese **en silencio**, hay un guard que exige que las tres llamadas lo pasen.

---

## Las cuatro direcciones, medidas

| caso | IVA | IGIC | IGV |
|---|---:|---:|---:|
| ① sin `taxName` (lo de hoy) | **2** | 0 | 0 |
| ② `taxName = IGIC` | **0** | 2 | 0 |
| ③ `country = PE` **sin** `taxName` | 2 | 0 | **0** |
| ④ `country = PE` + `taxName = IGV` (lo que pasa el llamante) | 0 | 0 | **2** |

Con un tipo del **7 %**, que no existe en España: la forma tampoco depende del juego de tipos.

**③ es el hallazgo**, y por eso está en la tabla: el documento ya **no** resuelve por país. Que
Perú siga viendo IGV depende enteramente de ④, o sea del llamante. Ahí está el guard.

---

## Los rojos — y la lección, DEMOSTRADA en vez de repetida

| inyección | qué cae | ¿lo caza el control negativo ①? |
|---|---|---|
| ① se regraba `IVA%` en la cabecera | 2 tests | **NO — sigue verde** |
| ② vuelve `locale.vatName` a los totales | 3 tests | **NO — sigue verde** |
| ③ un llamante deja de pasar `taxName` | 1 test, **y nombra el fichero** | — |

**El control negativo no puede cazar ninguna de las dos primeras**, y no es un descuido: con el
nombre regrabado el papel **peninsular sigue siendo correcto**, que es exactamente lo que ① mide.
Un control que no puede fallar ante el defecto no es cobertura — y por eso hay tres.

Y no lo afirmo: **hay un test que lo ejercita**, comprobando que ① aprobaría el documento que
imprimiría la regresión. Reversión de las tres inyecciones: `Buffer.compare === 0`, 0 CR.

---

## El test de SCRUM-604b, reapuntado sin debilitarlo

`SCRUM-604b · el rótulo del impuesto sale del locale: en Perú es IGV` fijaba el criterio **viejo**:
que el documento lo resolviera desde `locale.vatName`. Se reapunta, y **su propiedad no se toca**:
un presupuesto peruano sigue teniendo que decir IGV. Lo que cambia es **dónde** se decide, así que
ahora lo comprueba pasando `taxName: 'IGV'` — exactamente lo que pasan las tres rutas.

Y se le **añade** una aserción con el cambio de comportamiento escrito en vez de escondido: sin
`taxName`, el país ya no basta y el documento dice «IVA» aunque le pases `PE`.

---

## Dos desvíos que merecen constar

* **`quotes.routes.ts` (805 CR) y `quotesAdmin.routes.ts` (730 CR) estaban en CRLF en disco** —
  caso B de SCRUM-570. Rematerializados en LF con `censo-cr-en-disco --limpiar`
  (`Buffer.compare` contra el blob = 0, **cero cambios de contenido**) antes de tocarlos, porque el
  guard de SCRUM-533 mide el DISCO de los ficheros que la rama toca.
* 🔴 **`cat -A` me dijo que no había CR, y era mentira.** Mostró `$` y no `^M$`. Lo que lo destapó
  fue que una sustitución anclada a `\n` no casaba: al leer los bytes con node apareció el `\r\n`.
  Es literalmente la regla del bloque de seguridad —«NO midas fines de línea con `grep` en Git
  Bash»— y aquí la habría incumplido con `cat`.

## Adyacencia con S3 (SCRUM-636), comprobada y sin cruce

Su rama toca este mismo fichero: el `import` de `formatImporteEs`, el cuerpo de `fmtImporte` y el
`fmt` de la **factura**. Yo toco los rótulos del impuesto del **presupuesto**. **Regiones distintas,
líneas distintas: no me cruzo.** Al mergear las dos habrá que resolver `pdf.service.ts` a tres
bandas (623 + 636 + esto), pero ningún cambio pisa al otro.

---

## Lo que NO cubre

1. **No se construye el IGIC ni se resuelve el territorio** (SCRUM-646). Lo único que se hace es no
   cerrarle la puerta.
2. **`products.routes.ts:47` sigue estampando el tipo por país** — el hallazgo (B) del censo.
3. **`app.js:100` sigue siendo una segunda definición del locale** en el front.
4. **La factura no se toca**: quedó neutral en SCRUM-623.
5. **El desglose por tipo del presupuesto no cambia de forma**: sólo el rótulo del impuesto.

## Ficheros

* `src/modules/invoicing/infra/pdf/pdf.service.ts` — `taxName` en `generateQuotePdf`, resuelto una
  vez; los dos rótulos; y fuera `locale.vatName`.
* `src/modules/quotes/app/routes/quotes.routes.ts` · `src/modules/system/app/routes/quotesAdmin.routes.ts`
  — las tres llamadas pasan el impuesto, con la nota de que ahí es donde SCRUM-646 lo cambiará.
* `tests/scrum647-presupuesto-tambien-neutral.test.mjs` — **nuevo**, 7 tests.
* `tests/scrum604b-desglose-presupuesto.test.mjs` — el test del locale, reapuntado y ampliado.

## HALLAZGOS FUERA DE ALCANCE

* **`locale.defaultVat` tiene 10 apariciones y una escribe datos** (`products.routes.ts:47`).
* **`locale.vatName` se queda sin consumidores** tras esto: sólo definido, dos veces y en dos
  árboles (`core/i18n/locales.ts` y `public/dashboard/js/app.js:100`).
* Un tercer documento —el **albarán** (`albaranPdf.service`)— no se ha mirado en este ticket.
