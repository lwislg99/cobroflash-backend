# SCRUM-1102 · REDEME, SII y las exclusiones del RRSIF: la medición, contra el BOE

**Medido contra:** `origin/main` = `bf4d82c68cc74c390af36f92c90cdb915e8c31e8` · 2026-09-25T18:12:23Z

Sesión J1 (`jv-j1`), 25-sep-2026. Este documento **solo mide: no construye nada**. No hay rama de
código, no se toca el máster y no se ha cambiado el alcance del ticket. J1 paró porque el alcance
medido no es el del enunciado. Las decisiones (a) y (b) de §⑤ están en manos del fundador, y la (c)
ya es SCRUM-1129.

## ⓪ Las fuentes, y cómo se leyeron

Textos consolidados del BOE, descargados el 25-sep-2026 y leídos **literalmente**. Se extrajo el
texto del HTML y se buscó cada artículo por su encabezado exacto, no por un resumen. Las citas de
abajo son copia literal.

| norma | BOE | consolidación | sha256 del HTML (16) |
|---|---|---|---|
| Reglamento del IVA (RIVA), RD 1624/1992 | `BOE-A-1992-28925` | «Última actualización publicada el 28/02/2026» | `5761105b8dc2354b` |
| Reglamento de los SIF (RRSIF), RD 1007/2023 | `BOE-A-2023-24840` | «Última actualización publicada el 03/12/2025» | `fb9c94138436c048` |

Trampa del instrumento, anotada: la primera búsqueda de «Artículo 30» cogió el **30 ter**, y la de
«Artículo 62» el **62 ter**. Se corrigió exigiendo `Artículo N.` seguido de mayúscula. Después hubo
exactamente una coincidencia para cada uno.

## ① Las citas del asesor quedan VERIFICADAS

El asesor (23-sep-2026, pregunta 5 de Q-C8) citó de memoria (⚠) los arts. 30 y 62.6 del RIVA.
**Los dos son correctos**, y la cadena que describe se cierra con la norma en la mano:

1. **RIVA art. 30.1**: el REDEME.
   > «Para poder ejercitar el derecho a la devolución establecido en los artículos 116 y 163 nonies
   > de la Ley del Impuesto, los sujetos pasivos deberán estar inscritos en el registro de
   > devolución mensual regulado en este artículo.»

   **Art. 30.4**: la solicitud se presenta en noviembre.
   > «Las solicitudes de inscripción en el registro se presentarán en el mes de noviembre del año
   > anterior a aquél en que deban surtir efectos.»

2. **RIVA art. 71.3, 3.º**: los inscritos liquidan por mes natural.
   > «3.º Los comprendidos en el artículo 30 de este reglamento autorizados a solicitar la
   > devolución del saldo existente a su favor al término de cada período de liquidación.»

3. **RIVA art. 62.6, párrafo 1**: quien liquida por mes natural lleva los libros por el SII.
   > «…deberán llevarse a través de la Sede electrónica de la Agencia Estatal de Administración
   > Tributaria, mediante el suministro electrónico de los registros de facturación, por los
   > empresarios o profesionales y otros sujetos pasivos del Impuesto, que tengan un periodo de
   > liquidación que coincida con el mes natural de acuerdo con lo dispuesto en el artículo 71.3
   > del presente Reglamento.»

4. **RRSIF art. 3.3**: a esos no se les aplica el RRSIF.
   > «El presente Reglamento no se aplicará a los contribuyentes que lleven los libros registros en
   > los términos establecidos en el apartado 6 del artículo 62 del Reglamento del Impuesto sobre el
   > Valor Añadido…»

**Conclusión del asesor, confirmada:** un profesional en REDEME queda fuera del RRSIF y, por tanto,
fuera de lo que YaQu hace con VeriFactu.

## ② 🔴 Hallazgo 1 · la exclusión es «lleva el SII», no «está en REDEME»

El art. 3.3 no excluye a los del REDEME: excluye a **todo el que lleve los libros «en los términos
del art. 62.6»**. El REDEME es **una puerta de varias**:

- **La opción voluntaria**, en el párrafo 2 del mismo 62.6:
  > «Además, aquellos empresarios o profesionales y otros sujetos pasivos del Impuesto no
  > mencionados en el párrafo anterior, podrán optar por llevar los libros registro […] a través de
  > la Sede electrónica de la Agencia Estatal de Administración Tributaria en los términos
  > establecidos en el artículo 68 bis de este Reglamento.»
- **Las otras entradas a la liquidación mensual** del art. 71.3, que llevan al SII obligatorio
  igual que el REDEME:
  - 1.º, volumen de operaciones el año anterior de más de 6.010.121,04 €;
  - 2.º, adquisición de un patrimonio empresarial que lleve a superar esa cifra;
  - 4.º, régimen especial del grupo de entidades;
  - 5.º, titulares de depósitos fiscales de hidrocarburos.

**Una pregunta por el REDEME dejaría fuera a los demás**: es el mismo fallo, en el otro sentido.
**La pregunta que detecta la exclusión es «¿llevas el SII?»**. El texto exacto, si se decide
hacerla, lo firma el fundador (regla 39).

Dato relacionado, también literal (RIVA art. 30.3 d): no puede inscribirse en el REDEME quien
«realice actividades que tributen en el régimen simplificado».

## ③ 🔴 Hallazgo 2 · la línea 1858 del máster es FALSA en dos de sus cuatro puntos

