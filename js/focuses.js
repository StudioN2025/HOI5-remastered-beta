// focuses.js — РАСШИРЕННОЕ ДЕРЕВО С ЗАВИСИМОСТЯМИ

import { 
    getMyCountryId, getActiveFocus, setActiveFocus, 
    getCompletedFocuses, addCompletedFocus, 
    getPlayerResources, setPlayerResources, 
    getGridData, getCellStats, setCellStats,
    addUnit, addWar 
} from './game.js';
import { NATIONAL_FOCUSES } from './data.js';
import { addNotification } from './utils.js';

// ========== ЗАВИСИМОСТИ ФОКУСОВ (prerequisites) ==========
const FOCUS_PREREQUISITES = {
    germany: {
        ger_rearm: [],
        ger_danzig: ['ger_rearm'],
        ger_axis: ['ger_rearm'],
        ger_west: ['ger_rearm'],
        ger_break_pact: ['ger_danzig', 'ger_axis']
    },
    ussr: {
        ussr_five_year: [],
        ussr_industry: [],
        ussr_fin_war: ['ussr_five_year'],
        ussr_baltic: ['ussr_five_year', 'ussr_industry'],
        ussr_defense: ['ussr_fin_war', 'ussr_baltic']
    },
    italy: {
        ita_navy: [],
        ita_empire: [],
        ita_revive: ['ita_navy', 'ita_empire'],
        ita_allies: ['ita_navy', 'ita_empire']
    },
    uk: {
        uk_navy: [],
        uk_empire: [],
        uk_guarantee: ['uk_navy', 'uk_empire'],
        uk_raf: ['uk_navy', 'uk_empire']
    },
    france: {
        fra_maginot: [],
        fra_colonies: [],
        fra_allies: ['fra_maginot', 'fra_colonies'],
        fra_revanche: ['fra_maginot', 'fra_colonies']
    },
    poland: {
        pol_army: [],
        pol_industry: [],
        pol_allies: ['pol_army', 'pol_industry'],
        pol_defense: ['pol_army', 'pol_industry']
    },
    turkey: {
        tur_modernize: [],
        tur_straits: [],
        tur_balkans: ['tur_modernize', 'tur_straits'],
        tur_pan_turkic: ['tur_modernize', 'tur_straits']
    },
    spain: {
        spa_rebuild: [],
        spa_fleet: [],
        spa_empire: ['spa_rebuild']
    },
    romania: {
        rom_army: [],
        rom_oil: ['rom_army']
    },
    hungary: {
        hun_army: [],
        hun_revise: ['hun_army']
    },
    yugoslavia: {
        yug_army: [],
        yug_unity: ['yug_army']
    },
    greece: {
        gre_army: [],
        gre_megali: ['gre_army']
    },
    czechoslovakia: {
        cze_forts: [],
        cze_army: ['cze_forts']
    },
    finland: {
        fin_defense: []
    },
    bulgaria: {
        bul_army: []
    },
    switzerland: {
        swi_neutral: []
    },
    portugal: {
        por_colonies: []
    },
    luxembourg: {
        lux_defense: []
    }
};

