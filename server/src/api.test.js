import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { pool } from './db.js';

// Sin TEST_DATABASE_URL estos tests se saltan: ver README.
const conBase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const credenciales = (n) => ({
  name: `Usuario ${n}`,
  email: `usuario${n}@uniplanner.test`,
  password: 'clave-de-prueba-123',
});

conBase('API de UniPlanner', () => {
  let app;

  const registrar = async (n) => {
    const res = await request(app).post('/api/auth/register').send(credenciales(n));
    expect(res.status).toBe(201);
    return res.body.token;
  };

  const crearRamo = async (token, nombre = 'Cálculo I') => {
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: nombre });
    expect(res.status).toBe(201);
    return res.body;
  };

  beforeAll(async () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const sql = await readFile(path.join(dir, '..', 'schema.sql'), 'utf8');
    await pool.query(sql);
    // Límites altos para que el rate limiter no corte la propia suite.
    app = createApp({ rateLimits: { login: 10_000, register: 10_000, auth: 10_000 } });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE evaluations, courses, users RESTART IDENTITY CASCADE');
  });

  describe('salud y rutas inexistentes', () => {
    it('GET /api/health responde ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('una ruta que no existe devuelve 404 en JSON', async () => {
      const res = await request(app).get('/api/no-existe');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe('registro e inicio de sesión', () => {
    it('registra y devuelve token sin filtrar el hash', async () => {
      const res = await request(app).post('/api/auth/register').send(credenciales(1));
      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user).toMatchObject({ email: 'usuario1@uniplanner.test' });
      expect(res.body.user.password_hash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('clave-de-prueba');
    });

    it('rechaza un email ya registrado con 409', async () => {
      await registrar(1);
      const res = await request(app).post('/api/auth/register').send(credenciales(1));
      expect(res.status).toBe(409);
    });

    it('normaliza el email a minúsculas', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ ...credenciales(1), email: 'MAYUS@uniplanner.test' });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'mayus@uniplanner.test', password: 'clave-de-prueba-123' });
      expect(res.status).toBe(200);
    });

    it('rechaza contraseñas cortas con 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...credenciales(1), password: 'corta' });
      expect(res.status).toBe(400);
      expect(res.body.details[0].field).toBe('password');
    });

    it('inicia sesión con la contraseña correcta y la rechaza si no lo es', async () => {
      await registrar(1);
      const bien = await request(app)
        .post('/api/auth/login')
        .send({ email: credenciales(1).email, password: 'clave-de-prueba-123' });
      expect(bien.status).toBe(200);
      const mal = await request(app)
        .post('/api/auth/login')
        .send({ email: credenciales(1).email, password: 'otra-cosa' });
      expect(mal.status).toBe(401);
    });

    it('da el mismo error para email inexistente que para contraseña mala', async () => {
      await registrar(1);
      const inexistente = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nadie@uniplanner.test', password: 'xxxxxxxxxx' });
      const claveMala = await request(app)
        .post('/api/auth/login')
        .send({ email: credenciales(1).email, password: 'xxxxxxxxxx' });
      expect(inexistente.status).toBe(401);
      expect(inexistente.body.error).toBe(claveMala.body.error);
    });

    it('GET /api/auth/me exige un token válido', async () => {
      const token = await registrar(1);
      expect((await request(app).get('/api/auth/me')).status).toBe(401);
      expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer basura')).status).toBe(401);
      // Sin el esquema "Bearer" tampoco vale.
      expect((await request(app).get('/api/auth/me').set('Authorization', token)).status).toBe(401);
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(credenciales(1).email);
    });
  });

  describe('ramos', () => {
    it('exige autenticación en todas las rutas', async () => {
      expect((await request(app).get('/api/courses')).status).toBe(401);
      expect((await request(app).post('/api/courses').send({ name: 'X' })).status).toBe(401);
    });

    it('crea, lista, edita y elimina', async () => {
      const token = await registrar(1);
      const auth = (r) => r.set('Authorization', `Bearer ${token}`);

      const ramo = await crearRamo(token);
      expect(ramo.summary.status).toBe('sin-notas');

      const lista = await auth(request(app).get('/api/courses'));
      expect(lista.body).toHaveLength(1);

      const editado = await auth(request(app).put(`/api/courses/${ramo.id}`)).send({
        name: 'Álgebra',
        code: 'MAT-201',
      });
      expect(editado.status).toBe(200);
      expect(editado.body.name).toBe('Álgebra');

      expect((await auth(request(app).delete(`/api/courses/${ramo.id}`))).status).toBe(204);
      expect((await auth(request(app).get(`/api/courses/${ramo.id}`))).status).toBe(404);
    });

    it('un id que no es número devuelve 404, no 500', async () => {
      const token = await registrar(1);
      const res = await request(app).get('/api/courses/abc').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('rechaza un ramo sin nombre', async () => {
      const token = await registrar(1);
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '  ' });
      expect(res.status).toBe(400);
    });
  });

  describe('aislamiento entre usuarios', () => {
    it('un usuario no puede ver, editar ni borrar el ramo de otro', async () => {
      const tokenA = await registrar(1);
      const ramo = await crearRamo(tokenA);
      const tokenB = await registrar(2);
      const comoB = (r) => r.set('Authorization', `Bearer ${tokenB}`);

      expect((await comoB(request(app).get(`/api/courses/${ramo.id}`))).status).toBe(404);
      expect((await comoB(request(app).put(`/api/courses/${ramo.id}`)).send({ name: 'Robado' })).status).toBe(404);
      expect((await comoB(request(app).delete(`/api/courses/${ramo.id}`))).status).toBe(404);
      expect(
        (await comoB(request(app).post(`/api/courses/${ramo.id}/evaluations`)).send({ name: 'X', weight: 10 })).status
      ).toBe(404);
      expect((await comoB(request(app).get('/api/courses'))).body).toHaveLength(0);
    });

    it('el ramo de A sigue intacto después de los intentos de B', async () => {
      const tokenA = await registrar(1);
      const ramo = await crearRamo(tokenA);
      const tokenB = await registrar(2);
      await request(app)
        .put(`/api/courses/${ramo.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Robado' });

      const res = await request(app).get(`/api/courses/${ramo.id}`).set('Authorization', `Bearer ${tokenA}`);
      expect(res.body.name).toBe('Cálculo I');
    });
  });

  describe('evaluaciones y cálculo de notas', () => {
    let token;
    let ramo;
    let auth;

    beforeEach(async () => {
      token = await registrar(1);
      ramo = await crearRamo(token);
      auth = (r) => r.set('Authorization', `Bearer ${token}`);
    });

    const agregar = (datos) => auth(request(app).post(`/api/courses/${ramo.id}/evaluations`)).send(datos);

    it('reproduce el ejemplo del README', async () => {
      await agregar({ name: 'Certamen 1', weight: 30, grade: 3.5 });
      await agregar({ name: 'Certamen 2', weight: 30, grade: 5.0 });
      await agregar({ name: 'Examen', weight: 40 });

      const { body } = await auth(request(app).get(`/api/courses/${ramo.id}`));
      expect(body.summary).toMatchObject({
        currentAverage: 4.3,
        totalWeight: 100,
        gradedWeight: 60,
        neededToPass: 3.5,
        status: 'en-curso',
      });
    });

    it('devuelve weight y grade como números, no como strings', async () => {
      await agregar({ name: 'C1', weight: 30, grade: 3.5 });
      const { body } = await auth(request(app).get(`/api/courses/${ramo.id}`));
      expect(typeof body.evaluations[0].weight).toBe('number');
      expect(typeof body.evaluations[0].grade).toBe('number');
    });

    it('devuelve la fecha como YYYY-MM-DD sin correrla de día', async () => {
      await agregar({ name: 'C1', weight: 30, due_date: '2026-03-10' });
      const { body } = await auth(request(app).get(`/api/courses/${ramo.id}`));
      expect(body.evaluations[0].due_date).toBe('2026-03-10');
    });

    it('rechaza con 422 si las ponderaciones pasarían del 100%', async () => {
      await agregar({ name: 'C1', weight: 60 });
      const res = await agregar({ name: 'C2', weight: 50 });
      expect(res.status).toBe(422);
      expect(res.body.error).toContain('110');

      const { body } = await auth(request(app).get(`/api/courses/${ramo.id}`));
      expect(body.evaluations).toHaveLength(1); // no se guardó
    });

    it('al editar no se cuenta a sí misma en la suma', async () => {
      const { body: c1 } = await agregar({ name: 'C1', weight: 60 });
      const res = await auth(request(app).put(`/api/courses/${ramo.id}/evaluations/${c1.id}`)).send({
        name: 'C1',
        weight: 100,
      });
      expect(res.status).toBe(200);
      expect(res.body.weight).toBe(100);
    });

    it('rechaza notas fuera de la escala 1.0-7.0', async () => {
      expect((await agregar({ name: 'X', weight: 10, grade: 0.5 })).status).toBe(400);
      expect((await agregar({ name: 'X', weight: 10, grade: 7.5 })).status).toBe(400);
    });

    it('rechaza ponderaciones de cero o negativas', async () => {
      expect((await agregar({ name: 'X', weight: 0 })).status).toBe(400);
      expect((await agregar({ name: 'X', weight: -10 })).status).toBe(400);
    });

    it('elimina una evaluación y recalcula el resumen', async () => {
      const { body: c1 } = await agregar({ name: 'C1', weight: 50, grade: 2.0 });
      await agregar({ name: 'C2', weight: 50, grade: 6.0 });

      expect((await auth(request(app).delete(`/api/courses/${ramo.id}/evaluations/${c1.id}`))).status).toBe(204);
      const { body } = await auth(request(app).get(`/api/courses/${ramo.id}`));
      expect(body.summary.currentAverage).toBe(6.0);
      expect(body.evaluations).toHaveLength(1);
    });

    it('borrar el ramo se lleva sus evaluaciones', async () => {
      await agregar({ name: 'C1', weight: 50, grade: 4.0 });
      await auth(request(app).delete(`/api/courses/${ramo.id}`));
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM evaluations');
      expect(rows[0].n).toBe(0);
    });
  });

  describe('listado de ramos', () => {
    // El listado hacía una consulta por ramo: con la base en otra región cada
    // ramo nuevo sumaba un viaje de ida y vuelta. Este test fija el número de
    // consultas, porque es exactamente lo que se arregló: si alguien vuelve a
    // meter un await dentro del map, falla acá y no en producción.
    const contarConsultas = async (fn) => {
      const original = pool.query.bind(pool);
      let n = 0;
      pool.query = (...args) => {
        n += 1;
        return original(...args);
      };
      try {
        await fn();
      } finally {
        pool.query = original;
      }
      return n;
    };

    it('hace una sola consulta, haya 1 ramo o 5', async () => {
      const token = await registrar(1);
      const auth = (r) => r.set('Authorization', `Bearer ${token}`);

      for (let i = 1; i <= 5; i += 1) {
        const ramo = await crearRamo(token, `Ramo ${i}`);
        await auth(request(app).post(`/api/courses/${ramo.id}/evaluations`))
          .send({ name: 'C1', weight: 50, grade: 5.0 });
      }

      let body;
      const consultas = await contarConsultas(async () => {
        const res = await auth(request(app).get('/api/courses'));
        expect(res.status).toBe(200);
        body = res.body;
      });

      expect(consultas).toBe(1);
      expect(body).toHaveLength(5);
    });

    it('calcula el resumen de cada ramo sin mezclar las evaluaciones', async () => {
      const token = await registrar(1);
      const auth = (r) => r.set('Authorization', `Bearer ${token}`);
      const conEvaluaciones = async (nombre, evs) => {
        const ramo = await crearRamo(token, nombre);
        for (const [i, ev] of evs.entries()) {
          await auth(request(app).post(`/api/courses/${ramo.id}/evaluations`))
            .send({ name: `C${i + 1}`, weight: ev.weight, grade: ev.grade ?? null });
        }
      };

      await conEvaluaciones('Con notas', [{ weight: 30, grade: 3.5 }, { weight: 30, grade: 5.0 }]);
      await conEvaluaciones('Pendiente', [{ weight: 100 }]);
      await crearRamo(token, 'Vacio');

      const { body } = await auth(request(app).get('/api/courses'));
      const porNombre = Object.fromEntries(body.map((c) => [c.name, c.summary]));

      expect(porNombre['Con notas']).toMatchObject({
        currentAverage: 4.3,
        gradedWeight: 60,
        neededToPass: 3.5,
        status: 'en-curso',
      });
      expect(porNombre.Pendiente).toMatchObject({
        currentAverage: null,
        totalWeight: 100,
        gradedWeight: 0,
        status: 'sin-notas',
      });
      // Un ramo sin evaluaciones tiene que aparecer igual: el LEFT JOIN existe
      // para esto. Con un JOIN normal este ramo desaparecería del listado.
      expect(porNombre.Vacio).toMatchObject({ currentAverage: null, totalWeight: 0 });
    });

    it('el listado entrega el resumen, no las evaluaciones', async () => {
      const token = await registrar(1);
      const auth = (r) => r.set('Authorization', `Bearer ${token}`);
      const ramo = await crearRamo(token);
      await auth(request(app).post(`/api/courses/${ramo.id}/evaluations`))
        .send({ name: 'C1', weight: 50, grade: 5.0 });

      const { body } = await auth(request(app).get('/api/courses'));
      expect(body[0]).not.toHaveProperty('evaluations');
      expect(body[0].summary.currentAverage).toBe(5);
    });

    it('no muestra los ramos de otro usuario', async () => {
      const tokenA = await registrar(1);
      const tokenB = await registrar(2);
      await crearRamo(tokenA, 'Ramo de A');

      const { body } = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(body).toEqual([]);
    });
  });

  describe('protecciones', () => {
    it('rechaza un cuerpo JSON gigante con 413', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ name: 'x'.repeat(60000), email: 'a@b.cl', password: '12345678' }));
      expect(res.status).toBe(413);
    });

    it('rechaza un origen que no está en la lista', async () => {
      const res = await request(app).get('/api/health').set('Origin', 'http://malicioso.example');
      expect(res.status).toBe(403);
    });

    it('corta la fuerza bruta en el login', async () => {
      // App aparte con el límite bajo, para no afectar al resto de la suite.
      const appLimitada = createApp({ rateLimits: { login: 2, register: 100, auth: 100 } });
      await request(appLimitada).post('/api/auth/register').send(credenciales(9));

      const intentar = () =>
        request(appLimitada)
          .post('/api/auth/login')
          .send({ email: credenciales(9).email, password: 'no-es-la-clave' });

      expect((await intentar()).status).toBe(401);
      expect((await intentar()).status).toBe(401);
      expect((await intentar()).status).toBe(429);
    });
  });
});
