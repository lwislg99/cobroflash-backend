# SCRUM-1065 · Modelo 130 (pago fraccionado de IRPF) — BLOQUEADO, motivo medido

**Medido contra:** `origin/main` = `e2f715939d0e27ca2661821e1b57292d4ec1c3cc` · 2026-09-22T08:57:39Z
**Rama:** `scrum-1063-lote-contabilidad-modelos` · **Puesto:** J1 · **Encargo:** orquestador, 22-sep-2026

## PASO 0 — lo que ya existe

El 130 no existe como módulo: solo dos comentarios en `retencionIrpf.ts:110,129` (confirmado
leyendo el fichero), que son notas de diseño sobre el redondeo y el signo, no un cálculo del 130.
`src/modules/invoicing/domain/retencionIrpf.ts` sí calcula la retención **sufrida**
(`calcularRetencion`, `bloqueRetencion`) que este ticket necesitaría restar — esa pieza SÍ está
construida y reutilizable el día que el ticket se desbloquee.

## Por qué no se puede construir hoy — medido, no supuesto

La aceptación (punto 1) exige **«descargar y citar literalmente la orden [del 130/131] y responder
Q-C8»** antes de nada. Medido igual que en SCRUM-1063: SCRUM-1039 sigue «Tareas por hacer» sin
commit ni rama, y Q-C8 sigue sin respuesta en `docs/producto/CONTABILIDAD.md:86` — el propio
Q-C8 nombra expresamente «130/131» entre los modelos pendientes de plazo.

Hay una segunda dependencia propia del ticket, «Resumen del trimestre» (SCRUM-1048): también en
Jira «Tareas por hacer», sin construir.

El punto 5 de la aceptación ("gastos: solo los que el asesor confirme como deducibles") es otra
cita pendiente del mismo Q-C8/asesor: no hay lista de gastos deducibles verificada en el
repositorio hoy.

## Siguiente paso exacto

Ninguno para J1 hasta SCRUM-1039 + Q-C8, y hasta que SCRUM-1048 (el resumen del trimestre) tenga
su propio cálculo. El bloque reutilizable (`retencionIrpf.ts`) no necesita cambios cuando llegue
ese momento.

## STOP respetado

No se ha tocado `retencionIrpf.ts` ni ningún camino de emisión. Solo lectura y este documento.

---

# SCRUM-1065b · El borrador del 130, sin pantalla

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:15:59Z
**Rama:** `scrum-1065b-borrador-130` · **Puesto:** J1 (sesión `jv-j1be`) · **Encargo:** orquestador `cobroflash-backend-95`, 24-oct-2026 · **Desbloqueo:** D2 (SCRUM-1066 c.16699) y la 02 (SCRUM-1065 c.20721)

A9: aviso → A10 «Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.» — no se pudo comprobar: mi conductor de mutación pasaba `NODE_TEST_CONTEXT` vacío en vez de quitarlo y su base salió 0 pass · 0 fail; lo paró su propia comprobación de base, y ese conductor es temporal y está fuera del árbol, porque la red de la casa no filtra por fichero

## PASO 0

- `git log origin/main -i --grep=SCRUM-1065`: 0 commits. `ls-remote`: 0 ramas `scrum-1065*` (control positivo: 176 cabezas, `scrum-1016e-…` sí sale). PR: sólo #1656, que midió.
- `src/`: ningún cálculo del 130. Las dos menciones de `retencionIrpf.ts` son notas de diseño.
- Lo que desbloquea: D2 nombra el 130 («130/111/115/347 … borrador pre-rellenado para el asesor» → SÍ). Q-C8 tiene la respuesta del asesor (IA, sin revisión profesional, `PREGUNTAS_ASESOR.md`): 130 «siempre (estimación directa)», 131 «NUNCA».

## Qué se ha hecho (carril J1: `src/modules/fiscal/**`)

| fichero | qué |
|---|---|
| `src/modules/fiscal/modelo130/modelo130.ts` | las casillas 01-07 con su cita, `rangoAcumulado` y `construirBorrador130` (pura) |
| `src/modules/fiscal/modelo130/modelo130.repo.ts` | `leerBorrador130`: los MISMOS lectores de libro que el 303, del 1 de enero al fin del trimestre |
| `tests/scrum1065b-borrador-130.test.mjs` | 9 casos con cifras a mano y `MUTACIONES_QUE_ME_TUMBAN` (10) |
| `docs/master/evidencias/scrum1065/casillas-130.md` | la transcripción del impreso y los literales del art. 110 RIRPF |
| `scripts/_sin-consumir-declarados.json` | las 2 piezas sin consumidor, como J1 y con motivo (SCRUM-1185): sin ruta a propósito |

