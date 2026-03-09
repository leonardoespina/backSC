const { sequelize } = require('../config/database');
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');

const createTestAdmin = async () => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt);

    const [user, created] = await Usuario.findOrCreate({
      where: { cedula: '99999999' },
      defaults: {
        nombre: 'Admin',
        apellido: 'Test',
        password: hashedPassword,
        tipo_usuario: 'ADMIN',
        estado: 'ACTIVO'
      }
    });

    if (created) {
      console.log('✅ Usuario ADMIN de prueba creado: Cedula 99999999 / Pass 123456');
    } else {
      console.log('ℹ️ Usuario ADMIN de prueba ya existe.');
      // Update password just in case
      user.password = hashedPassword;
      await user.save();
      console.log('✅ Password actualizado a 123456');
    }

  } catch (error) {
    console.error('❌ Error creando admin:', error);
  } finally {
    await sequelize.close();
  }
};

createTestAdmin();
