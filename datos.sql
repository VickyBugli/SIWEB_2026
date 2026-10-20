-- =====================================================================
-- SIWeb - Datos representativos de prueba
-- Ejecutar DESPUÉS de schema.sql.
-- Se puede ejecutar varias veces: vacía las tablas y reinicia los IDs,
-- así la base vuelve siempre al mismo estado inicial (útil para la demo).
--
-- ANTES DE EJECUTAR:
--   1) Reemplazar PEGAR_HASH_AQUI por el hash que genera hash.ts
--      (Buscar y reemplazar todo). Todos los usuarios quedan con la
--      contraseña de prueba Clave1234.
--   2) Reemplazar est.fi.uncoma.edu.ar por el mismo dominio que pusieron en
--      DOMINIO_INSTITUCIONAL del archivo .env.
-- =====================================================================

TRUNCATE accion, valoracion, reporte, comentario, observacion,
         material, materia, usuario, rol RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- Roles (id 1, 2, 3)
-- ---------------------------------------------------------------------
INSERT INTO rol (nombre_rol, descripcion) VALUES
  ('estudiante',    'Consulta, publica, valora, comenta y reporta materiales'),
  ('moderador',     'Estudiante que además revisa los reportes'),
  ('administrador', 'Integrante del equipo que asigna moderadores y aprueba eliminaciones');

-- ---------------------------------------------------------------------
-- Materias (id 1 a 8). 
-- ---------------------------------------------------------------------
INSERT INTO materia (nombre_materia, anio_carrera) VALUES
  ('Elementos de Álgebra Lineal',               1),   -- 1
  ('Probabilidad y Estadística',   3),   -- 2
  ('Modelado de Datos',            1),   -- 3
  ('Programación Orientada a Objetos',       2),   -- 4
  ('Laboratorio de Base de Datos', 4),   -- 5
  ('Métodos Computacionales para el Cálculo',      2),   -- 6
  ('Sistemas Paralelos',           4),   -- 7
  ('Aspectos Profesionales y Sociales',       5);   -- 8

-- ---------------------------------------------------------------------
-- Usuarios (id 1 a 5), basados en los perfiles del informe
-- ---------------------------------------------------------------------
INSERT INTO usuario (nombre_apellido, email, contrasena_hash, es_avanzado, id_rol) VALUES
  ('Valentina Gómez',   'valentina.gomez@est.fi.uncoma.edu.ar', '$argon2id$v=19$m=65536,p=4,t=3$iRDmrzrQ3xdp2lPPqH8nDg$HFgx647Aa5K40Fe0so3uHDukuALS1E+Jo5luuOEGfiE', FALSE, 1), -- 1 cursante
  ('Esteban Ruiz',      'esteban.ruiz@est.fi.uncoma.edu.ar',    '$argon2id$v=19$m=65536,p=4,t=3$iRDmrzrQ3xdp2lPPqH8nDg$HFgx647Aa5K40Fe0so3uHDukuALS1E+Jo5luuOEGfiE', TRUE,  1), -- 2 avanzado
  ('Sofía Pérez',       'sofia.perez@est.fi.uncoma.edu.ar',     '$argon2id$v=19$m=65536,p=4,t=3$iRDmrzrQ3xdp2lPPqH8nDg$HFgx647Aa5K40Fe0so3uHDukuALS1E+Jo5luuOEGfiE', TRUE,  2), -- 3 moderadora
  ('Administrador SIWeb','admin@est.fi.uncoma.edu.ar',          '$argon2id$v=19$m=65536,p=4,t=3$iRDmrzrQ3xdp2lPPqH8nDg$HFgx647Aa5K40Fe0so3uHDukuALS1E+Jo5luuOEGfiE', TRUE,  3), -- 4 administrador
  ('Martín López',      'martin.lopez@est.fi.uncoma.edu.ar',    '$argon2id$v=19$m=65536,p=4,t=3$iRDmrzrQ3xdp2lPPqH8nDg$HFgx647Aa5K40Fe0so3uHDukuALS1E+Jo5luuOEGfiE', FALSE, 1); -- 5 cursante

