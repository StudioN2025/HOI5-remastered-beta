// ai.js — ПОЛНЫЙ С addPorts

import { 
    getMyCountryId, getGridData, getWars, getUnits, getGameSpeed, 
    addUnit, addToBuildingQueue, getActiveResearch, getTech, 
    setActiveResearch, getBuildingQueue, getCellStats, setCellStats,
    getAIActiveFocus, setAIActiveFocus, getAICompletedFocuses, addAICompletedFocus,
    getAlliances
} from './game.js';
import { NATIONAL_FOCUSES, UNIT_STATS } from './data.js';
import { isAtWar, getEnemiesOf, calculateCountryStats } from './utils.js';
import { getPocketsForCountry } from './supply.js';

const RESEARCH_DURATION = 100;
const CONSTRUCTION_TIME = 135;
const aiResources = {};
const aiPersonality = {};
const aiMemory = {};

function getAIResources(countryId) {
    if (!aiResources[countryId]) {
        const stats = calculateCountryStats(countryId, getGridData(), getCellStats());
        aiResources[countryId] = {
            equipment: 500 + stats.totalFactories * 150,
            manpower: Math.floor(stats.totalPop * 0.05)
        };
    }
    return aiResources[countryId];
}

function getPersonality(countryId) {
    if (!aiPersonality[countryId]) {
        const info = { ideology: 'Нейтралитет' };
        if (info.ideology === 'Фашизм' || info.ideology === 'Коммунизм') aiPersonality[countryId] = 'aggressive';
        else if (info.ideology === 'Демократия') aiPersonality[countryId] = 'defensive';
        else aiPersonality[countryId] = 'balanced';
    }
    return aiPersonality[countryId];
}

function getAIMemory(countryId) {
    if (!aiMemory[countryId]) {
        aiMemory[countryId] = { lastEncirclementAttempt: 0, encirclementTargets: [], fallbackPositions: [] };
    }
    return aiMemory[countryId];
}

function getBorderCells(countryId, targetId) {
    const gridData = getGridData();
    const borders = [];
    for (const [pos, owner] of Object.entries(gridData)) {
        if (owner !== countryId) continue;
        const [x, y] = pos.split(',').map(Number);
        if ([[0,1],[0,-1],[1,0],[-1,0]].some(([dx, dy]) => gridData[`${x+dx},${y+dy}`] === targetId)) {
            borders.push(pos);
        }
    }
    return borders;
}

function getFrontLine(countryId) {
    const enemies = getEnemiesOf(countryId, getWars());
    const gridData = getGridData();
    const frontLine = [];
    for (const [pos, owner] of Object.entries(gridData)) {
        if (owner !== countryId) continue;
        const [x, y] = pos.split(',').map(Number);
        if ([[0,1],[0,-1],[1,0],[-1,0]].some(([dx, dy]) => enemies.includes(gridData[`${x+dx},${y+dy}`]))) {
            frontLine.push(pos);
        }
    }
    return frontLine;
}

function getWeakestEnemy(countryId) {
    const enemies = getEnemiesOf(countryId, getWars());
    if (!enemies.length) return null;
    let weakest = null, weakestPower = Infinity;
    for (const enemyId of enemies) {
        const stats = calculateCountryStats(enemyId, getGridData(), getCellStats());
        const units = getUnits().filter(u => u.owner === enemyId);
        const power = stats.totalFactories * 2 + units.length * 5;
        if (power < weakestPower) { weakestPower = power; weakest = enemyId; }
    }
    return weakest;
}

function canEncircle(countryId, enemyId) {
    const borderCells = getBorderCells(countryId, enemyId);
    if (borderCells.length < 4) return false;
    let encirclePoints = 0;
    for (const pos of borderCells) {
        const [x, y] = pos.split(',').map(Number);
        let enemyNeighbors = 0;
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            if (getGridData()[`${x+dx},${y+dy}`] === enemyId) enemyNeighbors++;
        }
        if (enemyNeighbors >= 3) encirclePoints++;
    }
    return encirclePoints >= 2;
}

