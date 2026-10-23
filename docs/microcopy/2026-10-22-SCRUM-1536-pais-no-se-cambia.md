# Configuración › Empresa y asistente — el país no se cambia una vez creada la cuenta · SCRUM-1536

**Aprobado por el fundador** el 22-oct-2026, en **SCRUM-1536** (comentario 20245: «Ok me parece bien»).

Leído por J3 (sesión `jv-j3z`) en Jira. La decisión y la firma las dio el fundador en el chat de su
orquestador (`cobroflash-backend-5f`), que las transcribe en ese comentario: J3 no se las oyó al
fundador. El literal se ha copiado de la propuesta P1 de c.20242, como manda c.20245, y se ha
comparado por bytes con los dos comentarios.

## Texto aprobado, literal

> El país no se puede cambiar una vez creada la cuenta. Escríbenos por WhatsApp y lo vemos contigo.

La segunda frase ya estaba firmada (`MSG_SERIE_YA_EMITIDA`, 5-ago-2026); la primera es nueva.

## Dónde se pinta

- `src/modules/system/merchantAdmin.ts` (`MSG_PAIS_NO_CAMBIABLE`). Lo manda `PUT /admin/merchant`
  en `message` con el 409 `pais_no_cambiable` cuando el cuerpo trae un país distinto del guardado.
- Ninguna pantalla lo provoca: Empresa y el paso 1 del asistente ya no mandan el país al guardar, y
  lo enseñan como texto (la etiqueta «País» y el nombre del país, que ya estaban). Lo verá quien
  llame a la ruta con otro país.

## Qué cambió y por qué

Es nuevo. Medido en SCRUM-1536f (c.20242): pasar un comercio de ES a otro país encendía la factura
sin VeriFactu y con cobro (regla 24), y de otro país a ES se saltaba la exclusión territorial de
1536d. El fundador eligió la opción (a) en c.20245: «Sí de momento la A».

Se quita, sin sustituirla, la nota de Empresa «Cambia el idioma de los documentos ("Presupuesto" vs
"Cotización") y la moneda por defecto.»: describía un cambio que ya no se puede hacer.

## Queda sin firmar

Nada de lo que se aplica aquí.
