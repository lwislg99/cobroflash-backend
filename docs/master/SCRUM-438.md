# SCRUM-438 · Fase 1 — Atestiguar el sobre mientras todavía verifica (+ propuesta de v:3, SIN construir)

**Fecha:** 11-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `ddfa8ac5` · **Paso 0:** ninguna rama con `438`/`atestig`.

> 🔴 **ESTA ENTREGA NO CONSTRUYE v:3.** No se ha tocado `computeAlbaranContentHash`, ni
> `obraSegunVersion`, ni las recetas congeladas, ni el camino de emisión (regla 38). La propuesta
> del §3 se aprueba **antes** de escribirse.
>
> **Y no se escribe NADA en ninguna base:** ni el sobre (regla 29), ni el albarán, ni `AuditLog`.

## 1 · Por qué esto corre prisa, y por qué con un sobre sí hay salida

SCRUM-431 midió que el sobre lee **cinco campos EN VIVO** al verificar. En producción hay **UN
SOLO sobre emitido, y es v:1** (cero v:2 — el camino de C5 no se ha ejercitado nunca contra datos
reales). Con doscientos esto no tendría arreglo barato; con uno, sí: **ejecutar la verificación
ahora, mientras cuadra, y dejar constancia fechada.**

⚠️ **Y caduca.** `Job.titulo` tiene escritor desde SCRUM-317 y `Job.direccion` desde SCRUM-424. En
cuanto uno de los cinco se toque, para ese albarán ya no se puede hacer.

## 2 · Lo construido

| Fichero | Qué |
| --- | --- |
| `src/modules/fiscal/evidencias/atestiguamiento.ts` | **nuevo** · el documento, puro, sin `prisma` |
| `scripts/atestiguar-sobres.mjs` | **nuevo** · CLI **de solo lectura** |
| `src/modules/fiscal/evidencias/paquete.ts` | la política, **dentro del ZIP** |
| `tests/scrum438-atestiguar.test.mjs` | **nuevo** · 7 tests |

### 🔴 Qué es el documento, y qué NO es — con esas palabras, dentro de él

El campo `queEsEsto` viaja **en el propio documento**, no en un README que se separa de él:

> *«VERIFICACIÓN FECHADA, NO UNA FIRMA. … NO es un sellado, NO equivale a haber sellado esos
> valores y NO añade ninguna garantía criptográfica que el sobre no tuviera ya.»*

Hay test de que ese texto está y de que **no insinúa lo contrario**. Si lo insinuara sería peor que
no tenerlo: convertiría una nota interna en una prueba que nadie puede sostener.

### Por qué la herramienta SÍ puede apuntar a producción

**Porque no escribe.** Un aplicador de SQL acotado a dev (SCRUM-425) y un lector que puede mirar
producción no son incoherentes: la diferencia es si toca algo. Y no es una promesa — el guard
**deriva** las llamadas a prisma del CLI y falla si aparece una que no sea de lectura (forma de
SCRUM-371), con su propio control en rojo.

> **Dónde NO se guarda, y por qué:** no en `AuditLog`. `AuditAction` es una unión **CERRADA** y
> ampliarla es **decisión del fundador** (regla 5, dicho por el guard de SCRUM-371). El producto es
> un documento; **propongo** guardarlo en `docs/legal/atestiguamientos/` —versionado, fechado y con
> historia de git— y, si prefieres el `AuditLog`, eso es una acción nueva que apruebas tú.

### Lo probado contra bases reales

| Base | Resultado |
| --- | --- |
| **dev** (`yaqu_dev_javier`) | **0 albaranes firmados** → 🔴 el suelo dispara y **no emite nada**: «nada que atestiguar» y «todo verificado» no son lo mismo. Sale con código **1** |
| **staging** (`railway`) | **1 firmado, y SIN sobre de evidencias** → se declara «NO SE PUDO MIRAR» y, al no poder atestiguar ninguno, sale con código **1** |
| **producción** | **NO la toco: no tengo la clave y así sigue.** El comando va abajo |

## 3 · 🔴 PROPUESTA DE v:3 — **para aprobar, NO escrita**

### Qué entra en el sobre

Los **cinco campos vivos** pasan a guardarse DENTRO de `evidenciaFirma`, y la receta v:3 los lee de
ahí y no de las tablas: `obra` · `referenciaTrabajo` · `cliente` · `emisor` · `emisorNif`.

Con eso, verificar deja de depender de que nadie corrija una razón social. **Es la única opción que
ataca la causa**; las demás tratan el síntoma.

### Cómo despacha `obraSegunVersion` y sus hermanos

Hoy `obraSegunVersion` es `if (version === 1) → jobDireccion; si no → lugarEntrega`. Propuesta:
**un despachador por versión con recetario explícito**, como ya tiene el verificador
(`RECETAS_POR_VERSION`), en vez de un `if` con rama por defecto.

### Y la versión desconocida — el defecto que ya medí

🔴 **Hoy `obraSegunVersion` cae EN SILENCIO a la rama de v:2** con cualquier versión que no sea
exactamente `1`: `3`, `99`, `null`, `NaN`. El verificador de SCRUM-369 sí acierta
(`version_no_soportada`, y se niega a aproximar); el sellador no.

