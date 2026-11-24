# SCRUM-1610 · un hijo sale con su código correcto y la salida CORTADA: rojos falsos en el obligatorio

## J6 · SCRUM-1610 · medición y propuesta (nada construido)

**Medido contra:** `origin/main` = `f94908a532b9768abbf9ea7bd395a401c10d3a3b` · 2026-10-26T22:29:13Z (hora de GitHub; sesión J6 `jv-j6cu`, por encargo del orquestador `cobroflash-backend-8b`. Detalle y tablas en Jira, SCRUM-1610 c.20951)

A9: aviso → A10 «Antes de llamar mecanismo a lo que has visto, di sobre cuántos elementos lo mediste: un instante no es un régimen.» — no se pudo comprobar: con tres cortes (162-186 líneas) leí una cota por escrituras y no por bytes; el cuarto y el quinto (173 y 219) ensancharon la banda y la dejé como hipótesis. Ningún instrumento separa una banda de n=3 de un régimen

Sólo docs y una sonda en `docs/master/evidencias/SCRUM-1610/`. Ningún cambio en `src/`, en un test ni en una aserción.

**Cinco cortes, en el log del intento 1** (logs de unos 2,2 MB, bajados con `--allow-escape-sequences`):

- #2889 · scrum765 · 16.841 B · 171 líneas.
- #2894 · 1516c · 18.359 B · 162 líneas.
- #2892 · 1516c · 11.845 B · 186 líneas.
- #2896 · 1516c · 19.876 B · 173 líneas.
- #2899 · 1516c · 14.216 B · 219 líneas.

