# SCRUM-1554 · Puerta de go-live

## SCRUM-1554b · Los 57 que «esperan al fundador», por tipo de decisión: 27 esperan de verdad, 27 ya no hace falta decidirlos, 3 están aparcados en esta misma puerta

**Medido contra:** `origin/main` = `76c29b57c871584b04c8206c11571f9c56c9d699` · 2026-10-14T07:02:30Z

A9: aviso → A10 «La lista que decide qué se mira es la única que nadie mira.» — no se pudo comprobar: las etiquetas viven en Jira y no en el árbol, ningún test del repositorio puede leer Jira, y saber si una decisión «ya está tomada» es leer un literal, no contar algo

Sesión `jv-j4f` del equipo de Javier, carril `area-j3` (auditoría), por encargo de su orquestador
(`cobroflash-backend-2e`). El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1549); se construyó con la orden
escrita del orquestador. **Es LECTURA:** no se ha tocado ninguna etiqueta, comentario ajeno ni transición en
Jira, ni `src/`, `public/`, tests, guards o workflows. Entran este registro y `docs/master/evidencias/SCRUM-1554b/`.

### 0 · La respuesta corta

| Veredicto | Cuántos |
| --- | --- |
| 🔴 **ESPERA una decisión** (de él o de otro: ver la columna QUIÉN) | **27** |
| ✅ **YA NO HACE FALTA DECIDIRLO**: hay un literal suyo citado, o se quedó sin objeto. La etiqueta miente | **25**, más **2** dudosos (524, 1109) = **27** |
| 🚪 **APLAZADO A ESTA PUERTA**: espera su firma, pero el 14-oct él dijo que no se le pregunta hasta el go-live | **3** (1502, 1551, 1554) |
| NO SE DEJA RESUMIR / NO PUDE MIRAR | **0** |

**Población:** consulta `project = SCRUM AND statusCategory != Done AND labels = "equipo-javier" AND labels IN
("decision-jefe","fundador","sin-firma","stop-fundador")`, re-medida hoy: **57** (`totalCount` 57,
`hasNextPage: false`). La foto con las etiquetas está en `evidencias/SCRUM-1554b/foto-jira-57-2026-10-14.tsv`.
**Se clasificaron los 57.**

**Los 27 que esperan de verdad, por tipo:**

| Tipo de decisión | Cuántos | Cuáles | ¿Le toca a él? |
| --- | --- | --- | --- |
| **Algo que solo puede hacer o contestar él** (hablar con el asesor, la SL, Railway o Resend, dónde viven las preguntas) | 4 | 1264 · 143 · 1115 · 1316 | sí |
| **STOP fiscal** (regla 40, el camino de emisión) | 4 | 1129 · 1240 · 1260 · 1314 | sí; 1314, además, después del asesor |
| **Espera a un tercero** (el asesor), no a él | 2 | 142 · 825 | solo mandar la pregunta: está dentro de 1264 |
| **STOP de dinero o de canal** (Mercado Pago, regla 28, escrituras que fallan en silencio) | 3 | 1449 · 1509 · 1508 | sí |
| **Elegir entre opciones de producto ya medidas** (qué ve el Técnico, el límite del trial) | 2 | 1403 · 1406 | sí |
| **Firmar un texto** | 1 | 1132 | sí |
| **Cambio de máster** | 1 | 1499 | sí |
| **Cómo trabaja el equipo** (CI, guards, puerta de sesiones, esquema sin fuente) | 10 | 1549 · 1393 · 1387 · 1498 · 1310 · 1501 · 1410 · 1506 · 1510 · 1511 | **solo 6.** 1510 y 1511 los decide el orquestador o un jefe; 1506 es de S5 (equipo de Luis); 1410 no está maduro (antes hay que medir) |

### 1 · Qué cuesta no decidir: lo que ordena la lista

De mayor a menor coste. Solo los que bloquean algo; el resto «puede esperar» (columna COSTE del §3).

