// tech.js — система исследований

import { getTech, setTech, getActiveResearch, setActiveResearch } from './game.js';
import { TECH_TREE } from './data.js';
import { addNotification } from './utils.js';

export function getTechLevel(techType) {
    const tech = getTech();
    return tech[techType] || 1;
}

export function canResearch(techType, level) {
    const tech = getTech();
    const activeResearch = getActiveResearch();
    
    if (activeResearch) return false;
    if (tech[techType] >= level) return false;
    if (tech[techType] + 1 !== level) return false;
    
    return true;
}

export function startResearch(techType, level) {
    if (!canResearch(techType, level)) return false;
    
    setActiveResearch({
        type: techType,
        level: level,
        daysLeft: 100
    });
    
    addNotification(`Исследование ${TECH_TREE[techType]?.name} ур.${level} начато!`, 'info');
    
    const indicator = document.getElementById('research-indicator');
    if (indicator) indicator.classList.remove('hidden');
    
    return true;
}

export function updateResearch() {
    const activeResearch = getActiveResearch();
    if (!activeResearch) return;
    
    activeResearch.daysLeft--;
    
    if (activeResearch.daysLeft <= 0) {
        const tech = getTech();
        tech[activeResearch.type] = activeResearch.level;
        setTech(tech);
        addNotification(`Исследование ${TECH_TREE[activeResearch.type]?.name} ур.${activeResearch.level} завершено!`, 'info');
        setActiveResearch(null);
        
        const indicator = document.getElementById('research-indicator');
        if (indicator) indicator.classList.add('hidden');
    }
}

export function getUnitStatsWithTech() {
    const tech = getTech();
    const infLevel = tech.infantry;
    const infStatMult = 1 + (infLevel - 1) * 0.05;
    const infCostMult = 1 + (infLevel - 1) * 0.10;
    const tankStatMult = 1 + (tech.tank - 1) * 0.05;

    return {
        infantry: { 
            name: `Пехота (Ур. ${infLevel})`, icon: "💂", 
            costEquipment: Math.round(100 * infCostMult), 
            costManpower: Math.round(1000 * infCostMult),
            attack: 10 * infStatMult,
            defense: 25 * infStatMult,
            hp: 100 * infStatMult,
            armor: 0,
            maintenance: 0.2 * infStatMult
        },
        tank: { 
            name: `Танки (Ур. ${tech.tank})`, icon: "🚜", 
            costEquipment: Math.round(800 * (1 + (tech.tank - 1) * 0.1)), 
            costManpower: 500,
            attack: 45 * tankStatMult,
            defense: 15 * tankStatMult,
            hp: 50 * tankStatMult,
            armor: 30 * tankStatMult,
            maintenance: 1.5
        }
    };
}

export function updateResearchUI() {
    const container = document.getElementById('window-content');
    if (!container) return;
    
    const tech = getTech();
    const activeResearch = getActiveResearch();

    let html = '<div class="space-y-6">';
    
    for (const [key, value] of Object.entries(TECH_TREE)) {
        const currentLevel = tech[key] || 1;
        html += `
            <div class="bg-gray-700 p-4 rounded-lg border-l-4 border-yellow-500">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-yellow-500">${value.name}</span>
                    <span class="text-sm">Уровень ${currentLevel}/${value.maxLevel}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(currentLevel/value.maxLevel)*100}%"></div>
                </div>
        `;
        
        if (currentLevel < value.maxLevel && (!activeResearch || activeResearch.type !== key)) {
            html += `<button onclick="window.startResearch('${key}', ${currentLevel+1})" class="bg-blue-700 hover:bg-blue-600 px-3 py-1 text-xs rounded mt-2">ИССЛЕДОВАТЬ УР.${currentLevel+1}</button>`;
        } else if (activeResearch && activeResearch.type === key) {
            html += `<div class="text-xs text-blue-400 mt-2">🔬 Исследуется: ${activeResearch.daysLeft} дней</div>`;
        }
        
        html += `</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}
