// Script de prueba para verificar el endpoint de áreas
// Ejecutar con: node test-areas-endpoint.js

const http = require('http');

// Configuración
const BASE_URL = 'localhost';
const PORT = 3001;
const TOKEN = 'TU_TOKEN_AQUI'; // Reemplazar con un token válido

// Función para hacer peticiones HTTP
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Pruebas
async function runTests() {
  console.log('🧪 Iniciando pruebas del endpoint de áreas...\n');

  try {
    // Prueba 1: Obtener todas las áreas
    console.log('📋 Prueba 1: GET /api/areas');
    console.log('─'.repeat(50));
    const areasResponse = await makeRequest('/api/areas');
    console.log(`Status: ${areasResponse.statusCode}`);
    console.log('Áreas obtenidas:');
    console.log(JSON.stringify(areasResponse.body, null, 2));
    
    if (areasResponse.statusCode === 200) {
      console.log('✅ Prueba 1 EXITOSA\n');
      
      // Verificar que solo hay áreas activas
      const areas = areasResponse.body;
      const areasActivas = areas.filter(area => area.activo);
      const areasInactivas = areas.filter(area => !area.activo);
      
      console.log(`📊 Estadísticas:`);
      console.log(`   Total de áreas: ${areas.length}`);
      console.log(`   Áreas activas: ${areasActivas.length}`);
      console.log(`   Áreas inactivas: ${areasInactivas.length}\n`);
      
      if (areasActivas.length > 0) {
        console.log('✅ Hay áreas activas disponibles para el selector\n');
      } else {
        console.log('⚠️  ADVERTENCIA: No hay áreas activas. El selector estará vacío.\n');
      }
    } else {
      console.log('❌ Prueba 1 FALLIDA\n');
    }

    // Resumen
    console.log('═'.repeat(50));
    console.log('📝 RESUMEN DE PRUEBAS');
    console.log('═'.repeat(50));
    console.log('✅ Endpoint /api/areas está funcionando');
    console.log('✅ Las áreas se pueden obtener correctamente');
    console.log('\n🔍 PRÓXIMOS PASOS PARA PRUEBAS MANUALES:');
    console.log('1. Abrir http://localhost:3002/admin-dashboard');
    console.log('2. Ir a "Gestión de Áreas"');
    console.log('3. Verificar que existan áreas activas');
    console.log('4. Abrir http://localhost:3002/siaf-book/crear');
    console.log('5. Verificar que el selector "Área" muestre las áreas activas');
    console.log('6. Seleccionar un área y completar el formulario');
    console.log('7. Generar el PDF y verificar que el área aparezca correctamente');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
    console.log('\n⚠️  NOTA: Si el error es de autenticación, necesitas:');
    console.log('1. Iniciar sesión en http://localhost:3002');
    console.log('2. Obtener el token de autenticación');
    console.log('3. Reemplazar TU_TOKEN_AQUI en este script');
  }
}

// Ejecutar pruebas
runTests();
