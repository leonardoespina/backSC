-- Script para crear la vista de optimización de Solicitudes
-- Ejecutar en la base de datos para habilitar el modelo SolicitudDetalle

CREATE OR REPLACE VIEW vw_solicitudes_detalle AS
SELECT 
    s.id_solicitud,
    s.numero_ticket,
    s.fecha,
    s.hora,
    s.estatus,
    s.tipo_solicitud,
    s.tipo_suministro,
    s.litros_solicitado,
    s.litros_despachados,
    s.monto_total,
    s.moneda_pago,
    s.motivo_rechazo,
    s.fecha_creacion_registro,
    
    -- Vehículo
    v.id_vehiculo,
    v.placa,
    mar.nombre as marca_nombre,
    mod.nombre as modelo_nombre,
    
    -- Ubicación
    cat.nombre as categoria_nombre,
    dep.nombre_dependencia as dependencia_nombre,
    sub.nombre as subdependencia_nombre,
    
    -- Operativa
    lle.nombre_llenadero as llenadero_nombre,
    tan.nombre as tanque_nombre,
    tc.nombre as combustible_nombre,
    
    -- Usuarios (Concatenación de nombres)
    TRIM(u1.nombre || ' ' || u1.apellido) as solicitante_nombre,
    TRIM(u2.nombre || ' ' || u2.apellido) as aprobador_nombre,
    TRIM(u3.nombre || ' ' || u3.apellido) as retira_nombre,
    TRIM(u4.nombre || ' ' || u4.apellido) as almacenista_nombre,
    TRIM(u5.nombre || ' ' || u5.apellido) as despachador_nombre

FROM solicitudes s
JOIN vehiculos v ON s.id_vehiculo = v.id_vehiculo
JOIN marcas mar ON v.id_marca = mar.id_marca
JOIN modelos mod ON v.id_modelo = mod.id_modelo
JOIN categorias cat ON s.id_categoria = cat.id_categoria
JOIN dependencias dep ON s.id_dependencia = dep.id_dependencia
LEFT JOIN subdependencias sub ON s.id_subdependencia = sub.id_subdependencia
JOIN llenaderos lle ON s.id_llenadero = lle.id_llenadero
JOIN tanques tan ON s.id_tanque = tan.id_tanque
JOIN tipos_combustible tc ON s.id_tipo_combustible = tc.id_tipo_combustible
JOIN usuarios u1 ON s.id_usuario_solicita = u1.id_usuario
LEFT JOIN usuarios u2 ON s.id_usuario_aprueba = u2.id_usuario
LEFT JOIN usuarios u3 ON s.id_usuario_retira = u3.id_usuario
LEFT JOIN usuarios u4 ON s.id_usuario_almacen = u4.id_usuario
LEFT JOIN usuarios u5 ON s.id_usuario_despacha = u5.id_usuario;
