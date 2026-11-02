const fs = require('fs');
const path = require('path');

const rnDir = path.resolve(__dirname, '..', 'node_modules', 'react-native');

if (fs.existsSync(rnDir)) {
  const files = {
    'asset-registry.js': "module.exports = require('@react-native/assets-registry/registry');\n",
    'setup-env.js': 'module.exports = {};\n',
    'unstable-internals-do-not-use.js': 'module.exports = {};\n',
  };

  for (const [filename, content] of Object.entries(files)) {
    const target = path.join(rnDir, filename);
    if (!fs.existsSync(target)) {
      try {
        fs.writeFileSync(target, content, 'utf8');
        console.log(`[patch-rn] Created ${filename}`);
      } catch (err) {
        console.warn(`[patch-rn] Could not write ${filename}:`, err.message);
      }
    }
  }
}
