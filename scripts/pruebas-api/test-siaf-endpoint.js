// Script para probar el endpoint SIAF
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/siaf',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer fake-token-for-testing'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:', data);
    
    if (res.statusCode === 404) {
      console.log('\n❌ ERROR: El endpoint /api/siaf NO EXISTE (404)');
      console.log('Esto significa que el endpoint no se registró correctamente en el backend.');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('\n✅ BIEN: El endpoint /api/siaf EXISTE (pero requiere autenticación válida)');
    } else {
      console.log(`\n⚠️  El endpoint respondió con código: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error al conectar con el servidor:', error.message);
  console.log('Asegúrate de que el backend esté corriendo en http://localhost:3001');
});

req.end();
