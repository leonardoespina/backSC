const { sequelize } = require('../config/database');

async function inspect() {
  try {
    await sequelize.authenticate();
    console.log('Connected.');
    
    const [results] = await sequelize.query(`
        SELECT conname, pg_get_constraintdef(oid) 
        FROM pg_constraint 
        WHERE conrelid = 'cupo_base'::regclass;
    `);
    
    console.log('Constraints for cupo_base:');
    console.log(JSON.stringify(results, null, 2));

    const [indexes] = await sequelize.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'cupo_base';
    `);
    console.log('Indexes for cupo_base:');
    console.log(JSON.stringify(indexes, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

inspect();
