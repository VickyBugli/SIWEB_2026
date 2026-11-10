import 'dotenv/config'; // lee archivo .env y carga sus variables en process.env
import Fastify, { type FastifyRequest } from 'fastify'; // crea el servidor y define endpoints
import { Pool } from 'pg'; // para hacer consultas en sql
import swagger from '@fastify/swagger'; // generan especificacion openapi
import swaggerUI from '@fastify/swagger-ui';
import multipart, { ajvFilePlugin, type MultipartFile } from '@fastify/multipart'; // permite recibir archivos
import argon2 from 'argon2'; // encripta contraseñas y verifica en el login 
import nodemailer from 'nodemailer'; // envia el codigo de verificacion
import { randomBytes, randomUUID, createHash } from 'node:crypto'; // genera codigos y tokens al azar
import { mkdir, writeFile, unlink } from 'node:fs/promises'; 
import { createReadStream } from 'node:fs';
import path from 'node:path'; // arma rutas

// CONFIGURACIÓN INICIAL
const app = Fastify({ logger: true, ajv: { plugins: [ajvFilePlugin as any] } });
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const DIRECTORIO_ARCHIVOS = path.resolve('uploads'); // donde se guardan los matriales subidos

// SOLO PARA PRUEBAS LOCALES: no se agregan tablas al MER.
// Los registros pendientes y las sesiones se pierden al reiniciar el servidor.
type Pendiente = {
    nombre_apellido: string;
    email: string;
    contrasena_hash: string;
    es_avanzado: boolean;
    codigo_hash: string;
    vence: number;
};
const pendientes = new Map<string, Pendiente>();
const sesiones = new Map<string, { id_usuario: number; vence: number }>();

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

async function enviarCodigo(email: string, codigo: string): Promise<void> {
    const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Falta configurar el servicio SMTP');
        }
        // Modo demostración: nunca usar esto en producción.
        app.log.warn(`SMTP no configurado. Código de prueba para ${email}: ${codigo}`);
        return;
    }
    const puerto = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: puerto,
        secure: puerto === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    await transport.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: 'Verificación de cuenta SIWeb',
        text: `Tu código para verificar la cuenta es: ${codigo}. Vence en 30 minutos.`
    });
}

// Función mínima de identificación. No constituye una HU3 completa.
async function usuarioDeSesion(request: FastifyRequest): Promise<{
    id_usuario: number;
    rol: string;
} | null> {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    const sesion = sesiones.get(hashToken(token));
    if (!sesion || sesion.vence <= Date.now()) return null;
    const resultado = await db.query(
        `SELECT u.id_usuario, r.nombre_rol
         FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = $1`,
        [sesion.id_usuario]
    );
    if (!resultado.rows[0]) return null;
    return { id_usuario: resultado.rows[0].id_usuario, rol: resultado.rows[0].nombre_rol };
}

const idParam = {
    type: 'object', required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } }
} as const;
const errorRespuesta = {
    type: 'object', properties: { error: { type: 'string' } }
} as const;
const materialRespuesta = {
    type: 'object',
    properties: {
        id_material: { type: 'integer' },
        nombre_archivo: { type: 'string' },
        formato_archivo: { type: 'string' },
        fecha_publicacion: { type: 'string', format: 'date-time' },
        tipo_material: { type: 'string' },
        descripcion: { type: 'string' },
        tamano: { type: 'integer' },
        estado: { type: 'string' },
        id_materia: { type: 'integer' },
        id_usuario: { type: 'integer' },
        valoracion_promedio: { type: ['number', 'null'] },
        cantidad_votos: { type: 'integer' }
    }
} as const;
const reporteRespuesta = {
    type: 'object',
    properties: {
        id_observacion: { type: 'integer' },
        id_material: { type: 'integer' },
        id_reportante: { type: 'integer' },
        fecha_creacion: { type: 'string', format: 'date-time' },
        id_comentario: { type: ['integer', 'null'] },
        motivo_reporte: { type: 'string' },
        estado: { type: 'string' },
        fecha_resolucion: { type: ['string', 'null'], format: 'date-time' }
    }
} as const;

