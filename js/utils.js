// utils.js — вспомогательные функции

import { COUNTRIES } from './data.js';

export function getCountryInfo(id) {
    return COUNTRIES[id] || { 
        name: id.toUpperCase(), 
        color: generateColor(id), 
        leader: "Неизвестно", 
        ideology: "Нейтралитет" 
    };
}

export function getCellData(key, cellStats) {
    if (!cellStats[key]) {
        cellStats[key] = { 
            population: Math.floor(Math.random() * 80000) + 5000, 
            factories: Math.random() > 0.9 ? 1 : 0, 
            buildings: [] 
        };
    }
    return cellStats[key];
}

export function calculateCountryStats(countryId, gridData, cellStats) {
    let stats = { totalPop: 0, totalFactories: 0, cellCount: 0 };
    Object.entries(gridData).forEach(([pos, id]) => {
        if (id === countryId) {
            const data = getCellData(pos, cellStats);
            stats.totalPop += data.population;
            stats.totalFactories += data.factories;
            stats.cellCount++;
        }
    });
    return stats;
}

export function isAtWar(c1, c2, wars) {
    return wars.some(w => (w.a === c1 && w.b === c2) || (w.b === c1 && w.a === c2));
}

export function areAllies(c1, c2, alliances) {
    if (c1 === c2) return true;
    return alliances.some(a => a.has(c1) && a.has(c2));
}

export function getEnemiesOf(countryId, wars) {
    const enemies = [];
    wars.forEach(w => {
        if (w.a === countryId) enemies.push(w.b);
        if (w.b === countryId) enemies.push(w.a);
    });
    return [...new Set(enemies)];
}

export function getAlliesOf(countryId, alliances) {
    const allies = [];
    alliances.forEach(a => {
        if (a.has(countryId)) {
            a.forEach(id => {
                if (id !== countryId) allies.push(id);
            });
        }
    });
    return [...new Set(allies)];
}

export function addNotification(text, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;
    
    const notif = document.createElement('div');
    notif.className = type === 'war' ? 'notif-war' : 'notif-info';
    notif.innerHTML = `<strong>${type === 'war' ? '⚔️ ВНИМАНИЕ' : '📢 СООБЩЕНИЕ'}</strong><br><span style="font-size:11px">${text}</span>`;
    container.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transition = 'opacity 0.3s';
        setTimeout(() => notif.remove(), 300);
    }, 5000);
}

export function generateColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        value = Math.floor(value * 0.7 + 50);
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num).toString();
}
