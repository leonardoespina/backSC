const { sequelize } = require('./database');
const { supabase } = require('./supabase');
require('dotenv').config();

// CAMBIA AQUÍ: 'local' o 'supabase'
const mode = 'local'; 
// const mode = 'supabase';

const db = {
  mode,
  // Herramienta local (Sequelize)
  local: sequelize,
  // Herramienta remota (Supabase Client)
  remote: supabase,
  
  // Función para ejecutar algo dependiendo del modo
  async query(operation) {
    if (this.mode === 'supabase') {
      return await operation.remote(this.remote);
    } else {
      return await operation.local(this.local);
    }
  }
};

console.log(`🚀 Database Manager inicializado en modo: ${mode.toUpperCase()}`);

module.exports = db;
