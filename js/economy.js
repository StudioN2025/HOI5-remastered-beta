// economy.js — ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ

import { 
    getPlayerResources, setPlayerResources,
    getBuildingQueue, setBuildingQueue,
    getGridData, getMyCountryId, getCellStats, setCellStats,
    getUnits, getTech
} from './game.js';
import { BUILDING_STATS } from './data.js';
import { addNotification } from './utils.js';

// Начало стройки
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

    // ✅ Списание ресурсов
    resources.equipment -= stats.costEquipment;
    setPlayerResources(resources);

    // ✅ Добавление в очередь
    const queue = getBuildingQueue();
    queue.push({
        pos: posKey,
        type: buildingType,
        daysLeft: stats.buildTime,
        owner: myId
    });
    setBuildingQueue(queue);

    addNotification(`🏗️ Строительство ${stats.name} начато! (${stats.buildTime} дней)`, 'info');
    
    // Показываем индикатор
    const indicator = document.getElementById('build-indicator');
    if (indicator) indicator.classList.remove('hidden');
    
    return true;
}

// Обработка очереди строительства
export function processConstruction() {
    const queue = getBuildingQueue();
    
    if (!queue || queue.length === 0) {
        const indicator = document.getElementById('build-indicator');
        if (indicator) indicator.classList.add('hidden');
        return;
    }

    const current = queue[0];
    
    // ✅ Уменьшаем счётчик дней
    current.daysLeft = (current.daysLeft || 0) - 1;
    
    // ✅ Проверка завершения
    if (current.daysLeft <= 0) {
        completeConstruction(current);
        
        // ✅ Удаляем из очереди
        queue.shift();
        setBuildingQueue(queue);
        
        // ✅ Скрываем индикатор если очередь пуста
        if (queue.length === 0) {
            const indicator = document.getElementById('build-indicator');
            if (indicator) indicator.classList.add('hidden');
        }
    }
}

// ✅ Завершение постройки
function completeConstruction(project) {
    if (!project || !project.pos || !project.type) return;
    
    const cellStats = getCellStats();
    const myId = getMyCountryId();
    
    // ✅ Создаём клетку если её нет
    if (!cellStats[project.pos]) {
        cellStats[project.pos] = {
            population: Math.floor(Math.random() * 80000) + 5000,
            factories: 0,
            buildings: []
        };
    }
    
    const cell = cellStats[project.pos];
    
    // ✅ Применяем постройку
    if (project.type === 'factory') {
        cell.factories = (cell.factories || 0) + 1;
        
        if (project.owner === myId) {
            addNotification(`🏭 Военный завод построен! Всего в провинции: ${cell.factories}`, 'info');
        }
    } else if (project.type === 'port') {
        if (!cell.buildings) cell.buildings = [];
        
        // ✅ Проверяем что порта ещё нет
        if (!cell.buildings.includes('port')) {
            cell.buildings.push('port');
            if (project.owner === myId) {
                addNotification('⚓ Морской порт построен!', 'info');
            }
        }
    }
    
    // ✅ СОХРАНЯЕМ ИЗМЕНЕНИЯ
    cellStats[project.pos] = cell;
    setCellStats(cellStats);
    
    // ✅ Обновляем интерфейс
    if (project.owner === myId) {
        import('./ui.js').then(m => m.updateTopBar());
        import('./map.js').then(m => { m.markDirty(); m.renderMap(); });
    }
}

// Обновление экономики игрока
export function updateEconomy(techLevel, unitStats) {
    const resources = getPlayerResources();
    const myId = getMyCountryId();
    const gridData = getGridData();
    const cellStats = getCellStats();

    // ✅ Считаем заводы на территории игрока
    let totalFactories = 0;
    for (const [pos, owner] of Object.entries(gridData)) {
        if (owner === myId && cellStats[pos]) {
            totalFactories += cellStats[pos].factories || 0;
        }
    }

    resources.factories = totalFactories;

    // Производство снаряжения
    const industryBonus = 1 + ((techLevel || 1) - 1) * 0.05;
    const production = totalFactories * 1.5 * industryBonus;

    // Обслуживание юнитов
    const units = getUnits() || [];
    let maintenance = 0;
    for (const u of units) {
        if (u.owner === myId && (u.trainingDaysLeft || 0) <= 0) {
            const stats = unitStats[u.type];
            if (stats) maintenance += stats.maintenance || 0;
        }
    }

    // Обновление ресурсов
    resources.equipment = Math.max(0, (resources.equipment || 0) + production - maintenance);
    setPlayerResources(resources);

    // Обновление UI
    updateTopBarUI(resources);
}

function updateTopBarUI(resources) {
    const factoriesElem = document.getElementById('val-factories');
    const equipmentElem = document.getElementById('val-equipment');
    
    if (factoriesElem) factoriesElem.innerText = resources.factories || 0;
    if (equipmentElem) equipmentElem.innerText = Math.floor(resources.equipment || 0).toLocaleString();
}

export function getUnitProduction(factories, techLevel) {
    const industryBonus = 1 + ((techLevel || 1) - 1) * 0.05;
    return factories * 1.5 * industryBonus;
}
