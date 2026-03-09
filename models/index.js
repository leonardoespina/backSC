const fs = require("fs");
const path = require("path");
const { sequelize } = require("../config/database");
const db = {};

// 1. Leer todos los archivos .js en la carpeta models (excepto este index.js y copias)
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== "index.js" &&
      file !== "associations.js" &&
      !file.includes("copy") &&
      file.slice(-3) === ".js"
    );
  })
  .forEach((file) => {
    // 2. Importar cada modelo
    const model = require(path.join(__dirname, file));
    
    // 3. Guardarlo en el objeto db usando su nombre (ej: db.Usuario)
    // Sequelize define el nombre del modelo en model.name automáticamente
    db[model.name] = model;
  });

// 4. Ejecutar las asociaciones para cada modelo si las tiene definidas
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// 5. Exportar todo
db.sequelize = sequelize;

module.exports = db;
