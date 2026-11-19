# SCRUM-1770a · Literal propuesto para el MOTIVO de «un XML por año natural» (máster 766-768) — propuesta, sin tocar el máster

**Medido contra:** `origin/main` = `f44a597a66759373fefb06c46d5e77fcfc6add50` · 2026-11-19T00:04:56Z

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: la frase «la cadena de huellas es anual» del máster está partida entre las líneas 767 y 768 por el ajuste de línea, y un grep por línea no la casa; ningún guard sabe dónde corta el ajuste un fichero

Carril J5 (solo documentos). Encargo del orquestador J (`cobroflash-backend-8a`), 19-nov-2026, sobre el «Ok ábrelo» del fundador (descripción de SCRUM-1770). **`docs/YAQU_MASTER.md` NO se toca aquí** (reglas 27 y 35): esto es la propuesta; la firma el fundador en Jira y se aplica en otro PR. Solo norma literal con fuente; no es respuesta de asesor (reglas 17 y 26). **La DECISIÓN no se propone cambiar** («un XML por año natural que toque el rango pedido», fail-closed): solo su motivo y una frase con el criterio del año.

## 1 · El literal propuesto

**Texto de hoy** (`docs/YAQU_MASTER.md:766-768` en `origin/main` `f44a597a6`, dentro de la cita `>`):

> **Decisión del fundador — un XML por AÑO NATURAL que toque el rango pedido** (no por el rango en sí): el registro RRSIF se organiza por ejercicio y la cadena de huellas es anual — recortar por meses rompería el encadenamiento, mezclar años no representaría un registro válido.

**Propuesto** (sustituye esa frase; el resto del párrafo —fail-closed, LEEME, verificación en staging— queda igual):

