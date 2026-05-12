// main.js — ПОЛНЫЙ

import { COUNTRIES, UNIT_STATS, BUILDING_STATS } from './data.js';
import { 
    getGridData, setGridData, getCellStats, setCellStats, 
    setMyCountryId, setGameActive, setGameSpeed, setGameDate, 
    setUnits, setBuildingQueue, setPlayerResources,
    getMyCountryId, getPlayerResources, getBuildingQueue, 
    getUnits, getGameSpeed, getActiveResearch, getActiveFocus, 
    getSelectedUnitId, setSelectedUnitId, advanceDay, getDateString, 
    getTech, setWars, setAlliances, getWars, getAlliances,
    getActiveBattles, setActiveBattles, initializeFactories,
    saveGame, loadGame, autoSave
} from './game.js';
import { renderMap, resizeCanvas, setupMapEvents, screenToWorld, markDirty } from './map.js';
import { deployUnit, giveOrder, processMovement, processCombat, clearRecruitMode } from './military.js';
import { processConstruction, updateEconomy } from './economy.js';
import { updateResearch } from './tech.js';
import { updateFocus } from './focuses.js';
import { runAllAI } from './ai.js';
import { openWindow, closeWindow, updateTopBar, showCountryInfo, showHint, showSaveLoadMenu } from './ui.js';
import { getCountryInfo, addNotification, isAtWar } from './utils.js';

window._gridData = {};
window._cellStats = {};
window._units = [];
window._wars = [];
window._alliances = [];
window._countries = COUNTRIES;
window._buildingQueue = [];
window._activeBattles = [];
window._myCountryId = null;
window._isGameActive = false;
window._gameSpeed = 0;
window._gameDate = new Date(1936, 0, 1, 12, 0);
window._tech = { industry: 1, infantry: 1, tank: 1 };
window._activeResearch = null;
window._activeFocus = null;
window._completedFocuses = new Set();
window._playerResources = { equipment: 1000, factories: 0, manpower: 500000 };
window._selectedUnitId = null;

window.getPlayerResources = getPlayerResources;
window.setPlayerResources = setPlayerResources;
window.updateTopBar = updateTopBar;

let gameLoopId = null;

const IMAGES_TO_PRELOAD = ['assets/hoi5-backend.png', 'assets/uploading-screan.png'];

function preloadImages() {
    return Promise.all(IMAGES_TO_PRELOAD.map(src => new Promise(resolve => {
        const img = new Image();
        img.onload = () => { console.log(`✅ Загружено: ${src}`); resolve(img); };
        img.onerror = () => { console.warn(`⚠️ Не удалось загрузить: ${src}`); resolve(null); };
        img.src = src;
    })));
}

function showLoadingScreen() {
    const menu = document.getElementById('main-menu');
    if (menu) menu.style.display = 'none';
    
    const div = document.createElement('div');
    div.id = 'loading-screen';
    div.innerHTML = `<div style="position:fixed;inset:0;z-index:9999;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Special Elite',monospace;color:#eab308;"><div style="font-size:48px;margin-bottom:20px;">⚙️</div><div style="font-size:24px;letter-spacing:.2em;margin-bottom:30px;">HOI V REMASTERED</div><div id="loading-bar-container" style="width:300px;height:8px;background:#1f2937;border-radius:4px;overflow:hidden;border:1px solid #4b5563;"><div id="loading-bar-fill" style="width:0%;height:100%;background:linear-gradient(90deg,#eab308,#fbbf24);transition:width .3s ease;"></div></div><div id="loading-text" style="margin-top:16px;font-size:12px;color:#9ca3af;letter-spacing:.1em;">ЗАГРУЗКА...</div></div>`;
    document.body.appendChild(div);
    
    return {
        setProgress: p => { const f = document.getElementById('loading-bar-fill'); if (f) f.style.width = `${Math.min(100,Math.max(0,p))}%`; },
        setText: t => { const el = document.getElementById('loading-text'); if (el) el.innerText = t; },
        remove: () => {
            const s = document.getElementById('loading-screen');
            if (s) { s.style.opacity = '0'; s.style.transition = 'opacity .3s'; setTimeout(() => s.remove(), 300); }
            if (menu) menu.style.display = '';
        }
    };
}

