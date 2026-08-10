# SCRUM-438 · Fase 1 — Atestiguar el sobre mientras todavía verifica (+ propuesta de v:3, SIN construir)

**Fecha:** 11-ago-2026 · **Carril:** fiscal/evidencias · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `6cd4cffac1c3291da0caad6a3a4a10cc5c4a45c2` · 2026-08-10T19:08:12+02:00

**Paso 0:** ninguna rama remota con `438` ni `atestig`.

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
| `tests/scrum438-atestiguar.test.mjs` | **nuevo** · 11 tests |

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

> **Dónde NO se guarda:** no en `AuditLog` — ver §2 bis ①, ya decidido.

### Lo probado contra bases reales

| Base | Resultado |
| --- | --- |
| **dev** (`yaqu_dev_javier`) | **0 albaranes firmados** → 🔴 el suelo dispara y **no emite nada**: «nada que atestiguar» y «todo verificado» no son lo mismo. Sale con código **1** |
| **staging** (`railway`) | **1 firmado, y SIN sobre de evidencias** → se declara «NO SE PUDO MIRAR» y, al no poder atestiguar ninguno, sale con código **1** |
| **producción** | **NO la toco: no tengo la clave y así sigue.** El comando va abajo |

## 2 bis · Las dos decisiones del asesor (11-ago-2026), aplicadas

**① El atestiguamiento vive en `docs/legal/atestiguamientos/`.** Y el motivo de fondo no es solo
no ampliar `AuditAction`: **el AuditLog se escribe en 10 sitios y no se lee en ninguno**. Meter un
documento legal en un registro que nadie abre es guardarlo donde no se va a mirar. Un fichero
versionado tiene tres cosas que el AuditLog no tiene: **historia inmutable, revisión por PR antes
de entrar, y alguien que lo lee para aprobarlo.** Queda escrito en el `--help` del script.

**③ La política va SIEMPRE dentro del ZIP — es regla desde hoy**, con su motivo:

> *«Si solo saliera cuando algo falla, su presencia sería la señal, y habría motivo para quitarla.
> Un documento que solo aparece con malas noticias se convierte en la mala noticia.»*

Hay test que construye el paquete en los dos extremos —sin hallazgos y con un hallazgo— y exige la
pieza en los dos.

---

## 3 · 🔴 PROPUESTA DE v:3 — **para aprobar LÍNEA A LÍNEA. No hay una sola línea de código escrita**

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

### Las líneas que habría que escribir, una a una

**① `FirmaEvidencia` gana un bloque `contenidoCongelado`** — dentro de `evidenciaFirma`, que ya es
`Json?`: **cero schema**. Opcional en el tipo, porque los v:1 y v:2 no lo tienen y **no se rellena
a posteriori jamás** (mismo criterio que `firmadoPorNombre` en C5).

```ts
contenidoCongelado?: {
  obra: string | null;
  referenciaTrabajo: string | null;
  cliente: string | null;
  emisor: string | null;
  emisorNif: string | null;
};
```

**② `recetaV3`, escrita ENTERA y aparte**, con sus claves en su orden — no se deriva de v:2 ni se
comparte un helper: es la regla escrita del propio fichero (`JSON.stringify` serializa por orden de
inserción, y un helper compartido ataría el orden de una versión al de otra). El delta con v:2 es
que los cinco salen de `contenidoCongelado` y no de las fuentes vivas.

**③ `ALBARAN_CONTENIDO_VERSION_ACTUAL = 3`** y `RECETAS_POR_VERSION` gana su `3: recetaV3`. El
guard de SCRUM-369 ya exige que toda versión que el sellador construya tenga receta en el
verificador: **se pondría rojo hasta que las dos existan**, que es lo que se quiere.

**④ `buildFirmaEvidencia` guarda los cinco al sellar** — resolviéndolos donde ya los resuelve hoy,
sin consulta nueva. Es **la única línea que toca el camino de sellado**, y es el STOP.

