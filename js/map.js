// map.js — ПОЛНАЯ ОПТИМИЗИРОВАННАЯ ВЕРСИЯ СО СТРЕЛОЧКАМИ

import { getCountryInfo, getCellData } from './utils.js';
import { getGridData, getUnits, getMyCountryId, getBuildingQueue, getSelectedUnitId, getCellStats } from './game.js';
import { BUILDING_STATS } from './data.js';

const canvas = document.getElementById('map-canvas');
let ctx = canvas.getContext('2d', { 
    alpha: false,
    desynchronized: true 
});

const CELL_SIZE = 20;

let camera = { x: 0, y: 0, zoom: 0.8 };
let hoverCell = null;

// Оффскрин-канвас для кэширования статики
let offscreenCanvas = null;
let offscreenCtx = null;
let cacheValid = false;
let cachedVisibleRange = null;

export function getCamera() { return camera; }
export function getHoverCell() { return hoverCell; }
export function setHoverCell(cell) { hoverCell = cell; }
export function getCellSize() { return CELL_SIZE; }
export { canvas, ctx };

export function markDirty() {
    cacheValid = false;
}

export function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    offscreenCanvas = null;
    cacheValid = false;
}

export function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = sx - rect.left;
    const canvasY = sy - rect.top;
    const x = Math.floor(((canvasX - canvas.width / 2) / camera.zoom + camera.x) / CELL_SIZE);
    const y = Math.floor(((canvasY - canvas.height / 2) / camera.zoom + camera.y) / CELL_SIZE);
    return { x, y };
}

function getVisibleRange() {
    const invZoom = 1 / camera.zoom;
    return {
        startX: Math.floor((camera.x - canvas.width / 2 * invZoom) / CELL_SIZE) - 2,
        endX: Math.floor((camera.x + canvas.width / 2 * invZoom) / CELL_SIZE) + 2,
        startY: Math.floor((camera.y - canvas.height / 2 * invZoom) / CELL_SIZE) - 2,
        endY: Math.floor((camera.y + canvas.height / 2 * invZoom) / CELL_SIZE) + 2
    };
}

function isSameRange(a, b) {
    if (!a || !b) return false;
    return a.startX === b.startX && a.endX === b.endX &&
           a.startY === b.startY && a.endY === b.endY;
}

