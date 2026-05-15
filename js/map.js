// map.js — СУПЕР-ЛЁГКИЙ БЕЗ ЛАГОВ

import { getCountryInfo } from './utils.js';
import { getGridData, getUnits, getMyCountryId, getBuildingQueue, getSelectedUnitId, getCellStats, getWars } from './game.js';
import { BUILDING_STATS } from './data.js';

const canvas = document.getElementById('map-canvas');
let ctx = canvas.getContext('2d', { alpha: false });

const CELL_SIZE = 20;

let camera = { x: 0, y: 0, zoom: 0.8 };
let hoverCell = null;
let selectedArmyId = null;
let needRedraw = true;

export function getCamera() { return camera; }
export function getHoverCell() { return hoverCell; }
export function setHoverCell(cell) { hoverCell = cell; }
export function getCellSize() { return CELL_SIZE; }
export function setSelectedArmy(id) { selectedArmyId = id; needRedraw = true; }
export { canvas, ctx };

export function markDirty() { needRedraw = true; }

export function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    needRedraw = true;
}

export function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.floor(((sx - rect.left - canvas.width/2) / camera.zoom + camera.x) / CELL_SIZE),
        y: Math.floor(((sy - rect.top - canvas.height/2) / camera.zoom + camera.y) / CELL_SIZE)
    };
}

// ✅ РЕНДЕР ТОЛЬКО ВИДИМЫХ КЛЕТОК
export function renderMap() {
    if (!ctx || !needRedraw) return;
    needRedraw = false;
    
    const gridData = getGridData();
    const cellStats = getCellStats() || {};
    const units = getUnits();
    const myId = getMyCountryId();
    const selectedUnitId = getSelectedUnitId();
    const buildingQueue = getBuildingQueue();
    
    // Видимая область
    const invZoom = 1 / camera.zoom;
    const startX = Math.floor((camera.x - canvas.width/2 * invZoom) / CELL_SIZE) - 1;
    const endX = Math.ceil((camera.x + canvas.width/2 * invZoom) / CELL_SIZE) + 1;
    const startY = Math.floor((camera.y - canvas.height/2 * invZoom) / CELL_SIZE) - 1;
    const endY = Math.ceil((camera.y + canvas.height/2 * invZoom) / CELL_SIZE) + 1;
    
    // Фон
    ctx.fillStyle = '#1b3a4b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(canvas.width/2 - camera.x * camera.zoom, canvas.height/2 - camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);
    
    // ✅ РЕНДЕР КЛЕТОК — только видимые
    const visibleCount = (endX - startX) * (endY - startY);
    
    // Собираем видимые клетки
    const visibleCells = [];
    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            const key = `${x},${y}`;
            const owner = gridData[key];
            if (owner) visibleCells.push({ x, y, key, owner });
        }
    }
    
    // Если видно много — пропускаем иконки для скорости
    const showIcons = visibleCount < 5000;
    
    for (const { x, y, key, owner } of visibleCells) {
        // Заливка
        ctx.fillStyle = getCountryInfo(owner).color;
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        
        // Рамка
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        
        // Иконки только при достаточном зуме и малом количестве клеток
        if (showIcons && camera.zoom > 0.5) {
            const cell = cellStats[key];
            if (!cell) continue;
            
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            
            let iy = y * CELL_SIZE + 2;
            if (cell.buildings?.includes('port')) {
                ctx.fillStyle = '#3b82f6';
                ctx.fillText('⚓', x * CELL_SIZE + 1, iy);
                iy += 10;
            }
            if (cell.factories > 0) {
                ctx.fillStyle = '#fff';
                ctx.fillText('🏭', x * CELL_SIZE + 1, iy);
            }
        }
    }
    
    // Стройка
    if (buildingQueue.length > 0 && buildingQueue[0]?.pos) {
        const [bx, by] = buildingQueue[0].pos.split(',').map(Number);
        if (bx >= startX && bx <= endX && by >= startY && by <= endY) {
            const stats = BUILDING_STATS[buildingQueue[0].type];
            if (stats) {
                const p = Math.max(0, Math.min(1, (stats.buildTime - buildingQueue[0].daysLeft) / stats.buildTime));
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(bx * CELL_SIZE, by * CELL_SIZE + CELL_SIZE - 3, CELL_SIZE, 3);
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(bx * CELL_SIZE, by * CELL_SIZE + CELL_SIZE - 3, CELL_SIZE * p, 3);
            }
        }
    }
    
    // ✅ ЮНИТЫ — только видимые
    if (units.length > 0) {
        for (const u of units) {
            if (!u?.pos) continue;
            const [ux, uy] = u.pos.split(',').map(Number);
            if (ux < startX || ux > endX || uy < startY || uy > endY) continue;
            
            const cx = ux * CELL_SIZE + CELL_SIZE/2;
            const cy = uy * CELL_SIZE + CELL_SIZE/2;
            
            // Подсветка выбранного или из выбранной армии
            const isSelected = u.id === selectedUnitId;
            const inSelectedArmy = selectedArmyId && window._armies?.find(a => a.id === selectedArmyId)?.units.includes(u.id);
            
            if (isSelected || inSelectedArmy) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.strokeRect(ux * CELL_SIZE - 1, uy * CELL_SIZE - 1, CELL_SIZE + 2, CELL_SIZE + 2);
            }
            
            // Иконка
            ctx.font = '14px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = u.owner === myId ? '#fff' : '#f99';
            
            if (u.trainingDaysLeft > 0) {
                ctx.globalAlpha = 0.5;
                ctx.fillText('🛠', cx, cy);
                ctx.globalAlpha = 1;
            } else {
                ctx.fillText(u.type === 'tank' ? '🚜' : '💂', cx, cy);
            }
            
            // HP
            if (u.hp != null && camera.zoom > 0.4) {
                const maxHp = u.type === 'tank' ? 50 : 100;
                const hpP = Math.max(0, Math.min(1, u.hp / maxHp));
                const bw = CELL_SIZE * 0.5;
                const bx = ux * CELL_SIZE + (CELL_SIZE - bw)/2;
                const by = uy * CELL_SIZE + CELL_SIZE - 4;
                
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(bx, by, bw, 2);
                ctx.fillStyle = hpP > 0.5 ? '#22c55e' : '#eab308';
                ctx.fillRect(bx, by, bw * hpP, 2);
            }
        }
    }
    
    // Ховер
    if (hoverCell && gridData[hoverCell]) {
        const [hx, hy] = hoverCell.split(',').map(Number);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    
    ctx.restore();
}