Sin ruta, sin pantalla, sin texto nuevo que vea el usuario, sin esquema y sin tocar la emisión. El aviso es el
`AVISO_ORIENTATIVO` del 303, importado. Los motivos van como códigos.

## Casillas: de dónde salen

El Anexo I de la Orden EHA/672/2007 lo SUSTITUYÓ la Orden HAP/258/2015 (art. único.3, desde el 1T-2015): el
consolidado enlaza su imagen (`01656_4793.png`). Leída a mano, transcrita en la evidencia. La fórmula es el
art. 110 RIRPF del consolidado (redacción en vigor desde el 23-dic-2018). ⚠️ **NO comprobado** que sea el
formulario electrónico de hoy: el BOE no registra otra sustitución. Va al asesor.

## Qué casillas sí y cuáles no

| casilla | valor | por qué |
|---|---|---|
| 01 | **sí** | Σ base imponible del libro de emitidas, acumulada. Devengo por emisión, como el 303, y SIN el criterio de caja del merchant (es del IVA) |
| 02 | `null` · `gastos_deducibles_sin_confirmar` | aceptación punto 5 y fundador, c.20721 «Sin dato, y la hipótesis aparte» |
| 03 · 04 · 07 | `null` · `depende_de_una_casilla_sin_dato` | dependen de la 02 (y la 07, de la 06) |
| 05 | T1: **0** · T2-T4: `null` · `pagos_anteriores_sin_dato` | en el T1 la suma de trimestres anteriores es vacía; después sale de las 07 anteriores |
| 06 | `null` · `retenciones_soportadas_sin_dato` | `Invoice` no guarda la retención (SCRUM-1048, 1053). Y el art. 110.3.a sólo la deja restar a actividades profesionales: un oficio es empresarial (Q-C8) |
| 08-19 | fuera | secciones II y III; también 110.2 (Ceuta/Melilla) y 110.4 (porcentaje mayor voluntario). Se declaran en `fueraDePoblacion` |

**El 20 %, como hipótesis y no como casilla:** `hipotesisTodosLosGastosAnotados` da gastos anotados, rendimiento
y el 20 % si fuese positivo. Lo que no entra se dice con su dinero: facturas ilegibles, facturas sin número y
gastos sin base.

## Aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| 1. Solo tras descargar y citar literalmente la orden y responder Q-C8. | `docs/master/evidencias/scrum1065/casillas-130.md` · las `cita` de `modelo130.ts`. Q-C8: respuesta de IA sin revisión profesional (SCRUM-1261), no confirmada por un asesor |
| 2. Borrador con las cifras de SU base del trimestre y del acumulado del año, con la casilla de la orden en cada importe. | `tests/scrum1065b-borrador-130.test.mjs` («cifras a mano: un año con tres trimestres»). El impreso sólo pide el ACUMULADO; el trimestre suelto no es casilla y no se da |
| 3. Marca «borrador para tu asesor»; nada se presenta ni se dice que se pueda presentar (regla 7). | `avisoObligatorio` (el del 303, con `[PENDIENTE microcopy oficial]`) → NO HECHO como texto de pantalla: pide firma (regla 39) |
| 4. Las retenciones sufridas … si aún no está, se avisa «no incluido». | la 06 sale `null` con `retenciones_soportadas_sin_dato` (test «lo que no se sabe no sale a cero»). SCRUM-1053 sigue sin construir |
| 5. Gastos: solo los que el asesor confirme como deducibles; los demás no se cuentan. | la 02 sale `null` (mismo test); la lista es del asesor (SCRUM-1264) |
| 6. Documentos emitidos y libros intactos. | test «regla 2 y solo lectura»: sólo `findMany`, todas con `merchantId`. El diff no toca `src/modules/invoicing/` ni `prisma/` |
| Tests: 3 trimestres, acumulado, sin doble conteo · pérdidas · emitidas intactas | los casos del mismo nombre en el test |
| Tests: `npm test` completo en verde | NO CORRIDO en local (10 sesiones en la máquina): lo juzga el obligatorio |
| Casos límite: primer trimestre · pérdidas · gastos sin base · cambio de año | casos del test. **Inicio de actividad**: sin tratamiento propio; el acumulado empieza el 1 de enero igual. No probado aparte |
| en yaqu.app | NO HECHO: no hay pantalla |

## Lo que se corrió, con su población

- Test nuevo: **9 de 9**.
- Mutación, con un conductor temporal fuera del árbol que lee `MUTACIONES_QUE_ME_TUMBAN`, muta `src/`,
  recompila con `tsc --noCheck` y restaura: **base sin mutar 9/9 · 10 VIVAS (cada una tumba el caso que
  declara) · 0 mudas · 0 ciegas · sembrada (un comentario) MUDA**. Después, `src/` comprobado por contenido.
