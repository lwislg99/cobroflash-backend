# Exportación VeriFactu — motivo de exclusión: sellada como F1, se declararía como F2 · SCRUM-1258

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1258** (comentario 17713: «2-Ok la tuya más corta»).

La firma no me llegó a mí: el orquestador del equipo de Javier le presentó dos versiones, transcribió
su respuesta en ese comentario y me pasó el literal. J1c lo leyó después en Jira y lo copió de allí,
no del mensaje.

## Texto aprobado, literal

Es UN texto de dos frases, que se pinta seguido y separado por un espacio. Va una frase por línea
porque así lo leen los guards que cruzan lo firmado con el código, y cada frase está entera.

> Esta factura se selló como factura completa (F1) y el registro la declararía como simplificada (F2).
> El tipo forma parte de la huella y no puede cambiar después de sellar, así que queda fuera del registro.

## Dónde se pinta

Constante `MOTIVO_SELLADA_F1_DECLARADA_F2` en `src/modules/fiscal/verifactu/registro.builder.ts`.
Es el `motivo` de una factura excluida del registro: sale en `excluidos` de la exportación
(`src/modules/exports/app/routes/exports.routes.ts`, la ruta suelta y el paquete) y dentro del
propio XML, en el comentario que lista las facturas que quedan fuera.

Hoy no se pinta en ninguna exportación real: sólo aparece si el modo de las facturas sin NIF del
cliente resuelve un tipo distinto del sellado, y el modo vigente no lo hace.

## Qué cambió y por qué

Texto nuevo. Antes de SCRUM-1258 esa factura no se excluía: salía declarada como F2 con la huella
calculada sobre F1.

Se propusieron dos redacciones. El fundador eligió ésta porque nombra los tipos en palabras
(«factura completa», «simplificada») antes de las siglas: quien lee el paquete puede ser una
gestoría o el propio profesional.

## Queda sin firmar

Nada. Si algún día otro par de tipos pudiera discrepar, no hay texto para él: el código lo trata
como un error con código, que detiene la exportación, y no como una exclusión con motivo.
