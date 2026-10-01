# SCRUM-1222 · `scripts/qa/sesion-panel.mjs`: una sola vía, de solo lectura, para entrar al panel de yaqu.app

**Medido contra:** `origin/main` = `15ccc41e94948b2851161789eb17ee1dcc30afd9` · 2026-09-28T14:53:21Z

28-sep-2026 · **S3** (instrumentos). Encargo del orquestador. Con `POST /auth/test-login` encendido
en producción (SCRUM-1210), cada sesión montaba su propio `fetch` en un `node -e` y el clasificador
de permisos lo trataba distinto según la sesión. Un fichero único permite **una regla de permiso
estrecha** sobre él. Uso en `docs/RUNBOOKS.md`, R23.

## Qué garantiza, y cómo se comprueba (`tests/scrum1222-sesion-panel.test.mjs`, 9 tests, sin red)
| Garantía | Cómo |
|---|---|
| Secreto SOLO de `C:/Users/Admin/.yaqu-qa-secret.txt` | Ruta fija; el script no contiene `process.env` (el test lo comprueba) y no acepta el secreto por argumento |
| Ni el secreto ni la cookie salen por pantalla | La cookie se guarda en `C:/Users/Admin/.yaqu-qa-sesion.txt`; el test busca ambos en toda la salida, también en los errores |
| Sin secreto → CIEGO | exit 2, nada por stdout, cero llamadas a la red |
| Login que no da 200 con `pf_session` → lo DICE | exit 1 con el estado (404, 200 sin cookie, 500, red caída), sin guardar sesión |
| `get` no 2xx ≠ «no hay nada» | exit 1, nada por stdout; 401 → «caducó»; 3xx → «NO se sigue» (`redirect: 'manual'`) |
| **Solo lectura** | Todo método que no sea GET, salvo el POST exacto a `/auth/test-login`, se rechaza ANTES de la red (con control positivo: el GET sí sale) |
| **Solo `yaqu.app`** | URL absoluta, `http:`, `//host`, `/\host` y ruta sin `/` → rechazo (exit 3) antes de la red |

**Rojo probado por mutación:** aceptar cualquier método → cae el test de solo lectura; quitar la
comprobación de host → cae el test de host. Metaguardas y tests que leen `RUNBOOKS.md`: 505/505.

⚠️ **No se ha ejecutado contra producción.** Primero la herramienta; después, el fundador autoriza la
regla de permiso sobre este fichero. Ese orden no se invierte.

Nota: el login crea una `authSession` (24 h) en producción. Es inherente a entrar, y es la única
escritura que el instrumento admite.
