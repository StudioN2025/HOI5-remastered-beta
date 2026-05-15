// supply.js — ПОЛНАЯ ФИНАЛЬНАЯ ВЕРСИЯ (КОТЁЛ = 100% ОКРУЖЕНИЕ ВРАГАМИ)

import { getGridData, getUnits, getMyCountryId, getWars, getCellStats, getAlliances } from './game.js';
import { isAtWar, addNotification } from './utils.js';
import { checkCapitulation } from './diplomacy.js';

function areAlliesWith(c1, c2) {
    if (c1 === c2) return true;
    const alliances = getAlliances ? getAlliances() : (window._alliances || []);
    return alliances.some(a => a.has && a.has(c1) && a.has(c2));
}

function getEnemiesOf(countryId, wars) {
    const enemies = [];
    for (const w of wars) {
        if (w.a === countryId) enemies.push(w.b);
        if (w.b === countryId) enemies.push(w.a);
    }
    return [...new Set(enemies)];
}

// ========== ПОИСК СВЯЗНЫХ ГРУПП ==========

function findAllGroups(countryId) {
    const gridData = getGridData();
    const myCells = Object.keys(gridData).filter(pos => gridData[pos] === countryId);
    if (myCells.length === 0) return [];
    
    const visited = new Set();
    const allGroups = [];
    
    for (const startPos of myCells) {
        if (visited.has(startPos)) continue;
        
        const group = new Set();
        const queue = [startPos];
        visited.add(startPos);
        
        while (queue.length > 0) {
            const pos = queue.shift();
            group.add(pos);
            
            const [x, y] = pos.split(',').map(Number);
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const neighbor = `${x+dx},${y+dy}`;
                if (visited.has(neighbor)) continue;
                
                const owner = gridData[neighbor];
                if (owner === countryId || areAlliesWith(countryId, owner)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        
        allGroups.push(group);
    }
    
    allGroups.sort((a, b) => b.size - a.size);
    return allGroups;
}

// ✅ ПРОВЕРКА: клетка полностью окружена врагами?
function isFullySurroundedByEnemies(pos, countryId, enemies) {
    const gridData = getGridData();
    const [x, y] = pos.split(',').map(Number);
    
    let totalNeighbors = 0;
    let enemyNeighbors = 0;
    
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const neighbor = `${x+dx},${y+dy}`;
        const owner = gridData[neighbor];
        
        if (owner === undefined) continue; // Вода — не считается соседом для окружения
        
        totalNeighbors++;
        
        // Враг или вода (море тоже блокирует)
        if (enemies.includes(owner) || !owner) {
            enemyNeighbors++;
        }
    }
    
    // 100% сухопутных соседей — враги
    return totalNeighbors > 0 && enemyNeighbors >= totalNeighbors;
}

// ✅ ПРОВЕРКА: вся группа окружена врагами?
function isGroupSurrounded(group, countryId, enemies) {
    if (group.size === 0) return false;
    
    const gridData = getGridData();
    
    // Проверяем внешние границы группы
    for (const pos of group) {
        const [x, y] = pos.split(',').map(Number);
        
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const neighbor = `${x+dx},${y+dy}`;
            const owner = gridData[neighbor];
            
            // Пропускаем клетки внутри группы
            if (group.has(neighbor)) continue;
            
            // Вода — не враг (морское снабжение)
            if (!owner) return false;
            
            // Союзник или нейтрал — не враг
            if (owner === countryId) continue;
            if (areAlliesWith(countryId, owner)) return false;
            if (!enemies.includes(owner)) return false;
        }
    }
    
    return true;
}

function findPockets(countryId) {
    const gridData = getGridData();
    const wars = getWars();
    const enemies = getEnemiesOf(countryId, wars);
    const myCells = Object.keys(gridData).filter(pos => gridData[pos] === countryId);
    
    if (myCells.length === 0) return [];
    
    // ✅ Нет врагов — нет котлов
    if (enemies.length === 0) return [];
    
    // ✅ Страна ≤5 клеток — не считаем котлы
    if (myCells.length <= 5) return [];
    
    const allGroups = findAllGroups(countryId);
    if (allGroups.length === 0) return [];
    
    const pockets = [];
    
    // Проверяем каждую группу кроме самой большой
    for (let i = 1; i < allGroups.length; i++) {
        const group = allGroups[i];
        
        // ✅ Группа с портом — не котёл (морское снабжение)
        const cellStats = getCellStats();
        let hasPort = false;
        for (const pos of group) {
            const cell = cellStats[pos];
            if (cell?.buildings?.includes('port')) {
                hasPort = true;
                break;
            }
        }
        if (hasPort) continue;
        
        // ✅ Группа граничит с водой (порт не обязателен, но море рядом) — не котёл
        let touchesWater = false;
        for (const pos of group) {
            const [x, y] = pos.split(',').map(Number);
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                if (!gridData[`${x+dx},${y+dy}`]) {
                    touchesWater = true;
                    break;
                }
            }
            if (touchesWater) break;
        }
        if (touchesWater) continue; // Море = снабжение
        
        // ✅ Группа граничит с нейтралом — не котёл
        let touchesNeutral = false;
        for (const pos of group) {
            const [x, y] = pos.split(',').map(Number);
            for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const neighbor = `${x+dx},${y+dy}`;
                const owner = gridData[neighbor];
                if (owner && owner !== countryId && !enemies.includes(owner) && !areAlliesWith(countryId, owner)) {
                    touchesNeutral = true;
                    break;
                }
            }
            if (touchesNeutral) break;
        }
        if (touchesNeutral) continue; // Нейтрал = нет окружения
        
        // ✅ ФИНАЛЬНАЯ ПРОВЕРКА: 100% окружение врагами
        if (isGroupSurrounded(group, countryId, enemies)) {
            pockets.push({
                cells: [...group],
                size: group.size,
                countryId: countryId
            });
        }
    }
    
    return pockets;
}