- `tsc --noEmit` del proyecto: exit 0, 0 errores.
- Guards de suite y de registro: en la entrega (comentario de Jira), con su población.

---

# SCRUM-1065c · La marca firmada «Borrador para tu asesor» en los seis borradores

**Medido contra:** `origin/main` = `c6d3aa11f15a0a582f92b8ec4a8c9838ea426dd8` · 2026-10-24T15:37:28Z
**Rama:** `scrum-1065c-marca-borrador` · **Puesto:** J1 (sesión `jv-j1bv`) · **Encargo:** orquestador `cobroflash-backend-95`, 24-oct-2026 · **Firma:** SCRUM-1065 c.20813 y c.20820 (literal de SCRUM-1064 c.20780, T2)

A9: sin fallo que generalice — mi patrón de asignaciones casó también con la declaración del tipo (`avisoObligatorio: string;`); lo cazó el propio test en rojo en la primera pasada, antes de empujar, y la mutación sobre `retencionesPracticadas.ts` comprueba que el patrón corregido sigue viendo una asignación distinta

## PASO 0

* `git log origin/main -i --grep=1065c`: 0 · `ls-remote 'refs/heads/scrum-1065*'`: vacío · `gh pr list --state all --search 1065c`: vacío.
* El encargo hablaba de «cuatro» avisos. El barrido dio **1**: la constante `AVISO_ORIENTATIVO` de `modelo303.ts`, que importan el 130, el 347, el 390 **y el 111/115** (`retencionesPracticadas.ts`). Paré (c.20818) porque c.20813 no nombraba el 111/115; el fundador lo amplió en c.20820.

## Qué se ha hecho (carril J1, más el censo y los tests que fijaban el texto)

* `modelo303.ts`: la constante pasa a ser el literal firmado. Ningún otro texto cambia; los módulos que la importan no se tocan.
* `scripts/_marcadores-pendientes-declarados.json`: sale la entrada de `modelo303.ts` (lo exige el caso «y si BAJA, se aprieta» de `scrum667`). El censo baja, no se ensancha. Fichero de `scripts/` sin fila de dueño: se toca porque el test lo exige en el mismo commit.
* `tests/scrum667-marcador-visible.test.mjs`: el comentario de historia de esa entrada.
* Fijaban el texto viejo y ahora fijan el literal: `scrum295` (303), `scrum1067b` (347), `scrum1077` (390); `scrum1065b` (130) pedía sólo `/asesor/` y ahora pide el literal.
* Nuevo: `tests/scrum1065c-marca-borrador.test.mjs` — el literal; que los cinco módulos cablean `avisoObligatorio` a la constante y ninguno trae texto propio; cero marcadores de microcopy pendiente en las cinco carpetas, con su población y un positivo SEMBRADO en un árbol desechable (con el marcador lo ve; sin él, cero sobre 1 fichero).
* Registro de la firma: `docs/microcopy/2026-10-24-SCRUM-1065-marca-borrador.md`.

## Lo que se corrió, con su población