-- ---------------------------------------------------------------------
-- Materiales (id 1 a 8)
-- Para que la descarga funcione, copiar cualquier PDF en la carpeta
-- uploads/ con los nombres ejemplo-1.pdf ... ejemplo-8.pdf
-- ---------------------------------------------------------------------
INSERT INTO material (nombre_archivo, formato_archivo, fecha_publicacion, ruta_archivo,
                      tipo_material, descripcion, tamano, estado, id_materia, id_usuario) VALUES
  ('Resumen Sistemas Paralelos.pdf',  'application/pdf', '2025-06-10 10:00-03', 'uploads/ejemplo-1.pdf',
   'resumen', 'Resumen completo de la materia para el primer parcial', 524288, 'publicado', 7, 2),
  ('TP1 Algebra resuelto.pdf',        'application/pdf', '2025-04-02 18:30-03', 'uploads/ejemplo-2.pdf',
   'tp', 'Resolución del TP 1: matrices y determinantes', 310000, 'publicado', 1, 2),
  ('Apuntes Modelado clase 3.pdf',    'application/pdf', '2026-05-15 09:15-03', 'uploads/ejemplo-3.pdf',
   'apunte', 'Apuntes de clase sobre el modelo entidad-relación', 150000, 'publicado', 3, 1),
  ('Resumen Espacios Vectoriales.pdf','application/pdf', '2026-03-20 20:00-03', 'uploads/ejemplo-4.pdf',
   'resumen', 'Espacios vectoriales, bases y dimensión', 420000, 'publicado', 1, 2),
  ('TP3 POO.pdf',  'application/pdf', '2026-08-01 16:45-03', 'uploads/ejemplo-5.pdf',
   'tp', 'Creación de clases', 280000, 'publicado', 4, 2),
  ('Guia SQL Laboratorio.pdf',        'application/pdf', '2026-04-11 11:20-03', 'uploads/ejemplo-6.pdf',
   'apunte', 'Guía de consultas SQL con ejemplos', 610000, 'publicado', 5, 3),
  ('Resumen Probabilidad.pdf',        'application/pdf', '2026-09-05 14:10-03', 'uploads/ejemplo-7.pdf',
   'resumen', 'Variables aleatorias y distribuciones', 390000, 'publicado', 2, 5),
  ('Libro escaneado Metodos.pdf',     'application/pdf', '2026-07-22 22:00-03', 'uploads/ejemplo-8.pdf',
   'apunte', 'Capítulos de un libro escaneado', 9800000, 'eliminado', 6, 5);

-- ---------------------------------------------------------------------
-- Observaciones (id 1 a 13). Cada una se completa en su subtipo.
-- ---------------------------------------------------------------------
INSERT INTO observacion (fecha_creacion, id_usuario, id_material) VALUES
  (NOW() - INTERVAL '20 days', 1, 1),  --  1 comentario
  (NOW() - INTERVAL '18 days', 5, 1),  --  2 comentario
  (NOW() - INTERVAL '10 days', 1, 4),  --  3 comentario
  (NOW() - INTERVAL '19 days', 1, 1),  --  4 valoración
  (NOW() - INTERVAL '17 days', 5, 1),  --  5 valoración
  (NOW() - INTERVAL '15 days', 3, 1),  --  6 valoración
  (NOW() - INTERVAL '30 days', 1, 2),  --  7 valoración
  (NOW() - INTERVAL '9 days',  5, 4),  --  8 valoración
  (NOW() - INTERVAL '3 days',  1, 5),  --  9 valoración
  (NOW() - INTERVAL '2 days',  5, 6),  -- 10 reporte de material (pendiente)
  (NOW() - INTERVAL '1 day',   1, 1),  -- 11 reporte del comentario 2 (pendiente)
  (NOW() - INTERVAL '6 days',  1, 8),  -- 12 reporte de material (eliminado)
  (NOW() - INTERVAL '4 days',  2, 3);  -- 13 reporte de material (desestimado)

INSERT INTO comentario (id_observacion, contenido, descripcion) VALUES
  (1, 'Muy completo, me sirvió para el parcial.', NULL),
  (2, 'Este resumen es una basura, no lo descarguen.', NULL),
  (3, 'Ojo que en la página 4 hay un error en el ejemplo de base.', 'Sugerencia de corrección');

INSERT INTO valoracion (id_observacion, puntuacion) VALUES
  (4, 5), (5, 4), (6, 5), (7, 3), (8, 4), (9, 5);

INSERT INTO reporte (id_observacion, motivo_reporte, estado, fecha_resolucion, id_comentario) VALUES
  (10, 'El archivo no corresponde a la materia',     'pendiente',   NULL, NULL),
  (11, 'Comentario ofensivo',                         'pendiente',   NULL, 2),
  (12, 'Es un libro escaneado con derechos de autor', 'eliminado',   NOW() - INTERVAL '4 days', NULL),
  (13, 'Creo que tiene errores',                      'desestimado', NOW() - INTERVAL '3 days', NULL);

-- ---------------------------------------------------------------------
-- Historial de moderación
-- ---------------------------------------------------------------------
INSERT INTO accion (tipo_accion, descripcion, fecha_accion, id_usuario, id_reporte) VALUES
  ('solicitar_eliminacion', 'Se verifica que es material con derechos de autor', NOW() - INTERVAL '5 days', 3, 12),
  ('aprobar_eliminacion',   'Se aprueba la eliminación',                          NOW() - INTERVAL '4 days', 4, 12),
  ('desestimar_reporte',    'El material es correcto; el reporte no tiene fundamento', NOW() - INTERVAL '3 days', 3, 13);
