# Alta y Configuración › Empresa — forales y Canarias, fuera por ahora · SCRUM-1536

**Aprobado por el fundador** el 22-oct-2026, en **SCRUM-1536** (comentario 20225: «Ok firmo todas»).

Leído por J3 (sesión `jv-j3w`) en Jira. La pregunta se la hizo el orquestador del equipo de Javier
(`cobroflash-backend-5f`) en el chat y la respuesta está transcrita por él en ese comentario: J3 no
se la oyó al fundador. Los literales se han copiado de c.20223 §⑤, como manda c.20225, y no del
comentario de la firma.

## Texto aprobado, literal

**Q1 · las dos preguntas del alta.** La primera ya estaba firmada (SCRUM-1102 c.17709, y tiene
su propia ficha de ese ticket); la segunda es nueva.

> ¿Tienes el domicilio fiscal en el País Vasco o en Navarra?

> ¿Tienes el domicilio fiscal en Canarias?

**T1a · quien queda fuera en el alta, por su domicilio fiscal.**

> De momento YaQu no está disponible si tienes el domicilio fiscal en el País Vasco, Navarra o Canarias.

**T1a, variante para quien trabaja en Canarias** (Canarias por las dos vías, c.20225 ①: «Ok las 2»).

> De momento YaQu no está disponible para trabajos en Canarias.

**T2a · en Configuración, al marcar «Sí» en la pregunta foral.**

> De momento YaQu no está disponible con el domicilio fiscal en el País Vasco o en Navarra. No hemos guardado este cambio.

## Dónde se pinta

- **T1a y su variante:** `src/modules/auth/domain/territorioDeAlta.ts` (`TEXTO_FUERA_POR_DOMICILIO`,
  `TEXTO_FUERA_POR_TRABAJO`). Hoy no los pinta ninguna pantalla: el alta pública está cerrada
  (`POST /auth/register` da 409, SCRUM-1515) y la consola del equipo (`altaDeMerchant.ts`) los
  devuelve en `texto` para que se los diga a esa persona quien lanza el alta.
- **T2a:** el mismo fichero (`TEXTO_FORAL_EN_AJUSTES`). Lo manda `PUT /admin/merchant` en
  `message` con el 409 `territorio_excluido`, y `public/dashboard/js/settingsView.js` lo pinta en el
  aviso de error de la pestaña Empresa, sin el «Error al guardar:» de delante.
- **Q1:** la primera sigue pintándose en Configuración, como ya se pintaba. **La segunda no se pinta
  en ninguna pantalla todavía**: su sitio es `public/register.html` cuando se reabra el alta
  (registro 1536c, pieza C). En la consola son `--domicilio-foral` y `--domicilio-canarias`.

## Qué cambió y por qué

Son nuevos. El fundador decidió el 22-oct-2026 (c.20218) que los domicilios forales y Canarias no
entran en YaQu por ahora, no sólo sin facturación. Ninguno lleva claim fiscal, fecha ni promesa.

## Queda sin firmar

Nada de lo que se aplica aquí. Descartadas en c.20225: T1b, T1c, T2b y Q2.
