// Genera el hash argon2 de la contraseña de prueba para pegarlo en datos.sql
// Ejecutar con:  npx tsx hash.ts
import argon2 from 'argon2';

argon2.hash('Clave1234').then((hash) => console.log(hash));
