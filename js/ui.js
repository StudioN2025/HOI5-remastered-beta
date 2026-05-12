// ui.js — ПОЛНЫЙ + сохранения

import { 
    getMyCountryId, getPlayerResources, getBuildingQueue, 
    getWars, getAlliances, getUnits, getGameSpeed 
} from './game.js';
import { UNIT_STATS, BUILDING_STATS } from './data.js';
import { getCountryInfo, getCellData, calculateCountryStats, isAtWar, areAllies, getEnemiesOf, getAlliesOf, addNotification } from './utils.js';
import { declareWar, proposeAlliance, kickFromAlliance, callToWar } from './diplomacy.js';

window.startResearch = async (type, level) => {
    const { startResearch } = await import('./tech.js');
    startResearch(type, level);
    openWindow('research');
};

window.startFocus = async (focusId) => {
    const { startFocus } = await import('./focuses.js');
    startFocus(focusId);
    openWindow('focus');
};

window.selectUnitForMove = (unitId) => {
    import('./game.js').then(m => {
        m.setSelectedUnitId(unitId);
        closeWindow();
        showHint('Выберите цель для движения');
        document.getElementById('order-hint')?.classList.remove('hidden');
    });
};

window.recruitUnit = (type) => {
    closeWindow();
    window._recruitMode = type;
    showHint(`Выберите провинцию для ${UNIT_STATS[type]?.icon} ${UNIT_STATS[type]?.name}`);
    document.getElementById('recruit-hint')?.classList.remove('hidden');
};

window.selectBuildType = async (type) => {
    const stats = BUILDING_STATS[type];
    const res = getPlayerResources();
    if ((res.equipment||0) < stats.costEquipment) {
        addNotification(`Недостаточно снаряжения! Нужно ${stats.costEquipment} 🔫`, 'war');
        return;
    }
    closeWindow();
    window._pendingBuild = type;
    showHint(`Выберите провинцию для ${stats.icon} ${stats.name}`);
    document.getElementById('build-hint')?.classList.remove('hidden');
};

window.declareWarOn = (id) => { declareWar(id); document.getElementById('info-sidebar')?.classList.add('hidden'); };
window.proposeAlly = (id) => { proposeAlliance(id); document.getElementById('info-sidebar')?.classList.add('hidden'); };
window.callToWar = callToWar;
window.kickAlly = kickFromAlliance;

export function openWindow(tab) {
    const win = document.getElementById('info-window');
    const title = document.getElementById('window-title');
    const content = document.getElementById('window-content');
    if (!win || !title || !content) return;
    
    win.classList.remove('hidden');
    
    switch(tab) {
        case 'army': title.innerText = '🎖️ АРМИЯ'; renderArmy(content); break;
        case 'research': title.innerText = '🔬 ТЕХНОЛОГИИ'; import('./tech.js').then(m => m.updateResearchUI()); break;
        case 'focus': title.innerText = '⭐ ФОКУСЫ'; import('./focuses.js').then(m => m.updateFocusUI()); break;
        case 'diplomacy': title.innerText = '🤝 ДИПЛОМАТИЯ'; renderDiplomacy(content); break;
        case 'build': title.innerText = '🏗️ СТРОЙКА'; renderBuild(content); break;
    }
}

export function closeWindow() { document.getElementById('info-window')?.classList.add('hidden'); }
export function showHint(text) {
    const h = document.getElementById('hint');
    const ht = document.getElementById('hint-text');
    if (h && ht) { ht.innerText = text; h.classList.remove('hidden'); }
}

export function updateTopBar() {
    const myId = getMyCountryId();
    if (!myId) return;
    
    const res = getPlayerResources();
    const stats = calculateCountryStats(myId, window._gridData||{}, window._cellStats||{});
    res.factories = stats.totalFactories;
    
    const totalMp = stats.totalPop * 0.05;
    const usedMp = (getUnits()||[]).filter(u => u.owner === myId).reduce((a, u) => a + (UNIT_STATS[u.type]?.costManpower||1000), 0);
    
    document.getElementById('country-name').innerText = getCountryInfo(myId).name;
    document.getElementById('val-manpower').innerText = Math.floor(Math.max(0, totalMp - usedMp)).toLocaleString();
    document.getElementById('val-factories').innerText = stats.totalFactories;
    document.getElementById('val-equipment').innerText = Math.floor(res.equipment||0).toLocaleString();
}

