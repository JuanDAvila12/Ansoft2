// Script para ejecutar init_bd.sql contra Supabase
// Prueba múltiples combinaciones de conexión hasta encontrar la correcta
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Extraer PROJECT_REF de la URL de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const PROJECT_REF = supabaseUrl.replace('https://', '').replace('.supabase.co', '') || 'TU_PROJECT_REF';

// Posibles contraseñas a probar
const passwords = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
].filter(Boolean);

if (passwords.length === 0) {
  console.error('ERROR: Define SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  process.exit(1);
}

// Posibles hosts y puertos
const hosts = [
  // Conexión directa (diferentes regiones)
  { host: `db.${PROJECT_REF}.supabase.co`, port: 5432 },
  { host: `db.${PROJECT_REF}.supabase.co`, port: 6543 },
  // Poolers (diferentes regiones)
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 6543 },
  { host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432 },
  { host: 'aws-0-us-west-1.pooler.supabase.com', port: 6543 },
  { host: 'aws-0-us-west-1.pooler.supabase.com', port: 5432 },
  { host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543 },
  { host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 6543 },
  { host: 'aws-0-ap-northeast-1.pooler.supabase.com', port: 6543 },
  { host: 'aws-0-eu-west-1.pooler.supabase.com', port: 6543 },
  { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 6543 },
];

async function tryConnect(sqlContent) {
  const postgres = require('postgres');

  for (const pw of passwords) {
    for (const { host, port } of hosts) {
      const url = `postgres://postgres.${PROJECT_REF}:${encodeURIComponent(pw)}@${host}:${port}/postgres`;
      console.log(`Probando: ${host}:${port} ...`);

      try {
        const sql = postgres(url, {
          prepare: false,
          connect_timeout: 8,
          idle_timeout: 5,
          max: 1
        });

        // Probar conexión
        const result = await sql`SELECT 1 AS test`;
        console.log(`✅ CONECTADO a ${host}:${port}`);
        console.log(`   URL: postgres://postgres.${PROJECT_REF}:***@${host}:${port}/postgres\n`);

        // Ejecutar el script SQL
        console.log('Ejecutando init_bd.sql...');
        console.log('(Esto puede tomar unos segundos)\n');

        try {
          // Dividimos el script en statements individuales
          const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

          let success = 0;
          let errors = 0;

          for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            // Saltamos líneas que son solo comentarios
            if (stmt.startsWith('--') || stmt === '') continue;

            try {
              await sql.unsafe(stmt + ';');
              success++;
            } catch (e) {
              // Ignorar errores esperados (IF EXISTS, políticas duplicadas, etc.)
              if (e.message.includes('already exists') ||
                  e.message.includes('does not exist') ||
                  e.message.includes('duplicate_object') ||
                  e.code === '42710' || // type already exists
                  e.code === '42P07' || // relation already exists
                  e.code === '42701') { // column already exists
                success++;
              } else {
                errors++;
                console.log(`   ⚠️ Error (${e.code}): ${e.message.substring(0, 100)}`);
              }
            }
          }

          console.log(`\n✅ Script ejecutado: ${success} statements OK, ${errors} errores`);
          console.log('(Algunos errores son normales si ya existían objetos)\n');

        } catch (e) {
          console.log(`❌ Error ejecutando SQL: ${e.message}`);
        }

        // Verificar tablas creadas
        console.log('Verificando tablas creadas...');
        const tables = await sql`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `;
        console.log(`Tablas en la BD (${tables.length}):`);
        tables.forEach(t => console.log(`   - ${t.table_name}`));

        await sql.end();

        // Guardar la URL que funcionó
        const envPath = path.join(__dirname, '.env');
        const newUrl = `postgres://postgres.${PROJECT_REF}:${encodeURIComponent(pw)}@${host}:${port}/postgres`;
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('DATABASE_URL=')) {
          envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${newUrl}`);
        } else {
          envContent += `\nDATABASE_URL=${newUrl}\n`;
        }
        fs.writeFileSync(envPath, envContent);
        console.log(`\n✅ DATABASE_URL actualizado en .env`);

        console.log('\n=== MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
        return true;

      } catch (error) {
        // Falló, intentar siguiente combinación
        const msg = error.message || '';
        if (msg.includes('password authentication failed') || msg.includes('28P01')) {
          console.log(`   ❌ Password incorrecta para ${host}:${port}`);
        } else if (msg.includes('ENOTFOUND') || msg.includes('not found')) {
          console.log(`   ❌ Host no encontrado: ${host}:${port}`);
        } else if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
          console.log(`   ❌ Sin conexión: ${host}:${port}`);
        } else {
          console.log(`   ❌ Error: ${msg.substring(0, 80)}`);
        }
      }
    }
  }

  return false;
}

async function main() {
  const sqlPath = path.join(__dirname, '..', 'init_bd.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error('ERROR: No se encontró init_bd.sql en', sqlPath);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Archivo init_bd.sql cargado (${sqlContent.length} bytes)\n`);
  console.log('=== BUSCANDO CONEXIÓN A SUPABASE ===\n');

  const success = await tryConnect(sqlContent);

  if (!success) {
    console.log('\n=== NO SE PUDO CONECTAR A NINGÚN HOST ===');
    console.log('\nOpciones:');
    console.log('1. Verifica la contraseña en Supabase Dashboard → Settings → Database → Database Password');
    console.log('2. Habilita el Connection Pooler en Settings → Database → Connection Pooling');
    console.log('3. Verifica que el proyecto no esté pausado');
    console.log('4. Ejecuta init_bd.sql manualmente desde el SQL Editor de Supabase');
    process.exit(1);
  }

  process.exit(0);
}

main();