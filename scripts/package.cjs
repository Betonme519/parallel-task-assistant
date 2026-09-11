const path = require('node:path');

// Public builds never restore or copy a user's portable data.
(async () => {
  const { packager } = await import('@electron/packager');
  const result = await packager({
    dir: path.resolve(__dirname, '..'),
    out: path.resolve(__dirname, '../release-public'),
    name: 'Flowline',
    icon: path.resolve(__dirname, '../src/assets/icon.ico'),
    platform: 'win32', arch: 'x64', electronVersion: '44.2.0',
    asar: true, overwrite: false, prune: true,
    ignore: file => file !== '' && file !== '/' && !/^(?:\/(?:src|node_modules)(?:\/|$)|\/package\.json$)/.test(file),
    win32metadata: {
      CompanyName: 'Flowline', FileDescription: 'Flowline · 流线',
      ProductName: 'Flowline', InternalName: 'Flowline'
    }
  });
  console.log('Clean release created:', result);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