function findEncirclementPoints(countryId, enemyId) {
    const borderCells = getBorderCells(countryId, enemyId);
    const points = [];
    for (const pos of borderCells) {
        const [x, y] = pos.split(',').map(Number);
        let enemyNeighbors = 0;
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            if (getGridData()[`${x+dx},${y+dy}`] === enemyId) enemyNeighbors++;
        }
        if (enemyNeighbors >= 3) points.push({ pos });
    }
    return points;
}

function rescueFromPocket(countryId, unit, pocket) {
    if (!pocket || !pocket.cells.length) return;
    const gridData = getGridData();
    let bestEscape = null, bestDist = Infinity;
    for (const pocketPos of pocket.cells) {
        const [px, py] = pocketPos.split(',').map(Number);
        for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const escapePos = `${px+dx},${py+dy}`;
            const owner = gridData[escapePos];
            if ((owner === countryId && !pocket.cells.includes(escapePos)) || areAlliesCheck(countryId, owner)) {
                const [ux, uy] = unit.pos.split(',').map(Number);
                const dist = Math.abs(ux - (px+dx)) + Math.abs(uy - (py+dy));
                if (dist < bestDist) { bestDist = dist; bestEscape = escapePos; }
            }
        }
    }
    if (bestEscape) {
        const path = calculatePath(unit.pos, bestEscape, countryId);
        if (path) unit.path = path;
    }
}

function areAlliesCheck(c1, c2) {
    if (c1 === c2) return true;
    const alliances = getAlliances();
    return alliances.some(a => a.has && a.has(c1) && a.has(c2));
}

function calculatePath(startPos, endPos, owner) {
    const gridData = getGridData();
    const units = getUnits();
    const wars = getWars();
    const enemies = getEnemiesOf(owner, wars);
    const [sx, sy] = startPos.split(',').map(Number);
    const [tx, ty] = endPos.split(',').map(Number);
    
    const queue = [{ x: sx, y: sy, path: [] }];
    const visited = new Set([`${sx},${sy}`]);
    
    while (queue.length > 0) {
        const { x, y, path } = queue.shift();
        if (x === tx && y === ty) return path;
        if (path.length > 80) continue;
        
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            const cellOwner = gridData[key];
            if (!cellOwner) continue;
            if (units.find(u => u.pos === key && u.owner !== owner && isAtWar(owner, u.owner, wars))) continue;
            const isEnemy = enemies.includes(cellOwner);
            const isAlly = cellOwner === owner || areAlliesCheck(owner, cellOwner);
            if (!isEnemy && !isAlly) continue;
            visited.add(key);
            queue.push({ x: nx, y: ny, path: [...path, key] });
        }
    }
    return null;
}

function findAdjacentEnemyCell(frontCell, enemyId) {
    const gridData = getGridData();
    const [fx, fy] = frontCell.split(',').map(Number);
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const pos = `${fx+dx},${fy+dy}`;
        if (gridData[pos] === enemyId) return pos;
    }
    return null;
}

