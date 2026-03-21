const https = require('http');

// Primero, necesitamos hacer login para obtener un token válido
const loginData = JSON.stringify({
  codigoEmpleado: 'admin',
  password: 'admin123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

console.log('🔐 Intentando iniciar sesión como administrador...\n');

const loginReq = https.request(loginOptions, (loginRes) => {
  let loginBody = '';

  loginRes.on('data', (chunk) => {
    loginBody += chunk;
  });

  loginRes.on('end', () => {
    if (loginRes.statusCode === 200) {
      const loginResponse = JSON.parse(loginBody);
      console.log('✅ Login exitoso!');
      console.log(`   Usuario: ${loginResponse.nombres} ${loginResponse.apellidos}`);
      console.log(`   Rol: ${loginResponse.role}`);
      console.log(`   Token obtenido: ${loginResponse.token.substring(0, 20)}...\n`);

      // Ahora probamos el endpoint de estadísticas
      const statsOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/dashboard/stats',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.token}`
        }
      };

      console.log('📊 Obteniendo estadísticas del dashboard...\n');

      const statsReq = https.request(statsOptions, (statsRes) => {
        let statsBody = '';

        statsRes.on('data', (chunk) => {
          statsBody += chunk;
        });

        statsRes.on('end', () => {
          if (statsRes.statusCode === 200) {
            const stats = JSON.parse(statsBody);
            console.log('✅ Estadísticas obtenidas exitosamente!');
            console.log('\n📈 RESULTADOS:');
            console.log('═══════════════════════════════════════');
            console.log(`   👥 Total de Usuarios: ${stats.totalUsers}`);
            console.log(`   🔐 Total de Roles: ${stats.totalRoles}`);
            console.log(`   📄 Informes Generados: ${stats.totalReports}`);
            console.log('═══════════════════════════════════════\n');
            console.log('✅ PRUEBA EXITOSA: El endpoint está funcionando correctamente!');
          } else {
            console.log(`❌ Error al obtener estadísticas. Status: ${statsRes.statusCode}`);
            console.log(`   Respuesta: ${statsBody}`);
          }
        });
      });

      statsReq.on('error', (error) => {
        console.error('❌ Error en la petición de estadísticas:', error.message);
      });

      statsReq.end();

    } else {
      console.log(`❌ Error en login. Status: ${loginRes.statusCode}`);
      console.log(`   Respuesta: ${loginBody}`);
    }
  });
});

loginReq.on('error', (error) => {
  console.error('❌ Error en la petición de login:', error.message);
});

loginReq.write(loginData);
loginReq.end();