**⑤ 🔴 `obraSegunVersion` LANZA ante una versión que no conoce** — *aprobado por el asesor desde
ya*. Hoy es `if (version === 1) → jobDireccion; si no → lugarEntrega`, así que `3`, `99`, `null` y
`NaN` caen **en silencio** a la rama de v:2.

> *«Un despachador que elige una rama para una versión que no reconoce está adivinando, y hoy
> acierta solo porque nadie lo llama.»*

Y ese «nadie lo llama» está medido: `recomputarHashDeEvidencia` **no tiene llamadores** fuera de su
fichero. Es una **trampa cargada, no una herida abierta** — y v:3 sería justo lo que la activa,
porque estrena una versión que la rama por defecto interpretaría mal.

**⑥ Vector congelado de v:3** en el banco de SCRUM-369, junto a los de v:1 y v:2, para que el
sellador y el verificador sigan siendo **dos testigos independientes**.

### Lo que NO entra en v:3, y conviene decirlo

* **No se migra ningún sobre.** Ni v:1 ni v:2 se recalculan, se rellenan ni se «arreglan»: lo
  firmado no se toca ni siquiera para mejorarlo (regla 29).
* **No se retiran las recetas viejas.** Un verificador que dejara de saber recalcular v:1
  declararía no verificable el único sobre que hay en producción.
* **No se tocan los cinco campos de origen** ni se les pone candado: **decisión ya tomada** —
  prohibir corregir la razón social de un cliente es como se desactiva un sello.

### Coste y riesgo

| | |
| --- | --- |
| **Coste** | receta v:3 escrita **entera y aparte** (no se deduplica: es la regla del fichero) + su vector congelado + subir `ALBARAN_CONTENIDO_VERSION_ACTUAL` + el despachador |
| **Schema** | **ninguno**: los cinco caben en `evidenciaFirma`, que ya es `Json?` |
| **Riesgo alto** | toca el **sellado** → regla 38 → **STOP**. Un error aquí no se nota el día que se comete: aparece meses después como un «no coincide» sobre un documento intacto |
| **Lo que NO arregla** | **el pasado.** Los sobres v:1 y v:2 ya emitidos seguirán leyendo en vivo: sus recetas están congeladas y **no se tocan** (regla 29). Para ésos, lo que hay es el atestiguamiento del §2 y la política del §4 |

## 4 · La política, dentro del ZIP — ✅ **texto APROBADO** (asesor, 11-ago-2026)

Va como `alcance-de-la-verificacion.txt` **dentro del paquete**, y **siempre** (§2 bis ③). El texto
está **fijado entero** en `paquete.ts` (`POLITICA_SOBRES_ANTERIORES`): reformularlo es cambio de
máster, no una mejora de redacción.

**Y lleva la misma segunda capa que el 409 de SCRUM-358**: un invariante aparte que impide que el
texto vuelva a insinuar que esto es una firma —prohíbe «certifica», «garantiza la autenticidad»,
«validez legal»…— y que exige que siga diciendo **«integridad parcial verificable»** y **«lo que no
viaja, no»**.

Las dos capas, probadas en rojo por separado:

| Mutación | Cae diciendo |
| --- | --- |
| se reformula el texto | *«no es el aprobado por el asesor el 11-ago-2026 … reformularlo es cambio de máster»* |
| se reformula **y se actualiza el test exacto a juego** —lo que haría alguien «arreglándolo»— | *«el alcance dice “certifica”: eso INSINÚA que este paquete firma o certifica algo, y no lo hace»* |

> **Nota de método, otra vez:** el primer intento de la segunda mutación **no tocó el test** (mal
> escapado en el shell) y el rojo salió por la capa equivocada. Rehecha con post-condición que
> exige que **los dos ficheros** hayan cambiado. Es la misma lección de ayer: ante un rojo o un
> verde que no encaja, el primer sospechoso es la mutación.

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