1. **SCRUM-1264: mandar las preguntas al asesor.** Es la que más bloquea. La fecha la puso él: c.17682
   (1-oct), «3-Cita con el asesor en las proximas dos semanas», que **vence el 15-oct**. Antes de mandarlas
   quedan cuatro decisiones suyas «SIN TOMAR» (c.17456). De su respuesta dependen **1129, 1240, 1314, 1316, 142
   y 825**, y la política F2 de 1258.
2. **SCRUM-143: la SL.** Sin ella, SIF-1 no llega a 8/8 «por mucho código que se escriba» (c.17681). La fecha
   también es suya: «2-SL a lo largo de este mes» (c.17681). Arrastra a 870 en el go-live.
3. **SCRUM-1115: el remitente del correo.** **Pasa hoy, en producción:** todo correo sale como «PresuFácil
   <noreply@presufacil.online>» (c.17376, leído en Railway). No es «será falso al lanzar»: ya es así.
4. **SCRUM-1549: la puerta de sesiones, muerta desde el 28-sep.** Todas las sesiones arrancan «SIN IDENTIDAD»,
   y esta también. Arrastra a 1506 (la cerradura de carril depende de la mesa).
5. **SCRUM-1509 + 1508: las mismas salidas A–E.** Bloquean el go-live por la regla 28: el máster promete un
   «tope duro» de plantillas que no existe (c.18897).
6. **SCRUM-1129 + 1240: el mismo sitio del mismo fichero.** Mientras no se decidan, el registro de la AEAT diría
   `01` donde el libro dice «caja». Se despachan juntos. Bloquean el go-live fiscal.
7. **SCRUM-1316: tiene fecha, el 1-dic-2026** (el IVA del 10 % ligado al medio de pago).

### 2 · Hallazgos

- **La etiqueta miente en 25 de 57** (más 2 dudosos): la decisión ya está tomada, con su literal, y la etiqueta
  sigue puesta. Son 534 · 612 · 870 · 998 · 1016 · 1022 · 1023 · 1106 · 1116 · 1247 · 1253 · 1257 · 1258 · 1304 ·
  1319 · 1330 · 1341 · 1346 · 1347 · 1390 · 1402 · 1404 · 1405 · 1497 · 1552. **No se ha tocado ninguna** (A13).
- **Decidido y sin aplicar, que no es una decisión sino trabajo:**
  - **1016**: el titular está firmado desde el 23-sep (c.16564) y `public/index.html:6` todavía sirve
    «Del presupuesto al cobro».
  - **1347**: firmado el 1-oct («1-Sí firmo») y `docs/YAQU_MASTER.md:670` todavía dice «productos crear-ver ✅ ✅»
    para el Técnico.
- **La etiqueta dice «fundador» y quien decide es otro, en 7 de los 27:** el asesor en 142 y 825; el
  orquestador o un jefe en 1510 y 1511; S5 (equipo de Luis) en 1506; en 1410 antes tiene que medir una sesión;
  y en 1498 decide S5 con el fundador.
- **No se encontró ninguna que conste SOLO en la etiqueta:** las 27 tienen la decisión escrita en la
  descripción o en un comentario. Dos la tienen solo en la descripción, sin ningún comentario: 1499 y 1501.
- **1387**: lo que pedía la etiqueta está decidido (c.18016, c.19383). Lo que queda es una pregunta NUEVA
  (c.19527, 14-oct: si el meta-guard pasa a ser obligatorio) que consta escrita, pero **no consta que se le
  haya hecho**.
- **870 y 1506 llevan también `equipo-luis`.** Entran en la consulta porque tienen las dos etiquetas.
- **Dos de los 57 cuentan como «ya no hace falta» y solo son DUDOSOS:**
  - **524**: lo resolvió el código al construir (`sif.cola.ts:17`, `:128-129`), sin un literal suyo que apruebe
    esa forma.
  - **1109**: «ya está montada» se deduce de un registro del 25-sep (SCRUM-1114.md); no se comprobó que la
    tarea siga corriendo.

### 3 · Los 57, uno por uno

