// Se ejecuta antes de importar cualquier test. Prepara el entorno para que
// db.js levante el pool apuntando a la base de PRUEBAS, nunca a la real.
import 'dotenv/config';

process.env.NODE_ENV = 'test';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'secreto-solo-para-tests-con-largo-suficiente-123456';
}

const testUrl = process.env.TEST_DATABASE_URL;
if (testUrl) {
  // Red de seguridad: los tests hacen TRUNCATE. Si alguien apunta
  // TEST_DATABASE_URL a la base real, se borrarían los datos de verdad.
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL es idéntica a DATABASE_URL. Los tests borran tablas: usa una base aparte.'
    );
  }
  process.env.DATABASE_URL = testUrl;
} else {
  // Sin base de pruebas los tests de integración se saltan, pero db.js
  // igual exige una URL para construir el pool.
  process.env.DATABASE_URL ||= 'postgres://sin-base@localhost:5432/sin-base';
}
