const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, dialog, clipboard, safeStorage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Store } = require('./store.cjs');
const { validateState } = require('../core/model.cjs');
const { GLMVisionProvider } = require('./ai.cjs');
const {Credentials}=require('./credentials.cjs');
const {startVoice}=require('./voice.cjs');
const { dockBounds, activationRect, isInRect } = require('./dock.cjs');
const testMode = process.env.FLOWLINE_TEST === '1';
const packagedDirectory = app.isPackaged && path.basename(path.dirname(path.dirname(process.execPath))) === 'release-v2' ? path.resolve(path.dirname(process.execPath),'../../release/Flowline-win32-x64') : path.dirname(process.execPath);
const dataDirectory = process.env.FLOWLINE_DATA_DIR || path.join(app.isPackaged ? packagedDirectory : path.resolve(__dirname, '../..'), 'data');
app.setPath('userData', path.join(dataDirectory, 'runtime'));
let win, tray, store, timer, expanded = true, held = false, outsideSince = 0, graceUntil = 0;
const credentials=new Credentials(dataDirectory,safeStorage);
const provider=new GLMVisionProvider({getKey:()=>credentials.get()});
let currentDock = { expanded: true, side: 'right', view:'widget' };
const rendererFile = path.resolve(__dirname, '../renderer/index.html');
const getDisplays = () => screen.getAllDisplays().map((d, i) => ({ id: d.id, label: d.label || `显示器 ${i + 1}` }));
function place() {
  const settings = store.state.settings;
  const display = screen.getAllDisplays().find(d => d.id === settings.displayId) || screen.getPrimaryDisplay();
  const bounds = dockBounds(display.workArea, currentDock.view);
  bounds.x = settings.side === 'left' ? display.workArea.x : display.workArea.x + display.workArea.width - bounds.width;
  win.setBounds(bounds); currentDock.side = settings.side;
  win.webContents.send('dock:state', { ...currentDock });
}
function expand(focus = false) {
  expanded = true; currentDock.expanded = true; outsideSince = 0; graceUntil = Date.now() + 1200;
  win.setIgnoreMouseEvents(false); win.showInactive();
  win.webContents.send('dock:state', { ...currentDock });
  if (focus) win.focus();
}
function collapse() {
  if (held) return;
  if(currentDock.view==='home'){currentDock.view='widget';place();}
  expanded = false; currentDock.expanded = false;
  win.webContents.send('dock:state', { ...currentDock });
  // Transparent collapsed area never captures desktop clicks. Native cursor polling
  // detects the edge strip, including while dragging files from another app.
  win.setIgnoreMouseEvents(true, { forward: true });
}
function checkPointer() {
  if (!win || win.isDestroyed()) return;
  const point = screen.getCursorScreenPoint(); const bounds = win.getBounds();
  if (!expanded) { if (isInRect(point, activationRect(bounds, store.state.settings.side))) expand(); return; }
  if (currentDock.view === 'home' || held || store.state.settings.pinned || Date.now() < graceUntil || testMode) { outsideSince = 0; return; }
  if (isInRect(point, bounds)) outsideSince = 0;
  else if (!outsideSince) outsideSince = Date.now();
  else if (Date.now() - outsideSince > 850) collapse();
}
function safeHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('无效来源');
    try { return { ok: true, value: await handler(...args) }; }
    catch (error) { return { ok: false, error: error.message || '操作失败，请重试' }; }
  });
}
function assetPath(id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('截图标识无效');
  return path.join(dataDirectory, 'images', `${id}.png`);
}
function decodedImage(bytes) {
  if (!(bytes instanceof Uint8Array) && !Buffer.isBuffer(bytes)) throw new Error('图片格式无效');
  if (bytes.byteLength > 12 * 1024 * 1024 || bytes.byteLength === 0) throw new Error('请使用 12 MB 以内的图片');
  const buffer = Buffer.from(bytes);
  const png = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  const webp = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpg && !webp) throw new Error('支持 PNG、JPG、WebP 截图');
  let img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) throw new Error('无法读取此图片');
  const { width, height } = img.getSize();
  if (width * height > 60000000) throw new Error('图片尺寸过大，请裁剪后重试');
  if (width > 2400 || height > 2400) img = img.resize(width >= height ? { width: 2400 } : { height: 2400 });
  return img;
}
async function saveImage(bytes) {
  const img = decodedImage(bytes); const id = randomUUID();
  await fs.mkdir(path.join(dataDirectory, 'images'), { recursive: true });
  await fs.writeFile(assetPath(id), img.toPNG());
  return { id, preview: img.toDataURL() };
}
function installIPC() {
  safeHandler('workspace:load', async () => ({ai:await credentials.status(), state: store.snapshot(), canUndo: store.history.length > 0, displays: getDisplays(), dataDirectory, warning: store.warning, dock: currentDock }));
  safeHandler('workspace:command', async cmd => {
    if (cmd?.image) await fs.access(assetPath(cmd.image));
    const state = await store.command(cmd); if (cmd.type === 'settings') { place(); if (state.settings.pinned) expand(); }
    return { state, canUndo: store.history.length > 0 };
  });
  safeHandler('workspace:undo', async () => ({ state: await store.undo(), canUndo: store.history.length > 0 }));
  safeHandler('image:import', saveImage);
  safeHandler('image:get', async id => `data:image/png;base64,${(await fs.readFile(assetPath(id))).toString('base64')}`);
  safeHandler('image:clipboard', async () => {
    const items = await clipboard.read();
    for (const item of items) { const mime = item.types.find(type => ['image/png','image/jpeg','image/webp'].includes(type)); if (mime) { const blob = await item.getType(mime); return saveImage(new Uint8Array(await blob.arrayBuffer())); } }
    throw new Error('剪贴板里没有截图，请先截图或复制图片');
  });
  safeHandler('ai:status',()=>credentials.status());
  safeHandler('ai:configure',key=>credentials.save(key));
  safeHandler('ai:clear',()=>credentials.clear());
  safeHandler('voice:start',()=>startVoice(win,{testMode}));
  safeHandler('ai:analyze',async request=>{
    if(!request||!['create','append'].includes(request.mode)||typeof request.hint!=='string'||request.hint.length>800)throw new Error('识别请求无效');
    const bytes=await fs.readFile(assetPath(request.imageId));if(bytes.length>12*1024*1024)throw new Error('截图过大，请裁剪后重试');
    const t=request.mode==='append'?store.state.tasks.find(t=>t.id===request.taskId&&!t.archived):null;
    if(request.mode==='append'&&!t)throw new Error('请选择需要更新的任务');
    const task=t?{title:t.title,current:t.workflow?.steps[t.workflow.current]?.title||t.nodes.at(-1)?.title,steps:t.workflow?.steps.map(s=>s.title)||[]}:null;
    return provider.analyze({image:'data:image/png;base64,'+bytes.toString('base64'),mode:request.mode,hint:request.hint,task});
  });
  safeHandler('dock:hold', value => { held = value === true; outsideSince = 0; graceUntil = Date.now() + 600; });
  safeHandler('dock:collapse', () => collapse());
  safeHandler('dock:view', view => { if(!['home','widget'].includes(view))throw new Error('无效视图'); currentDock.view=view;place();expand(true);return {...currentDock}; });
  safeHandler('app:quit', () => { setTimeout(() => app.quit(), 50); });
  safeHandler('backup:export', async () => {
    const result = await dialog.showSaveDialog(win, { title: '导出工作区（含截图）', defaultPath: `Flowline-${new Date().toISOString().slice(0,10)}.flowline`, filters: [{ name: '任务助手备份', extensions: ['flowline'] }] });
    if (result.canceled) return null;
    const state = store.snapshot(); const images = {};
    for (const t of state.tasks) for (const n of t.nodes) if (n.image && !images[n.image]) images[n.image] = (await fs.readFile(assetPath(n.image))).toString('base64');
    await fs.writeFile(result.filePath, JSON.stringify({ format: 'flowline-backup', state, images }), 'utf8');
    return result.filePath;
  });
  safeHandler('backup:import', async () => {
    const result = await dialog.showOpenDialog(win, { title: '导入 任务助手备份', properties: ['openFile'], filters: [{ name: '任务助手备份', extensions: ['flowline'] }] });
    if (result.canceled) return null;
    const stat = await fs.stat(result.filePaths[0]); if (stat.size > 200 * 1024 * 1024) throw new Error('备份超过 200 MB，请拆分后导入');
    const bundle = JSON.parse(await fs.readFile(result.filePaths[0], 'utf8'));
    if (bundle.format !== 'flowline-backup') throw new Error('不是 任务助手备份');
    const state = validateState(bundle.state);
    const decoded = new Map();
    for (const t of state.tasks) for (const n of t.nodes) if (n.image && !decoded.has(n.image)) {
      assetPath(n.image);
      if (typeof bundle.images?.[n.image] !== 'string') throw new Error('备份缺少截图');
      decoded.set(n.image, decodedImage(Buffer.from(bundle.images[n.image], 'base64')).toPNG());
    }
    const confirm = await dialog.showMessageBox(win, { type: 'question', buttons: ['取消', '导入并替换'], defaultId: 0, cancelId: 0, message: `导入 ${state.tasks.length} 条时间线？`, detail: '当前工作区将被替换，可在本次运行中撤销。建议先导出当前工作区。' });
    if (confirm.response !== 1) return null;
    await fs.mkdir(path.join(dataDirectory, 'images'), { recursive: true });
    // Remap incoming image IDs so an imported backup cannot overwrite undo assets.
    const remap = new Map();
    for (const [old, bytes] of decoded) { const id = randomUUID(); await fs.writeFile(assetPath(id), bytes); remap.set(old, id); }
    for (const t of state.tasks) for (const n of t.nodes) if (n.image) n.image = remap.get(n.image);
    const next = await store.replace(state); place(); return { state: next, canUndo: true };
  });
}
async function boot() {
  store = new Store(dataDirectory); await store.init();
  win = new BrowserWindow({ width: 448, height: 800, show: false, frame: false, transparent: true, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, backgroundColor: '#00000000', title: '多线程任务助手', icon:path.resolve(__dirname,'../assets/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
  win.setMenu(null); win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  installIPC(); place(); await win.loadFile(rendererFile); expand();
  const icon = nativeImage.createFromPath(path.resolve(__dirname,'../assets/icon.png')).resize({width:20,height:20});
  tray = new Tray(icon); tray.setToolTip('多线程任务助手');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: '展开任务助手', click: () => expand(true) }, { label: '收起', click: collapse }, { type: 'separator' }, { label: '退出', click: () => app.quit() }]));
  tray.on('click', () => expand(true));
  const registered = globalShortcut.register('CommandOrControl+Shift+Space', () => expanded && !held ? collapse() : expand(true));
  if (!registered) store.warning = '快捷键被其他程序占用；仍可通过屏幕边缘或托盘打开。';
  screen.on('display-metrics-changed', place); screen.on('display-added', place); screen.on('display-removed', place);
  timer = setInterval(checkPointer, 80);
  app.on('second-instance', () => expand(true));
}
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(boot).catch(error => { dialog.showErrorBox('多线程任务助手启动失败', `${error.message}\n\n数据目录：${dataDirectory}`); app.quit(); });
app.on('window-all-closed', () => app.quit());
let finishing = false;
app.on('before-quit', event => { if (!finishing && store) { event.preventDefault(); finishing = true; store.queue.finally(() => app.quit()); } });
app.on('will-quit', () => { clearInterval(timer); globalShortcut.unregisterAll(); });
