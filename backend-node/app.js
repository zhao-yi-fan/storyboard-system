'use strict';

require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: {
    module: 'Node16',
    moduleResolution: 'Node16',
    esModuleInterop: true,
  },
});

module.exports = require('./app.ts');
