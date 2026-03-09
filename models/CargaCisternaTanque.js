const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CargaCisternaTanque = sequelize.define('CargaCisternaTanque', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    id_carga: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'cargas_cisterna',
            key: 'id_carga'
        }
    },
    id_tanque: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'tanques',
            key: 'id_tanque'
        }
    },
    medida_inicial: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    medida_final: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    litros_iniciales: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    litros_finales: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    },
    litros_recibidos: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
    }
}, {
    tableName: 'cargas_cisterna_tanques',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

CargaCisternaTanque.associate = (models) => {
    CargaCisternaTanque.belongsTo(models.CargaCisterna, { foreignKey: 'id_carga', as: 'CargaCisterna' });
    CargaCisternaTanque.belongsTo(models.Tanque, { foreignKey: 'id_tanque', as: 'Tanque' });
};

module.exports = CargaCisternaTanque;