export function showCountryInfo(countryId, posKey) {
    const info = getCountryInfo(countryId);
    const cell = getCellData(posKey, window._cellStats||{});
    const myId = getMyCountryId();
    
    document.getElementById('sidebar-title').innerText = info.name;
    document.getElementById('sidebar-leader').innerText = info.leader;
    document.getElementById('sidebar-ideology').innerText = info.ideology;
    document.getElementById('sidebar-pop').innerText = (cell.population||0).toLocaleString();
    document.getElementById('sidebar-factories').innerText = cell.factories||0;
    
    const bld = [];
    if (cell.factories > 0) bld.push(`🏭 Заводы: ${cell.factories}`);
    if (cell.buildings?.includes('port')) bld.push('⚓ Порт');
    document.getElementById('sidebar-buildings').innerText = bld.length ? bld.join(' | ') : 'Нет';
    
    const actions = document.getElementById('sidebar-actions');
    if (countryId !== myId && myId) {
        actions.classList.remove('hidden');
        const atWar = isAtWar(myId, countryId, getWars());
        const allied = areAllies(myId, countryId, getAlliances());
        
        actions.innerHTML = `
            ${!atWar ? `<button onclick="window.declareWarOn('${countryId}')" class="w-full bg-red-700 hover:bg-red-600 py-2.5 text-sm font-bold rounded mb-2">⚔️ ОБЪЯВИТЬ ВОЙНУ</button>` : '<div class="text-red-500 text-sm text-center mb-2 py-2 bg-red-900/30 rounded">⚔️ В СОСТОЯНИИ ВОЙНЫ</div>'}
            ${!atWar && !allied ? `<button onclick="window.proposeAlly('${countryId}')" class="w-full bg-emerald-700 hover:bg-emerald-600 py-2.5 text-sm font-bold rounded">🤝 ПРЕДЛОЖИТЬ АЛЬЯНС</button>` : allied ? '<div class="text-emerald-400 text-sm text-center mb-2 py-2 bg-emerald-900/30 rounded">🤝 В АЛЬЯНСЕ</div>' : ''}
        `;
    } else if (countryId === myId) {
        actions.classList.remove('hidden');
        actions.innerHTML = '<div class="text-yellow-400 text-sm text-center py-3 bg-yellow-900/20 rounded">⭐ Это ваша страна</div>';
    } else actions.classList.add('hidden');
    
    document.getElementById('info-sidebar').classList.remove('hidden');
}

// ========== ОКНО СОХРАНЕНИЙ ==========
export function showSaveLoadMenu() {
    const win = document.getElementById('info-window');
    const title = document.getElementById('window-title');
    const content = document.getElementById('window-content');
    if (!win || !content) return;
    
    title.innerText = '💾 СОХРАНЕНИЕ И ЗАГРУЗКА';
    win.classList.remove('hidden');
    
    import('./game.js').then(m => {
        const slots = m.getSaveSlots();
        
        let html = `
            <div class="space-y-4">
                <div class="flex gap-2 mb-4">
                    <button onclick="window.quickSave()" class="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm rounded font-bold flex-1">💾 СОХРАНИТЬ</button>
                    <button onclick="window.quickLoad()" class="bg-blue-700 hover:bg-blue-600 px-4 py-2 text-sm rounded font-bold flex-1">📂 ЗАГРУЗИТЬ</button>
                </div>
                <div class="font-bold text-yellow-500 mb-2">📁 СОХРАНЕНИЯ</div>
        `;
        
        if (!slots.length) html += '<div class="text-center text-gray-500 py-4">Нет сохранений</div>';
        else slots.forEach(s => {
            html += `
                <div class="bg-gray-700 p-3 rounded-lg mb-2 flex justify-between items-center">
                    <div><div class="font-bold text-white">${s.name}</div><div class="text-xs text-gray-400">${s.date} | ${s.gameDate}</div></div>
                    <div class="flex gap-2">
                        <button onclick="window.loadSlot('${s.name}')" class="bg-blue-600 hover:bg-blue-500 px-3 py-1 text-xs rounded">ЗАГРУЗИТЬ</button>
                        <button onclick="window.deleteSlot('${s.name}')" class="bg-red-600 hover:bg-red-500 px-3 py-1 text-xs rounded">УДАЛИТЬ</button>
                    </div>
                </div>`;
        });
        html += '</div>';
        content.innerHTML = html;
    });
}

window.quickSave = async () => {
    const { saveGame } = await import('./game.js');
    saveGame('quicksave');
    addNotification('💾 Игра сохранена!', 'info');
};

window.quickLoad = async () => {
    const { loadGame } = await import('./game.js');
    if (loadGame('quicksave')) {
        addNotification('📂 Игра загружена!', 'info');
        import('./map.js').then(m => { m.markDirty(); m.renderMap(); });
        updateTopBar();
    } else addNotification('Нет быстрого сохранения!', 'war');
};

window.loadSlot = async (slot) => {
    const { loadGame } = await import('./game.js');
    if (loadGame(slot)) {
        addNotification(`📂 "${slot}" загружен!`, 'info');
        import('./map.js').then(m => { m.markDirty(); m.renderMap(); });
        updateTopBar();
        closeWindow();
    }
};

window.deleteSlot = async (slot) => {
    const { deleteSave } = await import('./game.js');
    deleteSave(slot);
    showSaveLoadMenu();
    addNotification(`🗑️ "${slot}" удалён`, 'info');
};