export function runCountryAI(countryId) {
    const myId = getMyCountryId();
    if (countryId === myId || getGameSpeed() === 0) return;
    
    const stats = calculateCountryStats(countryId, getGridData(), getCellStats());
    const aiRes = getAIResources(countryId);
    const enemies = getEnemiesOf(countryId, getWars());
    const myUnits = getUnits().filter(u => u.owner === countryId);
    const frontLine = getFrontLine(countryId);
    const memory = getAIMemory(countryId);
    
    aiRes.equipment += stats.totalFactories * 1.5;
    
    // Исследования
    if (!getActiveResearch() && Math.random() < 0.05) {
        const priority = enemies.length > 0 ? ['tank', 'infantry', 'industry'] : ['industry', 'infantry', 'tank'];
        for (const techType of priority) {
            const lvl = getTech()[techType] || 1;
            if (lvl < 5) { setActiveResearch({ type: techType, level: lvl + 1, daysLeft: RESEARCH_DURATION }); break; }
        }
    }
    
    // Фокусы
    const aiActiveFocus = getAIActiveFocus(countryId);
    const aiCompleted = getAICompletedFocuses(countryId);
    const countryFocuses = NATIONAL_FOCUSES[countryId] || [];
    
    if (!aiActiveFocus && countryFocuses.length) {
        const available = countryFocuses.filter(f => !aiCompleted.has(f.id));
        if (available.length && Math.random() < 0.1) {
            setAIActiveFocus(countryId, { ...available[Math.floor(Math.random() * Math.min(3, available.length))], daysLeft: 70 });
        }
    }
    
    if (aiActiveFocus) {
        aiActiveFocus.daysLeft--;
        if (aiActiveFocus.daysLeft <= 0) {
            if (aiActiveFocus.effect) {
                const ctx = {
                    resources: aiRes,
                    declareWar: (targetId) => { import('./game.js').then(m => m.addWar(countryId, targetId)); },
                    proposeAlliance: (targetId) => { import('./diplomacy.js').then(m => m.proposeAlliance(targetId)); },
                    addEquipment: (amount) => { aiRes.equipment += amount; },
                    addFactories: (count) => {
                        const gridData = getGridData();
                        const myCells = Object.keys(gridData).filter(k => gridData[k] === countryId);
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
                        const myCells = Object.keys(gridData).filter(k => gridData[k] === countryId);
                        for (let i = 0; i < count; i++) {
                            const pos = myCells[Math.floor(Math.random() * myCells.length)];
                            if (pos) addUnit({ pos, owner: countryId, type, trainingDaysLeft: 0, path: [], inCombat: false });
                        }
                    },
                    addPorts: (count) => {
                        const gridData = getGridData();
                        const cellStats = getCellStats();
                        const myCells = Object.keys(gridData).filter(k => gridData[k] === countryId);
                        let portsAdded = 0;
                        for (const pos of myCells) {
                            if (portsAdded >= count) break;
                            const [x, y] = pos.split(',').map(Number);
                            const isCoastal = [[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => !gridData[`${x+dx},${y+dy}`]);
                            if (isCoastal) {
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
                aiActiveFocus.effect(ctx);
            }
            addAICompletedFocus(countryId, aiActiveFocus.id);
            setAIActiveFocus(countryId, null);
        }
    }
    
    // Строительство
    const aiQueue = getBuildingQueue().filter(b => b.owner === countryId);
    if (aiQueue.length < 3 && aiRes.equipment >= 500 && Math.random() < 0.1) {
        const myCells = Object.keys(getGridData()).filter(pos => getGridData()[pos] === countryId);
        if (myCells.length) {
            aiRes.equipment -= 500;
            addToBuildingQueue({ type: 'factory', pos: myCells[Math.floor(Math.random() * myCells.length)], daysLeft: CONSTRUCTION_TIME, owner: countryId });
        }
    }
    
    // Армия
    const maxUnits = Math.max(3, Math.floor(stats.totalFactories * 0.6) + 5);
    if (myUnits.length < maxUnits) {
        const buildChance = enemies.length > 0 ? 0.15 : 0.04;
        if (Math.random() < buildChance) {
            let unitType = 'infantry';
            if (stats.totalFactories > 3 && getTech().tank > 1 && Math.random() < 0.4) unitType = 'tank';
            const cost = UNIT_STATS[unitType].costEquipment;
            if (aiRes.equipment >= cost) {
                let spawnPos;
                if (frontLine.length && enemies.length) {
                    spawnPos = frontLine[Math.floor(Math.random() * frontLine.length)];
                } else {
                    const myCells = Object.keys(getGridData()).filter(pos => getGridData()[pos] === countryId);
                    spawnPos = myCells[Math.floor(Math.random() * myCells.length)];
                }
                if (spawnPos) {
                    aiRes.equipment -= cost;
                    addUnit({
                        id: `ai_${countryId}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
                        pos: spawnPos, owner: countryId, type: unitType,
                        hp: UNIT_STATS[unitType].hp || 100, trainingDaysLeft: 10,
                        path: [], moveCooldown: 0, inCombat: false
                    });
                }
            }
        }
    }
    
    // Котлы — спасение
    const pockets = getPocketsForCountry(countryId);
    const unitsInPockets = myUnits.filter(u => pockets.some(p => p.cells.includes(u.pos)));
    for (const u of unitsInPockets) {
        if (u.inCombat || u.trainingDaysLeft > 0) continue;
        const pocket = pockets.find(p => p.cells.includes(u.pos));
        if (pocket) rescueFromPocket(countryId, u, pocket);
    }
    
    if (!enemies.length) return;
    
    // Военная стратегия
    const availableUnits = myUnits.filter(u => u.trainingDaysLeft <= 0 && !u.inCombat);
    const idleUnits = availableUnits.filter(u => !u.path || u.path.length === 0);
    
    const myPower = availableUnits.length * 3 + stats.totalFactories * 2;
    let enemyPower = 0;
    enemies.forEach(e => {
        const eStats = calculateCountryStats(e, getGridData(), getCellStats());
        enemyPower += getUnits().filter(u => u.owner === e && u.trainingDaysLeft <= 0).length * 3 + eStats.totalFactories * 2;
    });
    const advantage = myPower / Math.max(1, enemyPower);
    
    // Тактика окружения
    const encirclementTarget = getWeakestEnemy(countryId);
    if (encirclementTarget && advantage > 1.3 && canEncircle(countryId, encirclementTarget) && idleUnits.length >= 4 && Math.random() < 0.2) {
        const points = findEncirclementPoints(countryId, encirclementTarget);
        if (points.length >= 2) {
            const half = Math.floor(idleUnits.length / 2);
            const leftFlank = idleUnits.slice(0, half);
            const rightFlank = idleUnits.slice(half);
            
            leftFlank.forEach(u => {
                const enemyCell = findAdjacentEnemyCell(points[0].pos, encirclementTarget);
                if (enemyCell) { const p = calculatePath(u.pos, enemyCell, countryId); if (p) u.path = p; }
            });
            rightFlank.forEach(u => {
                const enemyCell = findAdjacentEnemyCell(points[points.length-1].pos, encirclementTarget);
                if (enemyCell) { const p = calculatePath(u.pos, enemyCell, countryId); if (p) u.path = p; }
            });
        }
    }
    
    // Атака/оборона
    const target = getWeakestEnemy(countryId);
    if (target && idleUnits.length > 0) {
        const attackRatio = advantage > 1.2 ? 0.7 : advantage > 0.8 ? 0.5 : 0.3;
        idleUnits.forEach(u => {
            if (u.path && u.path.length > 0) return;
            if (Math.random() < attackRatio) {
                const borderCells = getBorderCells(countryId, target);
                if (borderCells.length) {
                    const targetCell = borderCells[Math.floor(Math.random() * borderCells.length)];
                    const enemyCell = findAdjacentEnemyCell(targetCell, target);
                    if (enemyCell) { const p = calculatePath(u.pos, enemyCell, countryId); if (p) u.path = p; }
                }
            } else {
                if (frontLine.length) {
                    let hottestFront = null, maxEnemies = 0;
                    for (const pos of frontLine) {
                        const [fx, fy] = pos.split(',').map(Number);
                        const nearby = getUnits().filter(eu => {
                            const [ex, ey] = eu.pos.split(',').map(Number);
                            return enemies.includes(eu.owner) && Math.abs(ex-fx) <= 2 && Math.abs(ey-fy) <= 2;
                        }).length;
                        if (nearby > maxEnemies) { maxEnemies = nearby; hottestFront = pos; }
                    }
                    if (hottestFront) { const p = calculatePath(u.pos, hottestFront, countryId); if (p) u.path = p; }
                }
            }
        });
    }
    
    // Добивание котлов
    for (const enemyId of enemies) {
        const enemyPockets = getPocketsForCountry(enemyId);
        if (enemyPockets.length > 0) {
            const availableForPocket = myUnits.filter(u => u.trainingDaysLeft <= 0 && !u.inCombat && (!u.path || u.path.length === 0));
            for (const u of availableForPocket.slice(0, 3)) {
                const targetCell = enemyPockets[0].cells[0];
                const p = calculatePath(u.pos, targetCell, countryId);
                if (p) u.path = p;
            }
        }
    }
}

export function runAllAI() {
    const gridData = getGridData();
    const allCountries = [...new Set(Object.values(gridData))];
    allCountries.forEach(countryId => runCountryAI(countryId));
}
