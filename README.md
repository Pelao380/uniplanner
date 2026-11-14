# 🎓 UniPlanner

[![CI](https://github.com/Pelao380/uniplanner/actions/workflows/ci.yml/badge.svg)](https://github.com/Pelao380/uniplanner/actions/workflows/ci.yml)

Aplicación full stack para organizar los ramos de la universidad: registra tus evaluaciones con su ponderación, ingresa tus notas y sabe al instante tu promedio y **qué nota necesitas para aprobar** (escala chilena 1.0–7.0).

> 🔗 **Demo:** https://uniplanner-sable.vercel.app — **sin registrarte**: entras y pruebas.

![Listado de ramos: cada tarjeta muestra el promedio, el avance evaluado y si vas aprobando](docs/capturas/dashboard-claro.png)

Dentro de un ramo está lo que de verdad uno quiere saber en mayo: **qué nota necesitas en
lo que falta**. Acá, con un 5.4 y un 4.8 rendidos, basta un 2.3 en el examen.

![Detalle de un ramo con sus evaluaciones, el promedio actual y la nota necesaria para aprobar](docs/capturas/detalle-ramo.png)

Y en oscuro, que es cuando uno suele estar calculando esto:

![El mismo listado de ramos en tema oscuro](docs/capturas/dashboard-oscuro.png)

## Funcionalidades
- **Se usa sin crear cuenta**: entras y empiezas a cargar ramos. La cuenta es opcional
- Tema claro, oscuro o el del sistema, recordado entre visitas
- Registro e inicio de sesión con contraseñas hasheadas (bcrypt) y JWT
- CRUD de ramos y de evaluaciones
- Promedio ponderado por ramo y promedio general
- Cálculo de la nota mínima necesaria para aprobar, redondeada hacia arriba
- Detecta cuando la aprobación ya está asegurada o ya no alcanza
- Rechaza ponderaciones que superen el 100%
- Cada usuario solo puede ver y modificar sus propios datos

## Usar sin cuenta

Una calculadora de notas que exige registrarse antes de mostrar nada pierde gente en la
puerta. Y pedir "nombre del ramo" antes de dejarte calcular es casi lo mismo: estorba a
quien solo quiere saber con cuánto queda. Así que **sin cuenta la app es una calculadora
y nada más**: entras evaluaciones, ves el promedio y lo que necesitas, sin pasar por
ningún formulario previo. Todo ocurre en el navegador (`localStorage`), sin tocar el
servidor.

La cuenta es lo que desbloquea tener **varios ramos a la vez**, además de lo que de verdad
necesita un servidor: no perder los datos si borras el navegador y abrirlos desde otro
dispositivo. Esa diferencia es la razón de registrarse, y por eso el dashboard de ramos
aparece recién con sesión.

Por dentro el invitado sí tiene un ramo, porque el almacenamiento local es el mismo que
usa la API, pero es implícito y se crea recién con la primera evaluación: entrar a mirar
no escribe nada. Al crear la cuenta se te pregunta cómo se llama ese ramo, porque hasta
ese momento no tenía nombre, y pasa a ser el primero de tu cuenta. Al iniciar sesión en
una cuenta que ya existe se ofrece lo mismo en vez de subirlo solo: esa cuenta puede tener
ramos de antes y nadie quiere duplicados. Si dices "ahora no", lo local queda intacto.

La pantalla de evaluaciones es una sola
([`client/src/components/Evaluaciones.jsx`](client/src/components/Evaluaciones.jsx)): la
usan igual la calculadora y la página de un ramo, y lo único que cambia es de dónde sale
el ramo.

Las dos fuentes de datos ([`api.js`](client/src/api.js) y [`local.js`](client/src/local.js))
exponen los mismos métodos, y [`store.js`](client/src/store.js) elige una en cada llamada
según si hay sesión. Las páginas no saben con cuál están hablando.

> `local.js` repite a mano las validaciones y los mensajes de error del servidor. Es
> deliberado: si no, la app se comportaría distinto según si tienes cuenta o no.

### Una lógica, dos copias

El cálculo de notas vive en [`server/src/grades.js`](server/src/grades.js) y, copiado,
en [`client/src/grades.js`](client/src/grades.js): el modo invitado lo necesita en el
navegador. Un paquete compartido obligaría a configurar el build de Vercel para leer
archivos fuera de `client/`, y son 60 líneas de aritmética pura.

El riesgo de copiar es que las dos versiones se separen, así que
[`scripts/check-grades-parity.mjs`](scripts/check-grades-parity.mjs) compara las dos
implementaciones con 20.000 casos generados más una docena escritos a mano, y corre en
cada push. Si tocas una sola, el CI se cae.

```bash
node scripts/check-grades-parity.mjs
```

## Tema claro y oscuro

El botón de la barra superior rota entre tres estados: **el del sistema** (por defecto),
claro y oscuro. "El del sistema" no es lo mismo que "claro": respeta lo que la persona ya
eligió en su computador o teléfono, y los otros dos existen para cuando quiere lo contrario
de eso solo en esta app.

Todo el color sale de variables CSS definidas en [`styles.css`](client/src/styles.css). El
tema se elige con un atributo `data-theme` en `<html>`: sin atributo manda
`prefers-color-scheme`, y con `light` o `dark` manda lo que pidió el usuario.

El detalle que importa es **dónde** se aplica: hay un script inline y síncrono en
[`index.html`](client/index.html) que lee la preferencia y pone el atributo *antes* de que
el navegador pinte. Si eso esperara a que React arranque, quien usa tema oscuro vería un
fogonazo blanco en cada carga. Es la razón de que esas seis líneas no vivan en un
componente.

## Cómo se calculan las notas

Las ponderaciones son porcentaje del ramo: **por definición suman 100**. Si suman menos, la app asume que todavía faltan evaluaciones por declarar y trata ese hueco como pendiente (y te avisa).

La regla de aprobación vive en una sola constante, [`ROUNDS_FINAL_GRADE`](server/src/grades.js):

- `true` (por defecto): la nota final se informa redondeada a un decimal, así que un **3.95 se convierte en 4.0 y aprueba**. Es lo habitual en Chile.
- `false`: hay que llegar a 4.0 exacto.

La nota necesaria siempre se redondea **hacia arriba**, para no prometer una nota más baja que la que de verdad se necesita.

**Ejemplo:** con un 3.5 y un 5.0 (30% cada uno), tu promedio es 4.3 y necesitas un **3.5** en el 40% que falta. Con `ROUNDS_FINAL_GRADE = false` ese número sube a 3.7.

Estados posibles de un ramo: `sin-notas`, `en-curso`, `asegurado` (apruebas pase lo que pase), `imposible` (ni un 7.0 en lo que queda alcanza), `aprobado`, `reprobado`.

### Examen y eximición

Un ramo puede tener examen final, y entonces el 100% de sus evaluaciones deja de ser el
ramo entero y pasa a ser la **nota de presentación**:

```
final = presentación × (100 − examen)%  +  examen × examen%
```

Son dos datos del ramo, los dos opcionales: con qué nota te eximes y cuánto vale el
examen. **Si los dejas vacíos el ramo no tiene examen** y se calcula exactamente como
antes — de ahí que los ramos que ya existían no cambien de resultado.

Con examen, la app responde las dos preguntas que importan: qué nota necesitas en lo que
te queda **para eximirte**, y qué nota necesitas **en el examen** para llegar a 4.0. La
segunda se muestra desde la primera nota, marcada como provisional mientras falten
evaluaciones por rendir, porque la presentación todavía puede moverse.

Eximirse usa el mismo redondeo que aprobar: si te eximes con 5.0, un 4.95 de presentación
te exime. Y mientras la presentación no esté cerrada el ramo queda `en-curso` aunque la
cuenta de hoy diga `imposible`: con las notas que faltan todavía puede darse vuelta.

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
- **Frontend:** `npm ci`, el control de paridad del cálculo de notas y `npm run build`.

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

- **Base de datos:** [Neon](https://neon.tech). Usa la connection string **pooled** (la que
  lleva `-pooler` en el host) y pégala completa en `DATABASE_URL`, desde `postgresql://`
  hasta el final, sin comillas ni espacios.
- **Backend:** [Render](https://render.com). El [`render.yaml`](render.yaml) deja el servicio
  configurado: solo hay que pegar `DATABASE_URL` y `CLIENT_URL` cuando los pida. `JWT_SECRET`
  lo genera Render.
- **Frontend:** [Vercel](https://vercel.com), root `client`, variable
  `VITE_API_URL=https://tu-api.onrender.com/api` (con el `/api` al final). El
  [`vercel.json`](client/vercel.json) ya trae el rewrite para React Router.
- **CORS:** `CLIENT_URL` es el origen de Vercel **sin ruta ni barra final**
  (`https://tu-app.vercel.app`). Se compara exacto; con una barra de más, la API responde 403.

### Qué pasa con cada push

Nada que hacer a mano: Render y Vercel escuchan `main` y despliegan solos.

| Cambias | Se despliega | Tienes que hacer algo |
|---|---|---|
| Algo en `client/` | Vercel | No |
| Algo en `server/` | Render | No |
| `render.yaml` | Render | No |
| **`schema.sql`** | **nadie** | **Sí**: correr las migraciones a mano |
| Una variable de entorno | — | Sí, ver abajo |

Como el servicio de Render tiene `rootDir: server`, un commit que solo toca `client/`
no dispara un despliegue de la API. Si alguna vez necesitas saltarte un despliegue,
`[skip render]` en el mensaje del commit lo evita.

Las dos excepciones:

- **La base de datos no se migra sola.** [`schema.sql`](server/schema.sql) solo crea las
  tablas que faltan: nunca toca una que ya existe. Los cambios sobre tablas con datos van
  como un `.sql` numerado en [`server/migrations/`](server/migrations), y se aplican a mano:

  ```bash
  npm run db:migrate    # dentro de server/, con DATABASE_URL apuntando a la base
  ```

  **El orden importa, y depende de lo que haga la migración.** La regla de fondo es que el
  esquema tiene que servirle a las dos versiones a la vez, porque durante el despliegue
  conviven un rato:

  - **Si la migración borra algo, despliega primero.** Si borras una columna mientras Render
    sigue sirviendo la versión anterior, esa versión seguirá pidiéndosela a Postgres y cada
    petición que la toque responderá 500 hasta que termine el despliegue. Así fue la 001.
  - **Si la migración agrega algo, migra primero.** El código nuevo nombra las columnas
    nuevas desde el primer minuto; el viejo simplemente las ignora. Así fue la 002.
- **`VITE_API_URL` se hornea en el build.** Las variables `VITE_*` no se leen en tiempo de
  ejecución: Vite las reemplaza por su valor al compilar. Si la cambias en Vercel, hay que
  volver a desplegar para que surta efecto. Las del backend no: Render reinicia el servicio
  al guardarlas.

> ⏱️ **Arranque en frío:** en el plan gratuito de Render el servicio se duerme cuando nadie
> lo usa. Medido: **22,8 segundos** la primera petición, **0,24 s** las siguientes. Como la
> app funciona sin cuenta, eso solo lo nota quien se registra o inicia sesión: abrir la demo
> y cargar ramos es instantáneo porque no pasa por el servidor.
>
> La interfaz lo dice en vez de quedarse colgada. Si una petición pasa de 2,5 segundos,
> [`AvisoDespertando`](client/src/components/AvisoDespertando.jsx) explica que el servidor
> está despertando. No acelera nada, pero medio minuto con un botón que dice "Enviando…" y
> nada más se lee como que la app se rompió, y la gente cierra la pestaña. Con una API
> despierta el aviso no alcanza a aparecer.

### Si el registro o el login devuelven 500

Casi siempre es `DATABASE_URL`. Los logs de Render (servicio → **Logs**) lo dicen en una línea:

| En el log | Qué pasó |
|---|---|
| `getaddrinfo ENOTFOUND <algo>` | La URL no apunta a Neon: ese host no existe. Vuelve a copiar la connection string. |
| `password authentication failed` | La URL está bien pero la clave no. Cópiala de nuevo, entera. |
| `relation "users" does not exist` | Falta correr `npm run db:init` contra esa base. |
| `ETIMEDOUT` | El host existe pero no responde. Revisa que sea el endpoint pooled. |

## Próximas mejoras
- [x] Tests del cálculo de notas (Vitest)
- [x] Tests de integración de la API (Supertest)
- [x] CI con GitHub Actions
- [x] Rate limiting en `/api/auth` y helmet
- [x] Listar los ramos en una sola consulta (antes hacía 1 + N)
- [x] Usar la app sin cuenta, con los datos en el navegador
- [x] Sin cuenta, calculadora directa: la cuenta es la que desbloquea varios ramos
- [x] Tema claro, oscuro o el del sistema
- [x] Nota de presentación + examen y eximición
- [ ] Renombrar un ramo desde la interfaz (la API ya lo permite, falta el botón)
- [ ] Créditos/SCT por ramo para un promedio general ponderado
- [ ] Simulador "¿qué pasa si saco X?"
- [ ] Calendario de evaluaciones próximas