// Рендер статики в оффскрин
function renderToOffscreen(range) {
    if (!offscreenCanvas || offscreenCanvas.width !== canvas.width || offscreenCanvas.height !== canvas.height) {
        offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
    }

    const ctx2 = offscreenCtx;
    
    // Фон
    ctx2.fillStyle = '#1b3a4b';
    ctx2.fillRect(0, 0, canvas.width, canvas.height);
    
    const gridData = getGridData();
    const cellStats = getCellStats() || {};
    const buildingQueue = getBuildingQueue();
    
    ctx2.save();
    ctx2.translate(canvas.width / 2 - camera.x * camera.zoom, canvas.height / 2 - camera.y * camera.zoom);
    ctx2.scale(camera.zoom, camera.zoom);

    const { startX, endX, startY, endY } = range;

    // Отрисовка клеток (фон)
    for (const [pos, id] of Object.entries(gridData)) {
        const [x, y] = pos.split(',').map(Number);
        if (x < startX || x > endX || y < startY || y > endY) continue;
        
        ctx2.fillStyle = getCountryInfo(id).color;
        ctx2.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    // Сетка и иконки
    ctx2.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx2.lineWidth = 0.5;
    
    for (const [pos, id] of Object.entries(gridData)) {
        const [x, y] = pos.split(',').map(Number);
        if (x < startX || x > endX || y < startY || y > endY) continue;
        
        // Тонкая сетка
        ctx2.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        
        // Иконки зданий
        const cell = cellStats[pos];
        if (!cell) continue;
        
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;
        
        ctx2.font = '9px sans-serif';
        ctx2.textAlign = 'left';
        ctx2.textBaseline = 'top';
        
        let iconY = py + 2;
        
        if (cell.buildings?.includes('port')) {
            ctx2.fillStyle = '#3b82f6';
            ctx2.fillText('⚓', px + 1, iconY);
            iconY += 10;
        }
        
        if (cell.factories > 0) {
            ctx2.fillStyle = '#fff';
            ctx2.fillText('🏭', px + 1, iconY);
        }
    }

    // Стройка
    if (buildingQueue.length > 0 && buildingQueue[0]?.pos) {
        const current = buildingQueue[0];
        const [bx, by] = current.pos.split(',').map(Number);
        
        if (bx >= startX && bx <= endX && by >= startY && by <= endY) {
            const stats = BUILDING_STATS[current.type];
            if (stats) {
                const progress = Math.max(0, Math.min(1, (stats.buildTime - (current.daysLeft || 0)) / stats.buildTime));
                const barX = bx * CELL_SIZE;
                const barY = by * CELL_SIZE + CELL_SIZE - 3;
                
                ctx2.fillStyle = 'rgba(255,255,255,0.3)';
                ctx2.fillRect(barX, barY, CELL_SIZE, 3);
                ctx2.fillStyle = '#3b82f6';
                ctx2.fillRect(barX, barY, CELL_SIZE * progress, 3);
            }
        }
    }

    ctx2.restore();
    cacheValid = true;
    cachedVisibleRange = { ...range };
}

// Основная функция рендера
export function renderMap() {
    if (!ctx) return;
    
    const range = getVisibleRange();
    const gridData = getGridData();
    const units = getUnits();
    const myId = getMyCountryId();
    const selectedUnitId = getSelectedUnitId();
    
    // Кэшированная отрисовка статики
    if (!cacheValid || !isSameRange(range, cachedVisibleRange)) {
        renderToOffscreen(range);
    }
    
    // Копируем кэш на основной канвас
    if (offscreenCanvas) {
        ctx.drawImage(offscreenCanvas, 0, 0);
    }
    
    // Поверх рисуем динамику
    ctx.save();
    ctx.translate(canvas.width / 2 - camera.x * camera.zoom, canvas.height / 2 - camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);
    
    const { startX, endX, startY, endY } = range;

    // ========== СТРЕЛКИ ПУТИ ==========
    const now = Date.now();
    
    for (const u of units) {
        if (!u?.path || u.path.length === 0) continue;
        if (u.owner !== myId && u.id !== selectedUnitId) continue;
        
        const [sx, sy] = u.pos.split(',').map(Number);
        
        // Если юнит не в видимой области и не выбран — пропускаем
        if (sx < startX || sx > endX || sy < startY || sy > endY) {
            if (u.id !== selectedUnitId) continue;
        }
        
        // Конечная точка пути
        const lastStep = u.path[u.path.length - 1];
        const [ex, ey] = lastStep.split(',').map(Number);
        
        // Пульсирующая точка в конце
        const pulse = Math.sin(now / 400) * 0.3 + 0.7;
        const endCX = ex * CELL_SIZE + CELL_SIZE / 2;
        const endCY = ey * CELL_SIZE + CELL_SIZE / 2;
        
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(endCX, endCY, CELL_SIZE * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Линия пути (упрощённая — каждые 4 клетки)
        ctx.strokeStyle = `rgba(255, 215, 0, 0.4)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        
        let firstPoint = true;
        for (let i = 0; i < u.path.length; i += 4) {
            const [px, py] = u.path[i].split(',').map(Number);
            const pxC = px * CELL_SIZE + CELL_SIZE / 2;
            const pyC = py * CELL_SIZE + CELL_SIZE / 2;
            
            if (firstPoint) {
                ctx.moveTo(sx * CELL_SIZE + CELL_SIZE / 2, sy * CELL_SIZE + CELL_SIZE / 2);
                firstPoint = false;
            }
            ctx.lineTo(pxC, pyC);
        }
        // Последняя точка — конец пути
        ctx.lineTo(endCX, endCY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Маленькие стрелочки через каждые 6 клеток
        for (let i = 5; i < u.path.length; i += 6) {
            const [px, py] = u.path[i].split(',').map(Number);
            const [prevX, prevY] = u.path[i - 1].split(',').map(Number);
            
            const arrowCX = px * CELL_SIZE + CELL_SIZE / 2;
            const arrowCY = py * CELL_SIZE + CELL_SIZE / 2;
            const angle = Math.atan2(py - prevY, px - prevX);
            
            const arrowSize = CELL_SIZE * 0.3;
            
            ctx.fillStyle = `rgba(255, 215, 0, 0.6)`;
            ctx.beginPath();
            ctx.moveTo(arrowCX, arrowCY);
            ctx.lineTo(
                arrowCX - arrowSize * Math.cos(angle - Math.PI / 6),
                arrowCY - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                arrowCX - arrowSize * Math.cos(angle + Math.PI / 6),
                arrowCY - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
        }
    }

    // ========== ЮНИТЫ ==========
    if (units.length > 0) {
        for (const u of units) {
            if (!u?.pos) continue;
            
            const [ux, uy] = u.pos.split(',').map(Number);
            if (ux < startX || ux > endX || uy < startY || uy > endY) continue;
            
            const cx = ux * CELL_SIZE + CELL_SIZE / 2;
            const cy = uy * CELL_SIZE + CELL_SIZE / 2;
            
            // Подсветка выбранного
            if (selectedUnitId && u.id === selectedUnitId) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.strokeRect(ux * CELL_SIZE - 1, uy * CELL_SIZE - 1, CELL_SIZE + 2, CELL_SIZE + 2);
                
                // Дополнительное свечение
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
                ctx.lineWidth = 4;
                ctx.strokeRect(ux * CELL_SIZE - 2, uy * CELL_SIZE - 2, CELL_SIZE + 4, CELL_SIZE + 4);
            }
            
            // Иконка юнита
            ctx.font = '14px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            if (u.trainingDaysLeft > 0) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#fff';
                ctx.fillText('🛠', cx, cy);
                ctx.globalAlpha = 1;
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillText(u.type === 'tank' ? '🚜' : '💂', cx, cy);
            }
            
            // HP-бар
            if (u.hp !== undefined && u.hp !== null) {
                const stats = u.type === 'tank' ? { hp: 50 } : { hp: 100 };
                const maxHp = stats.hp || 100;
                const hpPercent = Math.max(0, Math.min(1, (u.hp || 0) / maxHp));
                
                const bw = CELL_SIZE * 0.7;
                const bx = ux * CELL_SIZE + (CELL_SIZE - bw) / 2;
                const by = uy * CELL_SIZE + CELL_SIZE - 5;
                
                // Фон
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(bx, by, bw, 3);
                
                // Полоска HP
                const hpColor = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';
                ctx.fillStyle = hpColor;
                ctx.fillRect(bx, by, bw * hpPercent, 3);
            }
            
            // Индикатор своего/чужого
            if (u.owner !== myId) {
                ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                ctx.fillRect(ux * CELL_SIZE, uy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    // ========== ХОВЕР ==========
    if (hoverCell && gridData[hoverCell]) {
        const [hx, hy] = hoverCell.split(',').map(Number);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    ctx.restore();
}

// Обновление камеры
export function updateCamera() {
    const keys = window._keys || {};
    const speed = 12 / camera.zoom;
    let moved = false;
    
    if (keys['KeyW'] || keys['ArrowUp']) { camera.y -= speed; moved = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { camera.y += speed; moved = true; }
    if (keys['KeyA'] || keys['ArrowLeft']) { camera.x -= speed; moved = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { camera.x += speed; moved = true; }
    
    if (moved) {
        cacheValid = false;
        renderMap();
    }
}

// Настройка событий
export function setupMapEvents() {
    let lastRender = 0;
    const RENDER_INTERVAL = 1000 / 30;
    
    function throttledRender() {
        const now = performance.now();
        if (now - lastRender > RENDER_INTERVAL) {
            lastRender = now;
            renderMap();
        }
    }

    // Зум
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldBefore = screenToWorld(e.clientX, e.clientY);
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        camera.zoom = Math.min(Math.max(camera.zoom * zoomFactor, 0.1), 8);
        
        const worldAfter = screenToWorld(e.clientX, e.clientY);
        camera.x += worldBefore.x - worldAfter.x;
        camera.y += worldBefore.y - worldAfter.y;
        
        cacheValid = false;
        renderMap();
    }, { passive: false });

    // Мышь
    canvas.addEventListener('mousemove', e => {
        const world = screenToWorld(e.clientX, e.clientY);
        const newHover = `${world.x},${world.y}`;
        const gridData = getGridData();
        
        if (gridData[newHover] && hoverCell !== newHover) {
            hoverCell = newHover;
            cacheValid = false;
            throttledRender();
        } else if (!gridData[newHover] && hoverCell) {
            hoverCell = null;
            cacheValid = false;
            throttledRender();
        }
    });

    canvas.addEventListener('mouseleave', () => {
        hoverCell = null;
        cacheValid = false;
        renderMap();
    });

    // Клавиши
    window._keys = {};
    window.addEventListener('keydown', e => { 
        window._keys[e.code] = true; 
    });
    window.addEventListener('keyup', e => { 
        window._keys[e.code] = false; 
    });

    setInterval(() => {
        updateCamera();
    }, 1000 / 30);
}

// Инициализация
resizeCanvas();
window.addEventListener('resize', () => {
    resizeCanvas();
    cacheValid = false;
    renderMap();
});