**Propuesta: que lance.** Atenuante medido: `recomputarHashDeEvidencia` **no tiene ningún llamador**
fuera de su fichero, así que hoy es una **trampa cargada, no una herida abierta** — y es más barato
desarmarla antes de que v:3 la active.

### Coste y riesgo

| | |
| --- | --- |
| **Coste** | receta v:3 escrita **entera y aparte** (no se deduplica: es la regla del fichero) + su vector congelado + subir `ALBARAN_CONTENIDO_VERSION_ACTUAL` + el despachador |
| **Schema** | **ninguno**: los cinco caben en `evidenciaFirma`, que ya es `Json?` |
| **Riesgo alto** | toca el **sellado** → regla 38 → **STOP**. Un error aquí no se nota el día que se comete: aparece meses después como un «no coincide» sobre un documento intacto |
| **Lo que NO arregla** | **el pasado.** Los sobres v:1 y v:2 ya emitidos seguirán leyendo en vivo: sus recetas están congeladas y **no se tocan** (regla 29). Para ésos, lo que hay es el atestiguamiento del §2 y la política del §4 |

## 4 · La política de los sobres anteriores — **dentro del ZIP** (microcopy con marcador)

Va como `alcance-de-la-verificacion.txt` **dentro del paquete de evidencias**, no en un documento
aparte: un documento externo se separa del ZIP el primer día, y entonces quien lo recibe lee las
verificaciones sin el matiz que las acota.

**Se incluye SIEMPRE, cuadren o no.** Si solo saliera cuando algo falla, su presencia sería en sí
misma una señal de problema y quien prepara el paquete tendría un motivo para quitarla.

Declara los albaranes previos a v:3 de **«integridad parcial verificable»**: se demuestra que el
documento no ha cambiado, y **no** se demuestra por sí solo que los cinco datos sean los de la
fecha de la firma. Texto completo en `paquete.ts` (`POLITICA_SOBRES_ANTERIORES`), **con marcador —
lo apruebas tú (regla 30)**. Lo lee un asesor o un inspector, no un profesional.

## 5 · Verificación

| | Qué | Resultado |
| --- | --- | --- |
| **Control positivo** | atestigua un sobre de fixture que **cuadra de verdad**, y el registro reproduce la verificación (el hash se calcula con la **receta congelada**, no se escribe a mano: un literal probaría que dos constantes son iguales) | ✅ |
| **🔴 SUELO** | siete formas de no poder mirar —sin sobre, sin versión, versión no numérica, versión desconocida, sin hash— **lanzan**. Con control de que el sobre bueno sí pasa | ✅ |
| Distinción | un hash que **no cuadra** SÍ produce documento: eso sí se pudo mirar, y es un hallazgo que hay que fechar | ✅ |
| **🔴 Rojo por el mecanismo** | se cambia un campo vivo → **nombra cuál**, con su valor de antes y de ahora, y dice que el atestiguamiento es **ANTERIOR**. Los cinco, uno a uno | ✅ |
| Prueba de que no es cosmético | con el campo cambiado, el sobre **ya no verifica** — si eso saliera verde, sobraría toda esta tarea | ✅ |
| **Regla 29** | el CLI **solo lee**: métodos de prisma derivados, con control en rojo. Y el dominio **no importa `prisma`** ni toca `AuditLog` | ✅ |
| Anti-envejecimiento | los cinco campos se caran contra cómo los resuelve el adaptador: si el sobre leyera un sexto, esto se quedaría corto en silencio | ✅ |

### Tres guards ajenos que me cazaron, y qué cambié

1. **SCRUM-349 otra vez** (tercera hoy): el guard de «no escribe en AuditLog» cayó sobre **el
   comentario que explica la prohibición**. Arreglado con `soloEjecutable`, **sin borrar el
   comentario**.
2. **SCRUM-409**: mi fixture usaba `merchantId: 1`, el merchant demo. Cambié **el fixture**.
3. **SCRUM-297**: el manifiesto **sella todas las piezas** del ZIP y mi fichero entraba después.
   Movido **antes** de construir el manifiesto — ahora va sellado como las demás. Buen guard: sin
   él habría metido en el paquete una pieza que nadie podía comprobar.

## 6 · El comando para producción (lo ejecuta el fundador)

```bash
node scripts/atestiguar-sobres.mjs --clave DATABASE_URL --salida docs/legal/atestiguamientos/produccion-2026-08-11.json
```

**Solo lectura.** Imprime destino (`host/base`, sin la URL), la población, y el atestiguamiento de
cada sobre. **Códigos de salida:** `0` todo atestiguado · `2` hay sobres que no se pudieron mirar ·
`1` no se pudo atestiguar ninguno (o cero firmados).

**Qué esperar, con el dato de hoy:** 1 albarán firmado, sobre v:1. Si **cuadra**, el fichero de
salida es la evidencia congelada de ese sobre y debería entrar al repo por PR. Si **no cuadra**,
alguien ya tocó uno de los cinco campos y hay que decirlo — el documento lo registra igual, que es
para lo que sirve.

## 7 · Lo que no se ha tocado

El sellado · `computeAlbaranContentHash` · `obraSegunVersion` · las recetas congeladas · el
verificador · el camino de emisión · `prisma/schema.prisma` · `AuditAction` · ningún `.env` ·
**producción**.
