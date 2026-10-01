# Detalle del modo de emisión en Ajustes, modo `receipt` — SCRUM-1257 (P8)

**Aprobado por el orquestador por delegación del fundador** el 1-oct-2026 — SCRUM-1257 comentario 17676.

## Texto aprobado, literal

> Por ahora, YaQu no genera facturas desde tu cuenta.

## Dónde se pinta

| texto | dónde | qué sustituye |
|---|---|---|
| «Por ahora, YaQu no genera facturas desde tu cuenta.» | `public/dashboard/js/settingsView.js`, `DETALLE_MODO_EMISION.receipt` (fila del modo, pestaña «Cumplimiento») | la tercera redacción, firmada en SCRUM-1220 comentario 17385, que añadía «ni justificantes» tras «facturas» |

## Qué cambió y por qué

Se quitan dos palabras. El texto nuevo **no afirma nada sobre justificantes: solo deja de
mencionarlos.** Es, carácter a carácter, el que ya se pinta en el vacío de Facturas en este mismo
modo (P2, SCRUM-1257 comentario 17444), así que las dos pantallas dicen lo mismo.

Por eso lo firma el orquestador por delegación y no sube al fundador: una frase que dijera que YaQu
ya no genera justificantes afirmaría un hecho sobre el producto. Ésta retira una mención.

El comentario 17444 dejó esta ranura sin firmar hasta que SCRUM-825 retirase la figura. Medido el
1-oct-2026 contra `origin/main` `e9e71cab`: ninguna petición puede crear hoy un documento de tipo
justificante. El detalle, con sus poblaciones, está en `docs/master/SCRUM-1257.md` (sección
SCRUM-1257d) y en el comentario 17676.

**Sobre qué descansa la firma y sobre qué no:** descansa en el código de hoy, no en un guard que se
haya visto caer si alguien devolviera un generador de referencias `J-`. Y no se ha medido ninguna
base: «no se pueden crear nuevos» no dice cuántos documentos `J-` antiguos existen.

## Lo que queda sin firmar en esa misma pantalla

Nada de la fila del modo. Los rótulos que solo ven los documentos `J-` antiguos (ficha de la
factura, ficha del trabajo, Cobros) **no se renombran**: lo decide SCRUM-1252 (reglas 7 y 29).
