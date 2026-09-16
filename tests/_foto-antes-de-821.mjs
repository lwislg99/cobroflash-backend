// tests/_foto-antes-de-821.mjs — SCRUM-821c
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA FOTO CONGELADA DE LO QUE SE FOTOGRAFIABA ANTES DE SCRUM-821 — y por qué está aquí y no en git.
//
// ── EL DEFECTO QUE CIERRA, REPRODUCIDO ANTES DE TOCAR NADA ──────────────────────────────────
// `scrum821b` leía la lista vieja de `capture-demo.mjs` **en el punto de partida de la rama**,
// buscando la cadena `const AUTH_VIEWS = [`. El día que SCRUM-821 se mergeó, esa cadena dejó de
// existir en `main` —su ticket consistía justo en que la lista dejara de mantenerse a mano, y
// ahora es `const AUTH_VIEWS = vistasDelBarrido(RAIZ).map(…)`—, así que toda rama nacida después
// tiene un punto de partida donde el literal no está. Los tres tests salían CIEGOS y el job
// entero en rojo, bloqueando todo merge.
//
// Reproducido en árbol COMPLETO (no superficial) el 8-sep-2026, con el mensaje exacto del runner:
//   «🔴 CIEGO: no se pudo leer la lista vieja de `origin/main`: no encuentro `AUTH_VIEWS` en la
//    versión de origin/main»
// El clon superficial NO era la causa: el job de tests ya usa `fetch-depth: 0` (`ci.yml`).
//
// ── POR QUÉ UN TRINQUETE Y NO UNA LECTURA DE GIT ────────────────────────────────────────────
// 🔴 EL ESPEJO SE MOVÍA. Un test que lee git en tiempo de ejecución mide EL CHECKOUT, no el
// código: depende de la profundidad del clon, de si la rama base ya se mergeó y de en qué runner
// corre. Nada de eso es una propiedad del producto, y las tres cosas cambian solas.
//
// Y se movía en DOS sitios, no en uno. El segundo no daba rojo y era peor:
//   ① la lista vieja  → dejó de poder leerse (el rojo visible);
//   ② los HASHES      → `bytesEnLaBase` comparaba las capturas contra el punto de partida, y una
//      vez 821 mergeado ese punto YA CONTIENE las capturas de hoy. La comparación se volvía
//      «cada fichero contra sí mismo»: verde garantizado sobre nada. Un guard silenciosamente
//      vacío, que es exactamente lo que este fichero existe para no dejar pasar.
//
// Congelado, no depende de git, ni de la red, ni del runner. Duele cuando cambia — ése es su
// trabajo (mismo patrón que el número congelado a mano de `scrum522`).
//
// ── QUÉ ES ESTO EXACTAMENTE ─────────────────────────────────────────────────────────────────
// Las 12 vistas que `AUTH_VIEWS` enumeraba A MANO y el `sha256` de la captura de cada una,
// leídos de `6cbb60fd593f1418c293f68f36689df0fbe33c1c` — el commit ANTERIOR a que SCRUM-821 derivara la lista
// (`a902726c^`, padre de «SCRUM-821: la lista que decide que se mira deja de mantenerse a mano»).
//
// ⛔ ESTO NO SE «ACTUALIZA» PARA QUE EL TEST PASE. Es el pasado, y el pasado no cambia. Si una
// captura de éstas deja de cuadrar, lo que hay que mirar es la captura, no esta lista.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** El commit del que salió esta foto. Sirve para poder volver a mirarlo, no para leerlo en vivo. */
export const COMMIT_DE_LA_FOTO = '6cbb60fd593f1418c293f68f36689df0fbe33c1c';

export const VISTAS_ANTES_DE_821 = Object.freeze([
  { nombre: '01-home', url: '/dashboard/#home',
    sha256: 'a28264e4dcd9d3eb25d960d798c062ce5f68bd1e43857ce408ef9b7b26cf7f5d' },
  { nombre: '04-quotes-new', url: '/dashboard/#quotes-new',
    sha256: 'b62356abe528447a886fffec993ab7ffd84ca7405d4ab56c37c8fb12c07b24fe' },
  { nombre: '05-quotes-list', url: '/dashboard/#quotes-list',
    sha256: '7a38ea774158ea9dbed06457141fb8e02fb250df4085c2eda139d9d6f24e792a' },
  { nombre: '06-customers', url: '/dashboard/#customers',
    sha256: '9ad8080e72fe4fb77fb3643b3276f705f45ee49212a69beb64bdce5fcae0dd69' },
  { nombre: '07-products', url: '/dashboard/#products',
    sha256: '172e87d5876a0251f27633b9ef2ea876bed2e2bc7ff262f0ffe3202ed5e6e556' },
  { nombre: '08-invoices', url: '/dashboard/#invoices',
    sha256: '54202e49a799bdc5c5076d508ddd8a6839e7fc34413d0c02dc68015b663e1e2e' },
  { nombre: '09-reports', url: '/dashboard/#reports',
    sha256: '8d30846f978452100a9607fa84a54fd25513263eb5dd7344fca4a6a825421d7b' },
  { nombre: '10-quote-requests', url: '/dashboard/#quote-requests',
    sha256: '1e90c14d4d8f90960164d9a55921abd0b1d6c68fe8cd1ac98eee3cd2f119307f' },
  { nombre: '11-expenses', url: '/dashboard/#expenses',
    sha256: '51cb7b9770d6cdaa90568522c73b0f1deab2318f26017a8e3b0089513967966c' },
  { nombre: '12-providers', url: '/dashboard/#providers',
    sha256: '4ece1495cebb0553e2d52b242e6d0d1a273b79be11d3f09db71a754907983777' },
  { nombre: '13-team', url: '/dashboard/#team',
    sha256: '90dd04e43a90eaab66bde586ed30f5d5876173a1246991434a3d6a5d53f87c80' },
  { nombre: '14-settings', url: '/dashboard/#settings',
    sha256: '21124f0001e1811d7e9633992588f2e4bdf93c2f437e07a75dc7a602fbd3565f' },
]);