// ========== ПОЗИЦИИ ФОКУСОВ (расширенные) ==========
const FOCUS_POSITIONS = {
    germany: {
        ger_rearm: { x: 400, y: 80 },
        ger_danzig: { x: 200, y: 220 },
        ger_axis: { x: 400, y: 220 },
        ger_west: { x: 600, y: 220 },
        ger_break_pact: { x: 400, y: 360 }
    },
    ussr: {
        ussr_five_year: { x: 280, y: 80 },
        ussr_industry: { x: 520, y: 80 },
        ussr_fin_war: { x: 200, y: 220 },
        ussr_baltic: { x: 400, y: 220 },
        ussr_defense: { x: 400, y: 360 }
    },
    italy: {
        ita_navy: { x: 300, y: 100 },
        ita_empire: { x: 500, y: 100 },
        ita_revive: { x: 300, y: 260 },
        ita_allies: { x: 500, y: 260 }
    },
    uk: {
        uk_navy: { x: 300, y: 100 },
        uk_empire: { x: 500, y: 100 },
        uk_guarantee: { x: 300, y: 260 },
        uk_raf: { x: 500, y: 260 }
    },
    france: {
        fra_maginot: { x: 300, y: 100 },
        fra_colonies: { x: 500, y: 100 },
        fra_allies: { x: 300, y: 260 },
        fra_revanche: { x: 500, y: 260 }
    },
    poland: {
        pol_army: { x: 300, y: 100 },
        pol_industry: { x: 500, y: 100 },
        pol_allies: { x: 300, y: 260 },
        pol_defense: { x: 500, y: 260 }
    },
    turkey: {
        tur_modernize: { x: 300, y: 100 },
        tur_straits: { x: 500, y: 100 },
        tur_balkans: { x: 300, y: 260 },
        tur_pan_turkic: { x: 500, y: 260 }
    },
    spain: {
        spa_rebuild: { x: 350, y: 100 },
        spa_fleet: { x: 500, y: 100 },
        spa_empire: { x: 400, y: 260 }
    },
    romania: {
        rom_army: { x: 350, y: 120 },
        rom_oil: { x: 500, y: 260 }
    },
    hungary: {
        hun_army: { x: 350, y: 120 },
        hun_revise: { x: 500, y: 260 }
    },
    yugoslavia: {
        yug_army: { x: 350, y: 120 },
        yug_unity: { x: 500, y: 260 }
    },
    greece: {
        gre_army: { x: 350, y: 120 },
        gre_megali: { x: 500, y: 260 }
    },
    czechoslovakia: {
        cze_forts: { x: 350, y: 120 },
        cze_army: { x: 500, y: 260 }
    },
    finland: {
        fin_defense: { x: 400, y: 150 }
    },
    bulgaria: {
        bul_army: { x: 400, y: 150 }
    },
    switzerland: {
        swi_neutral: { x: 400, y: 150 }
    },
    portugal: {
        por_colonies: { x: 400, y: 150 }
    },
    luxembourg: {
        lux_defense: { x: 400, y: 150 }
    }
};

// ========== СОЕДИНЕНИЯ ==========
const FOCUS_CONNECTIONS = {
    germany: [
        ['ger_rearm', 'ger_danzig'], ['ger_rearm', 'ger_axis'], ['ger_rearm', 'ger_west'],
        ['ger_danzig', 'ger_break_pact'], ['ger_axis', 'ger_break_pact'], ['ger_west', 'ger_break_pact']
    ],
    ussr: [
        ['ussr_five_year', 'ussr_fin_war'], ['ussr_five_year', 'ussr_baltic'],
        ['ussr_industry', 'ussr_baltic'],
        ['ussr_fin_war', 'ussr_defense'], ['ussr_baltic', 'ussr_defense']
    ],
    italy: [
        ['ita_navy', 'ita_revive'], ['ita_empire', 'ita_revive'],
        ['ita_navy', 'ita_allies'], ['ita_empire', 'ita_allies']
    ],
    uk: [
        ['uk_navy', 'uk_guarantee'], ['uk_empire', 'uk_guarantee'],
        ['uk_navy', 'uk_raf'], ['uk_empire', 'uk_raf']
    ],
    france: [
        ['fra_maginot', 'fra_allies'], ['fra_colonies', 'fra_allies'],
        ['fra_maginot', 'fra_revanche'], ['fra_colonies', 'fra_revanche']
    ],
    poland: [
        ['pol_army', 'pol_allies'], ['pol_industry', 'pol_allies'],
        ['pol_army', 'pol_defense'], ['pol_industry', 'pol_defense']
    ],
    turkey: [
        ['tur_modernize', 'tur_balkans'], ['tur_straits', 'tur_balkans'],
        ['tur_modernize', 'tur_pan_turkic'], ['tur_straits', 'tur_pan_turkic']
    ],
    spain: [
        ['spa_rebuild', 'spa_empire'], ['spa_fleet', 'spa_empire']
    ],
    romania: [
        ['rom_army', 'rom_oil']
    ],
    hungary: [
        ['hun_army', 'hun_revise']
    ],
    yugoslavia: [
        ['yug_army', 'yug_unity']
    ],
    greece: [
        ['gre_army', 'gre_megali']
    ],
    czechoslovakia: [
        ['cze_forts', 'cze_army']
    ]
};

