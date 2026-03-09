// ============================================================
// Script de Prueba de Rate Limiting
// ============================================================
// Ejecutar: node test_rate_limit.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// ============================================================
// TEST 1: Rate Limiting en Login (5 intentos / 15 minutos)
// ============================================================
async function testLoginRateLimit() {
  console.log('\n=== TEST 1: RATE LIMITING EN LOGIN ===');
  console.log('Límite: 5 intentos cada 15 minutos\n');

  for (let i = 1; i <= 7; i++) {
    try {
      const response = await axios.post(`${BASE_URL}/api/usuarios/login`, {
        cedula: '12345678',
        password: 'wrongpassword'
      });
      
      console.log(`✅ Intento ${i}: ${response.status} - ${response.data.msg}`);
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ Intento ${i}: ${error.response.status} - ${error.response.data.msg || error.response.data.tipo}`);
        
        // Mostrar headers de rate limit
        const headers = error.response.headers;
        if (headers['ratelimit-limit']) {
          console.log(`   📊 RateLimit-Limit: ${headers['ratelimit-limit']}`);
          console.log(`   📊 RateLimit-Remaining: ${headers['ratelimit-remaining']}`);
          console.log(`   📊 RateLimit-Reset: ${new Date(headers['ratelimit-reset'] * 1000).toLocaleTimeString()}`);
        }
      } else {
        console.log(`❌ Intento ${i}: Error de red - ${error.message}`);
      }
    }
    
    // Esperar 500ms entre intentos
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// ============================================================
// TEST 2: Rate Limiting en API General (100 req / 1 minuto)
// ============================================================
async function testApiRateLimit() {
  console.log('\n=== TEST 2: RATE LIMITING GENERAL DE API ===');
  console.log('Límite: 100 requests por minuto\n');
  console.log('Haciendo 105 requests rápidas...\n');

  let blocked = 0;
  let success = 0;

  for (let i = 1; i <= 105; i++) {
    try {
      const response = await axios.get(`${BASE_URL}/api/usuarios/subdependencias-autorizadas`, {
        headers: { 'Authorization': 'Bearer invalid_token' }
      });
      success++;
    } catch (error) {
      if (error.response?.status === 429) {
        blocked++;
        if (blocked === 1) {
          console.log(`🚫 Request ${i}: BLOQUEADA por Rate Limit`);
          console.log(`   Mensaje: ${error.response.data.msg}`);
        }
      }
    }
  }

  console.log(`\n✅ Requests exitosas (o con 401/404): ${success}`);
  console.log(`🚫 Requests bloqueadas (429): ${blocked}`);
}

// ============================================================
// TEST 3: Verificar Headers de Rate Limit
// ============================================================
async function testRateLimitHeaders() {
  console.log('\n=== TEST 3: VERIFICAR HEADERS DE RATE LIMIT ===\n');

  try {
    const response = await axios.post(`${BASE_URL}/api/usuarios/login`, {
      cedula: 'test',
      password: 'test'
    });
  } catch (error) {
    const headers = error.response?.headers || {};
    
    console.log('Headers de Rate Limit recibidos:');
    console.log(`  RateLimit-Limit: ${headers['ratelimit-limit']}`);
    console.log(`  RateLimit-Remaining: ${headers['ratelimit-remaining']}`);
    console.log(`  RateLimit-Reset: ${headers['ratelimit-reset']} (${new Date(headers['ratelimit-reset'] * 1000).toLocaleString()})`);
  }
}

// ============================================================
// EJECUTAR TESTS
// ============================================================
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   PRUEBA DE RATE LIMITING - Sistema Combustible  ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  // Descomentar el test que deseas ejecutar:
  
  await testLoginRateLimit();        // TEST 1: Login (más importante)
  // await testApiRateLimit();       // TEST 2: API General (muchas requests)
  // await testRateLimitHeaders();   // TEST 3: Ver headers
  
  console.log('\n✅ Pruebas completadas\n');
}

runTests().catch(console.error);
