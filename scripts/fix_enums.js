const { sequelize } = require("../config/database");

async function run() {
  try {
    // Intentaremos agregar ANULADA y ANULADO a todas
    // Postgres >= 12 soporta IF NOT EXISTS
    
    console.log("Adding ANULADA to enum_cargas_cisterna_estado");
    try {
      await sequelize.query(`ALTER TYPE enum_cargas_cisterna_estado ADD VALUE IF NOT EXISTS 'ANULADA';`);
    } catch(e) { console.log(e.message) }

    console.log("Adding ANULADO to enum_transferencias_internas_estado");
    try {
      await sequelize.query(`ALTER TYPE enum_transferencias_internas_estado ADD VALUE IF NOT EXISTS 'ANULADA';`);
      await sequelize.query(`ALTER TYPE enum_transferencias_internas_estado ADD VALUE IF NOT EXISTS 'ANULADO';`);
    } catch(e) { console.log(e.message) }

    console.log("Success");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
