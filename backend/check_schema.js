// Verifica las tablas existentes en Supabase y su estructura
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = require('./db');

async function checkSchema() {
  console.log('=== ESQUEMA ACTUAL DE SUPABASE ===\n');
  
  // Tablas que podrían existir
  const tablesToCheck = [
    'usuariosd', 'usuarios', 'pacientes', 'doctores', 'citass',
    'especialidades', 'specialties', 'clinicas', 'seguros',
    'horarios_doctor', 'sesiones', 'configuracion',
    'vacunacion_paciente', 'citas'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205') {
          console.log(`❌ ${table}: No existe`);
        } else {
          console.log(`⚠️ ${table}: ${error.message} (código: ${error.code})`);
        }
      } else if (data && data.length >= 0) {
        const columns = data.length > 0 ? Object.keys(data[0]) : [];
        console.log(`✅ ${table}: ${data.length} registro(s), columnas: [${columns.join(', ')}]`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }

  // Intentar ver TODAS las tablas públicas con un approach diferente
  console.log('\n--- Intentando obtener todas las tablas vía API ---');
  try {
    // Probamos algunas consultas comunes para ver qué responde
    const queries = [
      { table: 'specialties', label: 'specialties (inglés)' },
      { table: 'patients', label: 'patients (inglés)' },
      { table: 'doctors', label: 'doctors (inglés)' },
      { table: 'appointments', label: 'appointments (inglés)' },
      { table: 'profiles', label: 'profiles' },
      { table: 'users', label: 'users' },
    ];

    for (const q of queries) {
      try {
        const { data, error } = await supabase.from(q.table).select('*').limit(1);
        if (error) {
          if (error.code === 'PGRST205') {
            // No existe, no hacemos nada
          } else {
            console.log(`⚠️ ${q.label} (${q.table}): ${error.message}`);
          }
        } else {
          const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
          console.log(`✅ ${q.label} (${q.table}): ${data?.length || 0} regs, cols: [${columns.join(', ')}]`);
        }
      } catch (e) {
        // skip
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  console.log('\n=== FIN DEL ANÁLISIS ===');
}

checkSchema();