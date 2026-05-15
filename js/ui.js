// ui.js — ПОЛНЫЙ С ФЛАГАМИ

import { 
    getMyCountryId, getPlayerResources, getBuildingQueue, 
    getWars, getAlliances, getUnits, getGameSpeed 
} from './game.js';
import { UNIT_STATS, BUILDING_STATS } from './data.js';
import { getCountryInfo, getCellData, calculateCountryStats, isAtWar, areAllies, getEnemiesOf, getAlliesOf, addNotification } from './utils.js';
import { declareWar, proposeAlliance, kickFromAlliance, callToWar } from './diplomacy.js';
import { getArmies } from './commanders.js';

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ONCLICK ==========

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
        setTimeout(() => document.getElementById('order-hint')?.classList.add('hidden'), 10000);
    });
};

window.recruitUnit = (type) => {
    closeWindow();
    window._recruitMode = type;
    showHint(`Выберите провинцию для развертывания ${UNIT_STATS[type]?.icon} ${UNIT_STATS[type]?.name}`);
    document.getElementById('recruit-hint')?.classList.remove('hidden');
    setTimeout(() => { document.getElementById('recruit-hint')?.classList.add('hidden'); window._recruitMode = null; }, 15000);
};

window.selectBuildType = async (type) => {
    const stats = BUILDING_STATS[type];
    const resources = getPlayerResources();
    if ((resources.equipment || 0) < stats.costEquipment) {
        addNotification(`Недостаточно снаряжения! Нужно ${stats.costEquipment} 🔫`, 'war');
        return;
    }
    closeWindow();
    window._pendingBuild = type;
    showHint(`Выберите провинцию для строительства ${stats.icon} ${stats.name}`);
    document.getElementById('build-hint')?.classList.remove('hidden');
    setTimeout(() => { document.getElementById('build-hint')?.classList.add('hidden'); window._pendingBuild = null; }, 15000);
};

window.declareWarOn = (id) => { declareWar(id); document.getElementById('info-sidebar')?.classList.add('hidden'); };
window.proposeAlly = (id) => { proposeAlliance(id); document.getElementById('info-sidebar')?.classList.add('hidden'); };
window.callToWar = callToWar;
window.kickAlly = kickFromAlliance;

// ========== ФЛАГИ ==========

function flagImg(countryId, size = 'normal') {
    const w = size === 'small' ? 24 : size === 'tiny' ? 18 : 32;
    const h = size === 'small' ? 15 : size === 'tiny' ? 11 : 20;
    return `<img src="assets/flags/${countryId}.png" style="width:${w}px;height:${h}px;border:1px solid rgba(255,255,255,0.2);border-radius:2px;object-fit:cover;image-rendering:pixelated;flex-shrink:0;" onerror="this.style.display='none'" alt="">`;
}

// ========== УПРАВЛЕНИЕ ОКНАМИ ==========

export function openWindow(tab) {
    const win = document.getElementById('info-window');
    const title = document.getElementById('window-title');
    const content = document.getElementById('window-content');
    if (!win || !title || !content) return;
    
    win.classList.remove('hidden');
    
    switch(tab) {
        case 'army': title.innerText = '🎖️ АРМИЯ'; renderArmyWindow(content); break;
        case 'research': title.innerText = '🔬 ТЕХНОЛОГИИ'; import('./tech.js').then(m => m.updateResearchUI()); break;
        case 'focus': title.innerText = '⭐ НАЦИОНАЛЬНЫЕ ФОКУСЫ'; import('./focuses.js').then(m => m.updateFocusUI()); break;
        case 'diplomacy': title.innerText = '🤝 ДИПЛОМАТИЯ'; renderDiplomacyWindow(content); break;
        case 'build': title.innerText = '🏗️ СТРОИТЕЛЬСТВО'; renderBuildWindow(content); break;
        case 'commanders': title.innerText = '🎖️ КОМАНДУЮЩИЕ'; renderCommandersWindow(content); break;
        case 'economy': title.innerText = '📊 ЭКОНОМИКА'; renderEconomyWindow(content); break;
    }
}

export function closeWindow() {
    document.getElementById('info-window')?.classList.add('hidden');
}

export function showHint(text) {
    const hint = document.getElementById('hint');
    const hintText = document.getElementById('hint-text');
    if (hint && hintText) {
        hintText.innerText = text;
        hint.classList.remove('hidden');
    }
}

