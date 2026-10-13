# SCRUM-1530 · La skill de VeriFactu decía «no hay pruebas contra la AEAT»: se le pone la fecha al lado, no se reescribe

**Medido contra:** `origin/main` = `780c812707bfd97b815fe5e25f31110e66e25975` · 2026-10-13T06:14:35Z

A9: aviso → cicatriz J5 «Empujé un cambio a una skill sin tener citado en Jira el OK del fundador que pide la regla 10: el bot arma el auto-merge en el push y la sesión ya no lo puede parar» — no se pudo comprobar: ningún guard del repositorio lee Jira, y el permiso de la regla 10 vive en un comentario

13-oct-2026 · **J5** (sesión `jv-j5b`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por la sesión, no por Javier. El encargo se leyó en Jira: SCRUM-1530 entero; «lo coge», c.19216.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
común del 13-oct. Carril J5 (fiscal). No se ha tocado `src/`, ni `prisma/schema.prisma`, ni ningún guard.
**No se ha pedido, buscado, abierto ni tocado ningún certificado, contraseña ni clave.**

## El error de esta sesión

Se empujó la rama (06:19Z) **antes** de comprobar si había en Jira un OK del fundador citable para tocar
`.claude/skills` (regla 10). El precedente lo pide por número de comentario (SCRUM-1500 c.18970 y c.18993).
En SCRUM-1530 no lo hay: la descripción la escribe el orquestador, y SCRUM-1521 c.19153 firma CÓMO se
corrige una frase histórica, no que se toque esta skill. El bot abrió el PR #2355 y le armó el auto-merge
en el mismo push; la sesión no toca el auto-merge. Se avisó al orquestador a las 06:20Z, con el PR sin
mergear, y la decisión —publicar el número del OK o parar el PR— es suya o de Javier. Va a las
cicatrices de J5, sin comprobación: no hay instrumento que lea Jira.

## Qué cambia

Una sola línea física, la **89**, idéntica en las dos copias de la skill
(`.claude/skills/yaqu-verifactu-sif/SKILL.md` y su espejo en `.agents/skills/`):

- `git diff --numstat`: `1 1` en cada copia. Antes 90 líneas, después 90.
- Las líneas 87, 88 y 90 quedan byte a byte como estaban: la frase del 20-ago-2026 **no se ha tocado**
  (principio de SCRUM-1521 c.19153). La nota va entre corchetes, detrás de «(comprobado el 20-ago-2026).».
- Las dos copias: 11.936 B, sha256 `877d509c8f1054c26bdd63a5b7b694ad7310ddea8c7bcc4a9cf96f05a08bff8e`.
  Bytes de control 0, CR 0, sin BOM (población: 11.936 bytes).

**Por qué en la línea y no debajo.** Hay citas de esta skill por fichero:línea, medidas antes de escribir:
`:3`, `:57`, `:87-90` y `:88` (en `docs/legal/INVENTARIO_AFIRMACIONES_SKILLS.md`, `docs/master/SCRUM-534.md`,
`SCRUM-1094.md`, `SCRUM-1500.md`, las evidencias de `scrum1500f`/`scrum1500h`, y
`scripts/censo-afirmaciones-de-skills.mjs`, que remite a «la línea 88 de esa skill»). La frase vive en
87-90 y la 90 es la última del fichero, así que añadir líneas detrás no habría movido ninguna cita; aun
así se eligió no añadir ninguna, que es el precedente de SCRUM-1500f/h y no depende de que eso siga
siendo verdad. Lo que SÍ cambia para quien cite `:89`: su texto. No hay ninguna cita a `:89` sola
(la de `SCRUM-1094.md:98` es el rango 87-90 y es historia de `docs/master`).

## ① Lo medido: la mitad de la frase es falsa, y la otra mitad son dos cosas

| trozo de la frase del 20-ago | hoy | cómo se midió |
|---|---|---|
| «no hay pruebas contra la AEAT» | **falso desde el 24-sep-2026** | abajo |
| «porque no hay envío» | **cierto de nuestro código** | `git grep -nE '\b(enviarSobre\|procesarObligado)\s*\('` sobre `src/`: 2 líneas, las dos son la definición (`sif.client.ts:355`, `sif.procesador.ts:70`); 0 llamadas. Positivo: las 2 definiciones aparecen |
| el documento de evidencias «no existe» | **sigue cierto** | `ls` da «No such file»; `docs/EVIDENCIAS_E2E.md` sí está |

El ticket da la frase entera por falsa. **No lo es entera:** las pruebas las hizo una persona, a mano, desde
su navegador; nuestro cliente (`sif.client.ts`) sigue sin llamador. La nota lo separa, porque una sesión
que lea «sí hay envío» concluiría lo contrario de lo que hay.

**El rastro, por identidad y no por palabra.** Se buscaron los códigos de respuesta (CSV) de la AEAT en
los 6.105 ficheros seguidos por git:

- Forma `A-` + 14 caracteres en `docs/`, `scripts/`, `tests/` y `src/`: **6 distintos**. Cinco reales y uno
  fabricado por un test (`A-FALSO000000001`).
- Los cinco reales salen en **8 ficheros**: `docs/master/SCRUM-1110.md`, `SCRUM-1127.md`, `SCRUM-1259.md`,
  `SCRUM-1296.md`, `SCRUM-1319.md`, `SCRUM-1398.md`, `SCRUM-1399.md` y un comentario de
  `src/modules/fiscal/verifactu/sif.client.ts`.
- Control de cero, sembrado: `A-ZZQX1530SEMBRADO` → 0. Control positivo: `A-KR84MFNPTPDHMN` → 7 ficheros.

**Corrección a la lista del ticket (son 8 y son 8, pero no los mismos).** De los ocho que nombra el ticket:

- `docs/SIF_SPEC_NOTES.md`, `docs/legal/SEMAFORO_CALIBRACION.md` y `docs/legal/PREGUNTAS_ASESOR.md` **no
  llevan rastro de ningún envío**: 0 CSV, 0 `PRUEBA-`. Casan con los patrones del ticket por
  `AceptadoConErrores` (es vocabulario del XSD) y por `preportal.aeat` (es la URL de una fuente).
- `docs/master/SCRUM-1225.md` tampoco: dice «sólo mandando» de lo que NO se había probado.
- `docs/master/SCRUM-1211.md` sí, por sus dos correcciones en sitio del 2-oct (sin CSV).
- Faltaban cuatro que sí lo llevan: `SCRUM-1259.md`, `SCRUM-1296.md`, `SCRUM-1398.md`, `SCRUM-1399.md`.
- «Registro de facturación duplicado», buscado por línea, sólo sale en `docs/legal/fuentes/aeat-errores.properties`
  (el catálogo). En `SCRUM-1398.md` está, partido entre dos líneas: un patrón por línea no lo ve.

La conclusión del ticket se sostiene. La lista, no.

## ② Dónde están las evidencias que sí existen

| qué | dónde | respuesta de la AEAT |
|---|---|---|
| los siete envíos del 24-sep, todos de alta | `docs/master/SCRUM-1110.md`, apéndice (Jira SCRUM-1110 c.16732, leído hoy) | 1-2: `4138` · 3: `1207` · 4: `1239` · 5 y 6: `AceptadoConErrores` (2004, 2007) · 7: `Correcto` |
| las dos sondas del 28-sep, de alta | `docs/master/SCRUM-1398.md` (transcribe Jira SCRUM-1211 c.17334, leído hoy) | `Correcto` las dos |
| el duplicado del 28-sep | el mismo | error 3000 |
| qué consta y qué no | `docs/master/SCRUM-1399.md` | ninguna respuesta a una anulación ni a una R1 |

Tres altas con `Correcto` (una del 24-sep, dos del 28-sep). De la R1 `PRUEBA-AEAT-963853`, generada el
28-sep, no hay rastro de envío ni de respuesta (lo dice `SCRUM-1398.md`; aquí no se ha vuelto a medir).

## ③ Con qué entorno y con qué titular constan — leído de `docs/` y de Jira, de ningún certificado

**Entorno.** El de **pruebas** de la AEAT: `preportal.aeat.es` → VERI*FACTU → «Cliente de servicio web»,
un invocador manual (fichero, endpoint, enviar). Lo presentado ahí «no tiene trascendencia tributaria»
(literal de la AEAT recogido en `SCRUM-1225.md`). **No consta en ningún sitio qué host de pruebas se eligió
en el formulario** (`prewww1` o `prewww10`).

**Titular.** Lo que está escrito, y nada más:

- Alta aceptada el 24-sep: «obligado `05292751Z`» (`SCRUM-1110.md:114-115` y c.16732). Es el NIF que el
  propio guion pone de ejemplo junto al nombre de Javier (`scripts/sobre-soap-prueba-aeat.mjs:39`).
- «Los envíos los hizo Javier desde su navegador con su certificado» (c.16732); «certificado FNMT» y
  «certificado personal» (`SCRUM-1110.md:11` y `:92`).
- Las dos del 28-sep: «mismo emisor» y «con su certificado» (c.17334). **El NIF no está escrito.**

**Lo que NO consta y no se ha mirado:** que el titular del certificado sea ese NIF. Ninguna sesión lo ha
comprobado, y no se comprueba aquí: habría que abrir un certificado. Lo sostiene que Javier lo dice y que
la AEAT no rechazó por autorización (su catálogo tiene el `4112`, «el titular del certificado debe ser
Obligado Emisión, Colaborador Social, Apoderado o Sucesor»). Eso es una lectura, no una medición.

**¿Un «aceptado» valida nuestro XML o sólo la autorización?** Leído de la secuencia del 24-sep: antes del
`Correcto`, la AEAT contestó `1239` (el destinatario), `2004` (la fecha) y `2007` (la cadena). Son avisos
sobre el CONTENIDO del registro: llegó a leerlo. Así que el `Correcto` dice algo del XML — **para el caso
«obligado = titular», que es el único probado**. No dice nada de:

- YaQu remitiendo por un tercero o como colaborador social. Pide la SL y el Convenio 017
  (`SCRUM-1225.md`), y es el modelo que `docs/SIF_SPEC_NOTES.md` §3 deja en «[VALIDAR con asesor]».
- El transporte: ningún envío pasó por `sif.client.ts`.
- Anulaciones y R1.
- Producción.

No cierra S1-D (≥10 consecutivos de alta, anulación y R1) y **no levanta la regla 7: cero claims**. La nota
de la skill no añade ninguna afirmación fiscal: quita una falsa y pone cuatro límites.

## De paso, sin número y sin tocar

- **Un cabo suelto que no cierro.** El guion pone por defecto el destinatario igual al emisor
  (`sobre-soap-prueba-aeat.mjs:78`), y el catálogo de la AEAT tiene el `1193`: el NIF del destinatario
  «debe ser distinto del NIF ObligadoEmision». El envío 7 salió `Correcto`. O se pasó `--dest-nif`, o el
  entorno de pruebas no aplica el `1193` a ese caso. **Sin determinar:** no está escrito qué destinatario
  llevó el envío 7, y saberlo pide el fichero enviado o un envío nuevo.
- `docs/SIF_SPEC_NOTES.md` sigue marcando `[VALIDAR]` los 240 s (líneas 86 y 158) que `SCRUM-1110.md`
  dice haber confirmado con el literal del `2004`. No se toca aquí: el ticket es de la skill.

## Lo que NO se ha medido

- Ningún certificado, contraseña ni clave. Ninguna base de datos. La AEAT: hoy no se ha enviado nada.
- Los `tmp/ultimo-registro.json` de ningún árbol.
- Otras redacciones de la misma frase fuera de `.claude/skills`, `.agents/skills`, `CLAUDE.md`,
  `docs/SIF_SPEC_NOTES.md` y `docs/AUDITORIA_RRSIF.md`: en esos cinco, buscando «no hay pruebas», «no hay
  envío», «nunca se ha enviado» y «pruebas contra la AEAT», sólo sale la línea 87 de la skill. El resto del
  repositorio no se ha barrido para eso.
- La suite completa no se ha corrido en este árbol (anidado, sin `dist/` propio): lo corrido va en la entrega.
