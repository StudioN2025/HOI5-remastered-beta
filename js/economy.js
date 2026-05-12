// economy.js — СТРОИТЕЛЬСТВО ТОЛЬКО ДЛЯ ИГРОКА

import { 
    getPlayerResources, setPlayerResources,
    getBuildingQueue, setBuildingQueue,
    getGridData, getMyCountryId, getCellStats, setCellStats,
    getUnits, getTech
} from './game.js';
import { BUILDING_STATS } from './data.js';
import { addNotification, calculateCountryStats } from './utils.js';

// Начало стройки (ТОЛЬКО для игрока)
export function startBuilding(buildingType, posKey) {
    const stats = BUILDING_STATS[buildingType];
    if (!stats) return false;

    const resources = getPlayerResources();
    if ((resources.equipment || 0) < stats.costEquipment) {
        addNotification(`Недостаточно снаряжения! Нужно ${stats.costEquipment} 🔫`, 'war');
        return false;
    }

    const gridData = getGridData();
    const myId = getMyCountryId();
    if (gridData[posKey] !== myId) {
        addNotification('Можно строить только на своей территории!', 'war');
        return false;
    }

    // Списание ресурсов
    resources.equipment -= stats.costEquipment;
    setPlayerResources(resources);

    // ✅ Добавляем в очередь с владельцем-игроком
    const queue = getBuildingQueue();
    queue.push({
        pos: posKey,
        type: buildingType,
        daysLeft: stats.buildTime,
        owner: myId
    });
    setBuildingQueue(queue);

    addNotification(`Строительство ${stats.name} начато! (${stats.buildTime} дней)`, 'info');
    
    const buildIndicator = document.getElementById('build-indicator');
    if (buildIndicator) buildIndicator.classList.remove('hidden');
    
    return true;
}

// Обработка строительства
export function processConstruction() {
    const queue = getBuildingQueue();
    if (!queue || queue.length === 0) {
        const buildIndicator = document.getElementById('build-indicator');
        if (buildIndicator) buildIndicator.classList.add('hidden');
        return;
    }

    const current = queue[0];
    
    // Уменьшаем дни
    current.daysLeft = (current.daysLeft || 0) - 1;

    if (current.daysLeft <= 0) {
        const cellStats = getCellStats();
        
        // ✅ Создаём клетку если её нет
        if (!cellStats[current.pos]) {
            cellStats[current.pos] = { 
                population: Math.floor(Math.random() * 80000) + 5000, 
                factories: 0, 
                buildings: [] 
            };
        }

        const cell = cellStats[current.pos];
        
        if (current.type === 'factory') {
            cell.factories = (cell.factories || 0) + 1;
            
            // ✅ УВЕДОМЛЕНИЕ ТОЛЬКО ДЛЯ ИГРОКА
            if (current.owner === getMyCountryId()) {
                addNotification(`🏭 Военный завод построен! Всего в провинции: ${cell.factories}`, 'info');
            }
        } else if (current.type === 'port') {
            if (!cell.buildings) cell.buildings = [];
            cell.buildings.push('port');
            
            if (current.owner === getMyCountryId()) {
                addNotification('⚓ Морской порт построен!', 'info');
            }
        }

        // ✅ СОХРАНЯЕМ
        cellStats[current.pos] = cell;
        setCellStats(cellStats);

        // Удаляем из очереди
        queue.shift();
        setBuildingQueue(queue);

        // Обновляем UI
        if (current.owner === getMyCountryId()) {
            import('./ui.js').then(m => m.updateTopBar());
            import('./map.js').then(m => { m.markDirty(); m.renderMap(); });
        }

        // Скрываем индикатор если очередь пуста
        if (queue.length === 0) {
            const buildIndicator = document.getElementById('build-indicator');
            if (buildIndicator) buildIndicator.classList.add('hidden');
        }
    }
}

// Обновление экономики
export function updateEconomy(techLevel, unitStats) {
    const resources = getPlayerResources();
    const myId = getMyCountryId();
    const gridData = getGridData();
    const cellStats = getCellStats();

    // Считаем заводы игрока
    let totalFactories = 0;
    Object.entries(gridData).forEach(([pos, id]) => {
        if (id === myId && cellStats[pos]) {
            totalFactories += cellStats[pos].factories || 0;
        }
    });

    resources.factories = totalFactories;

    // Производство
    const industryBonus = 1 + ((techLevel || 1) - 1) * 0.05;
    const production = totalFactories * 1.5 * industryBonus;

    // Обслуживание
    const units = getUnits() || [];
    let maintenance = 0;
    units.forEach(u => {
        if (u.owner === myId && (u.trainingDaysLeft || 0) <= 0) {
            const stats = unitStats[u.type];
            if (stats) {
                maintenance += stats.maintenance || 0;
            }
        }
    });

    resources.equipment = Math.max(0, (resources.equipment || 0) + production - maintenance);
    setPlayerResources(resources);

    // UI
    const equipmentElem = document.getElementById('val-equipment');
    const factoriesElem = document.getElementById('val-factories');
    if (equipmentElem) equipmentElem.innerText = Math.floor(resources.equipment || 0).toLocaleString();
    if (factoriesElem) factoriesElem.innerText = resources.factories || 0;
}

export function getUnitProduction(factories, techLevel) {
    const industryBonus = 1 + ((techLevel || 1) - 1) * 0.05;
    return factories * 1.5 * industryBonus;
}