// ========== ВЕРХНЯЯ ПАНЕЛЬ ==========

export function updateTopBar() {
    const myId = getMyCountryId();
    if (!myId) return;
    
    const resources = getPlayerResources();
    const gridData = window._gridData || {};
    const cellStats = window._cellStats || {};
    const stats = calculateCountryStats(myId, gridData, cellStats);
    resources.factories = stats.totalFactories;
    
    const totalManpower = stats.totalPop * 0.05;
    const usedManpower = (getUnits() || []).filter(u => u.owner === myId).reduce((acc, u) => acc + (UNIT_STATS[u.type]?.costManpower || 1000), 0);
    
    const countryNameElem = document.getElementById('country-name');
    const manpowerElem = document.getElementById('val-manpower');
    const factoriesElem = document.getElementById('val-factories');
    const equipmentElem = document.getElementById('val-equipment');
    
    if (countryNameElem) {
        countryNameElem.innerHTML = `
            <span class="flex items-center gap-2">
                ${flagImg(myId, 'small')}
                ${getCountryInfo(myId).name}
            </span>
        `;
    }
    if (manpowerElem) manpowerElem.innerText = Math.floor(Math.max(0, totalManpower - usedManpower)).toLocaleString();
    if (factoriesElem) factoriesElem.innerText = stats.totalFactories;
    if (equipmentElem) equipmentElem.innerText = Math.floor(resources.equipment || 0).toLocaleString();
    
    import('./game.js').then(m => {
        const research = m.getActiveResearch();
        const focus = m.getActiveFocus();
        const queue = m.getBuildingQueue();
        
        const researchInd = document.getElementById('research-indicator');
        const focusInd = document.getElementById('focus-indicator');
        const buildInd = document.getElementById('build-indicator');
        
        if (researchInd) researchInd.classList.toggle('hidden', !research);
        if (focusInd) focusInd.classList.toggle('hidden', !focus);
        if (buildInd) buildInd.classList.toggle('hidden', !queue || queue.length === 0);
    });
}

// ========== БОКОВАЯ ПАНЕЛЬ ==========

export function showCountryInfo(countryId, posKey) {
    const info = getCountryInfo(countryId);
    const cell = getCellData(posKey, window._cellStats || {});
    const myId = getMyCountryId();
    const wars = getWars();
    const alliances = getAlliances();
    
    document.getElementById('sidebar-title').innerHTML = `
        <div class="flex items-center gap-2">
            ${flagImg(countryId, 'small')}
            ${info.name}
        </div>
    `;
    document.getElementById('sidebar-leader').innerText = info.leader;
    document.getElementById('sidebar-ideology').innerText = info.ideology;
    document.getElementById('sidebar-pop').innerText = (cell.population || 0).toLocaleString();
    document.getElementById('sidebar-factories').innerText = cell.factories || 0;
    
    const buildings = [];
    if (cell.factories > 0) buildings.push(`🏭 Заводы: ${cell.factories}`);
    if (cell.buildings?.includes('port')) buildings.push('⚓ Порт');
    document.getElementById('sidebar-buildings').innerText = buildings.length ? buildings.join(' | ') : 'Нет построек';
    
    const actionsDiv = document.getElementById('sidebar-actions');
    
    if (countryId !== myId && myId) {
        actionsDiv.classList.remove('hidden');
        const atWar = isAtWar(myId, countryId, wars);
        const allied = areAllies(myId, countryId, alliances);
        
        actionsDiv.innerHTML = `
            ${!atWar ? `<button onclick="window.declareWarOn('${countryId}')" class="w-full bg-red-700 hover:bg-red-600 py-2.5 text-sm font-bold rounded mb-2 transition-colors">⚔️ ОБЪЯВИТЬ ВОЙНУ</button>` : '<div class="text-red-500 text-sm text-center mb-2 py-2 bg-red-900/30 rounded border border-red-800">⚔️ В СОСТОЯНИИ ВОЙНЫ</div>'}
            ${!atWar && !allied ? `<button onclick="window.proposeAlly('${countryId}')" class="w-full bg-emerald-700 hover:bg-emerald-600 py-2.5 text-sm font-bold rounded transition-colors">🤝 ПРЕДЛОЖИТЬ АЛЬЯНС</button>` : allied ? '<div class="text-emerald-400 text-sm text-center mb-2 py-2 bg-emerald-900/30 rounded border border-emerald-800">🤝 В АЛЬЯНСЕ</div>' : ''}
        `;
    } else if (countryId === myId) {
        actionsDiv.classList.remove('hidden');
        actionsDiv.innerHTML = '<div class="text-yellow-400 text-sm text-center py-3 bg-yellow-900/20 rounded border border-yellow-800/50">⭐ Это ваша страна</div>';
    } else {
        actionsDiv.classList.add('hidden');
    }
    
    document.getElementById('info-sidebar').classList.remove('hidden');
}

