// map.js — РЕНДЕРЕР СПОСОБНЫЙ ОБРАБОТАТЬ 1 000 000+ КЛЕТОК

import { getCountryInfo } from './utils.js';
import { getGridData, getUnits, getMyCountryId, getBuildingQueue, getSelectedUnitId, getCellStats } from './game.js';
import { BUILDING_STATS } from './data.js';

const canvas = document.getElementById('map-canvas');
let ctx = canvas.getContext('2d', { 
    alpha: false,
    desynchronized: true,
    willReadFrequently: false
});

const CELL_SIZE = 20;

// Камера
let camera = { x: 0, y: 0, zoom: 0.8 };
let hoverCell = null;

// Кэши
let offscreenCanvas = null;
let offscreenCtx = null;
let cacheValid = false;
let cachedRange = null;

// ✅ ТАЙЛОВАЯ СИСТЕМА
const TILE_SIZE = 512; // Размер тайла в пикселях
let tileCache = new Map(); // "tx,ty,zoom" -> ImageData
const MAX_TILES = 64; // Максимум тайлов в кэше

// Кэш котлов
let pocketCache = null;
let pocketFrame = 0;
const POCKET_INTERVAL = 60;

// Кэш юнитов (обновляется каждый кадр, но рендерится быстро)
let visibleUnits = [];

export function getCamera() { return camera; }
export function getHoverCell() { return hoverCell; }
export function setHoverCell(cell) { hoverCell = cell; }
export function getCellSize() { return CELL_SIZE; }
export { canvas, ctx };

export function markDirty() {
    cacheValid = false;
    tileCache.clear();
    pocketCache = null;
}

export function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    tileCache.clear();
    cacheValid = false;
}

export function screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: Math.floor(((sx - rect.left - canvas.width/2) / camera.zoom + camera.x) / CELL_SIZE),
        y: Math.floor(((sy - rect.top - canvas.height/2) / camera.zoom + camera.y) / CELL_SIZE)
    };
}

// ✅ ПОЛУЧЕНИЕ ИНДЕКСОВ ВИДИМЫХ КЛЕТОК БЕЗ ПЕРЕБОРА ВСЕХ
function getVisibleCells() {
    const invZoom = 1 / camera.zoom;
    const startX = Math.floor((camera.x - canvas.width/2 * invZoom) / CELL_SIZE) - 1;
    const endX = Math.ceil((camera.x + canvas.width/2 * invZoom) / CELL_SIZE) + 1;
    const startY = Math.floor((camera.y - canvas.height/2 * invZoom) / CELL_SIZE) - 1;
    const endY = Math.ceil((camera.y + canvas.height/2 * invZoom) / CELL_SIZE) + 1;
    
    return { startX, endX, startY, endY, 
        count: (endX - startX) * (endY - startY) 
    };
}

// ✅ ТАЙЛОВЫЙ РЕНДЕР
function getTileKey(tx, ty, zoomLevel) {
    return `${tx},${ty},${zoomLevel}`;
}

