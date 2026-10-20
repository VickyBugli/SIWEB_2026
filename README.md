# SIWeb – API de materiales de estudio

API REST para publicar, buscar, descargar, valorar y comentar materiales de estudio de la Facultad de Informática (UNComahue).

Trabajo práctico de **Sistemas de Información para la Web 2026** – Nicolás Quiroga · Victoria Bugli

**Tecnologías:** TypeScript · Fastify · PostgreSQL · OpenAPI (Swagger) · Open Library (servicio externo)

## Requisitos

- [Node.js](https://nodejs.org) (versión LTS)
- [PostgreSQL](https://www.postgresql.org/download/) (incluye pgAdmin)

## Instalación

**1. Clonar el repositorio e instalar las dependencias**

```bash
git clone <URL-DEL-REPOSITORIO>
cd <CARPETA-DEL-REPOSITORIO>
npm install
```

**2. Crear la base de datos**

En pgAdmin:
1. Clic derecho en **Databases → Create → Database...** → nombre `siweb` → **Save**.
2. Seleccionar `siweb` → **Tools → Query Tool**.
3. Abrir y ejecutar (**F5**) `database/schema.sql`.
4. Abrir y ejecutar (**F5**) `database/datos.sql`.

**3. Configurar el `.env`**

Copiar `.env.example` como `.env` y reemplazar `TU_CLAVE` por la contraseña de `postgres`:

```
DATABASE_URL=postgres://postgres:TU_CLAVE@localhost:5432/siweb
DOMINIO_INSTITUCIONAL=fi.uncoma.edu.ar
```

**4. Ejecutar el servidor**

```bash
npx tsx watch SIWeb_server.ts
```

## Uso

Documentación interactiva: **http://127.0.0.1:3000/docs**

Usuarios de prueba (contraseña **`Clave1234`**):

| Email | Rol |
|---|---|
| `valentina.gomez@est.fi.uncoma.edu.ar` | estudiante |
| `esteban.ruiz@est.fi.uncoma.edu.ar` | estudiante avanzado |
| `sofia.perez@est.fi.uncoma.edu.ar` | moderadora |
| `admin@est.fi.uncoma.edu.ar` | administrador |

Para usar los endpoints protegidos: hacer login con `POST /api/auth/login`, copiar el `token` y pegarlo en el botón **Authorize**.