// ========== ОКНО АРМИИ ==========

function renderArmyWindow(content) {
    const myId = getMyCountryId();
    const units = (getUnits() || []).filter(u => u.owner === myId);
    const resources = getPlayerResources();
    
    let html = `
        <div class="space-y-4">
            <div class="resources-grid">
                <div class="resource-card">
                    <div class="resource-icon">🔫</div>
                    <div class="resource-value">${Math.floor(resources.equipment || 0).toLocaleString()}</div>
                    <div class="resource-label">СНАРЯЖЕНИЕ</div>
                </div>
                <div class="resource-card">
                    <div class="resource-icon">👥</div>
                    <div class="resource-value">${Math.floor(resources.manpower || 0).toLocaleString()}</div>
                    <div class="resource-label">ЛЮДСКИЕ РЕЗЕРВЫ</div>
                </div>
                <div class="resource-card">
                    <div class="resource-icon">🏭</div>
                    <div class="resource-value">${resources.factories || 0}</div>
                    <div class="resource-label">ЗАВОДЫ</div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">🆕 НАБОР ВОЙСК</div>
                <div class="space-y-2">
                    ${Object.entries(UNIT_STATS).map(([key, u]) => {
                        const canAfford = (resources.equipment || 0) >= u.costEquipment;
                        return `
                            <div class="recruit-card ${!canAfford ? 'opacity-50' : ''}">
                                <div class="recruit-info">
                                    <div class="recruit-header">
                                        <span class="recruit-icon">${u.icon}</span>
                                        <span class="recruit-name">${u.name}</span>
                                    </div>
                                    <div class="recruit-stats">
                                        <span>⚔️ ${u.attack}</span>
                                        <span>🛡️ ${u.defense}</span>
                                        <span>❤️ ${u.hp}</span>
                                        ${u.armor > 0 ? `<span>🛡️+ ${u.armor}</span>` : ''}
                                    </div>
                                    <div class="recruit-cost">
                                        <span>💰 ${u.costEquipment} 🔫</span>
                                        <span>👥 ${u.costManpower} чел</span>
                                    </div>
                                </div>
                                <button onclick="window.recruitUnit('${key}')" 
                                    class="btn-recruit ${canAfford ? 'btn-active' : 'btn-disabled'}"
                                    ${!canAfford ? 'disabled' : ''}>
                                    НАБРАТЬ
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">⚔️ МОИ ВОЙСКА (${units.length})</div>
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    ${units.length === 0 ? 
                        '<div class="text-center text-gray-500 py-8 italic">Нет войск. Наберите новые дивизии!</div>' : 
                        units.map(u => {
                            const stats = UNIT_STATS[u.type];
                            const hpPercent = stats ? Math.max(0, (u.hp || 0) / stats.hp * 100) : 100;
                            const statusColor = u.trainingDaysLeft > 0 ? 'text-yellow-400' : u.inCombat ? 'text-red-400' : 'text-green-400';
                            const statusText = u.trainingDaysLeft > 0 ? `Тренировка: ${u.trainingDaysLeft} дн.` : u.inCombat ? '⚔️ В бою' : 'Готов';
                            
                            return `
                                <div class="unit-card-item">
                                    <div class="unit-card-header">
                                        <div class="unit-card-info">
                                            <span class="unit-icon">${stats?.icon || '❓'}</span>
                                            <div>
                                                <div class="unit-name">${stats?.name || u.type}</div>
                                                <div class="unit-status ${statusColor}">${statusText}</div>
                                            </div>
                                        </div>
                                        <button onclick="window.selectUnitForMove('${u.id}')" 
                                            class="btn-select" ${u.inCombat ? 'disabled' : ''}>
                                            ${u.inCombat ? '🔒' : 'ВЫБРАТЬ'}
                                        </button>
                                    </div>
                                    <div class="unit-hp-bar">
                                        <div class="hp-bar-bg">
                                            <div class="hp-bar-fill" style="width: ${hpPercent}%"></div>
                                        </div>
                                        <span class="hp-text">${Math.floor(u.hp || 0)}/${stats?.hp || 100}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

// ========== ОКНО СТРОИТЕЛЬСТВА ==========

function renderBuildWindow(content) {
    const resources = getPlayerResources();
    const queue = getBuildingQueue();
    
    let html = `
        <div class="space-y-4">
            <div class="resource-bar">
                <span>🔫 Доступно снаряжения:</span>
                <span class="text-yellow-400 font-bold">${Math.floor(resources.equipment || 0).toLocaleString()}</span>
            </div>
    `;
    
    if (queue.length > 0 && queue[0]) {
        const current = queue[0];
        const stats = BUILDING_STATS[current.type];
        if (stats) {
            const progress = Math.max(0, Math.min(1, (stats.buildTime - (current.daysLeft || 0)) / stats.buildTime)) * 100;
            html += `
                <div class="construction-active">
                    <div class="construction-header">
                        <span>🏗️ СТРОИТСЯ: ${stats.name}</span>
                        <span class="construction-days">${current.daysLeft || 0} дн.</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill-blue" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }
    }
    
    html += `
            <div class="section-title">📦 ДОСТУПНЫЕ ПОСТРОЙКИ</div>
            <div class="space-y-2">
                ${Object.entries(BUILDING_STATS).map(([key, b]) => {
                    const canAfford = (resources.equipment || 0) >= b.costEquipment;
                    return `
                        <div class="build-card ${!canAfford ? 'opacity-50' : ''}">
                            <div class="build-info">
                                <span class="build-icon">${b.icon}</span>
                                <div>
                                    <div class="build-name">${b.name}</div>
                                    <div class="build-cost">💰 ${b.costEquipment} 🔫</div>
                                </div>
                            </div>
                            <button onclick="window.selectBuildType('${key}')" 
                                class="btn-build ${canAfford ? 'btn-active' : 'btn-disabled'}"
                                ${!canAfford ? 'disabled' : ''}>
                                ПОСТРОИТЬ
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

// ========== ОКНО ДИПЛОМАТИИ ==========

function renderDiplomacyWindow(content) {
    const myId = getMyCountryId();
    const allies = getAlliesOf(myId, getAlliances());
    const enemies = getEnemiesOf(myId, getWars());
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="diplo-section">
                <div class="diplo-title diplo-allies">🤝 СОЮЗНИКИ</div>
                ${allies.length === 0 ? 
                    '<div class="diplo-empty">Нет союзников. Используйте ПКМ по стране на карте чтобы предложить альянс.</div>' : 
                    allies.map(a => `
                        <div class="diplo-card">
                            <div>
                                <div class="diplo-country flex items-center gap-2">
                                    ${flagImg(a, 'small')}
                                    ${getCountryInfo(a).name}
                                </div>
                                <div class="diplo-ideology">${getCountryInfo(a).ideology}</div>
                            </div>
                            <div class="diplo-actions">
                                <button onclick="window.callToWar('${a}')" class="btn-small btn-red">ПРИЗВАТЬ НА ВОЙНУ</button>
                                <button onclick="window.kickAlly('${a}')" class="btn-small btn-gray">ИСКЛЮЧИТЬ</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
            
            <div class="diplo-section">
                <div class="diplo-title diplo-enemies">⚔️ ВОЙНЫ</div>
                ${enemies.length === 0 ? 
                    '<div class="diplo-empty">Мирное время</div>' : 
                    enemies.map(e => `
                        <div class="diplo-card enemy-card">
                            <div>
                                <div class="diplo-country flex items-center gap-2">
                                    ${flagImg(e, 'small')}
                                    ${getCountryInfo(e).name}
                                </div>
                                <div class="diplo-ideology">${getCountryInfo(e).ideology}</div>
                            </div>
                            <div class="diplo-status-war">⚔️ ВОЙНА</div>
                        </div>
                    `).join('')
                }
            </div>
        </div>
    `;
}

// ========== ОКНО КОМАНДУЮЩИХ ==========

function renderCommandersWindow(content) {
    const myId = getMyCountryId();
    const allUnits = (getUnits() || []).filter(u => u.owner === myId);
    const armies = getArmies();
    const unassigned = allUnits.filter(u => !armies.some(a => a.units.includes(u.id)));
    
    let html = `
        <div class="space-y-4">
            <div class="flex gap-2 mb-4">
                <button onclick="window.createNewArmy()" class="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm rounded font-bold flex-1">
                    🆕 СОЗДАТЬ АРМИЮ
                </button>
            </div>
    `;
    
    if (armies.length === 0) {
        html += '<div class="text-center text-gray-500 py-4">Нет созданных армий. Создайте армию из свободных дивизий.</div>';
    } else {
        html += '<div class="font-bold text-yellow-500 mb-2">🎖️ АРМИИ</div>';
        
        armies.forEach(army => {
            const armyUnits = allUnits.filter(u => army.units.includes(u.id));
            const readyUnits = armyUnits.filter(u => u.trainingDaysLeft <= 0 && !u.inCombat);
            const inCombat = armyUnits.filter(u => u.inCombat);
            
            html += `
                <div class="bg-gray-700 p-4 rounded-lg mb-3 border-l-4 border-yellow-500">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <div class="font-bold text-lg text-yellow-400">${army.name}</div>
                            <div class="text-xs text-gray-400">👤 ${army.commander.name} (Навык: ${'⭐'.repeat(army.commander.skill)})</div>
                            <div class="text-xs text-gray-400 mt-1">
                                ⚔️ Атака: ${army.commander.attack} | 🛡️ Защита: ${army.commander.defense} | 📦 Снабжение: ${army.commander.logistics}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm">${armyUnits.length} дивизий</div>
                            <div class="text-xs text-green-400">${readyUnits.length} готовы</div>
                            ${inCombat.length > 0 ? `<div class="text-xs text-red-400">${inCombat.length} в бою</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-1 mb-3">
                        ${army.commander.traits.map(t => `
                            <span class="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-0.5 rounded">⭐ ${t.name}</span>
                        `).join('')}
                    </div>
                    
                    <div class="space-y-1 mb-3 max-h-32 overflow-y-auto">
                        ${armyUnits.map(u => {
                            const s = UNIT_STATS[u.type];
                            const hpP = s ? Math.max(0, (u.hp||0)/s.hp*100) : 100;
                            return `
                                <div class="bg-gray-600 p-2 rounded text-xs flex justify-between items-center">
                                    <span>${s?.icon || '❓'} ${s?.name || u.type}</span>
                                    <span class="${u.inCombat ? 'text-red-400' : u.trainingDaysLeft > 0 ? 'text-yellow-400' : 'text-green-400'}">
                                        ${u.inCombat ? '⚔️ Бой' : u.trainingDaysLeft > 0 ? '🛠 Трен.' : '✓'}
                                    </span>
                                    <div class="w-16 h-1.5 bg-gray-500 rounded overflow-hidden">
                                        <div class="h-full bg-green-500" style="width:${hpP}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="window.selectArmyUnits('${army.id}')" class="bg-blue-600 hover:bg-blue-500 px-3 py-1 text-xs rounded flex-1">
                            🎯 ВЫБРАТЬ ВСЕХ
                        </button>
                        <button onclick="window.orderArmyToAttack('${army.id}')" class="bg-red-600 hover:bg-red-500 px-3 py-1 text-xs rounded flex-1">
                            ⚔️ В АТАКУ
                        </button>
                        <button onclick="window.disbandArmy('${army.id}')" class="bg-gray-600 hover:bg-gray-500 px-3 py-1 text-xs rounded">
                            ❌
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    if (unassigned.length > 0) {
        html += `
            <div class="font-bold text-gray-400 mb-2 mt-4">👤 НЕРАСПРЕДЕЛЁННЫЕ ДИВИЗИИ (${unassigned.length})</div>
            <div class="space-y-1 max-h-40 overflow-y-auto">
                ${unassigned.map(u => {
                    const s = UNIT_STATS[u.type];
                    return `
                        <div class="bg-gray-600 p-2 rounded text-xs flex justify-between items-center">
                            <span>${s?.icon || '❓'} ${s?.name || u.type}</span>
                            <span class="${u.trainingDaysLeft > 0 ? 'text-yellow-400' : 'text-green-400'}">
                                ${u.trainingDaysLeft > 0 ? `🛠 ${u.trainingDaysLeft}д` : '✓ Готов'}
                            </span>
                            <span class="text-gray-500 text-xs">${u.pos}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    html += '</div>';
    content.innerHTML = html;
}

// ========== ОКНО ЭКОНОМИКИ ==========

function renderEconomyWindow(content) {
    const resources = getPlayerResources();
    const myId = getMyCountryId();
    const stats = calculateCountryStats(myId, window._gridData || {}, window._cellStats || {});
    
    const dailyProduction = (resources.factories || 0) * 1.5;
    const units = (getUnits() || []).filter(u => u.owner === myId && u.trainingDaysLeft <= 0);
    const dailyMaintenance = units.reduce((acc, u) => acc + (UNIT_STATS[u.type]?.maintenance || 0), 0);
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="resources-grid">
                <div class="resource-card">
                    <div class="resource-icon">🔫</div>
                    <div class="resource-value">${Math.floor(resources.equipment || 0).toLocaleString()}</div>
                    <div class="resource-label">СНАРЯЖЕНИЕ</div>
                    <div class="text-xs ${dailyProduction - dailyMaintenance > 0 ? 'text-green-400' : 'text-red-400'} mt-1">
                        ${dailyProduction > 0 ? '+' : ''}${Math.floor(dailyProduction - dailyMaintenance)}/день
                    </div>
                </div>
                <div class="resource-card">
                    <div class="resource-icon">👥</div>
                    <div class="resource-value">${Math.floor(resources.manpower || 0).toLocaleString()}</div>
                    <div class="resource-label">РЕЗЕРВЫ</div>
                </div>
                <div class="resource-card">
                    <div class="resource-icon">🏭</div>
                    <div class="resource-value">${resources.factories || 0}</div>
                    <div class="resource-label">ЗАВОДЫ</div>
                </div>
            </div>
            
            <div class="bg-gray-700 p-4 rounded-lg">
                <div class="text-sm text-gray-400 mb-2">📊 СТАТИСТИКА</div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div>📊 Провинций:</div><div class="text-right">${stats.cellCount}</div>
                    <div>👨‍👩‍👧‍👦 Население:</div><div class="text-right">${Math.floor(stats.totalPop).toLocaleString()}</div>
                    <div>⚔️ Дивизий:</div><div class="text-right">${units.length}</div>
                    <div>🏗️ В очереди:</div><div class="text-right">${getBuildingQueue().length}</div>
                </div>
            </div>
        </div>
    `;
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

// ========== ФУНКЦИИ КОМАНДУЮЩИХ ==========

window.createNewArmy = async () => {
    const myId = getMyCountryId();
    const allUnits = getUnits().filter(u => u.owner === myId && u.trainingDaysLeft <= 0 && !u.inCombat);
    const armies = getArmies();
    const unassigned = allUnits.filter(u => !armies.some(a => a.units.includes(u.id)));
    
    if (unassigned.length === 0) {
        addNotification('Нет свободных боеспособных дивизий!', 'war');
        return;
    }
    
    const { createArmy } = await import('./commanders.js');
    createArmy(null, unassigned.map(u => u.id));
    openWindow('commanders');
};

window.selectArmyUnits = async (armyId) => {
    const { selectArmy } = await import('./commanders.js');
    const units = selectArmy(armyId);
    if (units) {
        closeWindow();
        import('./map.js').then(m => {
            m.setSelectedArmy(armyId);
            m.markDirty();
            m.renderMap();
        });
        showHint('🎯 Армия выбрана! Кликните по врагу для атаки.');
    }
};

window.orderArmyToAttack = async (armyId) => {
    closeWindow();
    window._selectedArmy = armyId;
    showHint('🎯 Кликните по вражеской территории для атаки всей армией');
    document.getElementById('order-hint')?.classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('order-hint')?.classList.add('hidden');
        window._selectedArmy = null;
    }, 15000);
};

window.disbandArmy = async (armyId) => {
    const { disbandArmy } = await import('./commanders.js');
    disbandArmy(armyId);
    openWindow('commanders');
};

window.showSaveMenu = () => showSaveLoadMenu();

// ========== ВЫБОР СТРАНЫ (экспорт для main.js) ==========

export function createCountryButton(countryId, sizes) {
    const info = getCountryInfo(countryId);
    const btn = document.createElement('button');
    btn.style.borderLeftColor = info.color;
    btn.style.borderLeftWidth = '4px';
    btn.innerHTML = `
        <div class="flex items-center gap-3">
            ${flagImg(countryId)}
            <div>
                <div class="font-bold">${info.name}</div>
                <div class="text-xs opacity-70">${info.ideology} • ${info.leader}</div>
                <div class="text-xs opacity-50 mt-1">📊 Провинций: ${sizes[countryId]||0}</div>
            </div>
        </div>`;
    return btn;
}