// ========== РЕНДЕРЫ ОКОН ==========
function renderArmy(content) {
    const myId = getMyCountryId();
    const units = (getUnits()||[]).filter(u => u.owner === myId);
    const res = getPlayerResources();
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="resources-grid">
                <div class="resource-card"><div class="resource-icon">🔫</div><div class="resource-value">${Math.floor(res.equipment||0).toLocaleString()}</div><div class="resource-label">СНАРЯЖЕНИЕ</div></div>
                <div class="resource-card"><div class="resource-icon">👥</div><div class="resource-value">${Math.floor(res.manpower||0).toLocaleString()}</div><div class="resource-label">РЕЗЕРВЫ</div></div>
                <div class="resource-card"><div class="resource-icon">🏭</div><div class="resource-value">${res.factories||0}</div><div class="resource-label">ЗАВОДЫ</div></div>
            </div>
            <div class="section-title">🆕 НАБОР</div>
            ${Object.entries(UNIT_STATS).map(([k,u]) => `
                <div class="recruit-card"><div class="recruit-info"><div class="recruit-header"><span class="recruit-icon">${u.icon}</span><span class="recruit-name">${u.name}</span></div><div class="recruit-cost">💰 ${u.costEquipment} 🔫 | 👥 ${u.costManpower}</div></div><button onclick="window.recruitUnit('${k}')" class="btn-recruit btn-active">НАБРАТЬ</button></div>
            `).join('')}
            <div class="section-title">⚔️ ВОЙСКА (${units.length})</div>
            ${units.length === 0 ? '<div class="text-center text-gray-500 py-4">Нет войск</div>' : units.map(u => {
                const s = UNIT_STATS[u.type];
                const hpP = s ? Math.max(0, (u.hp||0)/s.hp*100) : 100;
                return `<div class="unit-card-item"><div class="unit-card-header"><div class="unit-card-info"><span class="unit-icon">${s?.icon||'?'}</span><div><div class="unit-name">${s?.name||u.type}</div><div class="unit-status ${u.trainingDaysLeft>0?'text-yellow-400':'text-green-400'}">${u.trainingDaysLeft>0?`Тренировка: ${u.trainingDaysLeft}д`:'Готов'}</div></div></div><button onclick="window.selectUnitForMove('${u.id}')" class="btn-select">ВЫБРАТЬ</button></div><div class="unit-hp-bar"><div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${hpP}%"></div></div><span class="hp-text">${Math.floor(u.hp||0)}/${s?.hp||100}</span></div></div>`;
            }).join('')}
        </div>`;
}

function renderBuild(content) {
    const res = getPlayerResources();
    const queue = getBuildingQueue();
    
    let html = `<div class="resource-bar"><span>🔫 Доступно:</span><span class="text-yellow-400 font-bold">${Math.floor(res.equipment||0).toLocaleString()}</span></div>`;
    
    if (queue.length && queue[0]) {
        const c = queue[0];
        const s = BUILDING_STATS[c.type];
        if (s) {
            const p = Math.max(0, Math.min(1, (s.buildTime-(c.daysLeft||0))/s.buildTime))*100;
            html += `<div class="construction-active"><div class="construction-header"><span>🏗️ ${s.name}</span><span class="construction-days">${c.daysLeft||0} дн.</span></div><div class="progress-bar"><div class="progress-fill-blue" style="width:${p}%"></div></div></div>`;
        }
    }
    
    html += `<div class="section-title">📦 ПОСТРОЙКИ</div>`;
    Object.entries(BUILDING_STATS).forEach(([k,b]) => {
        html += `<div class="build-card"><div class="build-info"><span class="build-icon">${b.icon}</span><div><div class="build-name">${b.name}</div><div class="build-cost">💰 ${b.costEquipment} 🔫</div></div></div><button onclick="window.selectBuildType('${k}')" class="btn-build btn-active">ПОСТРОИТЬ</button></div>`;
    });
    
    content.innerHTML = html;
}

function renderDiplomacy(content) {
    const myId = getMyCountryId();
    const allies = getAlliesOf(myId, getAlliances());
    const enemies = getEnemiesOf(myId, getWars());
    
    content.innerHTML = `
        <div class="diplo-section"><div class="diplo-title diplo-allies">🤝 СОЮЗНИКИ</div>${allies.length===0?'<div class="diplo-empty">Нет союзников</div>':allies.map(a=>`<div class="diplo-card"><div><div class="diplo-country">${getCountryInfo(a).name}</div><div class="diplo-ideology">${getCountryInfo(a).ideology}</div></div><div class="diplo-actions"><button onclick="window.callToWar('${a}')" class="btn-small btn-red">ПРИЗВАТЬ</button><button onclick="window.kickAlly('${a}')" class="btn-small btn-gray">ИСКЛЮЧИТЬ</button></div></div>`).join('')}</div>
        <div class="diplo-section"><div class="diplo-title diplo-enemies">⚔️ ВОЙНЫ</div>${enemies.length===0?'<div class="diplo-empty">Мирное время</div>':enemies.map(e=>`<div class="diplo-card enemy-card"><div><div class="diplo-country">${getCountryInfo(e).name}</div></div><div class="diplo-status-war">⚔️ ВОЙНА</div></div>`).join('')}</div>`;
}
