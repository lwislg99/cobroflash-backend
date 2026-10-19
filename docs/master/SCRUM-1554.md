# SCRUM-1554 · Puerta de go-live

## 19-oct-2026 · SCRUM-1554c · La puerta en un fichero, con un guard que no deja borrar renglones (A); el cierre en ejecución, sólo propuesto (B)

**Medido contra:** `origin/main` = `8ff423895024c7d2ce1c6bcb96054da11a227b90` (base de la rama) · 2026-10-19T07:26Z (hora real, cabecera
`Date:` de `gh api -i zen`). S5, equipo de Luis. El orquestador da OK a A y dice NO a construir B (mensaje
del 19-oct). El carril: el ticket es de `equipo-javier`, pero `docs/go-live/` es nuevo y el guard es nuestro.
El orquestador avisa a su equipo.

A9: comprobación → `tests/scrum1554c-puerta-de-go-live.test.mjs`

### ⚠️ Este fichero choca con el PR #2428 (SCRUM-1554b, equipo de Javier)
#2428 también CREA `docs/master/SCRUM-1554.md`. Lleva abierto desde el 14-oct, con `build + tests` en rojo,
y nadie lo ha tocado desde entonces. **Quien entre segundo resuelve el conflicto juntando las dos
secciones**, sin borrar ninguna. 1554b y 1554c no se solapan en contenido:

