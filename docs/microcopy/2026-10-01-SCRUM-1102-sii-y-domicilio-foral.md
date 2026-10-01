# Configuración › Empresa — las dos preguntas del SII y del domicilio foral · SCRUM-1102

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1102** (comentario 17709: «2-Sí firmo»).

Leído por J2d en Jira. La pregunta se la hizo el orquestador del equipo de Javier y la respuesta
está transcrita por él en ese comentario: J2d no se la oyó al fundador.

## Texto aprobado, literal

Son los rótulos de dos selectores. Cada uno es una pregunta entera, con sus signos.

> ¿Llevas los libros de IVA por el SII?

> ¿Tienes el domicilio fiscal en el País Vasco o en Navarra?

## Dónde se pinta

`public/dashboard/js/settingsView.js`, pestaña Empresa de Configuración, debajo de «Criterio de
caja»: los `<label>` de los selectores `name="llevaLibrosPorSii"` y `name="domicilioFiscalForal"`.

## Qué cambió y por qué

Son nuevos. Las dos columnas existían en la base desde el 25-sep-2026 y ninguna pantalla las
preguntaba. Van en Configuración y no sólo en el alta porque la respuesta puede cambiar durante el
ejercicio (`docs/master/SCRUM-1102.md`, anexo SCRUM-1102e §②).

Se pregunta el hecho que el profesional conoce. Ninguno de los dos lleva texto de ayuda: decirle
qué régimen le corresponde o qué consecuencia tiene sería asesorarle (regla 7).

## Queda sin firmar

Nada en esta ranura. Esta ficha firma **sólo los dos enunciados**: los rótulos de las opciones de
los dos selectores tienen su propia ficha y su propia firma (comentario 17721), porque el 17709 los
daba por incluidos en una terna «que ya existe» y la que existe dice otra cosa.
