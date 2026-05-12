// diplomacy.js — полная капитуляция

import { 
    getWars, setWars, getAlliances, setAlliances, 
    getMyCountryId, addWar,
    getGridData, setGridData, getUnits, setUnits,
    getCellStats, getBuildingQueue, setBuildingQueue,
    getActiveBattles, setActiveBattles,
    setGameSpeed, setGameActive
} from './game.js';
import { getCountryInfo, isAtWar, areAllies, getEnemiesOf, addNotification } from './utils.js';

export function declareWar(targetId) {
    const myId = getMyCountryId();
    const wars = getWars();
    
    if (isAtWar(myId, targetId, wars)) {
        addNotification('Уже в состоянии войны!', 'war');
        return;
    }
    
    const alliances = getAlliances();
    const newAlliances = alliances.filter(a => {
        if (a.has(myId) && a.has(targetId)) {
            addNotification(`Альянс с ${getCountryInfo(targetId).name} разорван!`, 'war');
            return false;
        }
        return true;
    });
    setAlliances(newAlliances);
    
    addWar(myId, targetId);
    addNotification(`${getCountryInfo(myId).name} объявляет войну ${getCountryInfo(targetId).name}!`, 'war');
    
    const sidebar = document.getElementById('info-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
}

export function proposeAlliance(targetId) {
    const myId = getMyCountryId();
    const wars = getWars();
    
    if (isAtWar(myId, targetId, wars)) {
        addNotification('Нельзя заключить альянс с врагом!', 'war');
        return;
    }
    
    const alliances = getAlliances();
    if (areAllies(myId, targetId, alliances)) {
        addNotification('Уже в альянсе!', 'info');
        return;
    }
    
    if (Math.random() < 0.8) {
        alliances.push(new Set([myId, targetId]));
        setAlliances(alliances);
        addNotification(`${getCountryInfo(myId).name} и ${getCountryInfo(targetId).name} заключили альянс!`, 'info');
    } else {
        addNotification(`${getCountryInfo(targetId).name} отклонил предложение альянса.`, 'info');
    }
    
    const sidebar = document.getElementById('info-sidebar');
    if (sidebar) sidebar.classList.add('hidden');
}

export function kickFromAlliance(allyId) {
    const myId = getMyCountryId();
    const alliances = getAlliances();
    
    const newAlliances = alliances.filter(a => {
        if (a.has(myId) && a.has(allyId)) {
            addNotification(`${getCountryInfo(allyId).name} исключён из альянса!`, 'info');
            return false;
        }
        return true;
    });
    setAlliances(newAlliances);
}

export function callToWar(allyId) {
    const myId = getMyCountryId();
    const wars = getWars();
    const myEnemies = getEnemiesOf(myId, wars);
    
    myEnemies.forEach(enemy => {
        if (!isAtWar(allyId, enemy, wars)) {
            addWar(allyId, enemy);
        }
    });
    
    addNotification(`${getCountryInfo(allyId).name} вступает в войну на нашей стороне!`, 'war');
}

export function checkCapitulation(targetCountry, winnerCountry) {
    const gridData = getGridData();
    
    let cellCount = 0;
    for (const id of Object.values(gridData)) {
        if (id === targetCountry) cellCount++;
    }
    
    if (cellCount > 0 && cellCount < 3) {
        addNotification(`КАПИТУЛЯЦИЯ: ${getCountryInfo(targetCountry).name} сдаётся ${getCountryInfo(winnerCountry).name}!`, 'war');
        
        // Передаём ВСЕ клетки победителю
        for (const key of Object.keys(gridData)) {
            if (gridData[key] === targetCountry) {
                gridData[key] = winnerCountry;
            }
        }
        setGridData(gridData);
        
        // Удаляем ВСЕ юниты
        const units = getUnits().filter(u => u.owner !== targetCountry);
        setUnits(units);
        
        // Удаляем из войн
        const wars = getWars().filter(w => w.a !== targetCountry && w.b !== targetCountry);
        setWars(wars);
        
        // Удаляем из альянсов
        const alliances = getAlliances().map(a => {
            const s = new Set(a);
            s.delete(targetCountry);
            return s;
        }).filter(a => a.size > 1);
        setAlliances(alliances);
        
        // Чистим стройку
        const queue = getBuildingQueue().filter(b => b.owner !== targetCountry);
        setBuildingQueue(queue);
        
        // Чистим бои
        const battles = getActiveBattles().filter(b => {
            const aOwner = getUnits().find(u => u.id === b.attacker?.id)?.owner;
            const dOwner = getUnits().find(u => u.id === b.defender?.id)?.owner;
            return aOwner !== targetCountry && dOwner !== targetCountry;
        });
        setActiveBattles(battles);
        
        if (targetCountry === getMyCountryId()) {
            addNotification('ВАША СТРАНА КАПИТУЛИРОВАЛА! Игра окончена.', 'war');
            setGameSpeed(0);
            setGameActive(false);
        }
        
        return true;
    }
    
    return false;
}

export function getWarsList() { return getEnemiesOf(getMyCountryId(), getWars()); }
export function getAlliancesList() {
    const myId = getMyCountryId();
    const allies = [];
    for (const a of getAlliances()) {
        if (a.has(myId)) for (const id of a) if (id !== myId) allies.push(id);
    }
    return [...new Set(allies)];
}

export function isAtWarCheck(c1, c2) { return isAtWar(c1, c2, getWars()); }
export function areAlliesCheck(c1, c2) { return areAllies(c1, c2, getAlliances()); }