| | SCRUM-1554b (Javier, #2428) | SCRUM-1554c (esto) |
|---|---|---|
| Qué es | Clasifica los **57 tickets de Jira** que «esperan al fundador», por tipo de decisión | La **lista de entradas** de la puerta, en un fichero, y un guard sobre ella |
| Toca | Sólo este registro y `docs/master/evidencias/SCRUM-1554b/` | `docs/go-live/puerta.json`, `scripts/go-live/puerta.mjs` y su test |
| Relación con la puerta | Cuenta 3 tickets aparcados en ella (1502, 1551, 1554) | Recoge sus entradas (1–23) |

### Lo medido antes de construir (y cambia lo que se puede prometer)
- **`INVOICING_ES_ENABLED` se enciende por la VARIABLE DE ENTORNO de Railway o por `merchants.flags` en la BD,
  a mano** (`src/core/flags.ts`: merchant > país > env > default). **Ninguno de los dos caminos pasa por la CI.**
  Por eso un guard de CI **no puede impedir** que se encienda: como mucho avisa. El requisito 1 de
  c.19645 («que impida, no que avise») no se puede cumplir desde la CI. Sólo se cumple en ejecución (B).
- **La lista no vivía en ningún fichero.** Estaba en el cuerpo del ticket (filas 1–8) y en sus comentarios
  (9, 10, 11–15). c.19645 nombra otros seis grupos «movidos» sin redactarlos, y **dos entradas sólo constaban
  en registros ajenos**: `SCRUM-1183.md:66` (el botón de exportar sin año) y `SCRUM-1558.md:29`
  (`sendInvoiceEmail` dice `ok` sin enviar; el registro dice «el orquestador lo apunta en la puerta», pero
  en el ticket NO consta). Así que el requisito 2 (autocontenido) tampoco se cumplía.

### A · Lo que entra
1. **`docs/go-live/puerta.json`**: 23 entradas, cada una con `numero`, `que`, `de_donde` y `consta_en`
   (dónde se escribió), y `condicion` cuando la fuente la da. **22 abiertas y 1 cerrada**: la 4, el P1 con
   asteriscos, por PR #2425 (`cd99c713994f`, ancestro de main, comprobado), con su motivo de c.19593/19594.
   Las 18 y 19 dicen «no lo dice el comentario» en `de_donde`: c.19645 no da el ticket de origen. No me lo
   invento.
2. **`scripts/go-live/puerta.mjs`**: `juzgarPuerta`, `leerPuerta` y `recuento`, y línea de órdenes:
   **0** = ninguna abierta · **1** = hay abiertas · **2** = NO PUDE LEER (nunca 0 por no poder leer).
   Hoy: `PUERTA DE GO-LIVE · 22 abierta(s) de 23 · cerradas: 4`, salida 1.
3. **El guard**, que corre en la tanda (`build + tests`, el obligatorio). Declara `TOTAL = 23` y
   `CERRADAS = [4]`, y cae **en los dos sentidos**:
   - una entrada que **desaparece**, aunque se renumere el resto → rojo («una entrada NUNCA se borra»);
   - una entrada **cerrada sin** `{por, motivo, sha, fecha}`, o con un sha que no se puede buscar → rojo;
   - una entrada **nueva**, o una **cerrada que el guard no declara**, o una **reabierta** → rojo, hasta que
     el mismo cambio suba `TOTAL` o toque `CERRADAS`. **Así el diff dice cuál salió** (requisito 3), y su
     motivo queda en la lista.

### Comprobado
| corrida | resultado |
|---|---|
| test nuevo | **14/14** |
| test nuevo + 1349 + 1415 + 824 + 723 | **46/46** |
| **mutantes sobre la lista DE VERDAD** (cambio y `git restore`; árbol limpio al acabar) | **borrar la 23 → cae**, con «faltan 1 entrada(s) (23)…» · **cerrar la 1 sin `cerrada`** → cae, con «cerrada sin {por, motivo, sha, fecha}» y «el guard no lo declara» |
| los 163 ficheros de test que barren `scripts/` o `tests/`, CONTRA LA BASE (la misma tanda en `8ff423895` sin el cambio) | base 85 caídos, rama 87. **Los 2 de más eran míos: `SCRUM-1349`.** Mi `spawnSync` dejaba pasar `FORCE_COLOR`; arreglado donde nace. Los 85 de la base son los de siempre en un árbol sin `dist/` (`scrum1398`, `scrum1262`…) |

### B · El cierre en ejecución: SÓLO PROPUESTA. NO construido
**Por qué no se construye:** cambiar `isFlagEnabled` es tocar un flag de la Parte P a nivel global, y eso es
un STOP del CLAUDE.md. **Lo lleva el orquestador al fundador con la pregunta sola, y nadie lo construye
hasta que haya una cita suya.**

**El diseño** (en `src/core/flags.ts`, dentro de `isFlagEnabled`, justo antes de devolver):
```ts
// SCRUM-1554 · LA PUERTA DE GO-LIVE: INVOICING_ES_ENABLED no se enciende con entradas abiertas.
// Fail-closed: si la lista no se puede leer o no tiene su forma, cuenta como CERRADA la puerta (OFF).
function puertaDeGoLiveLibre(): boolean {
  if (cachePuerta !== undefined) return cachePuerta;
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs', 'go-live', 'puerta.json'), 'utf8'));
    cachePuerta = Array.isArray(doc.entradas)
      && doc.entradas.length > 0
      && doc.entradas.every((e: any) => e && e.estado === 'cerrada');
  } catch { cachePuerta = false; }
  return cachePuerta;
}
// …y al final de isFlagEnabled, para este flag y sólo cuando el resultado sería true:
//   if (flag === 'INVOICING_ES_ENABLED' && resultado && !puertaDeGoLiveLibre()) return false;
```
- **`docs/` viaja al despliegue**: `legalPages.routes.ts:13` ya lee `path.join(process.cwd(), 'docs', 'legal')`
  en producción. La lista sólo cambia con un despliegue, así que se lee **una vez por proceso**.
- **Cierra los dos caminos a la vez** (env de Railway y `merchants.flags`), porque los dos pasan por
  `isFlagEnabled`. Y no toca el camino de emisión: lo que cambia es la respuesta del interruptor.

**🔴 Lo que hay que decidir ANTES de construirlo, medido:**
1. **33 ficheros de `tests/` encienden `INVOICING_ES_ENABLED`** (por env o por override) y esperan que
   emita. Con B tal cual, con 22 abiertas, **caen todos**. Hace falta una salida para los tests que **no sea
   un agujero en producción**. Una variable de entorno que salte la puerta es justo el camino que Railway
   puede poner. Opciones, sin elegir: (a) la puerta sólo rige con `NODE_ENV=production` (⚠️ staging
   también lo tiene, según SCRUM-1558, y el de producción no lo he medido); (b) los tests inyectan la
   lista por un parámetro de `FlagContext` que en producción nadie rellena.
2. **Si alguna cuenta tiene hoy el flag encendido** por `merchants.flags` (la demo, por ejemplo), **B se lo
   apaga al desplegar**. No lo puedo medir: ningún árbol tiene credenciales de producción (SCRUM-418).
   ⚠️ **Eximir a las cuentas de prueba es el agujero**: no se propone.
3. **El ratón y el gato del guard**: una entrada cerrada sin arreglar de verdad pasa el guard igual. B no lo
   arregla; lo que lo sujeta es que el cierre lleve `por`, `motivo` y `sha`, y que el diff lo vea un humano.

**🔢 La cifra de los 33, medida después (19-oct, sólo lectura, sobre `8ff423895`).** La pidió el orquestador
para que el fundador no decida B a ciegas:

| cómo encienden el flag | ficheros |
|---|---|
| **`merchant.flags = { INVOICING_ES_ENABLED: true }`** en un objeto que el test pasa a funciones de dominio (`getEmissionMode`, `allocateInvoiceNumber`, `modoDocumentoSuelto`…), o en un Prisma falso o en el banco desechable | **31** (incluidos `_banco-emision-con-estado.mjs`, `scrum974` con su `ENCENDIDA` y `scrum1097`, que es un guard que mide comercios encendidos) |
| **`process.env.INVOICING_ES_ENABLED = 'true'`** | **2** (`emission.test.mjs`, `flags.test.mjs`; el segundo prueba además el override) |
| sustituyen `isFlagEnabled` o su módulo | **0** |

Lo que eso dice de las dos salidas para los tests:
- **(a) la puerta sólo rige con `NODE_ENV=production`**: no toca ninguno de los 33, porque ninguno pone
  `NODE_ENV=production`. ⚠️ Sigue sin medir qué `NODE_ENV` tienen staging y producción.
- **(b) inyectar la lista por `FlagContext`**: 31 de los 33 NO llaman a `isFlagEnabled`: llegan a él a través
  del dominio. Habría que pasar el parámetro por cada función, y eso es mucho más invasivo de lo que parecía.
  Una variante menos invasiva es un interruptor en memoria exportado por `flags.ts` que sólo llaman los tests.
  No se puede poner desde Railway, pero sí desde cualquier código del proceso. Tampoco se elige aquí.

**Dos cosas que YA existen y cambian la pregunta:**
- **`scripts/guard-acreditacion-invoicing-es.mjs` (SCRUM-1097)** es de sólo lectura (lo verifica por AST) y
  contesta la duda 2: si hay hoy algún comercio ES, que no sea la demo, con el override encendido o con alguna
  factura fiscal emitida. **El fundador puede correrlo contra producción antes de decidir B**, sin escribir
  nada nuevo. Dice en su cabecera que no ve la variable de entorno; para eso tiene su brazo (b): ¿se ha emitido
  algo fiscal?
- **Ese guard EXCLUYE A LA DEMO (id=1) a propósito, por la regla 8.** B, tal como está escrita arriba, le
  apagaría la facturación a la demo si tiene el override encendido. Si la regla 8 la deja fuera de la puerta,
  eso lo decide el fundador. Una excepción por id fijo no es el agujero de «eximir cuentas de prueba» (no
  depende de ningún dato que se pueda poner desde fuera), pero tampoco lo propongo yo.
- **`scripts/cambiar-flag-fiscal.mjs`** es, según SCRUM-1097/1099, **la única vía humana y deliberada** de
  encender el override por comercio. Que ese guion se niegue con entradas abiertas cerraría UNO de los dos
  caminos sin tocar `flags.ts` (la variable de Railway seguiría abierta). Se nombra; no se propone ni se ha
  leído entero.

### Lo que NO hace
- **No impide encender el interruptor.** Hasta que exista B, esto es una lista vigilada, no una puerta.
  **La fila c3-17 de la página del fundador NO se cierra con A**: queda a medias, y la cierra B.
- **No está completa.** Recoge lo que consta escrito en el ticket y en los registros de `main` que mandan
  algo a esta puerta (`git grep` de «puerta de go-live» y «SCRUM-1554» en `docs src public tests scripts`).
  Lo que se aparcó sólo de palabra, o en Jira de otro ticket sin registro, no está.
- **No lee Jira.** Una entrada nueva hay que escribirla en el fichero. Si sólo se escribe en el ticket, el
  guard no la ve.
- No he redactado las seis que c.19645 sólo nombra (16–21): llevan el nombre que les dio el comentario.