`docs/YAQU_MASTER.md:1858` dice:

> `| Exclusiones: módulos, recargo equivalencia, forales, SII | ✅ | RD 1007/2023 |`

Contrastada con el RD 1007/2023 que ella misma cita:

| exclusión que afirma | qué dice el RD | ¿cierta? |
|---|---|---|
| **SII** | art. 3.3, citado arriba | ✅ sí |
| **forales** | art. 1: «En relación con los territorios históricos del País Vasco y en la Comunidad Foral de Navarra, el presente Reglamento será de aplicación a los obligados tributarios a que se refiere el artículo 3 de este Reglamento cuando tengan su domicilio fiscal en territorio común.» | ⚠️ cierta **según el DOMICILIO FISCAL**, no según el territorio donde se trabaja |
| **módulos** (régimen simplificado) | art. 10, abajo | 🔴 **NO**: están dentro |
| **recargo de equivalencia** | art. 10, abajo | 🔴 **NO**: están dentro |

**Por qué el art. 10 lo demuestra.** Es el artículo del contenido del registro de facturación de
alta, y dice:

> «Se informará además si la operación documentada ha sido realizada por un contribuyente al que le
> sea de aplicación el régimen simplificado o el régimen de recargo de equivalencia del Impuesto
> sobre el Valor Añadido.»

**No se informa del régimen de quien está excluido.** Si la norma obliga a que el registro diga que
el emisor está en simplificado o en recargo, es que ese emisor **genera registros**: está dentro del
RRSIF. Este razonamiento vale más que la cita suelta. Una exclusión no puede convivir con la
obligación de informar de ella en un registro que el excluido no tendría que hacer.

🔴 **El daño que se evita.** El punto 2 del ticket pedía «censar qué pasa hoy con las otras tres
exclusiones ya declaradas (módulos, recargo de equivalencia, forales)» para detectarlas en el alta.
**Censar las cuatro exclusiones para detectarlas en el alta habría hecho que DOS de ellas echaran a
clientes que la norma obliga a atender.** Los profesionales en módulos y en recargo son, además,
buena parte de los oficios.

**Por qué una línea con ✅ es peor que una sin marcar:** el ✅ la da por verificada, y **nadie
vuelve a comprobar lo que ya figura como comprobado**. No estaba registrada como falsa en ningún
sitio: `git grep` de «Exclusiones: m…» en `docs/` y `.claude/` solo devuelve esta línea y su copia en
`docs/historico/`, y no aparece en el inventario de SCRUM-528.

Corregirla es **cambio de máster** (regla 35), y lo firma el fundador. Aquí no se toca.

## ④ El estado del código hoy (solo lectura)

- `REDEME`, `SII` y «suministro inmediato»: **0 apariciones** en `src/`, `public/` y `prisma/`.
- `model Merchant` **no tiene ningún campo de régimen fiscal**: solo `taxId`, `country` y `timezone`.
  Guardar cualquier respuesta del alta exige una columna nueva (ALTER, A5).
- El `recargoEquivalencia` que existe (`Customer`, SCRUM-294) es **el del CLIENTE** destinatario,
  no el del profesional. No sirve para esto, y no debe confundirse.
- «foral», «Navarra» y «País Vasco»: 0 en código. El territorio y el régimen del impuesto (IGIC,
  IPSI) son SCRUM-646. `zonaDelMerchant.ts` resuelve el huso horario y avisa expresamente de que
  **no** resuelve el impuesto.
- **Hallazgo 3, ya es SCRUM-1129:** `registro.builder.ts:55` fija `CLAVE_REGIMEN_GENERAL = '01'`, y
  las líneas 313 y 328 lo aplican a todos los registros. Con el art. 10 en la mano, un emisor en
  simplificado o en recargo necesitaría informarlo. **Qué código de `ClaveRegimen` corresponde a
  cada régimen NO SE HA VERIFICADO:** el XSD `SuministroInformacion.xsd` enumera `01…20` sin su
  significado, y dar el significado de memoria sería una cita no verificada. Arreglarlo es camino de
  emisión (regla 40, STOP). Hoy no afecta, porque `INVOICING_ES_ENABLED` y `SIF_ENABLED` están en OFF.

## ⑤ Lo que queda por decidir (no lo decide J1)

- **(a) Corregir la línea 1858 del máster.** Firma del fundador. Redacción propuesta, a efectos de
  revisión: «Exclusión: quien lleve los libros por SII (RIVA 62.6: REDEME, más de 6 M€, grupos,
  depósitos fiscales o por opción del 68 bis) y quien tenga el domicilio fiscal en territorio
  foral. Módulos y recargo de equivalencia NO excluyen: se informan en el registro (RRSIF art. 10)».
- **(b) El alcance de SCRUM-1102** pasaría de «detectar REDEME» a «detectar el SII y el domicilio
  foral». Arrastra una columna nueva en `merchants` (ALTER, A5) y una pregunta de cara al usuario
  (regla 39). Recordatorio del enunciado: **se pregunta, no se asesora** (regla 7).
- **(c) `ClaveRegimen`:** SCRUM-1129, abierto por el orquestador.

## ⑥ Lo relacionado que no se toca aquí

El asesor añadió en la misma respuesta que **el SII elimina el 347 y VeriFactu NO**. Afecta a
SCRUM-1067. **No se ha verificado en esta medición**: queda como dicho por el asesor, pendiente de
cotejar.