Leído por cuatro lectores (subagentes, de 14 o 15 tickets cada uno), con una regla fija: veredicto solo con
cita (`c.<id>` con su fecha, o `fichero:línea` de `76c29b57c`). «Literal suyo» quiere decir que el texto lo
atribuye al fundador. ⚠️ La cuenta de Jira no dice quién escribe, y casi todos los literales los transcribe un
orquestador (§5).

#### 3.1 · ESPERA (27)

| Ticket | Tipo | Qué tiene que decidir | Dónde consta | Quién | Coste de no decidirlo |
| --- | --- | --- | --- | --- | --- |
| 1264 | SOLO-ÉL | Cuatro cosas antes de mandar las preguntas al asesor: quién escribió las «ASESOR» del 23-sep; si se mandan también las que respondió una IA; si se repite la del Convenio 017; si algún profesional real recibió un justificante. Y pedir la cita | c.17456 (29-sep) «Cuatro decisiones de Javier, antes de enviar — SIN TOMAR»; c.17682 (1-oct) plazo de dos semanas | él, después el asesor | vence el 15-oct. Bloquea 1129, 1240, 1314, 1316, 142, 825 y la F2 de 1258. Hay dos versiones vivas de las preguntas (31 aquí, 35 en su documento, según 1316 c.18758) |
| 143 | SOLO-ÉL | Constituir la SL, sacar el certificado de representante y tramitar el Convenio 017 (el Modelo A ya está decidido) | c.17681 (1-oct) «2-SL a lo largo de este mes» | él (y Luis, como socio) | sin la SL, SIF-1 no llega a 8/8 y no hay go-live fiscal. Arrastra a 870 |
| 1115 | SOLO-ÉL | Verificar yaqu.app en Resend, cambiar `EMAIL_FROM` en Railway y firmar el remitente | c.17376 (28-sep) «EMAIL_FROM = PresuFácil …»; c.17374 «parece Luis» (dominio y cuenta) | él, y probablemente Luis | **hoy en producción**: los correos salen con la marca vieja desde otro dominio («se parece mucho a un fraude», c.16977) |
| 1316 | SOLO-ÉL + TERCERO | Dónde viven las preguntas al asesor (el repo o su documento), y mandar la E6 sobre el IVA del 10 % según el medio de pago | c.18758 (7-oct) «Decidir dónde viven es del fundador» | él, después el asesor | tiene fecha: 1-dic-2026 (RDL 29/2026, sin convalidar) |
| 1129 | STOP-FISCAL | De dónde sale el régimen de IVA de cada profesional (un campo nuevo con su pregunta en el alta, o deducirlo de lo que ya hay) y el GO para tocar el builder | c.17405 (28-sep) «Faltan dos cosas, y ninguna es construible hoy» | él (y el asesor, para la clave 18) | todo registro sale como `01` (`registro.builder.ts:313`, `:328`, re-medido). Bloquea encender lo fiscal en ES. Va junto con 1240 |
| 1240 | STOP-FISCAL | GO para que el builder ponga caja (`07`) en cada operación, y la firma de la mención «régimen especial del criterio de caja» en el PDF | c.17410 (28-sep) «también hace falta un texto firmado … Sigue siendo STOP de regla 40» | él (y el asesor, B6) | el libro registro diría «caja» y la AEAT `01`. Va junto con 1129 |
| 1260 | STOP-FISCAL | La rama que todavía escribe `type 'JUST'` y ya no se puede alcanzar: A, retirarla; B, dejarla como red | descripción «Necesita GO expreso del fundador»; sin comentarios | él | nada: puede esperar. Se midió inalcanzable (330 combinaciones, 0 «J-») |
| 1314 | STOP-FISCAL / ELEGIR | La anulación sellada sobre una factura que sigue cobrada: A, sellar después del estado; B, un estado nuevo en la Parte L; C, aceptarlo y documentarlo | descripción «Lo que hay que decidir (a)/(b)/(c)»; es la A5 de 1264 | él, después del asesor | se puede alcanzar hoy (`psp.routes.ts:187` queda fuera del flag), aunque no hay profesionales reales |
| 142 | TERCERO | El dictamen P1: cuándo se emite la factura de anticipo y con qué fecha | descripción «NO se construye hasta tener el dictamen de P1»; c.11058 (27-jul) | el asesor | bloquea la factura de anticipo, que hará falta si en el go-live se cobran señales |
| 825 | TERCERO | D5.1, 5.2, 5.3 y 5.5: si P11 vale sin un asesor humano, si el PDF de la F1 lleva NIF y domicilio, y si se construye la F2 | c.17446 (28-sep) «Ok con que el resto lo vea el asesor» | el asesor (D3 es del equipo de Luis) | «Nada de D5 se construye hasta que el asesor conteste» |
| 1449 | DINERO-O-CANAL | Pago con Mercado Pago: A, si se avisa al cliente cuando el pago se rechaza; B, si se mantiene `/pay/mp/<token>`, a la que hoy no lleva ningún enlace | c.18771 (7-oct) «dos decisiones que no son texto» | él | J2 no puede construir las dos páginas. Riesgo bajo hoy |
| 1509 | DINERO-O-CANAL | La salida A–E para el recordatorio de facturas; una salida nueva para el tope de plantillas (deja pasar 10 de 10); y el límite delante del webhook de entrantes | c.18881 (8-oct) «siguen esperando la decisión entre A-E»; c.18897 | él (regla 28) | al llegar el primer cliente: 48 plantillas en 48 h, y que Meta marque la WABA. Bloquea el go-live |
| 1508 | ELEGIR (canal) | `recordAudit` y otras 40 escrituras se tragan su error: salidas A–E. Y antes, quién tiene que mirar `encolado_fallido` | c.18868 (8-oct) «Sin elegir» | él y los jefes; la D es de S1 | las mismas salidas que 1509: se despachan juntos |
| 1403 | ELEGIR | Qué cifras ve un Técnico en la ficha de cliente: A, ninguna; B, solo lo suyo (rótulos nuevos, con firma); C, la ficha ajena no se le abre (pide un ALTER). Y qué pasa con los eventos que llevan el importe en el texto | c.18040 (2-oct); `docs/master/SCRUM-1403.md:22` «pedida (2-oct-2026) y sin contestar» | él | un Técnico puede reconstruir lo cobrado por todo el negocio (1.050 de 1.050). Hoy no afecta a nadie |
| 1406 | ELEGIR | Cuántos usuarios da el plan `trial` (hoy 1), qué pasa con los creados si después contrata Pro, y si eso pasa a constar en el máster | descripción «SIN DECISIÓN TODAVÍA: el fundador ha pedido expresamente que se abra sin ella» | él | hoy nada; cuesta altas en cuanto haya pruebas reales |
| 1132 | FIRMA-TEXTO | Las notas del cliente: firmar 4 literales («Notas», «Sin notas», «Añadir nota», «No se pudo guardar: ») y elegir A (la nota solo en la tarjeta) o B (solo en la cabecera) | c.19538 (14-oct) «Firma de los cuatro literales … y elegir (a) o (b)» | él | la función no existe en pantalla. Lleva cuatro repartos rebotando |
| 1499 | CAMBIO-DE-MÁSTER | `WhatsAppMessage` escribe `inbound` y `received`, que el máster no tiene, y nunca escribe `queued`: A, se amplía el máster; B, se corrige el código | descripción «① Decidir, que es del fundador»; sin comentarios | él | bloquea los comentarios de `schema.prisma:1270`, `:1274` y `whatsappLog.service.ts` |
| 1549 | PROCESO / REPARTO | La puerta de sesiones: A, una sesión por puesto (y el orquestador cambia cómo reparte); B, la puerta aprende a nombrar varias por puesto | descripción «Esto es una DECISIÓN del fundador, no un arreglo» | él (`sesion.mjs` es de S5) | todas las sesiones arrancan sin identidad. Arrastra a 1506 |
| 1393 | PROCESO | Quién vigila `main`: A, una sesión; B, un workflow programado; C, un workflow que salta al acabar cada corrida; D, que Railway espere al CI; E, nada | c.18787 (7-oct) «No elijo»; `docs/master/SCRUM-1393.md:125-133` | él (B y C, además, S5) | en 30 días se sirvieron 21 commits con el obligatorio en rojo |
| 1387 | PROCESO | Si el meta-guard pasa a ser check obligatorio: A, sí; B, sigue informativo | c.19527 (14-oct) «es decisión del fundador … Se deja escrito» | él | 10 mutaciones del #2413 que nadie ha visto correr enteras. ⚠️ No consta que se le haya preguntado |
| 1498 | PROCESO | Si el siguiente commit de `main` tiene que esperar a dos jobs que no son obligatorios: salidas A–D | c.18769 (7-oct) | S5 y él | latencia: 24,8 min de mediana. No bloquea tickets |
| 1310 | PROCESO / esquema | Si se pasa a ficheros versionados el DDL que hoy solo vive en producción (13 de 37 claves ajenas) | c.17665 (1-oct) «La (ii) sigue abierta» | él | «No es urgente, pero cada `db push` la agranda». Bloquea el guard de 1307 |
| 1501 | PROCESO | Qué vigila el guard scrum475: A, solo la estructura; B, también los comentarios (y entonces cuál de los tres sitios manda) | descripción «es una DECISIÓN antes que un arreglo»; sin comentarios | él | bloquea dos líneas de comentario ya firmadas en 1401 |
| 1410 | PROCESO | Cuándo llama a `@claude` el avisador de PR en rojo, y si `claude[bot]` puede rearmar el auto-merge | descripción «Tráelas con su coste; no elijas» | **todavía no es suya**: antes una sesión tiene que medir el ① | `claude[bot]` puede volver a empujar a una rama con una sesión viva |
| 1506 | PROCESO | La cerradura de carril deja pasar a las `jv-jN`: A, que resuelva esos nombres; B, que un nombre que no resuelve sea un error | descripción «Decidid vosotros: el fichero es vuestro» | **S5, equipo de Luis** | depende de 1549 |
| 1510 | PROCESO | Si se arregla el guard scrum205 o se declara su límite | descripción «la decisión, que no es de una sesión»; c.18965 | **el orquestador** o quien sea dueño de 205 | nada: puede esperar |
| 1511 | PROCESO | Un mecanismo para las anclas nuevas del trinquete de firmas: A, solo proceso; B, exigirlo; C, nada | c.18962 (8-oct) «decide un jefe» | **un jefe** u orquestador | nada: hoy, 0 de 15 |

