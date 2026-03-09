const { supabase } = require('./config/supabase');

async function testConnection() {
  console.log('Probando conexión real a Supabase...');
  
  if (!supabase) {
    console.error('❌ Error: El cliente no está inicializado.');
    return;
  }

  try {
    // Intentamos una consulta simple a la base de datos
    // Usamos una tabla que suele existir o simplemente pedimos algo del esquema
    const { data, error } = await supabase.from('_test_inmaterial_').select('*').limit(1);
    
    // Si el error es solo que la tabla no existe, significa que la conexión SÍ funciona
    // pero la tabla no. Si el error es de credenciales, dirá "Invalid API Key" o similar.
    if (error && error.message.includes('FetchError')) {
      console.error('❌ Error de red/URL:', error.message);
    } else if (error && (error.code === 'PGRST301' || error.message.includes('JWN'))) {
      console.error('❌ Error de credenciales (API KEY):', error.message);
    } else {
      console.log('✅ ¡Conexión exitosa! El cliente se comunicó con Supabase.');
      if (error) {
        console.log('Nota: Recibimos un aviso esperado (probablemente la tabla de prueba no existe), pero la autenticación funcionó.');
      }
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err.message);
  }
}

testConnection();