En los cinco, el código de salida es el correcto: sólo falta la cola. Todos cortan al final de una línea. El mismo hijo sale completo al relanzar (#2892, run 40361196496, intento 2 en verde). Los dos hijos acaban con `console.log` por línea y `process.exit()` (`tests/_censo-frontera.mjs:550`, `scripts/meta-guard-mutaciones.mjs:1692`). Los lectores leen hasta `close`.

**Reproducción local con `sonda-salida-cortada.mjs`:** win32 10.0.26200 · node v24.18.0 · stdout del hijo `Pipe`. Hice cinco lotes de 62 pasadas: con tubería y con fichero, en paralelo 1 y 5, con el lector ocupado 0 y 300 ms, y hasta 216 KB de salida. Resultado: **0 cortadas de 300**. El positivo sembrado se cazó 10 de 10.

**El hijo real NO se corrió en bucle.** El meta-guard tarda 45 s por pasada, y el censo de frontera necesita un `dist/` que este árbol no tiene.

**Causa: SIN MEDIR en Linux**, porque aquí no hay WSL ni Docker y un workflow no es de este carril. La hipótesis es ésta: en Windows el stdout que va a una tubería es bloqueante, y en Linux no lo es. Así, en Linux, si el lector no drena a tiempo, `process.exit()` tira la cola. Queda sin explicar por qué se llena con menos de 64 KB.

**Propuesta ✅/❌:**

1. En el hijo, salir con el stdout ya vaciado (`process.stdout.write('', () => process.exit(c))`).
   - `_censo-frontera.mjs` → J6.
   - `meta-guard-mutaciones.mjs` → S3, va a Luis.
2. En el lector, exigir el centinela final antes de afirmar nada. Si falta, se relanza una vez y, si sigue faltando, cae como «CIEGO · salida cortada».
   - `scrum1516c` → J6.
   - `scrum765` → sin fila.
3. Medirlo en el runner, con un workflow (S5 o el fundador).

Suite entera local: NO CORRIDA.

## J6 · SCRUM-1610b · el hijo sale con stdout vaciado, y una salida cortada sale CIEGA (opciones 1 + 2, c.20952)

**Medido contra:** `origin/main` = `31d0bbae3ff7da9fafb76ffac0ec32a7fb856786` · 2026-10-26T23:00:35Z (hora de GitHub, cabecera `Date:`; sesión J6 `jv-j6cv`, por encargo del orquestador `cobroflash-backend-8b`. La rama lleva dentro el tramo de arriba, `22c8d232f`, que va en #2901 y aún no ha entrado)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

Mi error: probé mis tres mutaciones con un mutador propio, sin pasada base y con `NODE_TEST_CONTEXT` definido aunque vacío. Dijo MUDA a las tres con rc 0, cuando lo que pasaba es que el hijo no corría los tests. Lo cazó añadirle la pasada base, que tiene que dar 5 ✔: con ella salen las tres VIVAS. La comprobación de verdad es el meta-guard de la casa, que corre este catálogo en CI con su PUERTA 1. Segundo error, en la cicatriz de J6: mi primer corte sembrado no cortaba nada. Sobre la salida de 3 líneas del CIEGO por entorno, solo añadía una línea vacía detrás del centinela.

**① El hijo: `tests/_censo-frontera.mjs`** (sin fila en §3 de `dos-equipos.md`; lo hizo J6). Sus 8 salidas pasan por `fin(c)`, que fija `process.exitCode`, escribe `EXIT=c` y llama a `process.exit(c)` en el callback de ESA escritura. Es decir, sale cuando el centinela ya ha llegado al descriptor. Se espera a una promesa que nunca se resuelve, para que no siga corriendo el código de detrás: la salida por entorno corta antes de ejecutar manejadores que envían. No elegí `process.exitCode` sin `exit()` porque la app importada puede dejar asas vivas: el censo quedaría COLGADO, y además el flujo no se cortaría. `scripts/meta-guard-mutaciones.mjs` NO se toca: es S3 y va a Luis.

**② Los lectores exigen el centinela**, con `tests/_salida-entera.mjs`. Si el hijo acabó con código y le falta el centinela, se relanza UNA vez. Si vuelve a faltar, cae con «CIEGO · salida cortada: …». Cada corte deja en la salida del test cuántos hubo, en qué intento y cuántos B y líneas llegaron. Un hijo que no arrancó o que se mató por tiempo NO es un corte y no se relanza.
- `scrum1516c` (J6): el centinela es la última línea `EXIT=N`, con N igual al código. Se exige antes de leer nada, en las cinco corridas, también en las de `--sin-sembrar` y `--doble-sordo`.
- `scrum765` (sin fila en §3; cruce declarado en el commit): el centinela es su última línea, «MODO CENSO: NO se ha ejecutado ninguna mutación.». Si falta dos veces pero el bloque «frontera src/ ↔ dist/» llegó entero, no es un corte: es que la línea ya no se imprime, y cae la aserción de siempre. Ninguna aserción de lo que miden los censos se ha tocado (regla 41).

**③ Probado.** `tests/scrum1610b-salida-cortada-sale-ciega.test.mjs`, 5 de 5, con la sonda de jv-j6cu como hijo real:
- cortada ×2 → CIEGO;
- cortada solo en el primer intento → pasa y lo dice;
- completa → sin relanzar.

Tiene 3 mutaciones en su catálogo, las tres VIVAS. Además, contra el lector real de 1516c se sembró un corte quitando las 20 últimas líneas (`docs/master/evidencias/SCRUM-1610/1610b/`):
- cortado ×2 → las tres aserciones que leen caen con «CIEGO · salida cortada»;
- cortado solo en el primer intento → 4 de 4, con «cortes 1: intento 1 (13161 B / 204 líneas) → el relanzamiento llegó entero»;
- sin la exigencia → vuelve el rojo engañoso del 26-oct: «código 0 · población ¿?», «su línea de controles SEMBRADOS no dice true», «--doble-sordo salió 1 sin decir…».

Sin sembrar: 1516c da 4 de 4 con la población de c.20951 (rol 78 · RECORTA 44 · SIN-DOCUMENTO 17 · NO-LLEGO 14; comercio 192), y 765 da 7 de 7.

**Lo que NO está medido:** que `fin` evite el corte. En Windows no se reproduce (0 de 300, tramo de arriba), y medirlo en el runner pide un workflow (punto 3, S5 o el fundador). Si la hipótesis es mala, ② hace que el próximo corte se lea como CIEGO y no como un defecto del árbol. Banco local: `node_modules` enlazado al del checkout compartido (solo lectura, sin `generate`) y `dist/` con `tsc --noCheck`.

**Guards dirigidos:** 220 de 220 pasan, 0 saltados, en 23 ficheros: 1294, 237, 976, 824, 836, 419, 702, 700, 719, 1415, 267, 273, 1387, 1185, 411, 812, 850, 1610b, 1516c y 765. Antes me pararon dos, y los dos tenían razón:
- 700: el test nuevo traía un filtro de comentarios propio. Pasa a usar el de la casa.
- 719: ese filtro iba sin suelo y sin ficha de mudez. Pasa a usar `leerFuente` con su ancla, y la ficha se regenera con `npm run censo:mudez -- --escribir`.

Suite entera local: NO CORRIDA (orden del encargo). Hacen de tanda los guards dirigidos y el obligatorio de CI.

## S0 · SCRUM-1610c · la fila de carril de los tres ficheros de la tanda → J6

**Medido contra:** `origin/main` = `0fc4e30b8ff8c2ed2ed688fc16bb8d6f4e957cfb` · 2026-10-27T18:20:22Z (hora de GitHub, cabecera `Date:`; S0, por encargo del orquestador de Luis)
A9: comprobación → `tests/scrum1295-carriles.test.mjs`

**De dónde sale el dueño:** SCRUM-1610 c.21189 (27-oct-2026), decisión del fundador Javier por cuestionario de su
orquestador: «Son de J6: `tests/_salida-entera.mjs`; los dos ficheros de 1610b;
`tests/scrum765-la-puerta-y-el-suelo.test.mjs` […] La fila en `docs/equipo/dos-equipos.md` (§3) la pone S0,
dueña de la tabla, con esta cita». Leído en Jira antes de escribir la fila.

**«Los dos ficheros de 1610b», medidos y no supuestos:** el merge de 1610b (#2905, `b353c2ad4`) CREA en `tests/`
exactamente dos ficheros, `_salida-entera.mjs` y `scrum1610b-salida-cortada-sale-ciega.test.mjs` (los demás que
toca, como `_censo-frontera.mjs` o `scrum1516c`, ya existían y ya tenían fila en `:195`). La decisión nombra
`_salida-entera.mjs` dos veces, así que cubre tres ficheros: los mismos tres que 1480i dejó sin fila como pregunta.

**La fila:** `dos-equipos.md` §3.3:196, debajo de la de 1480i, y el generado regenerado una vez
(`.claude/carriles.json`, `.claude/rules/carril-j6.md`). `node scripts/carriles.mjs de` → los tres contestan J6
en `dos-equipos.md:196`. **Control negativo en la misma orden:** `docs/master/evidencias/SCRUM-1610/1610b/sembrar-corte.mjs`,
`docs/master/evidencias/SCRUM-1610/sonda-salida-cortada.mjs` (de J6, pero la decisión no las nombra),
`tests/_veredicto-mudez.json` y un `tests/_salida-entera-NOEXISTE.mjs` siguen «sin fila». `carriles.mjs comprobar`
→ IGUAL a la tabla (80 filas, 207 reglas), con exit 0.

**Consecuencia:** con fila, la cerradura (`.claude/hooks/carril.mjs`) deja de permitir que edite estos tres
ficheros quien no sea J6. `scrum765` lo editó 1610b como «cruce declarado» porque no tenía fila; ya no hace falta.

## S3 · SCRUM-1610d · el MODO CENSO del meta-guard sale cuando su centinela ya se ha escrito (pieza ① de c.20951 que c.21007 pone en la lista de Luis)

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-03T07:47:28Z

A9: comprobación → `tests/scrum1610d-meta-guard-censo-sale-vaciado.test.mjs`

Lo escribe S3 (equipo de Luis). `scripts/meta-guard-mutaciones.mjs` es de S3 (`carriles.mjs de` → S3, `dos-equipos.md:177`). Sólo esta pieza: el ticket lleva `equipo-javier` y `area-j6`, y la medida en el runner (punto 3, workflow) es de S5.

**Qué cambia.** En el bloque `if (soloCenso)`, `console.log(centinela)` seguido de `process.exit(0)` pasa a ser `await new Promise(() => process.stdout.write(centinela, () => process.exit(0)))`. Es el mismo contrato que `fin` en `tests/_censo-frontera.mjs` (1610b). El texto de la centinela no cambia, así que el lector de `scrum765` la sigue encontrando como última línea.

| control | resultado |
|---|---|
| rojo primero: el guard nuevo contra el meta-guard de `origin/main` | `tests 1 · fail 1` · «en el callback de la centinela: NO» |
| verde con el cambio | `pass 1` · «process.exit( 1 · en el callback de la centinela: sí» |
| la mutación declarada (vuelve la forma de antes), aplicada y restaurada byte a byte | cae |
| de punta a punta: `scrum765` (corre el meta-guard real con `--solo-censo`) + `scrum1610b` | `tests 12 · pass 12 · fail 0` |

**Lo que NO prueba.** Que esto evite el corte en el runner de Linux. En Windows la tubería es bloqueante y el corte no se reproduce (0 de 300, c.20951). Medirlo allí necesita un workflow (punto 3 de c.20952), que es de S5. **Tampoco cubre las otras 12 salidas del meta-guard** (13 `process.exit(` de código, medidas en el fuente sin comentarios): el encargo era la del MODO CENSO, la única cuya cola es la centinela que lee un test.

## J6 · SCRUM-1610e · medición de cierre: ¿ha vuelto el corte desde el 27-oct?

**Medido contra:** `origin/main` = `9067651f76c23ded05ae3b63be1385a3ba90170e` · 2026-11-24T07:45:48Z (hora de GitHub, cabecera `Date:`; sesión J6 `jv-j6fl`, por encargo del orquestador `cobroflash-backend-2d`. Sólo docs)

A9: comprobación → `tests/scrum1610b-salida-cortada-sale-ciega.test.mjs`

Mi error: la firma que di al subagente lector («cortes N: intento», «CIEGO · salida cortada») la imprime en TODOS los logs el autotest de 1610b, que siembra el corte a propósito. Sin excluir sus líneas («[cortada ×N]», «la sonda»), cada log habría salido como un corte. Lo cazó el propio escáner al ver 522 positivos sobre 523. La exclusión está en `escanear.mjs`. Que esas líneas lleguen a los 522 logs es también el positivo sembrado: prueba que una línea de rastro llega al log.

**① El mecanismo que sigue montado en main.** Estas piezas existen en `9067651f7`, y la tanda las corre como `tests/*.test.mjs`:
- **Hijo del censo de frontera.** `tests/_censo-frontera.mjs:48` define `fin`, que escribe `EXIT=c` y llama a `process.exit(c)` en el callback de esa escritura. El fichero tiene 8 `await fin(`.
- **Hijo del meta-guard, MODO CENSO.** `scripts/meta-guard-mutaciones.mjs:1881-1886`: la centinela sale con `process.stdout.write(…, () => process.exit(0))` (1610d).
- **Lector.** `tests/_salida-entera.mjs` exporta `sinCortar`/`sinCortarSync` (:33/:45), `rastroDeCortes` (:57) y `avisoDeCorte` (:64). Lo usan `scrum1516c` (:116-117) y `scrum765` (:270-271).
- **Guards de la propia pieza.** `tests/scrum1610b-salida-cortada-sale-ciega.test.mjs` y `tests/scrum1610d-meta-guard-censo-sale-vaciado.test.mjs`.

**② ¿Ha vuelto? Barrido de los logs del workflow CI** (id 321298878).
- Población: 1.280 runs creados desde el 25-oct. De ellos, 1.180 desde el 27-oct: 468 failure, 330 success, 376 cancelled y 7 en curso.
- Escaneado: los 650 logs de job en rojo de esos runs y el job de tests de los 330 verdes, todos sin muestreo. En total, 980 logs.
- 75 logs salieron CIEGOS por pesar menos de 100 KB. 74 son de jobs sin tests. El otro es un job de tests: run 44341511745, intento 1, de 58 KB.
- Quedan 523 logs de job de tests. En 522 corre 1516c.
- Control cero: «cortes 0:» aparece 0 veces.
- Control positivo: los tres jobs del 26-oct (121692797455 · 121706784273 · 121708898475) salen con su `test at tests/scrum765…`/`scrum1516c…`. El último además lleva «población ¿?» y «SEMBRADOS no dice true».

| tramo (por la hora del merge del arreglo) | logs de tests | cortes (rastro «cortes 1 … llegó entero») | cortes dobles (CIEGO real) |
|---|---|---|---|
| tras 1610b (2026-10-26T23:50:23Z) y antes de 1610d (2026-11-03T09:07:56Z) | 103 | **15**, todos de `[meta-guard --solo-censo]`, 17.134–21.352 B; **0 de 1516c** | 0 |
| tras 1610d, hasta 2026-11-24T06:36Z | 419 | **0** | 0 |

- **Firma vieja tras el 27-oct (rojo de 765/1516c):** aparece 2 veces, en los runs 45149192784 (23-nov) y 44336229482 (18-nov). Ninguna es un corte: el meta-guard dice «DECLARACIÓN(ES) QUE NO PUEDO EVALUAR», porque la rama declaraba una mutación que no es un literal.
- **Lectura:**
  - La salida cortada siguió ocurriendo en el runner de Linux mientras su hijo hacía `console.log` + `process.exit`: 15 de 103 logs, un 14,6 %.
  - Después de que ese hijo pasara a salir en el callback, ocurrió 0 veces en 419 logs. Con la tasa anterior, la probabilidad de 0 en 419 por azar es de 0,854^419 ≈ 10^-29.
  - El hijo de 1516c, que ya salía por `fin`, dio 0 cortes en los 522 logs.
  - Esto es, observada en el propio runner, la medición que el punto 3 de c.20952 pedía con un workflow.
  - Y el lector hizo su trabajo: los 15 cortes se relanzaron, quedaron rastreados y no produjeron ningún rojo falso.

**No medido:** los 376 runs cancelados; los jobs sin tests de los runs verdes; el log CIEGO de 58 KB. Tampoco medí el hueco del CI entre 2026-11-03T09:46Z y 2026-11-10T16:49Z, en el que hubo 0 runs de CI y 48 de otros workflows. Cae justo tras 1610d, así que el «después» empieza de verdad el 10-nov. La causa del corte (por qué se llena por debajo de 64 KB) sigue sin medir. Lo medido es que el arreglo lo quita.

**③ Veredicto propuesto: CERRAR** (lo decide el orquestador, A13). La parte que c.21007 dejaba abierta, medir en el runner, queda cubierta por la tabla de arriba, sin workflow nuevo. Frase de cierre: «La salida cortada no ha vuelto: 0 cortes en 419 logs de tests tras 1610d, frente a 15 en 103 antes; si vuelve, sale CIEGA y no como un rojo del test». Comprobaciones que quedan en pie: `tests/scrum1610b-salida-cortada-sale-ciega.test.mjs` y `tests/scrum1610d-meta-guard-censo-sale-vaciado.test.mjs`. Las otras salidas `process.exit(` del meta-guard siguen fuera de alcance, como dice 1610d, porque ningún lector exige su cola.

Evidencias: `docs/master/evidencias/SCRUM-1610/1610e/` (`escanear.mjs`, `resultado.tsv` con una fila por log, `cuenta.mjs` con el corte por tramos). Suite entera local: NO CORRIDA (tope de contexto del encargo); se corrieron sólo los guards de docs.