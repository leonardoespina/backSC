const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'tu_supabase_url') {
  console.warn('⚠️ Advertencia: SUPABASE_URL o SUPABASE_KEY no configurados correctamente en .env');
}

let supabase;

try {
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.error('❌ Error al inicializar el cliente de Supabase:', error.message);
  supabase = null;
}

module.exports = { supabase };
