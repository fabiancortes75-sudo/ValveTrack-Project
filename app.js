/**
 * ValveTrack App Logic - Dynamic Version
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwAtDuvWDTVcZ2zy1dHmq0VkY4aRIdG24XT6gfb0gQAffLqQbUMMCNyAOsWZQ5stavshA/exec';

const state = {
    valves: [],
    loading: true,
    currentView: 'dashboard',
    currentAssetType: 'PSV',
    searchQuery: '',
    editingId: null
};

// --- Data Fetching & Sync ---

async function fetchValveData() {
    state.loading = true;
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');

    try {
        const response = await fetch(API_URL);
        const jsonData = await response.json();

        // Map the JSON data from the Sheet to our app format
        state.valves = jsonData.map((item, index) => {
            const keys = Object.keys(item);
            const findKey = (subs) => {
                for (let sub of subs) {
                    const found = keys.find(k => k.toLowerCase().includes(sub.toLowerCase()));
                    if (found) return found;
                }
                return null;
            };

            const erpIdKey = findKey(["ID_ERP", "erpId"]);
            const equipmentKey = findKey(["Equipo", "Equipement"]);
            const stateKey = findKey(["Validación", "Cumplimiento", "Estado"]);
            const scheduledKey = findKey(["Próx. Mantenimiento", "Fecha Programada", "Programado"]);
            const lastDateKey = findKey(["Ultimo Mantenimiento", "Última Calibración", "Vencimiento"]);
            const areaKey = findKey(["Área Area", "Ubicación", "Area"]);
            const basinKey = findKey(["Zona/Activo", "Cuenca", "Zona"]);
            const jotformKey = findKey(["Crear Reporte", "JotForm", "Reporte"]);
            const typeKey = findKey(["Tipo", "Asset Type", "Clase"]);

            const formatSheetDate = (d) => {
                if (!d) return '';
                if (typeof d === 'string' && d.includes('T')) {
                    const date = new Date(d);
                    const day = String(date.getUTCDate()).padStart(2, '0');
                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const year = date.getUTCFullYear();
                    return `${day}/${month}/${year}`;
                }
                return d;
            };

            const typeVal = (item[typeKey] || '').toString().toUpperCase();
            const equipmentName = (item[equipmentKey] || '').toString().toUpperCase();

            // Normalize asset type to match our buttons (PSV, VPV, FSV)
            let normalizedType = 'PSV'; // Default
            if (typeVal.includes('VPV') || equipmentName.includes('VPV')) normalizedType = 'VPV';
            else if (typeVal.includes('FSV') || equipmentName.includes('FSV')) normalizedType = 'FSV';
            else if (typeVal.includes('PSV') || equipmentName.includes('PSV')) normalizedType = 'PSV';
            else if (typeVal !== '') normalizedType = 'PSV'; // Fallback for other types

            return {
                id: item[erpIdKey] || index,
                index: index,
                assetType: normalizedType,
                operationalStatus: item[findKey(["Condición Operativa", "Estado del Activo"])] || item["Estado"],
                calibrationStatus: item[findKey(["Estado / Acción", "Acción de Calibración"])],
                state: (item[stateKey] || '').toString().toUpperCase(),
                lastDate: formatSheetDate(item[lastDateKey]),
                scheduledDate: formatSheetDate(item[scheduledKey]),
                basin: item[basinKey] || "N/A",
                area: item[areaKey] || item["Ubicación"],
                equipment: item[equipmentKey],
                erpId: item[erpIdKey],
                jotform: item[jotformKey],
                setPoint: item[findKey(["Set Point"])],
                frequency: item[findKey(["Frecuencia"])]
            };
        }).filter(v => (v.erpId || v.equipment) && v.equipment !== 'undefined');

        state.loading = false;
        if (loader) loader.classList.add('hidden');
        render();
    } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback for demo if API fails or CORS issues in local file
        if (state.valves.length === 0) {
            console.log("Using fallback data for demonstration...");
            state.valves = [
                { id: '10078830', erpId: '10078830', equipment: 'DESCARGA DE BBA P-1001-B', state: 'VIGENTE', scheduledDate: '25/09/2026', area: 'Barda Las Vegas', basin: 'AUSTRAL 1' },
                { id: '10078833', erpId: '10078833', equipment: 'P-1002. BOMBA DE BOOSTER', state: 'VENCIDO', scheduledDate: '27/07/2024', area: 'Barda Las Vegas', basin: 'AUSTRAL 1' }
            ];
        }
        state.loading = false;
        if (loader) loader.classList.add('hidden');
        render();
    }
}

async function updateValveOnSheet(id, updates) {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');

    try {
        // We use a proxy or handle the POST to Apps Script
        // Note: Apps Script POST often requires a redirect handle which fetch handles, 
        // but it might have CORS issues from a local file.
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                id: id,
                updates: updates
            })
        });

        // Optimization: Update local state immediately for responsiveness
        const valve = state.valves.find(v => v.id == id);
        if (valve) {
            Object.keys(updates).forEach(key => {
                if (key === "Fecha Programada") valve.scheduledDate = updates[key];
                if (key === "Cumplimiento") valve.state = updates[key];
            });
        }

        setTimeout(() => {
            fetchValveData();
            closeModal();
        }, 1000);

    } catch (error) {
        console.error('Error updating data:', error);
        // Even if fetch fails due to CORS, the update might have reached the Sheet
        // We refresh locally to be sure
        setTimeout(() => {
            fetchValveData();
            closeModal();
        }, 1000);
    }
}

// --- UI Logic ---

function openEditModal(id) {
    const valve = state.valves.find(v => v.id == id);
    if (!valve) return;

    state.editingId = id;
    document.getElementById('edit-erp-id').value = valve.erpId || '';
    document.getElementById('edit-equipment').value = valve.equipment || '';
    document.getElementById('edit-state').value = valve.state || 'VIGENTE';
    document.getElementById('edit-date').value = formatDateForInput(valve.scheduledDate);

    document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    state.editingId = null;
}

function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    // Expected dd/mm/yyyy
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// --- View Rendering ---

function render() {
    const container = document.getElementById('view-container');
    if (!container) return;

    // First filter by active asset type
    const typeFilteredValves = state.valves.filter(v => v.assetType === state.currentAssetType);

    // Then apply search on the type-filtered list
    const filteredValves = typeFilteredValves.filter(v =>
        (v.equipment || '').toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        (v.erpId || '').toString().toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        (v.area || '').toLowerCase().includes(state.searchQuery.toLowerCase())
    );

    // Update page subtitle
    const subtitleEl = document.getElementById('page-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = `Monitoreo de estado de válvulas ${state.currentAssetType}`;
    }

    if (state.currentView === 'dashboard') {
        renderDashboard(container, typeFilteredValves);
    } else if (state.currentView === 'inventory') {
        renderInventory(container, filteredValves);
    } else if (state.currentView === 'alerts') {
        renderAlerts(container, filteredValves);
    }

    lucide.createIcons();
    updateAlertBadge();
    attachEventListeners();
}

function renderDashboard(container, valves) {
    const total = valves.length;
    const vigente = valves.filter(v => v.state === 'VIGENTE').length;
    const vencido = valves.filter(v => v.state === 'VENCIDO').length;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Total Válvulas</span>
                    <i data-lucide="activity"></i>
                </div>
                <div class="stat-value">${total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Vigentes</span>
                    <i data-lucide="check-circle" style="color: var(--success)"></i>
                </div>
                <div class="stat-value">${vigente}</div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-label">Vencidas</span>
                    <i data-lucide="alert-octagon" style="color: var(--danger)"></i>
                </div>
                <div class="stat-value">${vencido}</div>
            </div>
        </div>

        <div class="dashboard-content-row">
            <div class="data-card chart-section">
                <div class="table-header">
                    <h3>Estado General</h3>
                </div>
                <div style="padding: 1.5rem; display: flex; justify-content: center; align-items: center; min-height: 250px;">
                     <canvas id="mainChart" style="max-width: 250px;"></canvas>
                </div>
            </div>
            <div class="data-card upcoming-section">
                <div class="table-header">
                    <h3>Próximos Mantenimientos</h3>
                </div>
                <ul id="upcoming-list" class="maint-list">
                    <!-- Injected -->
                </ul>
            </div>
        </div>
    `;

    renderChart(vigente, vencido);
    renderUpcomingList(valves);
}

function renderInventory(container, valves) {
    container.innerHTML = `
        <div class="data-card">
            <div class="table-header">
                <h3>Listado de Equipos</h3>
                <div class="badge">${valves.length} equipos</div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ERP ID</th>
                            <th>Equipo</th>
                            <th>Estado</th>
                            <th>Programado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${valves.map(v => `
                            <tr>
                                <td style="font-family: monospace; font-weight: 600;">${v.erpId || 'N/A'}</td>
                                <td>
                                    <div style="font-weight: 600;">${v.equipment || 'Desconocido'}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary)">${v.basin} - ${v.area}</div>
                                </td>
                                <td><span class="status-badge status-${(v.state || '').toLowerCase()}">${v.state || 'N/A'}</span></td>
                                <td>${v.scheduledDate || '---'}</td>
                                <td>
                                    <div class="action-group">
                                        <button class="icon-btn edit-valve" data-id="${v.id}" title="Editar">
                                            <i data-lucide="edit-3"></i>
                                        </button>
                                        <a href="${v.jotform}" target="_blank" class="icon-btn" title="Abrir JotForm">
                                            <i data-lucide="external-link"></i>
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAlerts(container, valves) {
    const expired = valves.filter(v => v.state === 'VENCIDO');

    container.innerHTML = `
        <div class="data-card">
            <div class="table-header">
                <h3 style="color: var(--danger)">Alertas Críticas (Vencidas)</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>ERP ID</th>
                            <th>Equipo</th>
                            <th>Vencimiento</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expired.map(v => `
                            <tr>
                                <td>${v.erpId}</td>
                                <td>${v.equipment}</td>
                                <td style="color: var(--danger); font-weight: 700;">${v.scheduledDate}</td>
                                <td>
                                    <button class="action-link edit-valve" data-id="${v.id}">
                                        <i data-lucide="refresh-cw"></i> Actualizar
                                    </button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 3rem;">No hay alertas críticas en este momento.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// --- Helpers ---

function renderChart(vigente, vencido) {
    const canvas = document.getElementById('mainChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Vigente', 'Vencido'],
            datasets: [{
                data: [vigente, vencido],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } } }
            },
            cutout: '70%',
            maintainAspectRatio: false
        }
    });
}

function renderUpcomingList(valves) {
    const list = document.getElementById('upcoming-list');
    if (!list) return;

    const upcoming = valves
        .filter(v => v.state === 'VIGENTE' && v.scheduledDate)
        .sort((a, b) => {
            const dateA = new Date(a.scheduledDate.split('/').reverse().join('-'));
            const dateB = new Date(b.scheduledDate.split('/').reverse().join('-'));
            return dateA - dateB;
        })
        .slice(0, 5);

    list.innerHTML = upcoming.map(v => `
        <li class="maint-item">
            <div>
                <div class="maint-name">${v.equipment}</div>
                <div class="maint-sub">ERP: ${v.erpId}</div>
            </div>
            <div class="maint-date-box">
                <div class="maint-date">${v.scheduledDate}</div>
                <div class="maint-label">Próximo</div>
            </div>
        </li>
    `).join('') || '<p style="padding: 2rem; color: var(--text-secondary); text-align: center;">No hay mantenimientos próximos.</p>';
}

function updateAlertBadge() {
    const expiredCount = state.valves.filter(v => v.state === 'VENCIDO').length;
    const badge = document.getElementById('alert-count');
    if (badge) {
        badge.textContent = expiredCount;
        badge.style.display = expiredCount > 0 ? 'inline-block' : 'none';
    }
}

function attachEventListeners() {
    document.querySelectorAll('.edit-valve').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
}

// --- Init & Root Events ---

document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentView = btn.dataset.view;

        const titleMap = {
            'dashboard': 'Dashboard',
            'inventory': 'Inventario de Válvulas',
            'alerts': 'Alertas Críticas'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = titleMap[state.currentView];
        render();
    });
});

document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentAssetType = btn.dataset.type;
        render();
    });
});

const globalSearch = document.getElementById('global-search');
if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        render();
    });
}

const editForm = document.getElementById('edit-form');
if (editForm) {
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = state.editingId;
        const dateVal = document.getElementById('edit-date').value;

        // Convert yyyy-mm-dd to dd/mm/yyyy
        const parts = dateVal.split('-');
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;

        const updates = {
            "Fecha Programada": formattedDate,
            "Cumplimiento": document.getElementById('edit-state').value,
            "Acción de Calibración": document.getElementById('edit-state').value === 'VENCIDO' ? 'CALIBRAR' : 'CALIBRADO'
        };

        updateValveOnSheet(id, updates);
    });
}

const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

window.addEventListener('DOMContentLoaded', fetchValveData);
