// SERVICIO EXTERNO consumido directamente desde el navegador:
// API pública de Open Library (https://openlibrary.org/developers/api).
// No requiere clave y permite pedidos desde otros sitios (CORS).

export type Libro = {
  titulo: string
  autores: string[]
  anio: number | null
  portada: string | null
  enlace: string
}

type RespuestaOpenLibrary = {
  docs: {
    key: string
    title: string
    author_name?: string[]
    first_publish_year?: number
    cover_i?: number
  }[]
}

// Busca hasta 5 libros relacionados con el tema (el nombre de la materia).
export async function buscarLibros(tema: string): Promise<Libro[]> {
  const parametros = new URLSearchParams({
    q: tema,
    limit: '5',
    fields: 'key,title,author_name,first_publish_year,cover_i',
  })

  const respuesta = await fetch(`https://openlibrary.org/search.json?${parametros}`)
  if (!respuesta.ok) {
    throw new Error('Open Library no respondió')
  }
  const datos = (await respuesta.json()) as RespuestaOpenLibrary

  return datos.docs.map((libro) => ({
    titulo: libro.title,
    autores: libro.author_name ?? [],
    anio: libro.first_publish_year ?? null,
    portada: libro.cover_i ? `https://covers.openlibrary.org/b/id/${libro.cover_i}-M.jpg` : null,
    enlace: `https://openlibrary.org${libro.key}`,
  }))
}