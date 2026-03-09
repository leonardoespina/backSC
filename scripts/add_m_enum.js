const { sequelize } = require('../config/database');
(async () => {
    try {
        await sequelize.query(`ALTER TYPE "enum_tanques_unidad_medida" ADD VALUE 'M'`);
        console.log('Enum altered correctly.');
    } catch (e) {
        console.error(e.message);
    }
    process.exit();
})();