// Иконки
const FOCUS_ICONS = {
    ger_rearm: '🔫', ger_danzig: '⚔️', ger_axis: '🤝', ger_west: '🗺️', ger_break_pact: '💥',
    ussr_five_year: '🏭', ussr_industry: '⚙️', ussr_fin_war: '❄️', ussr_baltic: '🤝', ussr_defense: '🛡️',
    ita_navy: '⚓', ita_empire: '👑', ita_revive: '🏛️', ita_allies: '🤝',
    uk_navy: '🚢', uk_empire: '🌍', uk_guarantee: '📜', uk_raf: '✈️',
    fra_maginot: '🏰', fra_colonies: '🌍', fra_allies: '🤝', fra_revanche: '⚔️',
    pol_army: '💂', pol_industry: '🏭', pol_allies: '🤝', pol_defense: '🛡️',
    tur_modernize: '🔫', tur_straits: '🌊', tur_balkans: '🤝', tur_pan_turkic: '🐺',
    spa_rebuild: '🔧', spa_fleet: '⚓', spa_empire: '👑',
    rom_army: '💂', rom_oil: '🛢️',
    hun_army: '💂', hun_revise: '⚔️',
    yug_army: '💂', yug_unity: '🤝',
    gre_army: '💂', gre_megali: '🏛️',
    cze_forts: '🏰', cze_army: '💂',
    fin_defense: '🛡️',
    bul_army: '💂',
    swi_neutral: '🏔️',
    por_colonies: '🌍',
    lux_defense: '🏰'
};

