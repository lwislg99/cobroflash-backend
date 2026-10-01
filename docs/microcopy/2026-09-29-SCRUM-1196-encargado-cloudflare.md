# Política de privacidad, §5 «Con quién compartimos los datos» · Cloudflare (L3) · SCRUM-1196

**Aprobado por el fundador** el 29-sep-2026, en **SCRUM-1196**.

Javier firma **en persona**, no por delegación: es texto legal publicado (regla 39). Consta en el
comentario 17453 de SCRUM-1196: a la pregunta literal «¿Firmas L1, L3 y L6?» contestó **«Sí firmo
todas»**. El literal de L3 es el de la tabla L1–L6 de `docs/master/SCRUM-1196.md`, sin cambiar una
coma.

## El texto aprobado

| Ranura | Texto aprobado |
|---|---|
| `encargado-cloudflare` | `<li><strong>Cloudflare</strong> — red de entrega y seguridad por la que pasa todo el tráfico de yaqu.app, incluidas las páginas de presupuesto, firma y pago que abren tus clientes (dirección IP, navegador y dirección de la página); también gestiona el correo que se recibe en las direcciones @yaqu.app (transferencia internacional).</li>` |

## Dónde se pinta

`public/privacidad.html`, §5 «Con quién compartimos los datos», **justo después de la fila de
Railway**, como dice la tabla L1–L6. El guard es `tests/scrum1196-cloudflare-encargado.test.mjs`.

## Lo que NO entra con esta fila

- **L4 (el NEL de Cloudflare):** espera a la decisión del panel del fundador (17453).
- **L5 (el logo por URL):** no se firmó (17453).
- **L1 y L2:** superadas por el texto de SCRUM-1154, ya publicado.

## 🔴 Lo que este texto NO arregla

- **A qué buzón reenvía Cloudflare `hola@yaqu.app`.** Ese destino es otro encargado que L3 no puede
  nombrar (SCRUM-1196, §4 del expediente). Sigue sin determinar.
- **Que Cloudflare reescribe el HTML servido** (ofusca los `mailto:`). No está en el literal firmado
  y se arregla en el panel, no en el texto.
