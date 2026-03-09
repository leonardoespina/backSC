const { sequelize } = require('./config/database');
const { Solicitud } = require('./models');

async function testQuery() {
  try {
    console.log('--- TEST DE CONSULTA DE SOLICITUDES ---');
    
    // 1. Ver total de solicitudes
    const total = await Solicitud.count();
    console.log(`Total de solicitudes en la tabla: ${total}`);

    // 2. Ver estados existentes
    const estados = await Solicitud.findAll({
      attributes: [
        'estado',
        [sequelize.fn('COUNT', sequelize.col('id_solicitud')), 'cantidad']
      ],
      group: ['estado'],
      raw: true
    });
    console.log('Distribución por Estados:', estados);

    // 3. Ver tipos de solicitud existentes
    const tipos = await Solicitud.findAll({
        attributes: [
          'tipo_solicitud',
          [sequelize.fn('COUNT', sequelize.col('id_solicitud')), 'cantidad']
        ],
        group: ['tipo_solicitud'],
        raw: true
      });
      console.log('Distribución por Tipo de Solicitud:', tipos);

    // 4. Ver últimos 5 registros con sus fechas
    const ultimas = await Solicitud.findAll({
        attributes: ['id_solicitud', 'estado', 'tipo_solicitud', 'fecha_solicitud', 'fecha_despacho', 'id_llenadero'],
        order: [['id_solicitud', 'DESC']],
        limit: 5,
        raw: true
    });
    console.log('Últimos 5 registros:', ultimas);

  } catch (error) {
    console.error('ERROR EN TEST:', error);
  } finally {
    process.exit();
  }
}

testQuery();