// ========== ПРОВЕРКА ДОСТУПНОСТИ ==========
function isFocusAvailable(focusId, countryId, completed) {
    const prereqs = (FOCUS_PREREQUISITES[countryId] || {})[focusId] || [];
    if (prereqs.length === 0) return true;
    return prereqs.every(prereq => completed.has(prereq));
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

export function getAvailableFocuses() {
    const myCountryId = getMyCountryId();
    const completed = getCompletedFocuses();
    const focuses = NATIONAL_FOCUSES[myCountryId] || [];
    return focuses.filter(f => !completed.has(f.id) && isFocusAvailable(f.id, myCountryId, completed));
}

export function startFocus(focusId) {
    const myCountryId = getMyCountryId();
    const focuses = NATIONAL_FOCUSES[myCountryId] || [];
    const focus = focuses.find(f => f.id === focusId);
    const completed = getCompletedFocuses();
    
    if (!focus || completed.has(focus.id)) return false;
    
    // ✅ Проверка зависимостей
    if (!isFocusAvailable(focusId, myCountryId, completed)) {
        addNotification('Сначала изучите предыдущие фокусы!', 'war');
        return false;
    }
    
    if (getActiveFocus()) {
        addNotification('Фокус уже выполняется!', 'info');
        return false;
    }
    
    setActiveFocus({ ...focus, daysLeft: 70 });
    addNotification(`Национальный фокус "${focus.name}" начат!`, 'info');
    
    const indicator = document.getElementById('focus-indicator');
    if (indicator) indicator.classList.remove('hidden');
    return true;
}

export function updateFocus() {
    const activeFocus = getActiveFocus();
    if (!activeFocus) return;
    
    activeFocus.daysLeft--;
    
    if (activeFocus.daysLeft <= 0) {
        const ctx = createFocusContext();
        if (activeFocus.effect) activeFocus.effect(ctx);
        addCompletedFocus(activeFocus.id);
        setActiveFocus(null);
        addNotification(`Фокус "${activeFocus.name}" завершён!`, 'info');
        
        const indicator = document.getElementById('focus-indicator');
        if (indicator) indicator.classList.add('hidden');
    }
}

function createFocusContext() {
    const resources = getPlayerResources();
    const myId = getMyCountryId();
    return {
        resources,
        declareWar: (targetId) => addWar(myId, targetId),
        proposeAlliance: (targetId) => {
            import('./diplomacy.js').then(m => m.proposeAlliance(targetId));
        },
        addEquipment: (amount) => {
            resources.equipment += amount;
            setPlayerResources(resources);
        },
        addFactories: (count) => {
            const gridData = getGridData();
            const myCells = Object.keys(gridData).filter(k => gridData[k] === myId);
            const cellStats = getCellStats();
            for (let i = 0; i < count && i < myCells.length; i++) {
                const pos = myCells[i];
                if (!cellStats[pos]) cellStats[pos] = { population: 10000, factories: 0, buildings: [] };
                cellStats[pos].factories = (cellStats[pos].factories || 0) + 1;
            }
            setCellStats(cellStats);
        },
        addUnits: (type, count) => {
            const gridData = getGridData();
            const myCells = Object.keys(gridData).filter(k => gridData[k] === myId);
            for (let i = 0; i < count; i++) {
                const pos = myCells[Math.floor(Math.random() * myCells.length)];
                if (pos) {
                    addUnit({ pos, owner: myId, type, trainingDaysLeft: 0, path: [], inCombat: false });
                }
            }
        },
        addPorts: (count) => {
            const gridData = getGridData();
            const cellStats = getCellStats();
            const myCells = Object.keys(gridData).filter(k => gridData[k] === myId);
            let portsAdded = 0;
            for (const pos of myCells) {
                if (portsAdded >= count) break;
                const [x, y] = pos.split(',').map(Number);
                if ([[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => !gridData[`${x+dx},${y+dy}`])) {
                    if (!cellStats[pos]) cellStats[pos] = { population: 10000, factories: 0, buildings: [] };
                    if (!cellStats[pos].buildings) cellStats[pos].buildings = [];
                    if (!cellStats[pos].buildings.includes('port')) {
                        cellStats[pos].buildings.push('port');
                        portsAdded++;
                    }
                }
            }
            setCellStats(cellStats);
        },
        getGridData: () => getGridData(),
        getCellStats: () => getCellStats()
    };
}

// ========== ВИЗУАЛЬНОЕ ДЕРЕВО ==========

export function updateFocusUI() {
    const container = document.getElementById('window-content');
    if (!container) return;
    
    const myCountryId = getMyCountryId();
    const allFocuses = NATIONAL_FOCUSES[myCountryId] || [];
    const completed = getCompletedFocuses();
    const activeFocus = getActiveFocus();
    const positions = FOCUS_POSITIONS[myCountryId] || {};
    const connections = FOCUS_CONNECTIONS[myCountryId] || [];
    
    if (allFocuses.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-8">Нет доступных фокусов</div>';
        return;
    }
    
    const svgWidth = 800;
    const svgHeight = 450;
    
    let html = `
        <div class="focus-tree-container" style="overflow: auto; max-height: 65vh;">
            <div style="min-width: ${svgWidth}px; display: flex; justify-content: center;">
                <svg width="${svgWidth}" height="${svgHeight}" style="background: #1a1a2e; border-radius: 8px;">
                    <defs>
                        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
                        </pattern>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)"/>
                    
                    <!-- Заголовок -->
                    <text x="${svgWidth/2}" y="30" text-anchor="middle" font-size="16" fill="#c5a059" font-family="'Special Elite', monospace" font-weight="bold">
                        ${(FOCUS_POSITIONS[myCountryId] ? 'ДЕРЕВО ФОКУСОВ' : '')}
                    </text>
                    
                    <!-- Соединения -->
                    ${connections.map(([from, to]) => {
                        const p1 = positions[from];
                        const p2 = positions[to];
                        if (!p1 || !p2) return '';
                        
                        const isFromDone = completed.has(from);
                        const isToDone = completed.has(to);
                        const isActive = activeFocus && (activeFocus.id === from || activeFocus.id === to);
                        
                        let lineColor = '#374151';
                        if (isActive) lineColor = '#fbbf24';
                        else if (isFromDone) lineColor = '#22c55e';
                        else if (isFromDone || isToDone) lineColor = '#166534';
                        
                        return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" 
                            stroke="${lineColor}" stroke-width="2" opacity="0.8"/>`;
                    }).join('')}
                    
                    <!-- Ноды -->
                    ${allFocuses.map(focus => {
                        const pos = positions[focus.id];
                        if (!pos) return '';
                        
                        const isDone = completed.has(focus.id);
                        const isActive = activeFocus && activeFocus.id === focus.id;
                        const isAvailable = !isDone && !activeFocus && isFocusAvailable(focus.id, myCountryId, completed);
                        const isLocked = !isDone && !isActive && !isAvailable;
                        const icon = FOCUS_ICONS[focus.id] || '⭐';
                        
                        let bg = '#1f2937';
                        let border = '#374151';
                        let textC = '#6b7280';
                        let shadow = false;
                        
                        if (isDone) {
                            bg = '#064e3b';
                            border = '#22c55e';
                            textC = '#86efac';
                        } else if (isActive) {
                            bg = '#78350f';
                            border = '#fbbf24';
                            textC = '#fde68a';
                            shadow = true;
                        } else if (isAvailable) {
                            bg = '#1e3a8a';
                            border = '#3b82f6';
                            textC = '#93c5fd';
                        }
                        
                        const nodeSize = 65;
                        const x = pos.x - nodeSize/2;
                        const y = pos.y - nodeSize/2;
                        
                        return `
                            <g class="focus-node" style="cursor: ${isAvailable ? 'pointer' : 'not-allowed'}" 
                               onclick="${isAvailable ? `window.startFocus('${focus.id}')` : ''}">
                                ${shadow ? `<rect x="${x-3}" y="${y-3}" width="${nodeSize+6}" height="${nodeSize+6}" rx="10" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.5" filter="url(#glow)"/>` : ''}
                                <rect x="${x}" y="${y}" width="${nodeSize}" height="${nodeSize}" rx="8" fill="${bg}" stroke="${border}" stroke-width="${isActive ? 3 : 2}"/>
                                <text x="${pos.x}" y="${pos.y - 4}" text-anchor="middle" font-size="24">${icon}</text>
                                
                                ${isActive ? `
                                    <rect x="${x+6}" y="${y + nodeSize - 12}" width="${(nodeSize-12) * ((70 - activeFocus.daysLeft) / 70)}" height="5" rx="2" fill="#fbbf24"/>
                                    <rect x="${x+6}" y="${y + nodeSize - 12}" width="${nodeSize-12}" height="5" rx="2" fill="none" stroke="#4b5563" stroke-width="1"/>
                                ` : ''}
                                
                                ${isDone ? `
                                    <circle cx="${x + nodeSize - 10}" cy="${y + 10}" r="11" fill="#22c55e"/>
                                    <text x="${x + nodeSize - 10}" y="${y + 15}" text-anchor="middle" font-size="13" fill="white" font-weight="bold">✓</text>
                                ` : ''}
                                
                                ${isLocked ? `
                                    <text x="${pos.x}" y="${pos.y + 16}" text-anchor="middle" font-size="14" fill="#4b5563">🔒</text>
                                ` : ''}
                                
                                <text x="${pos.x}" y="${pos.y + nodeSize/2 + 18}" text-anchor="middle" font-size="9" fill="${textC}" font-family="'Special Elite', monospace">
                                    ${focus.name.length > 15 ? focus.name.substring(0, 13) + '...' : focus.name}
                                </text>
                            </g>
                        `;
                    }).join('')}
                </svg>
            </div>
        </div>
    `;
    
    // Активный фокус
    if (activeFocus) {
        html += `
            <div class="bg-yellow-900/30 border border-yellow-500 p-3 rounded mt-3">
                <div class="flex items-center gap-2">
                    <span class="text-yellow-500 font-bold">⚡ ${activeFocus.name}</span>
                    <span class="text-xs text-gray-400">(${activeFocus.daysLeft} дн.)</span>
                </div>
                <div class="text-xs text-gray-400 mt-1">${activeFocus.description}</div>
                <div class="progress-bar mt-2">
                    <div class="progress-fill" style="width: ${((70 - activeFocus.daysLeft) / 70) * 100}%"></div>
                </div>
            </div>
        `;
    }
    
    // Легенда
    html += `
        <div class="flex gap-4 mt-3 text-xs text-gray-500 justify-center flex-wrap">
            <span>🟢 Завершён</span>
            <span>🟡 Выполняется</span>
            <span>🔵 Доступен</span>
            <span>⚫ Заблокирован 🔒</span>
        </div>
    `;
    
    container.innerHTML = html;
}

window.startFocus = startFocus;
