// ai.js — ИИ с собственными фокусами и ресурсами

import { 
    getMyCountryId, getGridData, getWars, getUnits, getGameSpeed, 
    addUnit, addToBuildingQueue, getActiveResearch, getTech, 
    setActiveResearch, getBuildingQueue, getCellStats,
    getAIActiveFocus, setAIActiveFocus, getAICompletedFocuses, addAICompletedFocus
} from './game.js';
import { NATIONAL_FOCUSES, UNIT_STATS } from './data.js';
import { isAtWar, getEnemiesOf, calculateCountryStats } from './utils.js';

const RESEARCH_DURATION = 100;
const CONSTRUCTION_TIME = 135;
const aiResources = {};

function getAIResources(countryId) {
    if (!aiResources[countryId]) {
        const stats = calculateCountryStats(countryId, getGridData(), getCellStats());
        aiResources[countryId] = {
            equipment: 500 + stats.totalFactories * 100,
            manpower: stats.totalPop * 0.05
        };
    }
    return aiResources[countryId];
}

export function runCountryAI(countryId) {
    const myId = getMyCountryId();
    if (countryId === myId || getGameSpeed() === 0) return;

    const stats = calculateCountryStats(countryId, getGridData(), getCellStats());
    const aiRes = getAIResources(countryId);

    // 1. Исследования
    if (!getActiveResearch() && Math.random() < 0.03) {
        const techs = ['industry', 'infantry', 'tank'];
        const randomTech = techs[Math.floor(Math.random() * techs.length)];
        const currentLevel = getTech()[randomTech] || 1;
        if (currentLevel < 5) {
            setActiveResearch({ type: randomTech, level: currentLevel + 1, daysLeft: RESEARCH_DURATION });
        }
    }

    // 2. Собственные фокусы
    const aiActiveFocus = getAIActiveFocus(countryId);
    const aiCompleted = getAICompletedFocuses(countryId);
    const countryFocuses = NATIONAL_FOCUSES[countryId] || [];
    
    if (!aiActiveFocus && countryFocuses.length > 0) {
        const available = countryFocuses.filter(f => !aiCompleted.has(f.id));
        if (available.length > 0 && Math.random() < 0.08) {
            const focus = available[0];
            setAIActiveFocus(countryId, { ...focus, daysLeft: 70 });
        }
    }
    
    if (aiActiveFocus) {
        aiActiveFocus.daysLeft--;
        if (aiActiveFocus.daysLeft <= 0) {
            if (aiActiveFocus.effect) {
                const ctx = {
                    resources: aiRes,
                    declareWar: (targetId) => {
                        import('./game.js').then(m => m.addWar(countryId, targetId));
                    },
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
                    },
                    addUnits: (type, count) => {
                        const gridData = getGridData();
                        const myCells = Object.keys(gridData).filter(k => gridData[k] === countryId);
                        for (let i = 0; i < count; i++) {
                            const pos = myCells[Math.floor(Math.random() * myCells.length)];
                            if (pos) {
                                addUnit({ pos, owner: countryId, type, trainingDaysLeft: 0, path: [], inCombat: false });
                            }
                        }
                    }
                };
                aiActiveFocus.effect(ctx);
            }
            addAICompletedFocus(countryId, aiActiveFocus.id);
            setAIActiveFocus(countryId, null);
        }
    }

    // 3. Строительство
    const aiQueue = getBuildingQueue().filter(b => b.owner === countryId);
    if (aiQueue.length < 2 && stats.totalFactories > 0) {
        if (aiRes.equipment >= 500 && Math.random() < 0.08) {
            const myCells = Object.keys(getGridData()).filter(pos => getGridData()[pos] === countryId);
            if (myCells.length > 0) {
                const randomPos = myCells[Math.floor(Math.random() * myCells.length)];
                aiRes.equipment -= 500;
                addToBuildingQueue({ type: 'factory', pos: randomPos, daysLeft: CONSTRUCTION_TIME, owner: countryId });
            }
        }
    }

    // 4. Армия
    const aiUnits = getUnits().filter(u => u.owner === countryId);
    const maxUnits = Math.floor(stats.totalFactories * 0.4) + 2;
    
    if (aiUnits.length < maxUnits && Math.random() < 0.06) {
        const unitType = Math.random() > 0.3 ? 'infantry' : 'tank';
        const unitStats = UNIT_STATS[unitType];
        
        if (aiRes.equipment >= unitStats.costEquipment) {
            const myCells = Object.keys(getGridData()).filter(pos => getGridData()[pos] === countryId);
            if (myCells.length > 0) {
                const spawnPos = myCells[Math.floor(Math.random() * myCells.length)];
                aiRes.equipment -= unitStats.costEquipment;
                addUnit({
                    id: `ai_${countryId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    pos: spawnPos,
                    owner: countryId,
                    type: unitType,
                    hp: unitStats.hp || 100,
                    trainingDaysLeft: 10,
                    path: [],
                    moveCooldown: 0,
                    inCombat: false
                });
            }
        }
    }

    // 5. Военная логика
    const enemies = getEnemiesOf(countryId, getWars());
    
    aiUnits.forEach(u => {
        if (u.trainingDaysLeft <= 0 && !u.inCombat && u.path.length === 0 && enemies.length > 0 && Math.random() < 0.25) {
            const enemyCells = Object.keys(getGridData()).filter(pos => enemies.includes(getGridData()[pos]));
            if (enemyCells.length > 0) {
                const target = enemyCells[Math.floor(Math.random() * enemyCells.length)];
                
                const [sx, sy] = u.pos.split(',').map(Number);
                const [tx, ty] = target.split(',').map(Number);
                
                let path = [];
                let cx = sx, cy = sy;
                let steps = 0;
                
                while ((cx !== tx || cy !== sy) && steps < 100) {
                    if (cx < tx) cx++;
                    else if (cx > tx) cx--;
                    if (cy < ty) cy++;
                    else if (cy > ty) cy--;
                    path.push(`${cx},${cy}`);
                    steps++;
                }
                
                u.path = path;
            }
        }
    });
    
    aiRes.equipment += stats.totalFactories * 1.5;
}

export function runAllAI() {
    const gridData = getGridData();
    const allCountries = [...new Set(Object.values(gridData))];
    allCountries.forEach(countryId => runCountryAI(countryId));
}
