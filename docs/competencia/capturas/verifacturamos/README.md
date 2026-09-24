# Verifacturamos · POR DENTRO (21-sep-2026, parcial)

👁 **Visto por dentro**, con cuenta de prueba. Autorizado por el fundador en el chat de la Sesión 0 el
21-sep-2026 (correo `lwislg99@gmail.com`; sin tarjeta, sin SMS, sin enviar nada a terceros, datos
inventados, baja al terminar). Capturas hechas ≈08:20-08:25Z, `https://app.verifacturamos.com`.

**Cuenta abierta** (competidor: Verifacturamos · alta: 21-sep-2026 ≈08:20Z · correo: `lwislg99@gmail.com`
· nombre «Consultoria Prueba» · empresa ficticia «Consultoria Prueba SL»). **Sigue abierta; hay que
darla de baja al terminar.** La contraseña NO está en git.

| captura | qué se ve |
|---|---|
| `01-alta-formulario.png` | El alta pide **nombre, correo y contraseña** (con indicador de fuerza), acepta política y términos y una casilla de comunicaciones comerciales **sin marcar**. **Sin NIF, sin tarjeta, sin teléfono.** Cabecera: «20 facturas gratis para empezar · Sin tarjeta de crédito». |
| `02-onboarding-paso1-empresa.png` | Tras crear la cuenta **no verifica el correo**: entra directo a un asistente de tres pasos (Empresa · Numeración de facturas · Dirección). Paso 1: tipo de entidad (Autónomo / Empresa / Otro), nombre de la empresa y **NIF, ambos obligatorios**. |
| `03-onboarding-tras-siguiente.png` | Paso 2, «Numeración de facturas»: *«Si ya has facturado este año, podemos continuar tu numeración… De lo contrario, empezaremos desde el número 1»*, con «Sí, ya he facturado este año» / «No, soy nuevo», y botones Atrás / **Saltar** / Siguiente. |

## Lo medido por dentro (y lo que corrige de la web)
- **La web decía «Solo tu email y tu NIF»; el alta NO pide NIF, lo pide el asistente justo después** (§3 de `matriz.md` ya lo apuntaba a medias: «el formulario no pide NIF»). **El NIF es obligatorio para ver la app** y **se valida por dígito de control** (`B12345678`, el ejemplo de su propio campo, se rechaza con «El NIF introducido no es válido»; `B00000000` pasa).
- El alta **no exige verificar el correo**.
- **La numeración se pregunta en el alta**, con salto permitido: es su forma de la «migración conservando la numeración» que anuncia la web (⛔ dato de mercado, fiscal).

## Datos inventados usados
Empresa «Consultoria Prueba SL», NIF `B00000000` (formalmente válido, sin entidad real detrás),
correo del fundador. **Nada se emitió ni se envió a nadie.**

## Dónde se paró y qué falta (necesita seguir)
Se paró **en el paso 2 del asistente** por cierre de la sesión (fin de uso), **sin haber visto todavía lo
que importa: las opciones de cada documento (presupuesto, albarán, factura), el dashboard de tres
botones y el «Convertir en factura»**. Para seguir: entrar en `app.verifacturamos.com/login` con el
correo y la contraseña guardada fuera de git; el asistente puede quedar en el paso 2.
