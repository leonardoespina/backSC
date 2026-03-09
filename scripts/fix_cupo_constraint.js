const { sequelize } = require('../config/database');

async function fix() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected.');
    
    console.log('Cleaning up all old/incorrect constraints...');

    const constraintsToDrop = [
        'unique_cupo_base_combination',
        'cupo_base_id_categoria_id_dependencia_id_tipo_combustible_key',
        'unique_cupo_base_combination_v2' // drop to recreate
    ];

    for (const con of constraintsToDrop) {
        try {
            await sequelize.query(`ALTER TABLE cupo_base DROP CONSTRAINT IF EXISTS "${con}";`);
            console.log(`Dropped constraint ${con}`);
        } catch (e) {
            console.log(`Could not drop constraint ${con}: ${e.message}`);
        }
    }

    // Drop indexes just in case they are not linked to constraints
    const indexesToDrop = [
        'unique_cupo_base_combination',
        'cupo_base_id_categoria_id_dependencia_id_tipo_combustible_key',
        'unique_cupo_base_combination_v2'
    ];

    for (const idx of indexesToDrop) {
        try {
            await sequelize.query(`DROP INDEX IF EXISTS "${idx}";`);
            console.log(`Dropped index ${idx}`);
        } catch (e) {
            // console.log(`Could not drop index ${idx}: ${e.message}`);
        }
    }

    // Now create the ONE AND ONLY TRUE constraint
    console.log('Creating correct constraint...');
    try {
        await sequelize.query(`
          ALTER TABLE cupo_base 
          ADD CONSTRAINT unique_cupo_base_combination_v2 
          UNIQUE (id_categoria, id_dependencia, id_subdependencia, id_tipo_combustible);
        `);
        console.log('✅ Created new constraint unique_cupo_base_combination_v2');
    } catch (e) {
        console.error('❌ Error creating new constraint:', e.message);
        console.log('Probablemente ya existe o hay datos duplicados que lo impiden.');
    }
    
  } catch (error) {
    console.error('❌ Critical Error:', error);
  } finally {
    await sequelize.close();
  }
}

fix();