export function updateCamera() {
    const keys = window._keys || {};
    const speed = 12 / camera.zoom;
    if (keys['KeyW'] || keys['ArrowUp']) { camera.y -= speed; needRedraw = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { camera.y += speed; needRedraw = true; }
    if (keys['KeyA'] || keys['ArrowLeft']) { camera.x -= speed; needRedraw = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { camera.x += speed; needRedraw = true; }
    if (needRedraw) renderMap();
}

export function setupMapEvents() {
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const before = screenToWorld(e.clientX, e.clientY);
        camera.zoom = Math.min(Math.max(camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.05), 10);
        const after = screenToWorld(e.clientX, e.clientY);
        camera.x += before.x - after.x;
        camera.y += before.y - after.y;
        needRedraw = true;
        renderMap();
    }, { passive: false });

    canvas.addEventListener('mousemove', e => {
        const world = screenToWorld(e.clientX, e.clientY);
        const nh = `${world.x},${world.y}`;
        const gd = getGridData();
        if (gd[nh] && hoverCell !== nh) { hoverCell = nh; needRedraw = true; renderMap(); }
        else if (!gd[nh] && hoverCell) { hoverCell = null; needRedraw = true; renderMap(); }
    });

    canvas.addEventListener('mouseleave', () => { hoverCell = null; needRedraw = true; renderMap(); });

    window._keys = {};
    window.addEventListener('keydown', e => { window._keys[e.code] = true; });
    window.addEventListener('keyup', e => { window._keys[e.code] = false; });

    setInterval(() => { updateCamera(); if (needRedraw) renderMap(); }, 1000/30);
}

resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); needRedraw = true; renderMap(); });
