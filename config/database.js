const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  String(process.env.DB_PASS || ""), // Convierte a string vacío si es undefined
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432, // ← Agregado puerto por defecto de PostgreSQL
    dialect: "postgres",
    timezone: "-04:00",
    logging: false, // Desactiva logs de SQL en consola para limpieza
    pool: { // ← Recomendado para producción
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const dbConnect = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexión a PostgreSQL exitosa.");
    
    // Importamos modelos dinámicamente aquí para evitar dependencia circular
    const db = require("../models");
    
    console.log("⏳ Sincronizando base de datos...");

    // Sincronización final de TODOS los modelos
    await db.sequelize.sync({ alter: true });
    
    console.log("✅ Base de datos sincronizada completamente.");
  } catch (error) {
    console.error("❌ Error conectando a PostgreSQL:", error);
    process.exit(1);
  }
};

module.exports = { sequelize, dbConnect };