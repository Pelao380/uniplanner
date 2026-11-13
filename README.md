# 🎓 UniPlanner

[![CI](https://github.com/Pelao380/uniplanner/actions/workflows/ci.yml/badge.svg)](https://github.com/Pelao380/uniplanner/actions/workflows/ci.yml)

Aplicación full stack para organizar los ramos de la universidad: registra tus evaluaciones con su ponderación, ingresa tus notas y sabe al instante tu promedio y **qué nota necesitas para aprobar** (escala chilena 1.0–7.0).

> 🔗 **Demo:** _agrega aquí el link cuando la despliegues_
> 📸 _agrega aquí capturas de pantalla_

## Funcionalidades
- Registro e inicio de sesión con contraseñas hasheadas (bcrypt) y JWT
- CRUD de ramos y de evaluaciones
- Promedio ponderado por ramo y promedio general
- Cálculo de la nota mínima necesaria para aprobar, redondeada hacia arriba
- Detecta cuando la aprobación ya está asegurada o ya no alcanza
- Rechaza ponderaciones que superen el 100%
- Cada usuario solo puede ver y modificar sus propios datos

## Cómo se calculan las notas

Las ponderaciones son porcentaje del ramo: **por definición suman 100**. Si suman menos, la app asume que todavía faltan evaluaciones por declarar y trata ese hueco como pendiente (y te avisa).

La regla de aprobación vive en una sola constante, [`ROUNDS_FINAL_GRADE`](server/src/grades.js):

- `true` (por defecto): la nota final se informa redondeada a un decimal, así que un **3.95 se convierte en 4.0 y aprueba**. Es lo habitual en Chile.
- `false`: hay que llegar a 4.0 exacto.

La nota necesaria siempre se redondea **hacia arriba**, para no prometer una nota más baja que la que de verdad se necesita.

**Ejemplo:** con un 3.5 y un 5.0 (30% cada uno), tu promedio es 4.3 y necesitas un **3.5** en el 40% que falta. Con `ROUNDS_FINAL_GRADE = false` ese número sube a 3.7.

Estados posibles de un ramo: `sin-notas`, `en-curso`, `asegurado` (apruebas pase lo que pase), `imposible` (ni un 7.0 en lo que queda alcanza), `aprobado`, `reprobado`.

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | React 18, React Router, Vite |
| Backend | Node.js, Express, Zod (validación) |
| Base de datos | PostgreSQL |
| Auth | JWT + bcrypt |
| Tests | Vitest + Supertest |
| CI | GitHub Actions |

## Ejecutar en local

**Requisitos:** Node.js 20+ y una base PostgreSQL ([Neon](https://neon.tech) gratis, o Docker).

```bash
# 1. Base de datos: con Docker en local...
docker compose up -d
# ...o usa una connection string de Neon en DATABASE_URL

# 2. Backend
cd server
cp .env.example .env      # edita JWT_SECRET y DATABASE_URL
npm install
npm run db:init           # crea las tablas
npm run dev               # http://localhost:4000

# 3. Frontend (otra terminal)
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

> **npm 11 o superior:** bloquea los scripts de instalación por defecto y esbuild
> necesita el suyo para colocar su binario. Si Vite no arranca, corre
> `npm install-scripts approve esbuild` dentro de `client/` y reinstala.

El SSL se decide por el host de `DATABASE_URL`: `localhost` sin SSL, cualquier otro host con SSL verificado. No hay que tocar nada al pasar de local a producción.

## Tests

```bash
cd server
npm test              # unitarios + integración
npm run test:watch
```

Los **unitarios** ([`grades.test.js`](server/src/grades.test.js)) cubren el cálculo de notas y no necesitan base de datos. Incluyen una prueba de propiedad que toma la nota que la app dice que necesitas, rellena lo pendiente con exactamente esa nota y exige que el ramo cierre aprobado — y que con una décima menos repruebe.

Los **de integración** ([`api.test.js`](server/src/api.test.js)) recorren la API completa con Supertest: autenticación, aislamiento entre usuarios, validaciones, códigos de error y rate limiting. Necesitan una base de datos aparte y se **saltan solos** si no la encuentran:

```bash
# En server/.env
TEST_DATABASE_URL=postgres://usuario:clave@host:5432/uniplanner_test
```

> ⚠️ La suite hace `TRUNCATE` antes de cada test. Usa una base dedicada, nunca la real.
> El setup se niega a arrancar si `TEST_DATABASE_URL` es idéntica a `DATABASE_URL`.

Con Neon puedes crear esa base dentro del mismo proyecto:

```bash
neon databases create --name uniplanner_test
```

## Integración continua

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push a `main` y en cada pull request:

- **API:** levanta un servicio PostgreSQL 16, instala con `npm ci` y corre toda la suite. No necesita ningún secreto configurado en GitHub.
- **Frontend:** `npm ci` y `npm run build`.

## API REST

Todas las rutas de `/api/courses` requieren el header `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Usuario actual |
| GET | `/api/courses` | Listar ramos (con resumen de notas) |
| POST | `/api/courses` | Crear ramo |
| GET | `/api/courses/:id` | Detalle del ramo con evaluaciones |
| PUT | `/api/courses/:id` | Editar ramo |
| DELETE | `/api/courses/:id` | Eliminar ramo |
| POST | `/api/courses/:id/evaluations` | Agregar evaluación |
| PUT | `/api/courses/:id/evaluations/:evalId` | Editar evaluación |
| DELETE | `/api/courses/:id/evaluations/:evalId` | Eliminar evaluación |

Códigos de error: `400` datos inválidos, `401` sin autenticar o token expirado, `403` origen no permitido, `404` no existe o no es tuyo, `409` email ya registrado, `413` cuerpo demasiado grande, `422` las ponderaciones superarían el 100%, `429` demasiados intentos.

### El listado es una sola consulta

`GET /api/courses` arma el resumen de todos los ramos en una sola consulta
(`LEFT JOIN` + `json_agg`). Antes pedía las evaluaciones ramo por ramo: con la
base de datos en otra región, eso se paga en latencia. Medido contra Neon en
São Paulo, con 69 ms de ida y vuelta:

| Ramos | Antes (1 + N consultas) | Ahora (1 consulta) |
|---|---|---|
| 5 | 149 ms | 66 ms |
| 25 | 256 ms | 67 ms |
| 50 | 418 ms | 70 ms |

Las N consultas salían en paralelo, así que hasta 10 ramos costaban dos viajes;
pasado el tamaño del pool empiezan a hacer fila. Un test de
[`api.test.js`](server/src/api.test.js) fija el número de consultas en 1, así que
si alguien vuelve a poner un `await` dentro del `map`, falla ahí y no en producción.

## Seguridad

- Contraseñas con bcrypt a 12 rondas. El login tarda a propósito: ver el comentario en [`auth.js`](server/src/routes/auth.js).
- Rate limiting en `/api/auth`: 10 logins y 5 registros por IP cada 15 minutos. Los logins exitosos no cuentan.
- Cabeceras de seguridad con helmet; `x-powered-by` desactivado.
- CORS con lista blanca (`CLIENT_URL` acepta varios orígenes separados por coma).
- Cuerpo JSON limitado a 10 KB.
- El login tarda lo mismo con un email inexistente que con uno real, para que no se pueda averiguar quién tiene cuenta.
- En producción el servidor no arranca si `JWT_SECRET` tiene menos de 32 caracteres.
- El token se guarda en `localStorage`: simple y suficiente para este alcance, a cambio de ser vulnerable a XSS. Una cookie `httpOnly` + CSRF sería más robusta.

## Despliegue
- **Base de datos:** [Neon](https://neon.tech) o [Supabase](https://supabase.com). Copia la connection string a `DATABASE_URL`.
- **Backend:** [Render](https://render.com) (Web Service, root `server`, start `npm start`). Variables: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`.
- **Frontend:** [Vercel](https://vercel.com) (root `client`). Variable: `VITE_API_URL=https://tu-api.onrender.com/api`. El `vercel.json` ya incluye el rewrite para React Router.

## Próximas mejoras
- [x] Tests del cálculo de notas (Vitest)
- [x] Tests de integración de la API (Supertest)
- [x] CI con GitHub Actions
- [x] Rate limiting en `/api/auth` y helmet
- [x] Listar los ramos en una sola consulta (antes hacía 1 + N)
- [ ] Créditos/SCT por ramo para un promedio general ponderado
- [ ] Simulador "¿qué pasa si saco X?"
- [ ] Nota de presentación + examen y eximición
- [ ] Calendario de evaluaciones próximas
- [ ] Modo oscuro