function renderTile(tx, ty, zoomLevel) {
    const key = getTileKey(tx, ty, zoomLevel);
    
    // Проверяем кэш
    if (tileCache.has(key)) return tileCache.get(key);
    
    // Создаём тайл
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = TILE_SIZE;
    tileCanvas.height = TILE_SIZE;
    const tileCtx = tileCanvas.getContext('2d', { alpha: false });
    
    const gridData = getGridData();
    const cellStats = getCellStats() || {};
    
    // Вычисляем границы тайла в клетках
    const cellStartX = tx * Math.floor(TILE_SIZE / CELL_SIZE / zoomLevel);
    const cellStartY = ty * Math.floor(TILE_SIZE / CELL_SIZE / zoomLevel);
    const cellsPerTile = Math.ceil(TILE_SIZE / CELL_SIZE / zoomLevel);
    
    // Фон
    tileCtx.fillStyle = '#1b3a4b';
    tileCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    // ✅ РЕНДЕРИМ ТОЛЬКО КЛЕТКИ ЭТОГО ТАЙЛА
    for (let dx = 0; dx < cellsPerTile; dx++) {
        for (let dy = 0; dy < cellsPerTile; dy++) {
            const cx = cellStartX + dx;
            const cy = cellStartY + dy;
            const key = `${cx},${cy}`;
            const owner = gridData[key];
            
            if (!owner) continue;
            
            const screenX = dx * CELL_SIZE * zoomLevel;
            const screenY = dy * CELL_SIZE * zoomLevel;
            const size = CELL_SIZE * zoomLevel;
            
            tileCtx.fillStyle = getCountryInfo(owner).color;
            tileCtx.fillRect(screenX, screenY, size, size);
            tileCtx.strokeStyle = 'rgba(0,0,0,0.08)';
            tileCtx.lineWidth = 0.5;
            tileCtx.strokeRect(screenX, screenY, size, size);
            
            // Иконки только при достаточном зуме
            if (zoomLevel > 0.5) {
                const cell = cellStats[key];
                if (!cell) continue;
                
                tileCtx.font = `${Math.max(7, 9 * zoomLevel)}px sans-serif`;
                tileCtx.textAlign = 'left';
                tileCtx.textBaseline = 'top';
                
                let iconY = screenY + 2 * zoomLevel;
                if (cell.buildings?.includes('port')) {
                    tileCtx.fillStyle = '#3b82f6';
                    tileCtx.fillText('⚓', screenX + 1, iconY);
                    iconY += 10 * zoomLevel;
                }
                if (cell.factories > 0) {
                    tileCtx.fillStyle = '#fff';
                    tileCtx.fillText('🏭', screenX + 1, iconY);
                }
            }
        }
    }
    
    // Управление размером кэша
    if (tileCache.size >= MAX_TILES) {
        const firstKey = tileCache.keys().next().value;
        tileCache.delete(firstKey);
    }
    
    tileCache.set(key, tileCanvas);
    return tileCanvas;
}

