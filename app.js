import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

const app = Fastify({ logger: true })

// 1) Documentación OpenAPI
await app.register(swagger, {
  openapi: {
    info: {
      title: 'API Comunidad Facultad de Informática',
      description: 'Publicar, buscar, descargar y valorar materiales de estudio',
      version: '1.0.0'
    }
  }
})
await app.register(swaggerUi, { routePrefix: '/documentation' })

// 2) Datos de prueba (después van a venir de la base de datos)
const materias = [
  { id: 1, nombre: 'Álgebra Lineal' },
  { id: 2, nombre: 'Sistemas Paralelos' },
  { id: 3, nombre: 'Modelado de Datos' }
]

// 3) Primer endpoint
app.get('/materias', {
  schema: {
    tags: ['Materias'],
    summary: 'Listar materias',
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' }
          }
        }
      }
    }
  }
}, async () => {
  return materias
})

// 4) Levantar el servidor
await app.listen({ port: 3000 })