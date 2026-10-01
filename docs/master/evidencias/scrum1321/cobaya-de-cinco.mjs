// Cobaya: CINCO tests declarados; el tercero mata el proceso a medias con código 0.
// Deja un testigo de ejecución por test (A21) en el fichero que diga TESTIGO.
import test from 'node:test';
import fs from 'node:fs';

const TESTIGO = process.env.TESTIGO;
const marca = (n) => { if (TESTIGO) fs.appendFileSync(TESTIGO, `${n}\n`); };

test('uno', () => { marca('uno'); });
test('dos', () => { marca('dos'); });
test('tres · muere aquí', () => { marca('tres'); if (process.env.MORIR === '1') process.exit(0); });
test('cuatro', () => { marca('cuatro'); });
test('cinco', () => { marca('cinco'); });