// La inserción de Observación y su subtipo se hace en una transacción.
async function crearObservacion(
    id_usuario: number,
    id_material: number,
    subtipo: 'comentario' | 'reporte',
    datos: { contenido?: string; descripcion?: string; motivo_reporte?: string; id_comentario?: number | null }
) {
    const cliente = await db.connect();
    try {
        await cliente.query('BEGIN');
        const base = await cliente.query(
            `INSERT INTO observacion (fecha_creacion, id_usuario, id_material)
             VALUES (NOW(), $1, $2) RETURNING id_observacion`,
            [id_usuario, id_material]
        );
        const id_observacion = base.rows[0].id_observacion;
        if (subtipo === 'comentario') {
            await cliente.query(
                `INSERT INTO comentario (id_observacion, contenido, descripcion)
                 VALUES ($1, $2, $3)`,
                [id_observacion, datos.contenido, datos.descripcion ?? null]
            );
        } else {
            await cliente.query(
                `INSERT INTO reporte (id_observacion, motivo_reporte, estado, id_comentario)
                 VALUES ($1, $2, 'pendiente', $3)`,
                [id_observacion, datos.motivo_reporte, datos.id_comentario ?? null]
            );
        }
        await cliente.query('COMMIT');
        return { id_observacion, subtipo };
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
}

async function iniciarServidor() {
    // OpenAPI/Swagger deben registrarse ANTES de las rutas.
    await app.register(swagger, {
        openapi: {
            info: { title: 'API SIWeb', version: '1.0.0' },
            components: {
                securitySchemes: {
                    bearerAuth: { type: 'http', scheme: 'bearer' }
                }
            }
        }
    });
    await app.register(swaggerUI, { routePrefix: '/docs' });
    await app.register(multipart, {
        attachFieldsToBody: true,
        limits: { files: 1, fields: 3, fileSize: 20 * 1024 * 1024 }
    });

    // HU 1: Registro. La cuenta NO se guarda en PostgreSQL hasta verificar el email.
    app.post<{ Body: { nombre_apellido: string; email: string; password: string; es_avanzado?: boolean } }>(
        '/api/auth/registro', {
            schema: {
                summary: 'Registrar una cuenta pendiente de verificación',
                tags: ['Usuarios'],
                body: {
                    type: 'object', required: ['nombre_apellido', 'email', 'password'],
                    additionalProperties: false,
                    properties: {
                        nombre_apellido: { type: 'string', minLength: 1 },
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                        es_avanzado: { type: 'boolean' }
                    }
                }
            }
        }, async (request, reply) => {
            const { nombre_apellido, password, es_avanzado = false } = request.body;
            const email = request.body.email.trim().toLowerCase();
            const dominio = process.env.DOMINIO_INSTITUCIONAL?.replace(/^@/, '').toLowerCase();
            if (!dominio) throw new Error('Configurar DOMINIO_INSTITUCIONAL en .env');
            if (!email.endsWith(`@${dominio}`)) {
                return reply.code(400).send({ error: 'Se requiere email institucional' });
            }
            const existe = await db.query('SELECT 1 FROM usuario WHERE email = $1', [email]);
            if (existe.rowCount) return reply.code(409).send({ error: 'El correo ya está registrado' });
            const codigo = randomBytes(16).toString('hex');
            const pendiente: Pendiente = {
                nombre_apellido, email, contrasena_hash: await argon2.hash(password),
                es_avanzado, codigo_hash: hashToken(codigo), vence: Date.now() + 30 * 60_000
            };
            // Enviar antes de guardar el pendiente: si SMTP falla, no lo registramos.
            await enviarCodigo(email, codigo);
            pendientes.set(email, pendiente);
            return reply.code(202).send({ mensaje: 'Revisá tu correo para verificar la cuenta' });
        }
    );

    // HU 1: Verificar email y recién entonces crear Usuario.
    app.post<{ Body: { email: string; codigo: string } }>(
        '/api/auth/verificar-email', {
            schema: {
                summary: 'Verificar email y activar la cuenta', tags: ['Usuarios'],
                body: {
                    type: 'object', required: ['email', 'codigo'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        codigo: { type: 'string', minLength: 1 }
                    }
                }
            }
        }, async (request, reply) => {
            const email = request.body.email.trim().toLowerCase();
            const pendiente = pendientes.get(email);
            if (!pendiente || pendiente.vence <= Date.now() ||
                pendiente.codigo_hash !== hashToken(request.body.codigo)) {
                return reply.code(400).send({ error: 'Código inválido o vencido' });
            }
            try {
                const res = await db.query(
                    `INSERT INTO usuario (nombre_apellido, email, contrasena_hash, es_avanzado, id_rol)
                     SELECT $1, $2, $3, $4, id_rol FROM rol WHERE nombre_rol = 'estudiante'
                     RETURNING id_usuario`,
                    [pendiente.nombre_apellido, email, pendiente.contrasena_hash, pendiente.es_avanzado]
                );
                if (!res.rows.length) throw new Error('Falta cargar el rol estudiante en PostgreSQL');
                pendientes.delete(email);
                return reply.code(201).send({ id_usuario: res.rows[0].id_usuario, mensaje: 'Cuenta verificada' });
            } catch (error) {
                if ((error as { code?: string }).code === '23505') {
                    return reply.code(409).send({ error: 'Correo ya registrado' });
                }
                throw error;
            }
        }
    );

    // HU 1: Reenvío. Requiere que el alta pendiente siga en memoria.
    app.post<{ Body: { email: string } }>(
        '/api/auth/reenviar-verificacion', {
            schema: {
                summary: 'Reenviar código de verificación', tags: ['Usuarios'],
                body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }
            }
        }, async (request) => {
            const email = request.body.email.trim().toLowerCase();
            const pendiente = pendientes.get(email);
            if (pendiente) {
                const codigo = randomBytes(16).toString('hex');
                await enviarCodigo(email, codigo);
                pendiente.codigo_hash = hashToken(codigo);
                pendiente.vence = Date.now() + 30 * 60_000;
            }
            return { mensaje: 'Si hay un registro pendiente, se enviará otro código' };
        }
    );

    // HU 2: Login. Crea una sesión temporal EN MEMORIA.
    app.post<{ Body: { email: string; password: string } }>(
        '/api/auth/login', {
            schema: {
                summary: 'Iniciar sesión', tags: ['Usuarios'],
                body: {
                    type: 'object', required: ['email', 'password'],
                    properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } }
                }
            }
        }, async (request, reply) => {
            const res = await db.query(
                'SELECT id_usuario, contrasena_hash FROM usuario WHERE email = $1',
                [request.body.email.trim().toLowerCase()]
            );
            const usuario = res.rows[0];
            if (!usuario || !await argon2.verify(usuario.contrasena_hash, request.body.password)) {
                return reply.code(401).send({ error: 'Credenciales incorrectas' });
            }
            const token = randomBytes(32).toString('hex');
            sesiones.set(hashToken(token), { id_usuario: usuario.id_usuario, vence: Date.now() + 60 * 60_000 });
            return { token, tipo: 'Bearer', expira_en_segundos: 3600 };
        }
    );

    // HU 2: Logout. Invalida la sesión actual en memoria.
    app.post('/api/auth/logout', {
        schema: { summary: 'Cerrar sesión', tags: ['Usuarios'], security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!token || !sesiones.delete(hashToken(token))) {
            return reply.code(401).send({ error: 'Sesión inexistente o inválida' });
        }
        return reply.code(204).send();
    });

    // HU 3: No se desarrolla un módulo de roles completo en esta versión.
    app.get('/api/auth/yo', {
        schema: {
            summary: 'Consultar sesión actual', tags: ['Usuarios'], security: [{ bearerAuth: [] }],
            response: {
                200: { type: 'object', properties: {
                    id_usuario: { type: 'integer' },
                    rol: { type: 'string' }
                } },
                401: errorRespuesta
            }
        }
    }, async (request, reply) => {
        const usuario = await usuarioDeSesion(request);
        if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
        return usuario;
    });

    // HU 4: Publicar Material. Un archivo por publicación, máximo 20 MB.
    app.post<{ Body: {
        archivo: MultipartFile;
        id_materia: { value: string };
        tipo_material: { value: string };
        descripcion: { value: string };
    } }>('/api/materiales', {
        schema: {
            summary: 'Publicar material con un archivo adjunto', tags: ['Materiales'],
            security: [{ bearerAuth: [] }], consumes: ['multipart/form-data'],
            body: {
                type: 'object', required: ['archivo', 'id_materia', 'tipo_material', 'descripcion'],
                properties: {
                    archivo: { isFile: true },
                    id_materia: { type: 'object', properties: { value: { type: 'string' } } },
                    tipo_material: { type: 'object', properties: { value: { type: 'string' } } },
                    descripcion: { type: 'object', properties: { value: { type: 'string' } } }
                }
            }
        }
    }, async (request, reply) => {
        const usuario = await usuarioDeSesion(request);
        if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
        const { archivo, id_materia, tipo_material, descripcion } = request.body;
        const id = Number(id_materia.value);
        if (!Number.isInteger(id) || id <= 0 || !tipo_material.value.trim() || !descripcion.value.trim()) {
            return reply.code(400).send({ error: 'Datos del material inválidos' });
        }
        const permitidos = new Set(['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.zip']);
        const extension = path.extname(archivo.filename).toLowerCase();
        if (!permitidos.has(extension)) {
            return reply.code(400).send({ error: 'Formato de archivo no permitido' });
        }
        // Para simplificar el TP se almacena un Buffer de hasta 20 MB.
        const contenido = await archivo.toBuffer();
        const nombreAlmacenado = `${randomUUID()}${extension}`;
        const ruta = `uploads/${nombreAlmacenado}`;
        await mkdir(DIRECTORIO_ARCHIVOS, { recursive: true });
        await writeFile(path.join(DIRECTORIO_ARCHIVOS, nombreAlmacenado), contenido);
        try {
            const resultado = await db.query(
                `INSERT INTO material
                 (nombre_archivo, formato_archivo, fecha_publicacion, ruta_archivo,
                  tipo_material, descripcion, tamano, estado, id_materia, id_usuario)
                 VALUES ($1, $2, NOW(), $3, $4, $5, $6, 'publicado', $7, $8)
                 RETURNING id_material, nombre_archivo, estado`,
                [archivo.filename, archivo.mimetype, ruta, tipo_material.value,
                 descripcion.value, contenido.length, id, usuario.id_usuario]
            );
            return reply.code(201).send(resultado.rows[0]);
        } catch (error) {
            await unlink(path.join(DIRECTORIO_ARCHIVOS, nombreAlmacenado)).catch(() => {});
            if ((error as { code?: string }).code === '23503') {
                return reply.code(400).send({ error: 'Materia inexistente' });
            }
            throw error;
        }
    });

    // HU 5: Listado de Materias.
    app.get('/api/materias', {
        schema: {
            summary: 'Listar materias', tags: ['Materias'],
            response: { 200: {
                type: 'array', items: { type: 'object', properties: {
                    id_materia: { type: 'integer' },
                    nombre_materia: { type: 'string' },
                    anio_carrera: { type: 'integer' }
                } }
            } }
        }
    }, async () => {
        const resultado = await db.query('SELECT id_materia, nombre_materia, anio_carrera FROM materia ORDER BY nombre_materia');
        return resultado.rows;
    });

    // HU 6: Buscar y filtrar por texto, Materia, tipo y año de carrera.
    app.get<{ Querystring: {
        texto_buscado?: string; id_materia?: number; tipo_material?: string; anio_carrera?: number;
    } }>('/api/materiales', {
        schema: {
            summary: 'Buscar y filtrar materiales publicados', tags: ['Materiales'],
            response: { 200: { type: 'array', items: materialRespuesta } },
            querystring: { type: 'object', properties: {
                texto_buscado: { type: 'string' },
                id_materia: { type: 'integer', minimum: 1 },
                tipo_material: { type: 'string' },
                anio_carrera: { type: 'integer', minimum: 1 }
            } }
        }
    }, async (request) => {
        const q = request.query;
        const condiciones = ["m.estado = 'publicado'"];
        const valores: unknown[] = [];
        if (q.texto_buscado) {
            valores.push(`%${q.texto_buscado}%`);
            condiciones.push(`(m.nombre_archivo ILIKE $${valores.length} OR m.descripcion ILIKE $${valores.length})`);
        }
        if (q.id_materia) { valores.push(q.id_materia); condiciones.push(`m.id_materia = $${valores.length}`); }
        if (q.tipo_material) { valores.push(q.tipo_material); condiciones.push(`m.tipo_material = $${valores.length}`); }
        if (q.anio_carrera) { valores.push(q.anio_carrera); condiciones.push(`ma.anio_carrera = $${valores.length}`); }
        const resultado = await db.query(
                        `SELECT m.id_material, m.nombre_archivo, m.formato_archivo, m.fecha_publicacion,
                    m.tipo_material, m.descripcion, m.tamano, m.estado, m.id_materia, m.id_usuario,
                    (SELECT ROUND(AVG(v.puntuacion), 1)::float
                       FROM valoracion v JOIN observacion o ON o.id_observacion = v.id_observacion
                      WHERE o.id_material = m.id_material) AS valoracion_promedio,
                    (SELECT COUNT(*)::int
                       FROM valoracion v JOIN observacion o ON o.id_observacion = v.id_observacion
                      WHERE o.id_material = m.id_material) AS cantidad_votos
             FROM material m JOIN materia ma ON ma.id_materia = m.id_materia
             WHERE ${condiciones.join(' AND ')} ORDER BY m.fecha_publicacion DESC`, valores
        );
        return resultado.rows;
    });

    // HU 7: Detalle de un Material, no una lista.
    app.get<{ Params: { id: number } }>('/api/materiales/:id', {
        schema: { summary: 'Consultar un material', tags: ['Materiales'], params: idParam,
            response: { 200: materialRespuesta, 404: errorRespuesta } }
    }, async (request, reply) => {
        const resultado = await db.query(
            `SELECT id_material, nombre_archivo, formato_archivo, fecha_publicacion,
                    tipo_material, descripcion, tamano, estado, id_materia, id_usuario
             FROM material WHERE id_material = $1 AND estado = 'publicado'`,
            [request.params.id]
        );
        if (!resultado.rows.length) return reply.code(404).send({ error: 'Material no encontrado' });
        return resultado.rows[0];
    });

    // HU 7: Descargar realmente el archivo asociado al Material.
    app.get<{ Params: { id: number } }>('/api/materiales/:id/descargar', {
        schema: { summary: 'Descargar un archivo', tags: ['Materiales'], params: idParam, security: [{ bearerAuth: [] }] }
    }, async (request, reply) => {
        const usuario = await usuarioDeSesion(request);
        if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
        const resultado = await db.query(
            `SELECT nombre_archivo, ruta_archivo, formato_archivo FROM material
             WHERE id_material = $1 AND estado = 'publicado'`, [request.params.id]
        );
        if (!resultado.rows.length) return reply.code(404).send({ error: 'Material no encontrado' });
        const material = resultado.rows[0];
        // La ruta que se guarda es generada por el servidor, no por el usuario.
        const archivoEnDisco = path.join(DIRECTORIO_ARCHIVOS, path.basename(material.ruta_archivo));
        reply.header('Content-Type', material.formato_archivo);
        reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(material.nombre_archivo)}`);
        return reply.send(createReadStream(archivoEnDisco));
    });

    // HU 8: Comentar. INSERT en Observación y Comentario mediante una transacción.
    app.post<{ Params: { id: number }; Body: { contenido: string; descripcion?: string } }>(
        '/api/materiales/:id/comentarios', {
            schema: {
                summary: 'Crear comentario sobre un material', tags: ['Observaciones'], params: idParam,
                security: [{ bearerAuth: [] }],
                body: { type: 'object', required: ['contenido'], properties: {
                    contenido: { type: 'string', minLength: 1, maxLength: 500 },
                    descripcion: { type: 'string' }
                } }
            }
        }, async (request, reply) => {
            const usuario = await usuarioDeSesion(request);
            if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
            const material = await db.query(
                `SELECT 1 FROM material WHERE id_material = $1 AND estado = 'publicado'`, [request.params.id]
            );
            if (!material.rowCount) return reply.code(404).send({ error: 'Material no encontrado' });
            const creado = await crearObservacion(usuario.id_usuario, request.params.id, 'comentario', request.body);
            return reply.code(201).send(creado);
        }
    );

    app.get<{ Params: { id: number } }>('/api/materiales/:id/comentarios', {
        schema: {
            summary: 'Listar comentarios de un material',
            tags: ['Observaciones'],
            params: idParam,
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id_comentario: { type: 'integer' },
                            id_usuario: { type: 'integer' },
                            autor: { type: 'string' },
                            contenido: { type: 'string' },
                            fecha_creacion: { type: 'string', format: 'date-time' }
                        }
                    }
                },
                404: errorRespuesta
            }
        }
    }, async (request, reply) => {
        const material = await db.query(
            `SELECT 1 FROM material WHERE id_material = $1 AND estado = 'publicado'`,
            [request.params.id]
        );
        if (!material.rowCount) return reply.code(404).send({ error: 'Material no encontrado' });
        const resultado = await db.query(
            `SELECT c.id_observacion AS id_comentario, o.id_usuario,
                    u.nombre_apellido AS autor, c.contenido, o.fecha_creacion
             FROM comentario c
             JOIN observacion o ON o.id_observacion = c.id_observacion
             JOIN usuario u ON u.id_usuario = o.id_usuario
             WHERE o.id_material = $1
             ORDER BY o.fecha_creacion ASC, c.id_observacion ASC`,
            [request.params.id]
        );
        return resultado.rows;
    });    

    // HU 9: Reportar Material.
    app.post<{ Params: { id: number }; Body: { motivo_reporte: string } }>(
        '/api/materiales/:id/reportes', {
            schema: {
                summary: 'Reportar un material', tags: ['Observaciones'], params: idParam,
                security: [{ bearerAuth: [] }],
                body: { type: 'object', required: ['motivo_reporte'], properties: {
                    motivo_reporte: { type: 'string', minLength: 1 }
                } }
            }
        }, async (request, reply) => {
            const usuario = await usuarioDeSesion(request);
            if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
            const material = await db.query(
                `SELECT 1 FROM material WHERE id_material = $1 AND estado = 'publicado'`, [request.params.id]
            );
            if (!material.rowCount) return reply.code(404).send({ error: 'Material no encontrado' });
            const creado = await crearObservacion(usuario.id_usuario, request.params.id, 'reporte', request.body);
            return reply.code(201).send(creado);
        }
    );

    // HU 9: Reportar Comentario (relación 'sobre' del MER actualizado).
    app.post<{ Params: { id: number }; Body: { motivo_reporte: string } }>(
        '/api/comentarios/:id/reportes', {
            schema: {
                summary: 'Reportar un comentario', tags: ['Observaciones'], params: idParam,
                security: [{ bearerAuth: [] }],
                body: { type: 'object', required: ['motivo_reporte'], properties: {
                    motivo_reporte: { type: 'string', minLength: 1 }
                } }
            }
        }, async (request, reply) => {
            const usuario = await usuarioDeSesion(request);
            if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
            const comentario = await db.query(
                `SELECT o.id_material FROM comentario c
                 JOIN observacion o ON o.id_observacion = c.id_observacion
                 JOIN material m ON m.id_material = o.id_material
                 WHERE c.id_observacion = $1 AND m.estado = 'publicado'`, [request.params.id]
            );
            if (!comentario.rows.length) return reply.code(404).send({ error: 'Comentario no encontrado' });
            const creado = await crearObservacion(usuario.id_usuario, comentario.rows[0].id_material, 'reporte', {
                ...request.body, id_comentario: request.params.id
            });
            return reply.code(201).send(creado);
        }
    );

    // HU 10: Listado de Reportes (solo moderador/administrador).
    app.get<{ Querystring: { estado?: string } }>('/api/reportes', {
        schema: { summary: 'Listar reportes', tags: ['Reportes'], security: [{ bearerAuth: [] }],
            response: { 200: { type: 'array', items: reporteRespuesta } },
            querystring: { type: 'object', properties: { estado: { type: 'string' } } } }
    }, async (request, reply) => {
        const usuario = await usuarioDeSesion(request);
        if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
        if (!['moderador', 'administrador'].includes(usuario.rol)) return reply.code(403).send({ error: 'Sin permiso' });
        const estado = request.query.estado ?? null;
        const resultado = await db.query(
            `SELECT r.id_observacion, o.id_material, o.id_usuario AS id_reportante,
                    o.fecha_creacion, r.id_comentario, r.motivo_reporte, r.estado, r.fecha_resolucion
             FROM reporte r JOIN observacion o ON o.id_observacion = r.id_observacion
             WHERE ($1::text IS NULL OR r.estado = $1) ORDER BY o.fecha_creacion DESC`, [estado]
        );
        return resultado.rows;
    });

    // HU 10: Consultar Reporte individual.
    app.get<{ Params: { id: number } }>('/api/reportes/:id', {
        schema: { summary: 'Consultar un reporte', tags: ['Reportes'], params: idParam, security: [{ bearerAuth: [] }],
            response: { 200: reporteRespuesta, 404: errorRespuesta } }
    }, async (request, reply) => {
        const usuario = await usuarioDeSesion(request);
        if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
        if (!['moderador', 'administrador'].includes(usuario.rol)) return reply.code(403).send({ error: 'Sin permiso' });
        const resultado = await db.query(
            `SELECT r.*, o.id_material, o.id_usuario AS id_reportante, o.fecha_creacion
             FROM reporte r JOIN observacion o ON o.id_observacion = r.id_observacion
             WHERE r.id_observacion = $1`, [request.params.id]
        );
        if (!resultado.rows.length) return reply.code(404).send({ error: 'Reporte no encontrado' });
        return resultado.rows[0];
    });

    // HU 10, 11 y 12: UNA ruta de acciones de moderación (desestimar, solicitar,
    // aprobar o rechazar). Registra Acción y actualiza Reporte en una transacción.
    app.post<{ Params: { id: number }; Body: { tipo_accion: string; descripcion?: string } }>(
        '/api/reportes/:id/acciones', {
            schema: {
                summary: 'Registrar acción de moderación', tags: ['Acciones'], params: idParam,
                security: [{ bearerAuth: [] }],
                body: { type: 'object', required: ['tipo_accion'], properties: {
                    tipo_accion: { type: 'string', enum: [
                        'desestimar_reporte', 'solicitar_eliminacion', 'aprobar_eliminacion', 'rechazar_eliminacion'
                    ] },
                    descripcion: { type: 'string' }
                } }
            }
        }, async (request, reply) => {
            const usuario = await usuarioDeSesion(request);
            if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
            const tipo = request.body.tipo_accion;
            const requiereAdmin = ['aprobar_eliminacion', 'rechazar_eliminacion'].includes(tipo);
            if (requiereAdmin && usuario.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
            if (!requiereAdmin && !['moderador', 'administrador'].includes(usuario.rol)) {
                return reply.code(403).send({ error: 'Solo moderador/administrador' });
            }
            const cliente = await db.connect();
            try {
                await cliente.query('BEGIN');
                const res = await cliente.query(
                    `SELECT r.estado, r.id_comentario, o.id_material FROM reporte r
                     JOIN observacion o ON o.id_observacion = r.id_observacion
                     WHERE r.id_observacion = $1 FOR UPDATE OF r`, [request.params.id]
                );
                if (!res.rows.length) {
                    await cliente.query('ROLLBACK');
                    return reply.code(404).send({ error: 'Reporte no encontrado' });
                }
                const reporte = res.rows[0];
                const valido = requiereAdmin ? reporte.estado === 'solicitud_eliminacion' : reporte.estado === 'pendiente';
                if (!valido) {
                    await cliente.query('ROLLBACK');
                    return reply.code(409).send({ error: 'Transición de estado no permitida' });
                }
                const estados: Record<string, string> = {
                    desestimar_reporte: 'desestimado',
                    solicitar_eliminacion: 'solicitud_eliminacion',
                    aprobar_eliminacion: 'eliminado',
                    rechazar_eliminacion: 'rechazado'
                };
                const nuevoEstado = estados[tipo];
                await cliente.query(
                    `INSERT INTO accion (tipo_accion, descripcion, fecha_accion, id_usuario, id_reporte)
                     VALUES ($1, $2, NOW(), $3, $4)`,
                    [tipo, request.body.descripcion ?? null, usuario.id_usuario, request.params.id]
                );
                await cliente.query(
                    `UPDATE reporte SET estado = $1, fecha_resolucion =
                        CASE WHEN $2 THEN NOW() ELSE NULL END
                     WHERE id_observacion = $3`,
                    [nuevoEstado, nuevoEstado !== 'solicitud_eliminacion', request.params.id]
                );
                if (tipo === 'aprobar_eliminacion') {
                    if (reporte.id_comentario !== null) {
                        // Comentario NO tiene atributo estado en el MER:
                        // se oculta el texto sin borrar el registro que sostiene el reporte.
                        await cliente.query(
                            `UPDATE comentario SET contenido = '[Contenido eliminado por moderación]', descripcion = NULL
                             WHERE id_observacion = $1`, [reporte.id_comentario]
                        );
                    } else {
                        await cliente.query(`UPDATE material SET estado = 'eliminado' WHERE id_material = $1`, [reporte.id_material]);
                    }
                }
                await cliente.query('COMMIT');
                return reply.code(201).send({ id_reporte: request.params.id, estado: nuevoEstado });
            } catch (error) {
                await cliente.query('ROLLBACK');
                throw error;
            } finally {
                cliente.release();
            }
        }
    );

    // HU 13: Asignar/revocar Moderador; no se puede asignar Administrador desde aquí.
    app.patch<{ Params: { id: number }; Body: { id_rol: number } }>(
        '/api/usuarios/:id/rol', {
            schema: {
                summary: 'Asignar o revocar rol moderador', tags: ['Usuarios'], params: idParam,
                security: [{ bearerAuth: [] }],
                body: { type: 'object', required: ['id_rol'], properties: {
                    id_rol: { type: 'integer', minimum: 1 }
                } }
            }
        }, async (request, reply) => {
            const usuario = await usuarioDeSesion(request);
            if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
            if (usuario.rol !== 'administrador') return reply.code(403).send({ error: 'Solo administrador' });
            const rol = await db.query('SELECT nombre_rol FROM rol WHERE id_rol = $1', [request.body.id_rol]);
            if (!['estudiante', 'moderador'].includes(rol.rows[0]?.nombre_rol)) {
                return reply.code(400).send({ error: 'Solo se permite estudiante o moderador' });
            }
            const actual = await db.query(
                `SELECT r.nombre_rol FROM usuario u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = $1`,
                [request.params.id]
            );
            if (!actual.rows.length) return reply.code(404).send({ error: 'Usuario no encontrado' });
            if (actual.rows[0].nombre_rol === 'administrador') {
                return reply.code(403).send({ error: 'No se modifica el rol de un administrador' });
            }
            await db.query('UPDATE usuario SET id_rol = $1 WHERE id_usuario = $2',
                [request.body.id_rol, request.params.id]);
            return { id_usuario: request.params.id, id_rol: request.body.id_rol };
        }
    );

    // HU: Valorar un material (1 a 5 estrellas).
    // Un voto por usuario y material: si ya votó, se reemplaza su voto anterior.
    // No se puede valorar un material propio.
    app.put<{ Params: { id: number }; Body: { puntuacion: number } }>(
        '/api/materiales/:id/valoracion', {
            schema: {
                summary: 'Valorar un material', tags: ['Observaciones'], params: idParam,
                description: 'Puntuación entera de 1 a 5. Un voto por usuario y material: si ya votó, se reemplaza. No se puede valorar un material propio.',
                security: [{ bearerAuth: [] }],
                body: { type: 'object', required: ['puntuacion'], properties: {
                    puntuacion: { type: 'integer', minimum: 1, maximum: 5 }
                } },
                response: {
                    200: { type: 'object', properties: {
                        id_material: { type: 'integer' },
                        puntuacion: { type: 'integer' },
                        promedio: { type: 'number' },
                        cantidad_votos: { type: 'integer' }
                    } },
                    401: errorRespuesta, 403: errorRespuesta, 404: errorRespuesta
                }
            }
        }, async (request, reply) => {
            const usuario = await usuarioDeSesion(request);
            if (!usuario) return reply.code(401).send({ error: 'Iniciá sesión' });
            const id_material = request.params.id;
            const { puntuacion } = request.body;

            const material = await db.query(
                `SELECT id_usuario FROM material WHERE id_material = $1 AND estado = 'publicado'`,
                [id_material]
            );
            if (!material.rows.length) return reply.code(404).send({ error: 'Material no encontrado' });
            if (material.rows[0].id_usuario === usuario.id_usuario) {
                return reply.code(403).send({ error: 'No se puede valorar un material propio' });
            }

            const cliente = await db.connect();
            try {
                await cliente.query('BEGIN');
                // ¿Ya había votado este usuario este material?
                const previa = await cliente.query(
                    `SELECT v.id_observacion FROM valoracion v
                     JOIN observacion o ON o.id_observacion = v.id_observacion
                     WHERE o.id_usuario = $1 AND o.id_material = $2 FOR UPDATE`,
                    [usuario.id_usuario, id_material]
                );
                if (previa.rows.length) {
                    // Reemplaza el voto anterior
                    const id_observacion = previa.rows[0].id_observacion;
                    await cliente.query('UPDATE valoracion SET puntuacion = $1 WHERE id_observacion = $2',
                        [puntuacion, id_observacion]);
                    await cliente.query('UPDATE observacion SET fecha_creacion = NOW() WHERE id_observacion = $1',
                        [id_observacion]);
                } else {
                    // Primer voto: Observación + Valoración (generalización)
                    const base = await cliente.query(
                        `INSERT INTO observacion (fecha_creacion, id_usuario, id_material)
                         VALUES (NOW(), $1, $2) RETURNING id_observacion`,
                        [usuario.id_usuario, id_material]
                    );
                    await cliente.query('INSERT INTO valoracion (id_observacion, puntuacion) VALUES ($1, $2)',
                        [base.rows[0].id_observacion, puntuacion]);
                }
                // Promedio y cantidad de votos actualizados (no se guardan: se calculan)
                const resumen = await cliente.query(
                    `SELECT ROUND(AVG(v.puntuacion), 1)::float AS promedio, COUNT(*)::int AS cantidad_votos
                     FROM valoracion v JOIN observacion o ON o.id_observacion = v.id_observacion
                     WHERE o.id_material = $1`,
                    [id_material]
                );
                await cliente.query('COMMIT');
                return { id_material, puntuacion, ...resumen.rows[0] };
            } catch (error) {
                await cliente.query('ROLLBACK');
                throw error;
            } finally {
                cliente.release();
            }
        }
    );

    // SERVICIO WEB EXTERNO: bibliografía sugerida para una materia.
    // Consulta la API pública de Open Library (https://openlibrary.org/developers/api).
    // No requiere autenticación ni clave. Formato de respuesta: JSON.
    app.get<{ Params: { id: number } }>('/api/materias/:id/bibliografia', {
        schema: {
            summary: 'Bibliografía sugerida (servicio externo Open Library)', tags: ['Materias'],
            description: 'Busca en la API pública de Open Library hasta 5 libros relacionados con el nombre de la materia. Si el servicio externo no responde, devuelve 503.',
            params: idParam,
            response: {
                200: { type: 'array', items: { type: 'object', properties: {
                    titulo: { type: 'string' },
                    autores: { type: 'array', items: { type: 'string' } },
                    anio: { type: ['integer', 'null'] },
                    portada: { type: ['string', 'null'] },
                    enlace: { type: 'string' }
                } } },
                404: errorRespuesta,
                503: errorRespuesta
            }
        }
    }, async (request, reply) => {
        const materia = await db.query(
            'SELECT nombre_materia FROM materia WHERE id_materia = $1', [request.params.id]
        );
        if (!materia.rows.length) return reply.code(404).send({ error: 'Materia no encontrada' });

        const parametros = new URLSearchParams({
            q: materia.rows[0].nombre_materia,
            limit: '5',
            fields: 'key,title,author_name,first_publish_year,cover_i'
        });
        try {
            const respuesta = await fetch(`https://openlibrary.org/search.json?${parametros}`, {
                // Open Library pide identificar la aplicación que hace las consultas
                headers: { 'User-Agent': 'SIWeb/1.0 (proyecto academico UNComahue)' },
                signal: AbortSignal.timeout(5000) // espera como máximo 5 segundos
            });
            if (!respuesta.ok) throw new Error(`Open Library respondió ${respuesta.status}`);
            const datos = await respuesta.json() as {
                docs: Array<{ key: string; title: string; author_name?: string[];
                              first_publish_year?: number; cover_i?: number }>
            };
            return datos.docs.map((libro) => ({
                titulo: libro.title,
                autores: libro.author_name ?? [],
                anio: libro.first_publish_year ?? null,
                portada: libro.cover_i ? `https://covers.openlibrary.org/b/id/${libro.cover_i}-M.jpg` : null,
                enlace: `https://openlibrary.org${libro.key}`
            }));
        } catch (error) {
            request.log.error(error);
            return reply.code(503).send({ error: 'El servicio de bibliografía no está disponible en este momento' });
        }
    });

    await app.listen({ port: 3000, host: '127.0.0.1' });
}

iniciarServidor().catch((error) => {
    app.log.error(error);
    process.exitCode = 1;
});