#### 3.2 · YA NO HACE FALTA DECIDIRLO (25 + 2 dudosos)

| Ticket | Qué se decidió | Cita |
| --- | --- | --- |
| 534 | P2 firmado y aplicado (#2415 mergeado) | c.19531 (14-oct) «Ok vamos con tu recomendación»; c.19585 «Ok autorizo» |
| 612 | expediente del justificante completo | c.16184 (21-sep) «las 7 preguntas, contestadas»; #1593 |
| 870 | el productor de pruebas es él (vuelve con la SL, 143) | c.16599 (23-sep) «Sí soy yo el productor de pruebas» |
| 998 | forales: hoy no se hace nada | c.16609 (23-sep) «DECISIÓN DE JAVIER … NO se hace nada hoy» |
| 1016 | titular firmado. ⚠️ **Sin aplicar**: `public/index.html:6` | c.16564 «CANDIDATO 1»; c.16648 «Okey te la firmo» |
| 1022 | la dependencia de .xlsx, autorizada y construida | c.16597 (23-sep) «Sí que entre»; #1786 |
| 1023 | lo sustituyen sus cuatro decisiones del 30-sep (SCRUM-1261) | `docs/master/SCRUM-1261.md`, vuelta 3 |
| 1106 | la retención emitida se aparca | SCRUM-1053 c.16660 «Ok aparca» |
| 1116 | texto del digest firmado y mergeado | c.16979 (25-sep) «TEXTO FIRMADO POR EL FUNDADOR»; #1798 |
| 1247 | firmado por delegación y superado por SCRUM-1154 | c.17425; `docs/microcopy/2026-09-29-SCRUM-1154-encargados-privacidad.md:3-24` |
| 1253 | el justificante se quita | c.17441 (28-sep) «1-Sí quitalo…» |
| 1257 | P1–P8 firmados por delegación | c.17444; c.17676 |
| 1258 | GO dado y construido | c.17705 (1-oct) «1-Ok, Go»; #2048 |
| 1304 | GO dado y construido | c.17639 «4-Go»; c.17704; dentro de #2053 |
| 1319 | autorizado y en main | descripción «5-Sí te autorizo»; #2040 |
| 1330 | GO; en main | c.17724 (1-oct) «1-GO»; #2053 |
| 1341 | la B, y el rótulo firmado | c.17827 «1-Ese esta bien»; #2112 |
| 1346 | el Técnico ve aquello de lo que es autor o lo que tiene asignado | c.17828 «1-Ok la B»; c.17932; c.17952 |
| 1347 | firmado. ⚠️ **Sin aplicar**: `YAQU_MASTER.md:670` | descripción «1-Sí firmo» |
| 1390 | las tres, firmadas | c.17962 «1-Sí» · «2-Ok firmo» · «3-El admin conserva sí» |
| 1402 | la A | c.18019 (2-oct) «1-Ok A»; #2222 |
| 1404 | GO, mientras no haya facturas reales | c.19293 (13-oct) «GO, no hay facturas reales en producción» |
| 1405 | la salida C (pendiente de construir) | c.19584 (14-oct) «Ok la C» — contrastado |
| 1497 | Canarias y forales: no por ahora | descripción «No de momento dejamos Canarias sin hacer» |
| 1552 | reglas 43 y 44 en el máster (#2422). Sigue abierto, sin dueño, quién escribe la línea de la 44 | c.19550 «En la que estimes conveniente» |
| 524 *(dudoso)* | «aceptado con errores» lo resolvió el código, sin un literal suyo | `src/modules/fiscal/verifactu/sif.cola.ts:17`, `:128-129` |
| 1109 *(dudoso)* | «Vamos con el 3»; que esté montada se deduce del 25-sep | descripción; `docs/master/SCRUM-1114.md` |

#### 3.3 · APLAZADO A ESTA PUERTA (3)

| Ticket | Qué espera | Cita |
| --- | --- | --- |
| 1551 | R1–R6 y la D1 del documento legal servido | c.19547 (14-oct) «en la puerta de go-live (SCRUM-1554), no en la mesa del fundador» |
| 1502 | si reconoce las 5 marcas «aprobado por el fundador» que no constan: es la fila 5 de la tabla de esta puerta. ⚠️ Le queda además una decisión de proceso que **no** está aplazada: `sinCitas` en `tests/_respaldo-de-firma.mjs`, «lo decide un jefe» (c.18797) | c.19543 (14-oct); descripción de SCRUM-1554, fila 5 |
| 1554 | cuándo es la revisión de go-live, y si la lista lleva un mecanismo | descripción «Lo que falta decidir, y es del fundador — EN LA REVISIÓN, no ahora» |

### 4 · Los controles

| Control | Esperado | Salió |
| --- | --- | --- |
| 🔴 POSITIVO a ciegas · SCRUM-1050 en el lote A. No está entre los 57; SCRUM-1553 lo dio por decidido (c.16593) | YA NO HACE FALTA | **YA NO HACE FALTA**, c.16593 ✅ |
| 🔴 POSITIVO a ciegas · SCRUM-1246 en el lote B. No está entre los 57; SCRUM-1553 lo dio por YA ESTÁ | YA NO HACE FALTA | **YA NO HACE FALTA**, «1-Okey la dejamos en firma» ✅ |
| NEGATIVO del censo de la casa · SCRUM-9999, en la misma pasada | NADA EN MAIN | NADA EN MAIN ✅ |
| ¿Este registro absuelve alguna marca? Contiene «aprobado por el fundador», así que el índice de `_respaldo-de-firma.mjs` lo cuenta como fuente que atribuye | lo mismo con él que sin él | `porNivel()` de scrum921c, con él y sin él: documental 24 · sin-respaldo 27 en las dos pasadas ✅. ⚠️ Sin control positivo sembrado: no se ha comprobado que esta comparación sepa ver una absolución |
| Contraste mío de cuatro citas de los lectores | lo que dicen | 1405 c.19584 «Ok la C» ✅ · 1116 c.16979 ✅ · `registro.builder.ts:313`/`:328` con `CLAVE_REGIMEN_GENERAL` ✅ · `YAQU_MASTER.md:670` sin corregir ✅ |

**El censo de la casa, reusado sin escribir otro:** `node docs/master/evidencias/SCRUM-1496/tabla-ya-esta.mjs
--jira <foto> --ref 76c29b57c…` salió con código 0 en 2 min 55 s: **39 ALGO EN MAIN · 18 NADA EN MAIN · 0 NO HE
PODIDO MIRAR**. Está entero en `evidencias/SCRUM-1554b/tabla-ya-esta-76c29b57c.md`. ⚠️ «ALGO EN MAIN» no
contesta la pregunta de este encargo, que es si queda una DECISIÓN pendiente. Eso solo lo dice leer el texto.

### 5 · Lo que NO contesta, y los errores míos

- **Casi todos los literales «del fundador» los transcribe un orquestador** bajo la cuenta de Javier. Se
  contaron como decisión tomada cuando el texto se los atribuye a él, como pedía el encargo, pero ninguno es
  de su puño (lo marcó el lector B).
- **Si las decisiones fiscales (1129, 1240) quedan aparcadas por esta puerta.** No son textos falsos sino
  defectos de emisión, y la puerta no los lista: se quedan en ESPERA.
- **No se miró:** si 1507 (S1) construyó ya la pieza (b) de 1509; si 1346 y 1390 midieron lo que dejaban
  abierto; si la tarea de 1109 sigue corriendo; si yaqu.app se verificó en Resend después del 28-sep (1115).
- **Error mío:** a los lectores les di un vocabulario de tipos para que las filas casaran. Eso empuja a encajar
  en esas casillas, que es justo lo que el encargo pedía no hacer. Los lectores usaron `OTRO:` tres veces, en
  524, 1022 y 1316, y en la tabla final he fundido esas filas con los tipos vecinos. **Los grupos son míos y
  no han salido de los datos a ciegas.**
- **Error de los lectores, cazado al cruzar:** el lector D dio 1502 por ESPERA sin ver que sus cinco marcas
  son la fila 5 de esta misma puerta. El lector A dio 524 por «ya no hace falta» con solo el código; lo he
  bajado a dudoso, porque el código que lo cumple no puede ser a la vez el que firma la condición.
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

#### Arreglo del check obligatorio (mismo día, antes de mergear)
El `build + tests` del PR #2601 caía con `not ok 3440 - SCRUM-1480f`: `scripts/go-live/puerta.mjs` (creado en
este mismo PR) es un script NUEVO sin fila en `docs/equipo/dos-equipos.md` §3.3. Medido el motivo: SCRUM-1554
lleva las etiquetas `decision-jefe, equipo-javier, fundador, go-live, legal, microcopy` — NINGUNA es
`area-*`. Por «Cómo nace la fila de un fichero de `scripts/`» (SCRUM-1480), un ticket sin UNA etiqueta de
área hace que el criterio calle: no se le puede dar fila a un puesto. Declarado en
`scripts/_sin-fila-declarados.json` (caso 2: lo crea el equipo de Luis en un ticket sin etiqueta de área).
`tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`: 6/6 verde tras el cambio.
El rojo de `guards de navegador (fuera de la tanda)` (34 verdes, 3 rojos, 1 ciego) es PREEXISTENTE: medido
también en rojo en el último run de `main` (39218813067, el mismo job, misma conclusión `failure`), y
ninguno de los 4 ficheros de este PR toca `public/` ni el dashboard. No es de este PR; no se toca aquí.