* Dirigida (`dist/` con `tsc --noCheck`): 1065c, 1065b, 295, 667, 1063b, 1063c, 1066c, 1066e, 1067b, 1077 — **10 ficheros · 100 tests · 100 pass · 0 fail · 0 skipped**. La primera pasada dio 99/1: el fallo era de mi patrón (arriba).
* Mutación con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` sobre `MUTACIONES_QUE_ME_TUMBAN`: base 4/4 · **2 vivas**, cada una tumba el caso que declara · 0 mudas · 0 ciegas. Árbol limpio después (`git status`).
* Guards de suite y de registro: en la entrega, con su población.
* `npm test` completo: NO CORRIDO en local (10 sesiones a la vez); lo juzga el obligatorio. yaqu.app: sin pantalla que mirar; el texto sale en el JSON de `GET /admin/modelo-303`.

---

# SCRUM-1065d · El caso «autónomo en inicio de actividad», medido en la norma y fijado con un test

**Medido contra:** `origin/main` = `289ca894656c7c3686a0469d34785512b960e0b3` · 2026-10-26T15:18:23Z
**Rama:** `scrum-1065d-inicio-actividad` · **Puesto:** J1 (sesión `jv-j1cd`; el hook de inicio dijo «SIN IDENTIDAD», SCRUM-1498) · **Encargo:** orquestador `cobroflash-backend-8b`

A9: comprobación → `tests/scrum1065d-inicio-de-actividad.test.mjs`

## PASO 0

* `git log origin/main -i --grep=SCRUM-1065`: 1065b (#2815) y 1065c (#2858), nada de 1065d · `ls-remote 'refs/heads/scrum-1065*'`: vacío · `gh pr list --state all --search 1065`: ningún PR de 1065d.
* El tramo 1065b dejaba el caso así: «Inicio de actividad: sin tratamiento propio; el acumulado empieza el 1 de enero igual. No probado aparte».

## Lo que dice la norma (RIRPF consolidado, API de legislación consolidada del BOE)

* Art. 110, versión vigente desde el 23-dic-2018 (BOE-A-2007-6820, bloque `a110`), y art. 109 (bloque `a109`, versión única de 2007).
* **En estimación directa no hay regla de inicio.** El 110.1.a acumula «desde el primer día del año hasta el último día del trimestre» y resta los pagos que «habría correspondido ingresar en los trimestres anteriores del mismo año».
* «Inicio de actividades» aparece sólo en tres sitios, y ninguno es de esta población:
  * el 110.1.b y el 110.3.a.2.º, que son de estimación OBJETIVA;
  * el 109.5, que es la exención del 70 % retenido (109.2 a 109.4) y vale sólo para actividades profesionales, agrícolas y forestales. Un oficio es empresarial (Q-C8).
* Control positivo de la lectura: la cita `CITA_ACUMULADO` de `modelo130.ts` aparece literal en el texto bajado.

## Lo que hace hoy el borrador (corrido, no leído)

Una sonda fuera del árbol sobre `dist/` (`tsc --noCheck`). El merchant del caso empieza el 10-jul-2026: facturas de 1.000 (10-jul), 500 (20-ago) y 2.000 (5-nov), y un gasto de 200 (15-jul).

| trimestre | 01 | hipótesis (gastos · rendimiento · 20 %) | 05 | 07 |
|---|---|---|---|---|
| T2 | 0 | 0 · 0 · 0 | null `pagos_anteriores_sin_dato` | null |
| T3 | 1.500 | 200 · 1.300 · 260 | null `pagos_anteriores_sin_dato` | null |
| T4 | 3.500 | 200 · 3.300 · 660 | null `pagos_anteriores_sin_dato` | null |

Las cifras casan con las hechas a mano. Acumular desde el 1 de enero da lo mismo que acumular desde el alta, porque antes no hay nada. **Así que no hay nada que construir que se deduzca de la norma.**

## Lo que NO se deduce de la norma, y queda como pregunta

* La 05 de un merchant que empezó en julio sería, por norma, 0 en el T3: antes no había actividad, así que no había pago que ingresar. Pero el borrador no lo sabe.
  * Saberlo exige la fecha de inicio de actividad que el merchant declaró a Hacienda, y `schema.prisma` no tiene ningún campo para ella. Barrido de `inicioActividad|fechaAlta|altaActividad|activityStart|epigrafe|iae`: 0. Control: `merchantId`, 80.
  * Unos libros vacíos antes de julio dicen «no se facturó por YaQu», no «no había actividad».
  * Aunque tuviéramos el dato, la 07 seguiría en null por la 02 (c.20721).
* Riesgo medido: un merchant que llega a YaQu a mitad de año pero facturaba antes por otra vía tiene una 01 que sólo ve lo de YaQu, y `motivosParaNoFiarse` sale vacío (T2, T3 y T4 de la sonda: `[]`).
* Las preguntas ✅/❌ para el fundador están en el comentario de Jira de este tramo. Las dos piden decisión: la 1 añade un motivo nuevo al borrador y la 2 toca esquema y texto. No se construye ninguna sin respuesta.

## Qué se ha hecho

* Sólo un test, `tests/scrum1065d-inicio-de-actividad.test.mjs`. `src/` no se toca. Fija tres cosas:
  * con el alta en julio, el acumulado empieza el 1 de enero y las cifras son las de la tabla;
  * 🔴 la 05 no sale a cero por unos libros vacíos (T2-T4), y en el T2 la 01 es un cero de verdad (0 facturas miradas);
  * el control positivo: en el T1 la 05 sí es 0.

## Lo que se corrió, con su población

* El test nuevo: 3 tests · 3 pass · 0 fail · 0 skipped.
* Mutación con `correr` y `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, sobre `MUTACIONES_QUE_ME_TUMBAN`:
  * base 3/3;
  * **3 vivas**, cada una tumba el caso que declara: la 05 siempre a 0, el acumulado desde julio y el 21 %;
  * 0 mudas · 0 ciegas.
* Control del conductor: una mutación sembrada en un comentario sale MUDA. `git status` limpio después.
* Guards dirigidos: en la entrega, con su población. `npm test` completo: NO CORRIDO en local; lo juzga el obligatorio. yaqu.app: sin pantalla (el 130 no tiene ruta).