async function loadMapFromFile(filename) {
    try {
        const r = await fetch(`maps/${filename}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        console.log(`✅ Карта "${filename}" загружена (${Object.keys(d.gridData||{}).length} клеток)`);
        return d;
    } catch(e) { console.error('❌ Ошибка карты:', e); addNotification(`Ошибка: ${e.message}`, 'war'); return null; }
}

function areAlliesCheck(c1, c2) {
    if (c1 === c2) return true;
    return getAlliances().some(a => a.has && a.has(c1) && a.has(c2));
}

function showCountrySelection(list) {
    const c = document.getElementById('country-list');
    if (!c) return;
    c.innerHTML = '';
    
    const sizes = {};
    Object.values(getGridData()).forEach(id => sizes[id] = (sizes[id]||0)+1);
    list.sort((a,b) => (sizes[b]||0) - (sizes[a]||0));
    
    const major = list.filter(id => (sizes[id]||0) >= 30);
    const minor = list.filter(id => (sizes[id]||0) < 30);
    
    if (major.length) {
        const l = document.createElement('div');
        l.style.cssText = 'font-size:10px;color:#854d0e;text-transform:uppercase;letter-spacing:.1em;padding:4px 0;border-bottom:1px solid rgba(0,0,0,.1);margin-bottom:4px;';
        l.innerText = 'Великие державы';
        c.appendChild(l);
        major.forEach(id => c.appendChild(createBtn(id, sizes)));
    }
    if (minor.length) {
        const l = document.createElement('div');
        l.style.cssText = 'font-size:10px;color:#854d0e;text-transform:uppercase;letter-spacing:.1em;padding:8px 0 4px;border-bottom:1px solid rgba(0,0,0,.1);margin-bottom:4px;';
        l.innerText = 'Региональные державы';
        c.appendChild(l);
        minor.forEach(id => c.appendChild(createBtn(id, sizes)));
    }
    
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('country-select').classList.remove('hidden');
}

function createBtn(countryId, sizes) {
    const info = getCountryInfo(countryId);
    const btn = document.createElement('button');
    btn.style.borderLeftColor = info.color;
    btn.style.borderLeftWidth = '4px';
    btn.innerHTML = `<div class="font-bold">${info.name}</div><div class="text-xs opacity-70">${info.ideology} • ${info.leader}</div><div class="text-xs opacity-50 mt-1">📊 Провинций: ${sizes[countryId]||0}</div>`;
    btn.onclick = () => startGame(countryId);
    return btn;
}

function startGame(countryId) {
    setMyCountryId(countryId);
    setGameActive(true);
    setGameSpeed(1);
    setGameDate(new Date(1936, 0, 1, 12, 0));
    setUnits([]);
    setBuildingQueue([]);
    setWars([]);
    setAlliances([]);
    setActiveBattles([]);
    setPlayerResources({ equipment: 1000, factories: 0, manpower: 500000 });
    setSelectedUnitId(null);
    initializeFactories();
    
    document.getElementById('country-select').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    document.getElementById('game-tabs').classList.remove('hidden');
    
    updateSpeedButtons(1);
    updateTopBar();
    markDirty();
    renderMap();
    
    const info = getCountryInfo(countryId);
    addNotification(`🎌 Игра начата! Вы играете за ${info.name}`, 'info');
    addNotification('🖱️ ПКМ по юниту → ЛКМ по врагу для атаки', 'info');
    addNotification('⌨️ WASD — камера | Колёсико — зум | Пробел — пауза', 'info');
    
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    startGameLoop();
}

function startGameLoop() {
    let lastTick = performance.now();
    const TICK_INTERVAL = 1000;
    let autoSaveCounter = 0;
    
    function loop(timestamp) {
        if (!timestamp) timestamp = performance.now();
        const speed = getGameSpeed();
        
        if (speed === 0) {
            lastTick = timestamp;
            gameLoopId = requestAnimationFrame(loop);
            return;
        }
        
        const elapsed = timestamp - lastTick;
        
        if (elapsed >= TICK_INTERVAL / speed) {
            lastTick = timestamp - (elapsed % (TICK_INTERVAL / speed));
            
            advanceDay();
            autoSaveCounter++;
            
            if (autoSaveCounter >= 30) {
                autoSaveCounter = 0;
                autoSave();
            }
            
            const dateElem = document.getElementById('game-date');
            if (dateElem) dateElem.innerText = getDateString();
            
            updateResearch();
            updateFocus();
            processConstruction();
            processMovement();
            processCombat();
            
            try {
                updateEconomy(getTech().industry, { infantry: { maintenance: 0.2 }, tank: { maintenance: 1.5 } });
            } catch(e) {}
            
            runAllAI();
            updateTopBar();
            updateOpenWindows();
            markDirty();
        }
        
        gameLoopId = requestAnimationFrame(loop);
    }
    
    gameLoopId = requestAnimationFrame(loop);
}

function updateSpeedButtons(speed) {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === speed));
}

function updateOpenWindows() {
    const win = document.getElementById('info-window');
    if (!win || win.classList.contains('hidden')) return;
    const title = document.getElementById('window-title');
    if (!title) return;
    if (title.innerText.includes('ТЕХНОЛОГИИ')) import('./tech.js').then(m => m.updateResearchUI());
    else if (title.innerText.includes('ФОКУСЫ')) import('./focuses.js').then(m => m.updateFocusUI());
    else if (title.innerText.includes('СТРОИТЕЛЬСТВО')) openWindow('build');
}

async function init() {
    console.log('🚀 HOI V Remastered v2.0');
    
    const ls = showLoadingScreen();
    ls.setText('ЗАГРУЗКА ИЗОБРАЖЕНИЙ...');
    ls.setProgress(10);
    await preloadImages();
    
    ls.setText('ИНИЦИАЛИЗАЦИЯ КАРТЫ...');
    ls.setProgress(40);
    await new Promise(r => setTimeout(r, 100));
    
    resizeCanvas();
    setupMapEvents();
    renderMap();
    
    ls.setText('ЗАГРУЗКА МОДУЛЕЙ...');
    ls.setProgress(70);
    await new Promise(r => setTimeout(r, 200));
    
    ls.setText('ГОТОВО');
    ls.setProgress(100);
    
    document.getElementById('btn-play').onclick = async () => {
        const mapData = await loadMapFromFile('europe.json');
        if (!mapData) { addNotification('Не удалось загрузить карту.', 'war'); return; }
        setGridData(mapData.gridData || {});
        setCellStats(mapData.cellStats || {});
        showCountrySelection([...new Set(Object.values(getGridData()))]);
        addNotification('Карта Европы (1936) загружена!', 'info');
    };
    
    document.getElementById('btn-cancel').onclick = () => {
        document.getElementById('country-select').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
    };
    
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.onclick = () => { setGameSpeed(parseInt(btn.dataset.speed)); updateSpeedButtons(parseInt(btn.dataset.speed)); };
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.tab === 'save') showSaveLoadMenu();
            else openWindow(btn.dataset.tab);
        };
    });
    
    document.getElementById('close-window').onclick = closeWindow;
    document.getElementById('close-sidebar').onclick = () => document.getElementById('info-sidebar').classList.add('hidden');
    
    const canvas = document.getElementById('map-canvas');
    
    canvas.addEventListener('click', async (e) => {
        const world = screenToWorld(e.clientX, e.clientY);
        const key = `${world.x},${world.y}`;
        const gridData = getGridData();
        const myId = getMyCountryId();
        const units = getUnits();
        const wars = getWars();
        
        if (window._recruitMode) {
            if (gridData[key] === myId) deployUnit(key, window._recruitMode);
            else addNotification('Можно развертывать только на своей территории!', 'war');
            window._recruitMode = null;
            document.getElementById('recruit-hint')?.classList.add('hidden');
            return;
        }
        
        if (window._pendingBuild) {
            if (gridData[key] === myId) {
                const { startBuilding } = await import('./economy.js');
                if (startBuilding(window._pendingBuild, key)) { markDirty(); renderMap(); updateTopBar(); }
            } else addNotification('Строить можно только на своей территории!', 'war');
            window._pendingBuild = null;
            document.getElementById('build-hint')?.classList.add('hidden');
            return;
        }
        
        const selUnitId = getSelectedUnitId();
        if (selUnitId) {
            const selUnit = units.find(u => u.id === selUnitId);
            if (!selUnit) { setSelectedUnitId(null); document.getElementById('order-hint')?.classList.add('hidden'); return; }
            
            const targetOwner = gridData[key];
            if (targetOwner && isAtWar(myId, targetOwner, wars)) {
                const enemyUnit = units.find(u => u.pos === key && u.owner !== myId && isAtWar(myId, u.owner, wars));
                if (enemyUnit) {
                    const battles = getActiveBattles();
                    if (!battles.some(b => (b.attacker?.id===selUnit.id&&b.defender?.id===enemyUnit.id)||(b.attacker?.id===enemyUnit.id&&b.defender?.id===selUnit.id))) {
                        battles.push({ attacker: selUnit, defender: enemyUnit, daysCounter: 0 });
                        setActiveBattles(battles);
                        selUnit.inCombat = true;
                        enemyUnit.inCombat = true;
                        addNotification(`⚔️ Атака на ${enemyUnit.type==='tank'?'🚜 Танки':'💂 Пехоту'}!`, 'war');
                    }
                    setSelectedUnitId(null);
                    document.getElementById('order-hint')?.classList.add('hidden');
                    markDirty();
                    return;
                }
                giveOrder(key, selUnitId);
                setSelectedUnitId(null);
                document.getElementById('order-hint')?.classList.add('hidden');
                return;
            }
            
            if (targetOwner === myId || areAlliesCheck(myId, targetOwner)) {
                giveOrder(key, selUnitId);
                setSelectedUnitId(null);
                document.getElementById('order-hint')?.classList.add('hidden');
                return;
            }
            
            if (targetOwner) addNotification('⚡ Сначала объявите войну (ПКМ по клетке страны)!', 'war');
            else addNotification('🌊 Юниты не ходят по воде!', 'war');
            setSelectedUnitId(null);
            document.getElementById('order-hint')?.classList.add('hidden');
            return;
        }
        
        if (gridData[key]) showCountryInfo(gridData[key], key);
    });
    
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!getMyCountryId()) return;
        
        const world = screenToWorld(e.clientX, e.clientY);
        const key = `${world.x},${world.y}`;
        const units = getUnits();
        const myId = getMyCountryId();
        const gridData = getGridData();
        
        const unit = units.find(u => u.pos === key && u.owner === myId);
        if (unit) {
            setSelectedUnitId(unit.id);
            document.getElementById('order-hint')?.classList.remove('hidden');
            document.getElementById('info-sidebar')?.classList.add('hidden');
            showHint('⚔️ Кликните по врагу для атаки или по территории для захвата');
            return;
        }
        
        if (gridData[key] && gridData[key] !== myId) showCountryInfo(gridData[key], key);
    });
    
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && getMyCountryId()) {
            e.preventDefault();
            const s = getGameSpeed();
            setGameSpeed(s === 0 ? 1 : 0);
            updateSpeedButtons(s === 0 ? 1 : 0);
        }
    });
    
    setTimeout(() => ls.remove(), 400);
    
    function animate() { renderMap(); requestAnimationFrame(animate); }
    animate();
}

window.recruitUnit = (type) => {
    document.getElementById('info-window')?.classList.add('hidden');
    window._recruitMode = type;
    showHint(`🎯 Выберите провинцию для развертывания ${UNIT_STATS[type]?.icon} ${UNIT_STATS[type]?.name}`);
    document.getElementById('recruit-hint')?.classList.remove('hidden');
};

window.showSaveMenu = () => showSaveLoadMenu();

init().catch(e => {
    console.error('❌ Ошибка:', e);
    document.getElementById('loading-screen')?.remove();
    document.getElementById('main-menu').style.display = '';
});