// ========== ШТРАФЫ ==========

function applySupplyPenalties() {
    const myId = getMyCountryId();
    const gridData = getGridData();
    const allCountries = [...new Set(Object.values(gridData))];
    const wars = getWars();
    const notifiedPockets = new Set();
    
    for (const countryId of allCountries) {
        const pockets = findPockets(countryId);
        if (pockets.length === 0) continue;
        
        for (const pocket of pockets) {
            const units = getUnits();
            let unitsLost = 0;
            
            for (const u of units) {
                if (u.owner === countryId && pocket.cells.includes(u.pos)) {
                    const supplyDamage = 2 + Math.floor(Math.random() * 4);
                    u.hp = Math.max(0, (u.hp || 0) - supplyDamage);
                    u.supplyPenalty = true;
                    
                    if (u.hp <= 0) {
                        import('./game.js').then(m => m.removeUnit(u.id));
                        unitsLost++;
                    }
                }
            }
            
            const pocketKey = `${countryId}_${pocket.size}`;
            
            if (countryId === myId && !notifiedPockets.has(pocketKey)) {
                notifiedPockets.add(pocketKey);
                addNotification(`⚠️ ${pocket.size} провинций в котле! Потери: ${unitsLost} юнитов.`, 'war');
                setTimeout(() => notifiedPockets.delete(pocketKey), 10000);
            }
            
            if (isAtWar(myId, countryId, wars) && !notifiedPockets.has(`enemy_${pocketKey}`)) {
                notifiedPockets.add(`enemy_${pocketKey}`);
                addNotification(`🔥 Враг в котле! ${pocket.size} клеток окружены.`, 'war');
                setTimeout(() => notifiedPockets.delete(`enemy_${pocketKey}`), 10000);
            }
        }
        
        const allCells = Object.values(gridData).filter(id => id === countryId).length;
        const totalPocketCells = pockets.reduce((sum, p) => sum + p.size, 0);
        
        if (totalPocketCells >= allCells * 0.9 && allCells > 10) {
            const enemies = getEnemiesOf(countryId, wars);
            if (enemies.length > 0) {
                addNotification(`💀 ${countryId.toUpperCase()} капитулирует!`, 'war');
                checkCapitulation(countryId, enemies[0]);
            }
        }
    }
}

// ========== ВИЗУАЛИЗАЦИЯ ==========

export function renderSupplyOverlay(ctx, camera, CELL_SIZE) {
    const myId = getMyCountryId();
    const gridData = getGridData();
    const wars = getWars();
    
    if (!myId || !wars.length) return;
    
    const now = Date.now();
    
    for (const countryId of [...new Set(Object.values(gridData))]) {
        const isEnemy = isAtWar(myId, countryId, wars);
        const isOurs = countryId === myId;
        if (!isEnemy && !isOurs) continue;
        
        const pockets = findPockets(countryId);
        if (pockets.length === 0) continue;
        
        for (const pocket of pockets) {
            const pulse = Math.sin(now / 500) * 0.3 + 0.7;
            
            for (const pos of pocket.cells) {
                const [x, y] = pos.split(',').map(Number);
                
                ctx.strokeStyle = isEnemy ? `rgba(255,30,30,${pulse})` : `rgba(255,200,0,${pulse})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                ctx.setLineDash([]);
                
                ctx.fillStyle = isEnemy ? 'rgba(255,0,0,0.08)' : 'rgba(255,200,0,0.08)';
                ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                
                if (pocket.size > 3) {
                    ctx.font = `${CELL_SIZE * 0.6}px serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = isEnemy ? `rgba(255,50,50,${pulse+0.2})` : `rgba(255,180,0,${pulse+0.2})`;
                    ctx.fillText('💀', x * CELL_SIZE + CELL_SIZE/2, y * CELL_SIZE + CELL_SIZE/2);
                }
            }
        }
    }
}

// ========== ЭКСПОРТ ==========

export function processSupply() { applySupplyPenalties(); }
export function getPocketsForCountry(countryId) { return findPockets(countryId); }

export function debugSupply(countryId) {
    const allGroups = findAllGroups(countryId);
    const pockets = findPockets(countryId);
    console.log(`=== ${countryId}: ${allGroups.length} групп, ${pockets.length} котлов ===`);
    return { allGroups, pockets };
}