> **Decisión del fundador — un XML por AÑO NATURAL que toque el rango pedido** (no por el rango en sí). Es una decisión de PRODUCTO, no una exigencia de la norma: la Orden HAC/1177/2024 solo pide que el sistema permita «exportar todos los registros de facturación generados en un periodo» (art. 8.2), sin fijar qué periodo ni con qué calendario, y YaQu toma el año natural porque es el periodo que manejan el profesional y su asesor y el de la exportación para una inspección (R13). El corte no toca la cadena: cada registro lleva dentro los datos y la huella del inmediatamente anterior (art. 7.a), y la cadena es una sola por obligado y sistema desde su puesta en marcha (art. 7.b-c: «cada sistema informático producirá una única cadena de registros de facturación»); no se reinicia por año, y exportar un año no altera ningún registro. **El año de un registro es el de su fecha de expedición en la zona del emisor**, la misma que imprime `FechaExpedicionFactura` (decisión A del fundador, 19-nov-2026, [SCRUM-1761 c.22126](https://yaqu.atlassian.net/browse/SCRUM-1761?focusedCommentId=22126); el código la cumplirá con SCRUM-1761c: hasta entonces el filtro es otro). *[Motivo sustituido el 19-nov-2026 por SCRUM-1770. Decía: «el registro RRSIF se organiza por ejercicio y la cadena de huellas es anual — recortar por meses rompería el encadenamiento, mezclar años no representaría un registro válido». Motivo del cambio: ni el RD 1007/2023 ni la Orden HAC/1177/2024 conocen el «ejercicio» de un registro, y la cadena no es anual (Orden arts. 7.a-c y 8.2, BOE leído el 18 y el 19-nov-2026; SCRUM-1761 c.22115 y este registro).]*

Qué cumple de lo pedido:
- (a) la decisión sale tal cual, con su «(no por el rango en sí)»;
- (b) el porqué del año natural se da como elección de YaQu, y la frase dice que la norma no lo exige; «el periodo que manejan el profesional y su asesor» es motivo de producto, **no lo he leído en ninguna norma**, y así lo dice la frase;
- (c) cita el art. 7 (a, b y c) y el 8.2; las descargas, en §3;
- (d) recoge la decisión A con su enlace, y avisa de que el código aún no la cumple (el filtro de hoy es `createdAt` con el calendario del proceso: SCRUM-1761 c.22059);
- la frase vieja queda entre corchetes con su fecha y su motivo (A8: no se borra, se fecha).

⚠️ «el de la exportación para una inspección (R13)» lo tomo de c.22115 §3 (`docs/RUNBOOKS.md` R13, máster `:461`), **no lo he vuelto a leer hoy**. Si el fundador prefiere no dar ese segundo motivo, la frase se sostiene sin él.

## 2 · Qué más repite el motivo caducado

Medido con `git grep -n -i` sobre `origin/main` `f44a597a6`, población `docs/`, `src/` y `.claude/` (6.247 ficheros):

- Patrón del encargo, `cadena de huellas es anual\|se organiza por ejercicio\|encadenamiento.*anual`: **4 líneas**. Control positivo: la propia `docs/YAQU_MASTER.md:767` sale, pero **solo por «se organiza por ejercicio»**: «la cadena de huellas es / anual» está partida entre la 767 y la 768 y la primera alternativa no la casa (por eso la línea `A9:`).
- Patrón derivado (`cadena de huellas es`, `organiza por ejercicio`, `rompería el encadenamiento`, `cadena … por año/ejercicio`, `registro v.lido`, y otras): sale además la 768; el resto de lo que casa habla de otra cosa (cadena factura→paid, «romper la cadena» en VeriFactu, la condición de entrada en la cadena de SCRUM-328). Control cero: un término fabricado, `zzqx-cadena-anual`, da 0 ficheros.

Las que repiten el motivo:

| fichero:línea | qué dice | de quién | adónde va |
|---|---|---|---|
| `docs/YAQU_MASTER.md:766-768` | el motivo entero | máster (firma del fundador) | este cambio de máster |
| `docs/legal/AUDITLOG_FISCAL_CONTRATO.md:450` | «el registro RRSIF se organiza por año natural y la cadena de huellas es anual» (por qué el `rango` del XML suelto es `ejercicio`) | doc derivado; `carriles.mjs de` → sin cerradura, propone J4 | su registro, en el mismo PR que aplique el máster o detrás; la decisión de las dos formas de `rango` no cambia, solo el motivo |
| `src/modules/exports/app/routes/exports.routes.ts:233-235` | comentario de código: el mismo motivo, palabra por palabra | **S1** (equipo de Luis), `carriles.mjs de` | «Para Luis»: no se toca desde aquí |
| `docs/master/SCRUM-1761.md:59` | es la medición que señala el defecto, no lo repite | — | nada |

## 3 · Las citas del BOE

API de legislación consolidada (`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/<id>/texto`, `Accept: application/xml`), las dos con `HTTP/1.1 200 OK` y `Date: Thu, 19 Nov 2026 00:04:02 GMT`:

| norma | id | B | sha256 | ¿igual que c.22115? |
|---|---|---|---|---|
| Orden HAC/1177/2024 | BOE-A-2024-22138 | 119.057 | `284db49ed40e17ad47fb2447a6e37ef087c192d68336df9bd465fdfcbfd4a4ff` | sí, byte a byte |
| RD 1007/2023 (RRSIF) | BOE-A-2023-24840 | 88.577 | `20d704afa2d24e91cf97e8ec83c41038f1eef964a1ba724ff6f0958425a8ca38` | sí, byte a byte |

Literales (texto quitadas las etiquetas; 596 párrafos en la Orden; el art. 7 va del párrafo 81 al 102 y el 8 del 103 al 112):

1. **Orden, art. 7.c)** (párrafo 91): «c) Para un determinado obligado tributario, cada sistema informático producirá una única cadena de registros de facturación, es decir, todos los registros de facturación de un mismo obligado tributario generados por un mismo sistema informático deberán formar parte de la misma cadena.»
   Y **7.b)** (párrafo 90): «…primer registro de facturación generado en el sistema informático desde su instalación o puesta en marcha inicial…»; y **7.a)** (párrafo 84): «Cada registro de facturación, de alta o de anulación, contendrá el siguiente conjunto de datos referido al registro de facturación, de alta o de anulación, inmediatamente anterior por orden cronológico de fecha de generación:» (4.º: «Los primeros 64 caracteres de la huella o «hash» del registro de facturación inmediatamente anterior.»).
2. **Orden, art. 8.2** (párrafos 105-106; el 105 empieza «2. Los registros de facturación podrán ser conservados fuera del sistema informático que los generó.»): «A este respecto, deberá ofrecer, al menos, la posibilidad de exportar todos los registros de facturación generados en un periodo.»

Controles: `zzqx` da 0 en los dos textos (cero); «huso horario» da 4 en la Orden (positivo, el mismo recuento que c.22115). En el RRSIF, «ejercicio» casa 5 veces y ninguna se refiere a un registro («en el ejercicio de su actividad», «de responsabilidad», «de las habilitaciones», «de su actividad económica», «de sus competencias»): lo mismo que midió c.22115.

**Sin medir:** las tablas del anexo de la Orden (son imágenes en el BOE, c.22115); `docs/RUNBOOKS.md` R13, que cito de c.22115; nada en yaqu.app (no hay superficie: es el máster).