// Основной рендер
export function renderMap() {
    if (!ctx) return;
    
    const gridData = getGridData();
    const visible = getVisibleCells();
    const now = Date.now();
    
    // ✅ ЕСЛИ ВИДИМО МАЛО КЛЕТОК — ПРЯМОЙ РЕНДЕР
    if (visible.count < 10000) {
        renderDirect(visible, gridData, now);
        return;
    }
    
    // ✅ ТАЙЛОВЫЙ РЕНДЕР ДЛЯ БОЛЬШИХ КАРТ
    const zoomLevel = Math.round(camera.zoom * 4) / 4; // Квантуем зум
    const tilesX = Math.ceil(canvas.width / TILE_SIZE) + 1;
    const tilesY = Math.ceil(canvas.height / TILE_SIZE) + 1;
    
    const baseTx = Math.floor(camera.x / (TILE_SIZE / zoomLevel));
    const baseTy = Math.floor(camera.y / (TILE_SIZE / zoomLevel));
    
    ctx.fillStyle = '#1b3a4b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
            const tile = renderTile(baseTx + tx, baseTy + ty, zoomLevel);
            if (!tile) continue;
            
            const screenX = (baseTx + tx) * TILE_SIZE - camera.x * zoomLevel + canvas.width/2;
            const screenY = (baseTy + ty) * TILE_SIZE - camera.y * zoomLevel + canvas.height/2;
            
            ctx.drawImage(tile, screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
    }
    
    // ✅ КОТЛЫ (редко)
    pocketFrame++;
    if (pocketFrame >= POCKET_INTERVAL) {
        pocketFrame = 0;
        updatePocketCache();
    }
    
    if (pocketCache) {
        ctx.save();
        ctx.translate(canvas.width/2 - camera.x * camera.zoom, canvas.height/2 - camera.y * camera.zoom);
        ctx.scale(camera.zoom, camera.zoom);
        
        for (const pocket of pocketCache) {
            const pulse = Math.sin(now / 500) * 0.3 + 0.7;
            for (const pos of pocket.cells) {
                const [x, y] = pos.split(',').map(Number);
                ctx.strokeStyle = pocket.isEnemy ? `rgba(255,30,30,${pulse})` : `rgba(255,200,0,${pulse})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                ctx.setLineDash([]);
            }
        }
        ctx.restore();
    }
    
    // ✅ ЮНИТЫ и ховер
    renderDynamicLayer(visible, now);
}

// Прямой рендер для маленьких карт
function renderDirect(visible, gridData, now) {
    ctx.fillStyle = '#1b3a4b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const cellStats = getCellStats() || {};
    const buildingQueue = getBuildingQueue();
    
    ctx.save();
    ctx.translate(canvas.width/2 - camera.x * camera.zoom, canvas.height/2 - camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);
    
    const { startX, endX, startY, endY } = visible;
    
    // Клетки
    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            const key = `${x},${y}`;
            const owner = gridData[key];
            if (!owner) continue;
            
            ctx.fillStyle = getCountryInfo(owner).color;
            ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            
            const cell = cellStats[key];
            if (cell) {
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
    }
    
    // Стройка
    if (buildingQueue.length > 0 && buildingQueue[0]?.pos) {
        const [bx, by] = buildingQueue[0].pos.split(',').map(Number);
        const stats = BUILDING_STATS[buildingQueue[0].type];
        if (stats) {
            const p = Math.max(0, Math.min(1, (stats.buildTime - buildingQueue[0].daysLeft) / stats.buildTime));
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fillRect(bx * CELL_SIZE, by * CELL_SIZE + CELL_SIZE - 3, CELL_SIZE, 3);
            ctx.fillStyle = '#3b82f6';
            ctx.fillRect(bx * CELL_SIZE, by * CELL_SIZE + CELL_SIZE - 3, CELL_SIZE * p, 3);
        }
    }
    
    ctx.restore();
    
    // Котлы
    pocketFrame++;
    if (pocketFrame >= POCKET_INTERVAL) {
        pocketFrame = 0;
        updatePocketCache();
    }
    
    if (pocketCache) {
        ctx.save();
        ctx.translate(canvas.width/2 - camera.x * camera.zoom, canvas.height/2 - camera.y * camera.zoom);
        ctx.scale(camera.zoom, camera.zoom);
        
        for (const pocket of pocketCache) {
            const pulse = Math.sin(now / 500) * 0.3 + 0.7;
            for (const pos of pocket.cells) {
                const [x, y] = pos.split(',').map(Number);
                ctx.strokeStyle = pocket.isEnemy ? `rgba(255,30,30,${pulse})` : `rgba(255,200,0,${pulse})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                ctx.setLineDash([]);
            }
        }
        ctx.restore();
    }
    
    renderDynamicLayer(visible, now);
}

