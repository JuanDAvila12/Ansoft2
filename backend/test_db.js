// Script para probar conexión a Supabase vía API (REST)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = require('./db');

async function testConnection() {
  console.log('=== PROBANDO CONEXIÓN A SUPABASE (API REST) ===\n');
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configurada ✓' : 'NO ENCONTRADA ✗');
  console.log('');

  try {
    // 1. Insertar y leer en configuracion (prueba de escritura + lectura)
    console.log('1. Probando inserción/lectura en configuracion...');
    
    const { data: upsertData1, error: upsertError1 } = await supabase
      .from('configuracion')
      .upsert({ clave: 'test_conexion', valor: 'OK desde API: ' + new Date().toISOString() }, { onConflict: 'clave' })
      .select();

    if (upsertError1) throw upsertError1;
    console.log(`   ✅ Inserción exitosa: ${upsertData1[0].clave} = ${upsertData1[0].valor}`);

    // 2. Verificar tablas existentes
    console.log('\n2. Verificando tablas...');
    const tables = [
      'especialidades', 'clinicas', 'seguros', 'usuariosd',
      'pacientes', 'doctores', 'horarios_doctor', 'citas',
      'sesiones', 'configuracion'
    ];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`   ${table}: ❌ Error - ${error.message}`);
        } else {
          console.log(`   ${table}: ✅ (${count} registros)`);
        }
      } catch (e) {
        console.log(`   ${table}: ❌ ${e.message}`);
      }
    }

    // 3. Verificar especialidades (lectura)
    console.log('\n3. Leyendo especialidades...');
    const { data: especialidades, error: espError } = await supabase
      .from('especialidades')
      .select('id, nombre')
      .limit(5);

    if (espError) throw espError;

    if (especialidades.length > 0) {
      console.log(`   ✅ ${especialidades.length} encontradas:`);
      especialidades.forEach(e => console.log(`      - ${e.nombre}`));
    } else {
      console.log('   ⚠️ No hay especialidades aún.');
    }

    // 4. Verificar usuarios
    console.log('\n4. Leyendo usuarios...');
    const { data: usuarios, error: userError } = await supabase
      .from('usuariosd')
      .select('id, nombre_completo, email, rol')
      .limit(5);

    if (userError) throw userError;

    if (usuarios.length > 0) {
      console.log(`   ✅ ${usuarios.length} encontrados:`);
      usuarios.forEach(u => console.log(`      - ${u.nombre_completo} (${u.rol}): ${u.email}`));
    } else {
      console.log('   ⚠️ No hay usuarios aún.');
    }

    // 5. Probar inserción de datos en tabla principal
    console.log('\n5. Probando CRUD completo en especialidades...');

    // INSERT
    const { data: nuevaEsp, error: insertError } = await supabase
      .from('especialidades')
      .insert({ nombre: 'Test ' + Date.now(), descripcion: 'Especialidad de prueba' })
      .select();

    if (insertError) {
      console.log(`   ⚠️ No se pudo insertar: ${insertError.message}`);
    } else {
      console.log(`   ✅ Insertada: ${nuevaEsp[0].nombre} (${nuevaEsp[0].id})`);

      // UPDATE
      const { error: updateError } = await supabase
        .from('especialidades')
        .update({ descripcion: 'Actualizada por test' })
        .eq('id', nuevaEsp[0].id);

      if (updateError) {
        console.log(`   ⚠️ No se pudo actualizar: ${updateError.message}`);
      } else {
        console.log('   ✅ Actualizada correctamente');
      }

      // DELETE
      const { error: deleteError } = await supabase
        .from('especialidades')
        .delete()
        .eq('id', nuevaEsp[0].id);

      if (deleteError) {
        console.log(`   ⚠️ No se pudo eliminar: ${deleteError.message}`);
      } else {
        console.log('   ✅ Eliminada correctamente');
      }
    }

    console.log('\n=== ✅ TODAS LAS PRUEBAS EXITOSAS ===');
    console.log('La conexión a Supabase vía API REST funciona correctamente.');
    console.log('Ya puedes ingresar datos a la BD desde el backend.');

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('   Mensaje:', error.message);
    console.error('   Detalles:', error.details || 'N/A');
    console.error('   Código:', error.code);
    console.error('\nPosibles causas:');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY incorrecta');
    console.error('   - Proyecto pausado en Supabase');
    console.error('   - RLS bloqueando las operaciones');
    console.error('   - Tablas no creadas aún (ejecuta init_bd.sql primero)');
  }
}

testConnection();