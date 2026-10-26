// ¿Quién mete DATABASE_URL_* en el entorno al cargar la app? Mide antes y después de cada import.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const raiz = path.resolve(process.argv[2]);
process.chdir(raiz);
const cuenta = () => Object.keys(process.env).filter((k) => /DATABASE_URL/.test(k) && process.env[k]).join(',') || '(ninguna)';
console.log('0 al arrancar:', cuenta());
createRequire(path.join(raiz, 'dist', 'core', 'config', 'loadEnv.js'))('dotenv').config = () => ({ parsed: {} });
await import(pathToFileURL(path.join(raiz, 'dist', 'core', 'config', 'loadEnv.js')).href);
console.log('1 tras loadEnv (dotenv doblado):', cuenta());
await import(pathToFileURL(path.join(raiz, 'dist', 'core', 'db', 'prisma.js')).href);
console.log('2 tras prisma.js:', cuenta());
await import(pathToFileURL(path.join(raiz, 'dist', 'app.js')).href);
console.log('3 tras app.js:', cuenta());
process.exit(0);