// ✅ ДИНАМИЧЕСКИЙ СЛОЙ (юниты, ховер)
function renderDynamicLayer(visible, now) {
    const units = getUnits();
    const myId = getMyCountryId();
    const selectedUnitId = getSelectedUnitId();
    const gridData = getGridData();
    const { startX, endX, startY, endY } = visible;
    
    ctx.save();
    ctx.translate(canvas.width/2 - camera.x * camera.zoom, canvas.height/2 - camera.y * camera.zoom);
    ctx.scale(camera.zoom, camera.zoom);
    
    // ✅ ТОЛЬКО ВИДИМЫЕ ЮНИТЫ
    for (const u of units) {
        if (!u?.pos) continue;
        const [ux, uy] = u.pos.split(',').map(Number);
        if (ux < startX || ux > endX || uy < startY || uy > endY) continue;
        
        const cx = ux * CELL_SIZE + CELL_SIZE/2;
        const cy = uy * CELL_SIZE + CELL_SIZE/2;
        
        // Путь (только для выбранного)
        if (u.id === selectedUnitId && u.path?.length > 0) {
            const lastStep = u.path[u.path.length - 1];
            if (lastStep) {
                const [ex, ey] = lastStep.split(',').map(Number);
                
                ctx.strokeStyle = 'rgba(255,215,0,0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.arc(ex * CELL_SIZE + CELL_SIZE/2, ey * CELL_SIZE + CELL_SIZE/2, CELL_SIZE * 0.3, 0, Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        // Подсветка
        if (u.id === selectedUnitId) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.strokeRect(ux * CELL_SIZE - 1, uy * CELL_SIZE - 1, CELL_SIZE + 2, CELL_SIZE + 2);
        }
        
        // Иконка
        ctx.font = `${Math.min(14, CELL_SIZE * camera.zoom * 0.7)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        
        if (u.trainingDaysLeft > 0) {
            ctx.globalAlpha = 0.5;
            ctx.fillText('🛠', cx, cy);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillText(u.type === 'tank' ? '🚜' : '💂', cx, cy);
        }
        
        // HP
        if (u.hp != null) {
            const maxHp = u.type === 'tank' ? 50 : 100;
            const hpP = Math.max(0, Math.min(1, u.hp / maxHp));
            const bw = CELL_SIZE * 0.5;
            const bx = ux * CELL_SIZE + (CELL_SIZE - bw)/2;
            const by = uy * CELL_SIZE + CELL_SIZE - 4;
            
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(bx, by, bw, 2);
            ctx.fillStyle = hpP > 0.5 ? '#22c55e' : hpP > 0.25 ? '#eab308' : '#ef4444';
            ctx.fillRect(bx, by, bw * hpP, 2);
        }
    }
    
    // Ховер
    if (hoverCell && gridData[hoverCell]) {
        const [hx, hy] = hoverCell.split(',').map(Number);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(hx * CELL_SIZE, hy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    
    ctx.restore();
}

function updatePocketCache() {
    try {
        const myId = getMyCountryId();
        const wars = window._wars || [];
        if (!myId || !wars.length) { pocketCache = null; return; }
        
        import('./supply.js').then(m => {
            const allPockets = [];
            const countries = [...new Set(Object.values(getGridData()))];
            for (const countryId of countries) {
                const isEnemy = wars.some(w => (w.a === myId && w.b === countryId) || (w.b === myId && w.a === countryId));
                if (!isEnemy && countryId !== myId) continue;
                
                const pockets = m.getPocketsForCountry(countryId);
                for (const p of pockets) {
                    allPockets.push({ ...p, isEnemy: countryId !== myId });
                }
            }
            pocketCache = allPockets.length > 0 ? allPockets : null;
        });
    } catch(e) { pocketCache = null; }
}

export function updateCamera() {
    const keys = window._keys || {};
    const speed = 15 / camera.zoom;
    let moved = false;
    if (keys['KeyW'] || keys['ArrowUp']) { camera.y -= speed; moved = true; }
    if (keys['KeyS'] || keys['ArrowDown']) { camera.y += speed; moved = true; }
    if (keys['KeyA'] || keys['ArrowLeft']) { camera.x -= speed; moved = true; }
    if (keys['KeyD'] || keys['ArrowRight']) { camera.x += speed; moved = true; }
    if (moved) renderMap();
}

export function setupMapEvents() {
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const before = screenToWorld(e.clientX, e.clientY);
        camera.zoom = Math.min(Math.max(camera.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.05), 10);
        const after = screenToWorld(e.clientX, e.clientY);
        camera.x += before.x - after.x;
        camera.y += before.y - after.y;
        tileCache.clear();
        renderMap();
    }, { passive: false });

    canvas.addEventListener('mousemove', e => {
        const world = screenToWorld(e.clientX, e.clientY);
        const nh = `${world.x},${world.y}`;
        if (getGridData()[nh] !== undefined && hoverCell !== nh) {
            hoverCell = nh;
            renderMap();
        } else if (!getGridData()[nh] && hoverCell) {
            hoverCell = null;
            renderMap();
        }
    });

    canvas.addEventListener('mouseleave', () => { hoverCell = null; renderMap(); });

    window._keys = {};
    window.addEventListener('keydown', e => { window._keys[e.code] = true; });
    window.addEventListener('keyup', e => { window._keys[e.code] = false; });

    setInterval(updateCamera, 1000/30);
}

resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); renderMap(); });
