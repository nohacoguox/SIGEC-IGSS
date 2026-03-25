const webpack = require('webpack');

module.exports = function override(config, env) {
  // Configuración para mayor estabilidad
  config.devServer = {
    ...config.devServer,
    port: 3002,
    host: '0.0.0.0',
    allowedHosts: 'all',
    // Desactivar hot reload completo para mayor estabilidad
    hot: false,
    liveReload: false,
    // Configuración de timeout
    client: {
      overlay: false,
      progress: false,
      reconnect: 5,
    },
    // Configuración de compresión y buffer
    compress: true,
    // Configuración de headers para evitar problemas de CORS
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
    // Configuración de estabilidad
    static: {
      directory: './public',
      watch: {
        ignored: /node_modules/,
        poll: 1000,
      },
    },
  };

  // Configuración de webpack para mejor rendimiento
  config.optimization = {
    ...config.optimization,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  };

  // Plugins adicionales para estabilidad
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL || 'http://localhost:3001'),
    })
  );

  return config;
};