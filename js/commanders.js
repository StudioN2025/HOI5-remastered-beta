// commanders.js — СИСТЕМА КОМАНДУЮЩИХ И АРМИЙ

import { getUnits, setUnits, getMyCountryId, getGridData, getWars } from './game.js';
import { UNIT_STATS } from './data.js';
import { isAtWar, addNotification } from './utils.js';
import { renderMap, markDirty } from './map.js';

// Хранилище армий
let _armies = []; // { id, name, commander, units: [], stance: 'attack'|'defense'|'balanced' }

export function getArmies() { return _armies; }
export function setArmies(data) { _armies = data || []; }

// Создание армии
export function createArmy(name, unitIds) {
    const myId = getMyCountryId();
    const allUnits = getUnits();
    
    // Проверяем что юниты принадлежат игроку
    const armyUnits = allUnits.filter(u => unitIds.includes(u.id) && u.owner === myId);
    
    if (armyUnits.length === 0) {
        addNotification('Нет доступных юнитов для армии!', 'war');
        return null;
    }
    
    const army = {
        id: `army_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
        name: name || `${armyUnits.length}-я армия`,
        commander: generateCommander(),
        units: armyUnits.map(u => u.id),
        stance: 'balanced',
        createdAt: new Date()
    };
    
    _armies.push(army);
    
    addNotification(`🎖️ Армия "${army.name}" создана! ${armyUnits.length} дивизий под командованием ${army.commander.name}`, 'info');
    
    return army;
}

// Генерация командира
function generateCommander() {
    const firstNames = ['Эрих', 'Гейнц', 'Эрвин', 'Федор', 'Георгий', 'Бернард', 'Дуайт', 'Шарль', 'Хидэки', 'Иван'];
    const lastNames = ['Манштейн', 'Гудериан', 'Роммель', 'Бок', 'Жуков', 'Монтгомери', 'Эйзенхауэр', 'Голль', 'Тодзио', 'Конев'];
    
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    
    return {
        name,
        skill: 1 + Math.floor(Math.random() * 5), // 1-5
        attack: 1 + Math.floor(Math.random() * 3),
        defense: 1 + Math.floor(Math.random() * 3),
        logistics: 1 + Math.floor(Math.random() * 3),
        traits: generateTraits()
    };
}

function generateTraits() {
    const possibleTraits = [
        { name: 'Танковый командир', bonus: 'tank_attack', value: 1.2 },
        { name: 'Пехотный эксперт', bonus: 'infantry_defense', value: 1.2 },
        { name: 'Мастер окружения', bonus: 'encirclement', value: 1.3 },
        { name: 'Снабженец', bonus: 'supply', value: 0.5 },
        { name: 'Агрессор', bonus: 'all_attack', value: 1.1 },
        { name: 'Защитник', bonus: 'all_defense', value: 1.15 }
    ];
    
    const numTraits = Math.random() > 0.7 ? 2 : 1;
    const traits = [];
    
    for (let i = 0; i < numTraits; i++) {
        const trait = possibleTraits[Math.floor(Math.random() * possibleTraits.length)];
        if (!traits.find(t => t.name === trait.name)) {
            traits.push(trait);
        }
    }
    
    return traits;
}

// Приказ армии: атаковать цель
export function orderArmyAttack(armyId, targetPos) {
    const army = _armies.find(a => a.id === armyId);
    if (!army) return false;
    
    const allUnits = getUnits();
    const myId = getMyCountryId();
    const gridData = getGridData();
    
    // ✅ Распределяем юниты веером для атаки
    const armyUnits = allUnits.filter(u => army.units.includes(u.id) && u.owner === myId);
    
    if (armyUnits.length === 0) {
        addNotification('В армии нет боеспособных юнитов!', 'war');
        return false;
    }
    
    const [tx, ty] = targetPos.split(',').map(Number);
    
    // Находим центр армии
    let avgX = 0, avgY = 0;
    armyUnits.forEach(u => {
        const [ux, uy] = u.pos.split(',').map(Number);
        avgX += ux;
        avgY += uy;
    });
    avgX = Math.floor(avgX / armyUnits.length);
    avgY = Math.floor(avgY / armyUnits.length);
    
    // ✅ Каждый юнит получает свою цель (веер)
    armyUnits.forEach((u, index) => {
        if (u.inCombat || u.trainingDaysLeft > 0) return;
        
        // Смещение для веера
        const offsetX = Math.floor((index - armyUnits.length / 2) * 1.5);
        const offsetY = Math.floor((index % 3) - 1);
        
        const unitTarget = `${tx + offsetX},${ty + offsetY}`;
        
        // Проверяем что цель существует
        if (gridData[unitTarget]) {
            import('./military.js').then(m => {
                m.giveOrder(unitTarget, u.id);
            });
        }
    });
    
    addNotification(`🎯 Армия "${army.name}" выдвигается к цели!`, 'info');
    return true;
}

// Приказ армии: оборонять линию
export function orderArmyDefend(armyId, frontPositions) {
    const army = _armies.find(a => a.id === armyId);
    if (!army) return false;
    
    const allUnits = getUnits();
    const myId = getMyCountryId();
    
    const armyUnits = allUnits.filter(u => army.units.includes(u.id) && u.owner === myId);
    
    if (armyUnits.length === 0) return false;
    
    // Распределяем юнитов по линии обороны
    armyUnits.forEach((u, index) => {
        if (u.inCombat || u.trainingDaysLeft > 0) return;
        
        const targetPos = frontPositions[index % frontPositions.length];
        if (targetPos) {
            import('./military.js').then(m => {
                m.giveOrder(targetPos, u.id);
            });
        }
    });
    
    army.stance = 'defense';
    addNotification(`🛡️ Армия "${army.name}" заняла оборону!`, 'info');
    return true;
}

// ✅ ВЫДЕЛЕНИЕ ВСЕХ ЮНИТОВ АРМИИ
export function selectArmy(armyId) {
    const army = _armies.find(a => a.id === armyId);
    if (!army) return;
    
    const allUnits = getUnits();
    const myId = getMyCountryId();
    const armyUnits = allUnits.filter(u => army.units.includes(u.id) && u.owner === myId);
    
    // Подсвечиваем всех юнитов армии
    import('./map.js').then(m => {
        m.setSelectedArmy(army.id);
        m.markDirty();
        m.renderMap();
    });
    
    addNotification(`🎖️ Армия "${army.name}" выбрана (${armyUnits.length} дивизий)`, 'info');
    return armyUnits;
}

// Добавить юнитов в армию
export function addUnitsToArmy(armyId, unitIds) {
    const army = _armies.find(a => a.id === armyId);
    if (!army) return false;
    
    const myId = getMyCountryId();
    const allUnits = getUnits();
    
    const validUnits = unitIds.filter(id => {
        const u = allUnits.find(unit => unit.id === id);
        return u && u.owner === myId && !army.units.includes(id);
    });
    
    army.units.push(...validUnits);
    addNotification(`+${validUnits.length} дивизий добавлено в армию "${army.name}"`, 'info');
    return true;
}

// Удалить армию
export function disbandArmy(armyId) {
    const army = _armies.find(a => a.id === armyId);
    if (!army) return false;
    
    _armies = _armies.filter(a => a.id !== armyId);
    addNotification(`Армия "${army.name}" расформирована`, 'info');
    return true;
}

// Бонусы командира для юнита
export function getCommanderBonus(unitId) {
    const army = _armies.find(a => a.units.includes(unitId));
    if (!army) return { attack: 1, defense: 1 };
    
    const commander = army.commander;
    let bonus = { attack: 1, defense: 1 };
    
    // Базовый бонус от навыка
    bonus.attack += commander.attack * 0.05;
    bonus.defense += commander.defense * 0.05;
    
    // Бонусы от трейтов
    const unit = getUnits().find(u => u.id === unitId);
    if (unit) {
        commander.traits.forEach(trait => {
            if (trait.bonus === 'tank_attack' && unit.type === 'tank') {
                bonus.attack *= trait.value;
            }
            if (trait.bonus === 'infantry_defense' && unit.type === 'infantry') {
                bonus.defense *= trait.value;
            }
            if (trait.bonus === 'all_attack') bonus.attack *= trait.value;
            if (trait.bonus === 'all_defense') bonus.defense *= trait.value;
        });
    }
    
    return bonus;
}
