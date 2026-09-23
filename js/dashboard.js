import { getSession, signOut } from './supabase-client.js';

const API = 'https://seculo-api.vercel.app';

// ── Bootstrap ──────────────────────────────────────────────
const session = await getSession();
if (!session) {
  window.location.href = 'login.html';
}

const { access_token, refresh_token, user } = session;
const tier = user?.user_metadata?.tier || 'free';
const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Explorer';

document.getElementById('navUser').style.display = 'flex';
document.getElementById('navUserName').textContent = name;
document.getElementById('signOutBtn').addEventListener('click', () => signOut());

const tierBadge = document.getElementById('tierBadge');
tierBadge.textContent = tier;
tierBadge.style.display = 'inline-block';

// Engine link — los tokens se generan EN EL CLIC, no al cargar la página:
// el access_token dura 1 h y el refresh_token rota; un enlace construido al
// cargar enviaba tokens muertos y el engine caía al tier free (visto en la
// demo del 28-ago y a diario por David, 01-sep-2026). getSession() de la SDK
// refresca automáticamente la sesión si está vencida.
async function goToEngine(e) {
  e.preventDefault();
  const s = await getSession();
  if (!s) { window.location.href = 'login.html'; return; }
  const t = s.user?.user_metadata?.tier || tier || 'free';
  window.location.href = `${API}/?load_saved=1#access_token=${encodeURIComponent(s.access_token)}&refresh_token=${encodeURIComponent(s.refresh_token)}&tier=${t}`;
}
// TODOS los enlaces del dashboard hacia el engine (Ver no mapa, Abrir Motor,
// Começar a explorar…) pasan por el mismo flujo: sin esto, los estáticos
// mandaban al engine sin credenciales y salía la versión free (David, 01-sep).
document.querySelectorAll('a[href^="https://seculo-api.vercel.app"]').forEach(a =>
  a.addEventListener('click', goToEngine));

// ── State ──────────────────────────────────────────────────
let properties = [];
let folders    = [];
let activeFolderId = null; // null=All, 'unfiled'=no folder, uuid=folder

// Report (PDF) — declarado aquí, en el nivel superior, para que initDashboard()
// y buildCard() lo vean sin TDZ. El flujo se construyó en mayo-junio de 2026 y
// desapareció del dashboard con el release del rediseño (084d2ae, 26-ago-2026);
// el back (/api/generate-report) siguió funcionando todo el tiempo.
// Restaurado 23-sep-2026. Mismos tiers que api/generate-report.js.
const REPORT_TIERS = new Set(['agency', 'professional', 'pro_investor', 'admin',
                              'lifestyle_match', 'business_match', 'investment_match']);
const canReport = REPORT_TIERS.has(tier);
const selectedForReport = new Set();
const _reportMaps     = {};
const _reportMarkers  = {};
const _reportGeoData  = {};
const _debounceTimers = {};
const REPORT_MAX = 5;

// ── Load data ──────────────────────────────────────────────
try {
  const [propsRes, foldsRes] = await Promise.all([
    fetch(`${API}/api/my-properties`, { headers: { Authorization: `Bearer ${access_token}` } }),
    fetch(`${API}/api/folders`,       { headers: { Authorization: `Bearer ${access_token}` } }),
  ]);
  if (propsRes.ok) { const d = await propsRes.json(); properties = d.properties || []; }
  if (foldsRes.ok) { const d = await foldsRes.json(); folders = d.folders || []; }
} catch (e) {
  console.error('Failed to load dashboard data', e);
}


// ── Folder sidebar ─────────────────────────────────────────
function countInFolder(fid) {
  if (fid === null) return properties.length;
  if (fid === 'unfiled') return properties.filter(p => !p.folder_id).length;
  return properties.filter(p => p.folder_id === fid).length;
}

function renderFolderSidebar() {
  const sidebar = document.getElementById('foldSidebar');
  if (properties.length === 0) { sidebar.style.display = 'none'; return; }
  sidebar.style.display = '';
  sidebar.innerHTML = '';

  const t = getT();

  const title = document.createElement('div');
  title.className = 'fold-sidebar-title';
  title.textContent = t.folders.title;
  sidebar.appendChild(title);

  sidebar.appendChild(makeFoldItem(null, '', t.folders.all, countInFolder(null)));

  const unfiledCount = countInFolder('unfiled');
  if (folders.length > 0 || unfiledCount < properties.length) {
    sidebar.appendChild(makeFoldItem('unfiled', '', t.folders.unfiled, unfiledCount));
  }

  const topFolders = folders.filter(f => !f.parent_id);
  if (topFolders.length > 0) {
    const hr = document.createElement('hr');
    hr.className = 'fold-divider';
    sidebar.appendChild(hr);

    for (const f of topFolders) {
      sidebar.appendChild(makeFoldItem(f.id, '', f.name, countInFolder(f.id), f));
      const subs = folders.filter(s => s.parent_id === f.id);
      for (const s of subs) {
        sidebar.appendChild(makeFoldItem(s.id, '', s.name, countInFolder(s.id), s, true));
      }
    }
  }

  const hr2 = document.createElement('hr');
  hr2.className = 'fold-divider';
  sidebar.appendChild(hr2);

  const newBtn = document.createElement('button');
  newBtn.className = 'fold-new-btn';
  newBtn.innerHTML = `<span>+</span> <span>${t.folders.newFolder}</span>`;
  newBtn.addEventListener('click', () => promptCreateFolder());
  sidebar.appendChild(newBtn);
}

function makeFoldItem(fid, icon, label, count, folderObj, isSub) {
  const el = document.createElement('div');
  el.className = 'fold-item' + (isSub ? ' sub' : '') + (activeFolderId === fid ? ' active' : '');

  const iconEl = document.createElement('span');
  iconEl.className = 'fold-item-icon';
  iconEl.textContent = icon;

  const nameEl = document.createElement('span');
  nameEl.className = 'fold-item-name';
  nameEl.textContent = label;

  const countEl = document.createElement('span');
  countEl.className = 'fold-item-count';
  countEl.textContent = count;

  el.appendChild(iconEl);
  el.appendChild(nameEl);
  el.appendChild(countEl);

  if (folderObj) {
    const kebab = document.createElement('button');
    kebab.className = 'fold-kebab';
    kebab.title = 'Options';
    kebab.innerHTML = '&#8942;';
    kebab.addEventListener('click', (e) => { e.stopPropagation(); showFolderMenu(folderObj, kebab); });
    el.appendChild(kebab);
  }

  el.addEventListener('click', () => setActiveFolder(fid));
  return el;
}

function setActiveFolder(fid) {
  activeFolderId = fid;
  renderFolderSidebar();
  renderDashGrid();
}

function showFolderMenu(folder, anchor) {
  document.getElementById('_foldMenu')?.remove();
  const t = getT();

  const menu = document.createElement('div');
  menu.id = '_foldMenu';
  menu.style.cssText = 'position:fixed;background:var(--brand-light);border:1px solid var(--color-divider);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:9000;min-width:140px;padding:0.4rem 0;font-size:0.84rem;font-family:var(--font-body);';

  const rect = anchor.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(8, rect.left - 100) + 'px';

  const makeItem = (label, color, onClick) => {
    const item = document.createElement('div');
    item.style.cssText = `padding:0.5rem 1rem;cursor:pointer;color:${color || 'inherit'};`;
    item.textContent = label;
    item.addEventListener('mouseenter', () => item.style.background = 'var(--color-raised)');
    item.addEventListener('mouseleave', () => item.style.background = '');
    item.addEventListener('click', () => { menu.remove(); onClick(); });
    return item;
  };

  menu.appendChild(makeItem(t.folders.rename, null, () => promptRenameFolder(folder)));
  menu.appendChild(makeItem(t.folders.delete, 'var(--brand-terracotta)', () => confirmDeleteFolder(folder)));

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
}

// ── Folder CRUD ────────────────────────────────────────────
async function promptCreateFolder(parentId) {
  const t = getT();
  const rawName = window.prompt(t.folders.newFolderPrompt, '');
  if (!rawName || !rawName.trim()) return;

  try {
    const res = await fetch(`${API}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({ name: rawName.trim(), parent_id: parentId || null }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const folder = await res.json();
    folders.push(folder);
    renderFolderSidebar();
    document.querySelectorAll('.prop-folder-select').forEach(sel => addFolderOption(sel, folder));
    showToast(folder.name);
  } catch (e) {
    showToast('Could not create folder');
  }
}

async function promptRenameFolder(folder) {
  const t = getT();
  const rawName = window.prompt(t.folders.renamePrompt, folder.name);
  if (!rawName || !rawName.trim() || rawName.trim() === folder.name) return;

  try {
    const res = await fetch(`${API}/api/folders?id=${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({ name: rawName.trim() }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    folder.name = rawName.trim();
    renderFolderSidebar();
    document.querySelectorAll(`.prop-folder-select option[value="${folder.id}"]`).forEach(opt => {
      opt.textContent = folder.name;
    });
    showToast(t.toastRenamed);
  } catch (e) {
    showToast('Could not rename folder');
  }
}

async function confirmDeleteFolder(folder) {
  const t = getT();
  if (!window.confirm(t.folders.deleteConfirm.replace('{name}', folder.name))) return;

  try {
    const res = await fetch(`${API}/api/folders?id=${folder.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    folders = folders.filter(f => f.id !== folder.id);
    properties.forEach(p => { if (p.folder_id === folder.id) p.folder_id = null; });
    if (activeFolderId === folder.id) activeFolderId = null;
    renderFolderSidebar();
    renderDashGrid();
    document.querySelectorAll(`.prop-folder-select option[value="${folder.id}"]`).forEach(opt => opt.remove());
    showToast(t.toastDeleted);
  } catch (e) {
    showToast('Could not delete folder');
  }
}

// ── Grid ───────────────────────────────────────────────────
function getFilteredProps() {
  if (activeFolderId === null) return properties;
  if (activeFolderId === 'unfiled') return properties.filter(p => !p.folder_id);
  return properties.filter(p => p.folder_id === activeFolderId);
}

function initDashboard() {
  if (properties.length === 0) {
    document.getElementById('foldSidebar').style.display = 'none';
    document.getElementById('dashGrid').style.display = 'none';
    document.getElementById('dashEmpty').style.display = 'block';
    document.getElementById('dashMeta').textContent = '';
    document.getElementById('copyAllBtn').style.display = 'none';
  } else {
    document.getElementById('copyAllBtn').style.display = '';
    renderFolderSidebar();
    renderDashGrid();
  }
  updateReportBtn();
}

function renderDashGrid() {
  const grid     = document.getElementById('dashGrid');
  const empty    = document.getElementById('dashEmpty');
  const emptyFld = document.getElementById('dashEmptyFolder');
  const meta     = document.getElementById('dashMeta');

  grid.innerHTML = '';
  empty.style.display    = 'none';
  emptyFld.style.display = 'none';

  if (properties.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    meta.textContent = '';
    return;
  }

  const filtered = getFilteredProps();

  if (filtered.length === 0) {
    grid.style.display = 'none';
    emptyFld.style.display = 'block';
    meta.textContent = '';
    if (window.applyCurrentLang) window.applyCurrentLang();
    return;
  }

  grid.style.display = 'grid';
  filtered.forEach(prop => grid.appendChild(buildCard(prop)));

  const t = getT();
  meta.textContent = `${filtered.length} ${filtered.length === 1 ? t.propSingular : t.propPlural}`;

  if (window.applyCurrentLang) window.applyCurrentLang();
}

// Re-render when language changes
document.addEventListener('seculo-lang-change', function () {
  if (properties.length > 0) { renderFolderSidebar(); renderDashGrid(); }
});

// ── Translations ───────────────────────────────────────────
const CARD_T = {
  en: {
    status: { interested: 'Interested', visited: 'Visited', discarded: 'Discarded', saved: 'Saved' },
    view: 'View listing',
    copy: 'Copy link',
    del:  'Delete',
    expired:     'Link expired',
    expires_in:  (n) => `Link expires in ${n} day${n === 1 ? '' : 's'}`,
    expires_on:  (d) => `Link expires ${d}`,
    bed: 'bed',
    propSingular: 'saved property',
    propPlural:   'saved properties',
    folderNone:  'No folder',
    toastRenamed: 'Folder renamed',
    toastDeleted: 'Folder deleted',
    toastUpdated: 'Status updated',
    toastMoved:   'Moved',
    report: {
      manual: 'Confirmed manually on the map', adjust: 'Adjust on map', adjustDone: 'Done', mapHint: 'Drag the pin or click on the map to set the exact location.',
      add: 'Add to report', inReport: 'In report', max: 'Maximum 5 properties per report',
      btn: 'Generate report', btnHint0: 'Click "Add to report" on a property card', btnHint: (n) => `Generate PDF with ${n} propert${n === 1 ? 'y' : 'ies'}`,
      title: 'Verify property addresses',
      body: 'Each property needs a confirmed address to place the isochrone and walkability analysis correctly on the map. The address has been pre-filled from the portal: review each one and correct it if needed. The map updates automatically.',
      label: 'Address (edit if incorrect)', ph: 'Street, number, city — Portugal',
      legend: 'Green = address found precisely · Yellow = street level · Red = not found, please correct. Drag the pin or click on the map to set the exact location.',
      cancel: 'Cancel', generate: 'Generate report', geocoding: 'Geocoding…', notFound: 'Not found',
      approx: 'Approximate (confirm address)', building: 'Building-level', street: 'Street-level', approxShort: 'Approximate',
      generating: 'Generating PDF…', stages: ['Connecting to report server…', 'Fetching isochrones…', 'Generating maps…', 'Building pages…', 'Rendering PDF…', 'Finalizing…'],
      left: (s) => ` — ~${s}s left`, ready: 'PDF ready — downloading…', failed: 'Generation failed',
      done: 'Report generated — check your downloads folder', error: 'Error generating report: ',
    },
    folders: {
      title:         'Folders',
      all:           'All',
      unfiled:       'Unfiled',
      newFolder:     'New folder',
      newFolderPrompt: 'Folder name:',
      renamePrompt:  'New name:',
      deleteConfirm: 'Delete folder "{name}"? Properties will become unfiled.',
      rename:        'Rename',
      delete:        'Delete folder',
    },
  },
  pt: {
    status: { interested: 'Interessado', visited: 'Visitado', discarded: 'Descartado', saved: 'Guardado' },
    view: 'Ver anúncio',
    copy: 'Copiar link',
    del:  'Apagar',
    expired:     'Link expirado',
    expires_in:  (n) => `Link expira em ${n} dia${n === 1 ? '' : 's'}`,
    expires_on:  (d) => `Link expira ${d}`,
    bed: 'qto',
    propSingular: 'propriedade guardada',
    propPlural:   'propriedades guardadas',
    folderNone:  'Sem pasta',
    toastRenamed: 'Pasta renomeada',
    toastDeleted: 'Pasta eliminada',
    toastUpdated: 'Estado atualizado',
    toastMoved:   'Movido',
    report: {
      manual: 'Confirmado manualmente no mapa', adjust: 'Ajustar no mapa', adjustDone: 'Concluir', mapHint: 'Arraste o pino ou clique no mapa para fixar a localização exata.',
      add: 'Adicionar ao relatório', inReport: 'No relatório', max: 'Máximo de 5 imóveis por relatório',
      btn: 'Gerar relatório', btnHint0: 'Clique em "Adicionar ao relatório" num cartão', btnHint: (n) => `Gerar PDF com ${n} ${n === 1 ? 'imóvel' : 'imóveis'}`,
      title: 'Verifique os endereços dos imóveis',
      body: 'Cada imóvel precisa de um endereço confirmado para colocar a isócrona e a análise de walkability corretamente no mapa. O endereço foi pré-preenchido com os dados do portal: reveja cada um e corrija se necessário. O mapa atualiza automaticamente.',
      label: 'Endereço (edite se necessário)', ph: 'Rua, número, cidade — Portugal',
      legend: 'Verde = endereço encontrado com precisão · Amarelo = nível de rua · Vermelho = não encontrado, corrija. Arraste o pino ou clique no mapa para fixar a localização exata.',
      cancel: 'Cancelar', generate: 'Gerar relatório', geocoding: 'A geocodificar…', notFound: 'Não encontrado',
      approx: 'Aproximado (confirme o endereço)', building: 'Nível de edifício', street: 'Nível de rua', approxShort: 'Aproximado',
      generating: 'A gerar PDF…', stages: ['A ligar ao servidor de relatórios…', 'A obter isócronas…', 'A gerar mapas…', 'A construir páginas…', 'A renderizar PDF…', 'A finalizar…'],
      left: (s) => ` — ~${s}s restantes`, ready: 'PDF pronto — a transferir…', failed: 'A geração falhou',
      done: 'Relatório gerado — veja a pasta de transferências', error: 'Erro ao gerar o relatório: ',
    },
    folders: {
      title:         'Pastas',
      all:           'Todas',
      unfiled:       'Sem pasta',
      newFolder:     'Nova pasta',
      newFolderPrompt: 'Nome da pasta:',
      renamePrompt:  'Novo nome:',
      deleteConfirm: 'Eliminar pasta "{name}"? As propriedades ficarão sem pasta.',
      rename:        'Renomear',
      delete:        'Eliminar pasta',
    },
  },
  es: {
    status: { interested: 'Interesado', visited: 'Visitado', discarded: 'Descartado', saved: 'Guardado' },
    view: 'Ver anuncio',
    copy: 'Copiar link',
    del:  'Eliminar',
    expired:     'Link expirado',
    expires_in:  (n) => `Link expira en ${n} día${n === 1 ? '' : 's'}`,
    expires_on:  (d) => `Link expira ${d}`,
    bed: 'hab',
    propSingular: 'propiedad guardada',
    propPlural:   'propiedades guardadas',
    folderNone:  'Sin carpeta',
    toastRenamed: 'Carpeta renombrada',
    toastDeleted: 'Carpeta eliminada',
    toastUpdated: 'Estado actualizado',
    toastMoved:   'Movido',
    report: {
      manual: 'Confirmada manualmente en el mapa', adjust: 'Ajustar en el mapa', adjustDone: 'Listo', mapHint: 'Arrastra el pin o haz clic en el mapa para fijar la ubicación exacta.',
      add: 'Añadir al informe', inReport: 'En el informe', max: 'Máximo 5 propiedades por informe',
      btn: 'Generar informe', btnHint0: 'Pulsa "Añadir al informe" en una tarjeta', btnHint: (n) => `Generar PDF con ${n} propiedad${n === 1 ? '' : 'es'}`,
      title: 'Verifica las direcciones de las propiedades',
      body: 'Cada propiedad necesita una dirección confirmada para colocar correctamente la isócrona y el análisis de caminabilidad en el mapa. La dirección se ha rellenado con los datos del portal: revisa cada una y corrígela si es necesario. El mapa se actualiza automáticamente.',
      label: 'Dirección (edita si es incorrecta)', ph: 'Calle, número, ciudad — Portugal',
      legend: 'Verde = dirección encontrada con precisión · Amarillo = nivel de calle · Rojo = no encontrada, corrígela. Arrastra el pin o haz clic en el mapa para fijar la ubicación exacta.',
      cancel: 'Cancelar', generate: 'Generar informe', geocoding: 'Geocodificando…', notFound: 'No encontrada',
      approx: 'Aproximada (confirma la dirección)', building: 'Nivel de edificio', street: 'Nivel de calle', approxShort: 'Aproximada',
      generating: 'Generando PDF…', stages: ['Conectando con el servidor de informes…', 'Obteniendo isócronas…', 'Generando mapas…', 'Construyendo páginas…', 'Renderizando PDF…', 'Finalizando…'],
      left: (s) => ` — ~${s}s restantes`, ready: 'PDF listo — descargando…', failed: 'La generación falló',
      done: 'Informe generado — revisa tu carpeta de descargas', error: 'Error al generar el informe: ',
    },
    folders: {
      title:         'Carpetas',
      all:           'Todas',
      unfiled:       'Sin carpeta',
      newFolder:     'Nueva carpeta',
      newFolderPrompt: 'Nombre de la carpeta:',
      renamePrompt:  'Nuevo nombre:',
      deleteConfirm: 'Eliminar carpeta "{name}"? Las propiedades quedarán sin carpeta.',
      rename:        'Renombrar',
      delete:        'Eliminar carpeta',
    },
  },
};

function getT() {
  return CARD_T[window.getCurrentLang ? window.getCurrentLang() : 'en'] || CARD_T.en;
}

// ── Card builder ───────────────────────────────────────────
function addFolderOption(sel, folder) {
  const opt = document.createElement('option');
  opt.value = folder.id;
  opt.textContent = folder.name;
  sel.appendChild(opt);
}

function buildCard(prop) {
  const t    = getT();
  const d    = prop.property_data || {};
  const img  = d.image || d.img || d.thumbnail || '';
  const title    = d.title || d.address || d.descricao || 'Property';
  const location = [d.freguesia, d.concelho, d.distrito].filter(Boolean).join(', ')
                || d.location || d.cidade || '';
  const price  = d.price != null ? formatPrice(d.price) : '—';
  const area   = d.area   != null ? `${d.area} m²` : '';
  const rooms  = d.rooms  != null ? `${d.rooms} ${t.bed}` : '';
  const portal = d.portal || d.source || '';
  const url    = d.url    || d.link   || '';
  const statusClass = prop.status || 'saved';
  const expiryText  = formatExpiry(prop.expires_at, t);
  const expirySoon  = isExpiringSoon(prop.expires_at);

  const card = document.createElement('div');
  card.className = 'prop-card';
  card.dataset.id = prop.id;

  card.innerHTML = `
    ${img
      ? `<img class="prop-img" src="${escHtml(img)}" alt="${escHtml(title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="prop-img-placeholder" style="display:none;"></div>`
      : `<div class="prop-img-placeholder"></div>`
    }
    <div class="prop-body">
      <div class="prop-top">
        <span class="prop-portal">${escHtml(portal)}</span>
        <select class="prop-status-select ${escHtml(statusClass)}">
          <option value="saved"       ${statusClass==='saved'       ? 'selected' : ''}>${escHtml(t.status.saved)}</option>
          <option value="interested"  ${statusClass==='interested'  ? 'selected' : ''}>${escHtml(t.status.interested)}</option>
          <option value="visited"     ${statusClass==='visited'     ? 'selected' : ''}>${escHtml(t.status.visited)}</option>
          <option value="discarded"   ${statusClass==='discarded'   ? 'selected' : ''}>${escHtml(t.status.discarded)}</option>
        </select>
      </div>
      <div class="prop-title">${escHtml(title)}</div>
      ${location ? `<div class="prop-location">${escHtml(location)}</div>` : ''}
      <div class="prop-price">${price}</div>
      ${(area || rooms) ? `<div class="prop-details">${[rooms, area].filter(Boolean).join(' · ')}</div>` : ''}
      ${prop.notes ? `<div class="prop-notes">${escHtml(prop.notes)}</div>` : ''}
      ${expiryText ? `<div class="prop-expiry${expirySoon ? ' expiring-soon' : ''}">${expiryText}</div>` : ''}
    </div>
    <div class="prop-footer">
      ${url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" class="prop-btn">${t.view}</a>` : ''}
      ${prop.is_public
        ? `<button class="prop-btn share" data-share="${escHtml(prop.id)}">${t.copy}</button>`
        : ''}
      <button class="prop-btn delete" data-delete="${escHtml(prop.id)}">${t.del}</button>
      ${canReport
        ? `<button class="prop-btn report-sel${selectedForReport.has(prop.id) ? ' active' : ''}" data-report="${escHtml(prop.id)}">${selectedForReport.has(prop.id) ? t.report.inReport : t.report.add}</button>`
        : ''}
      ${folders.length > 0
        ? `<div class="prop-folder-wrap"><select class="prop-folder-select${prop.folder_id ? ' has-folder' : ''}" data-prop-id="${escHtml(prop.id)}"></select></div>`
        : ''}
    </div>
  `;

  // Status selector
  const statusSel = card.querySelector('.prop-status-select');
  let _currentStatus = statusClass;
  statusSel.addEventListener('change', async () => {
    const newStatus = statusSel.value;
    statusSel.disabled = true;
    try {
      const res = await fetch(`${API}/api/property/${prop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      statusSel.className = `prop-status-select ${newStatus}`;
      _currentStatus = newStatus;
      prop.status = newStatus;
      showToast(t.toastUpdated);
    } catch (e) {
      statusSel.value = _currentStatus;
      showToast('Could not update — please try again');
    } finally {
      statusSel.disabled = false;
    }
  });

  // Share button
  const shareBtn = card.querySelector('[data-share]');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(`https://seculopt.com/share.html?id=${shareBtn.dataset.share}`)
        .then(() => showToast('Link copied to clipboard'));
    });
  }

  // Delete button
  card.querySelector('[data-delete]').addEventListener('click', () => deleteProperty(prop.id, card));

  // Report selection button
  const reportBtn = card.querySelector('[data-report]');
  if (reportBtn) {
    if (selectedForReport.has(prop.id)) card.classList.add('in-report');
    reportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleReportSelect(prop.id, card, reportBtn);
    });
  }

  // Folder select
  const folderSel = card.querySelector('.prop-folder-select');
  if (folderSel) {
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = t.folderNone;
    folderSel.appendChild(noneOpt);
    folders.forEach(f => addFolderOption(folderSel, f));
    folderSel.value = prop.folder_id || '';

    let _currentFolder = prop.folder_id || '';
    folderSel.addEventListener('change', async () => {
      const newFolderId = folderSel.value || null;
      folderSel.disabled = true;
      try {
        const res = await fetch(`${API}/api/property/${prop.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
          body: JSON.stringify({ folder_id: newFolderId }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        prop.folder_id = newFolderId;
        _currentFolder = folderSel.value;
        folderSel.className = 'prop-folder-select' + (newFolderId ? ' has-folder' : '');
        renderFolderSidebar();
        showToast(t.toastMoved);
      } catch (e) {
        folderSel.value = _currentFolder;
        showToast('Could not move — please try again');
      } finally {
        folderSel.disabled = false;
      }
    });
  }

  return card;
}

// ── Delete ─────────────────────────────────────────────────
async function deleteProperty(id, cardEl) {
  if (!confirm('Remove this property from your saved list?')) return;
  try {
    const res = await fetch(`${API}/api/property/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    cardEl.style.transition = 'opacity 0.3s';
    cardEl.style.opacity = '0';
    setTimeout(() => {
      cardEl.remove();
      properties = properties.filter(p => p.id !== id);
      selectedForReport.delete(id);
      renderFolderSidebar();
      renderDashGrid();
      updateReportBtn();
    }, 300);
  } catch (e) {
    showToast('Could not delete — please try again');
  }
}

// ── Helpers ────────────────────────────────────────────────
function formatPrice(val) {
  if (!val) return '—';
  return '€ ' + Number(val).toLocaleString('pt-PT');
}

function formatExpiry(ts, t) {
  if (!ts) return '';
  if (!t) t = getT();
  const d = new Date(ts);
  const now = new Date();
  if (d < now) return t.expired;
  const diff = Math.ceil((d - now) / 86400000);
  if (diff <= 7) return t.expires_in(diff);
  return t.expires_on(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
}

function isExpiringSoon(ts) {
  if (!ts) return false;
  return (new Date(ts) - new Date()) < 7 * 86400000;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const t = document.getElementById('dashToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Copy all share links ────────────────────────────────────
window.copyAllLinks = function() {
  const source = activeFolderId ? getFilteredProps() : properties;
  const lines = source
    .filter(p => p.is_public)
    .map((p, i) => {
      const d = p.property_data || {};
      const title    = d.title || d.address || d.descricao || 'Propriedade';
      const price    = d.price != null ? '€ ' + Number(d.price).toLocaleString('pt-PT') : '';
      const location = [d.freguesia, d.concelho, d.distrito].filter(Boolean).join(', ')
                    || d.location || d.cidade || '';
      const link = `https://seculopt.com/share.html?id=${p.id}`;
      return [
        `${i + 1}. ${title}${price ? ' — ' + price : ''}`,
        location ? `   ${location}` : '',
        `   ${link}`,
      ].filter(Boolean).join('\n');
    });

  if (!lines.length) { showToast('Nenhuma propriedade para partilhar'); return; }

  const text = `As minhas propriedades no Século Explorador:\n\n${lines.join('\n\n')}\n\nEncontrado em seculopt.com`;
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast(`${lines.length} link${lines.length === 1 ? '' : 's'} copiado${lines.length === 1 ? '' : 's'}!`);
      const btn = document.getElementById('copyAllBtn');
      if (btn) { btn.textContent = 'Copiado!'; setTimeout(() => { btn.innerHTML = 'Copiar todos os links'; }, 2500); }
    })
    .catch(() => showToast('Erro ao copiar — tenta de novo'));
};

// ══════════════════════════════════════════════════════════════
// REPORT (PDF) — selección en tarjetas → confirmación de direcciones → /api/generate-report
// ══════════════════════════════════════════════════════════════

function updateReportBtn() {
  const btn   = document.getElementById('reportBtn');
  const badge = document.getElementById('reportBadge');
  if (!btn) return;
  if (!canReport) { btn.style.display = 'none'; return; }
  const t = getT();
  const count = selectedForReport.size;
  if (badge) { badge.textContent = count; badge.style.display = count ? '' : 'none'; }
  btn.style.display = properties.length > 0 ? '' : 'none';
  btn.disabled = count === 0;
  btn.title = count === 0 ? t.report.btnHint0 : t.report.btnHint(count);
}

function toggleReportSelect(propId, cardEl, btnEl) {
  const t = getT();
  if (selectedForReport.has(propId)) {
    selectedForReport.delete(propId);
    cardEl.classList.remove('in-report');
    btnEl.textContent = t.report.add;
    btnEl.classList.remove('active');
  } else {
    if (selectedForReport.size >= REPORT_MAX) { showToast(t.report.max); return; }
    selectedForReport.add(propId);
    cardEl.classList.add('in-report');
    btnEl.textContent = t.report.inReport;
    btnEl.classList.add('active');
  }
  updateReportBtn();
}

// ── Nominatim geocode ───────────────────────────────────────
async function geocodeForReport(address, concelho) {
  if (!address || address.trim().length < 5) return null;
  const q = [address.trim(), concelho || '', 'Portugal'].filter(Boolean).join(', ');
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pt&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'pt' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name, type: data[0].type };
  } catch { return null; }
}

function geoConfidence(type) {
  if (!type) return 'red';
  if (type === 'manual') return 'green';
  if (['house', 'building', 'apartments', 'residential'].includes(type)) return 'green';
  if (['road', 'street', 'pedestrian', 'path', 'cycleway'].includes(type)) return 'yellow';
  return 'red';
}

function geoLabel(color, type) {
  const t = getT();
  if (type === 'manual')  return t.report.manual;
  if (color === 'green')  return t.report.building;
  if (color === 'yellow') return t.report.street;
  return t.report.approxShort;
}

function updateMiniMap(propId, lat, lng) {
  const map = _reportMaps[propId], marker = _reportMarkers[propId];
  if (!map || !marker) return;
  marker.setLatLng([lat, lng]);
  map.setView([lat, lng], 14, { animate: true });
}

function initMiniMap(propId, containerId, lat, lng) {
  const container = document.getElementById(containerId);
  if (!container || !window.L) return;
  // Mapa interactivo: el agente puede arrastrar el pin o hacer clic para colocarlo
  // (urbanizaciones, caminos rurales y nombres que Nominatim no encuentra).
  const map = window.L.map(container, {
    center: [lat, lng], zoom: 16, zoomControl: true, attributionControl: false,
    dragging: true, scrollWheelZoom: true, doubleClickZoom: false,
  });
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const icon = window.L.divIcon({ className: 'rconf-pin', iconSize: [18, 18], iconAnchor: [9, 9] });
  const marker = window.L.marker([lat, lng], { icon, draggable: true }).addTo(map);
  const placed = (ll) => {
    _reportGeoData[propId] = { lat: ll.lat, lng: ll.lng, display: 'manual', type: 'manual' };
    setGeoStatus(propId, 'green', geoLabel('green', 'manual'));
  };
  marker.on('dragend', () => placed(marker.getLatLng()));
  map.on('click', (e) => { marker.setLatLng(e.latlng); placed(e.latlng); });
  _reportMaps[propId]    = map;
  _reportMarkers[propId] = marker;
}

// Amplía/reduce el mapa de una fila para ajustar el pin con precisión.
window.toggleReportMap = function (propId, btn) {
  const row = document.querySelector(`.rconf-row[data-prop-id="${propId}"]`);
  const map = _reportMaps[propId];
  if (!row) return;
  const t = getT();
  const big = row.classList.toggle('expanded');
  if (btn) btn.textContent = big ? t.report.adjustDone : t.report.adjust;
  if (map) setTimeout(() => { map.invalidateSize(); const m = _reportMarkers[propId]; if (m) map.setView(m.getLatLng(), big ? 17 : 16); }, 50);
};

function setGeoStatus(propId, color, text) {
  const dotEl  = document.getElementById(`geoDot-${propId}`);
  const textEl = document.getElementById(`geoText-${propId}`);
  if (dotEl)  dotEl.className = `rconf-geo-dot ${color}`;
  if (textEl) textEl.textContent = text;
}

// ── Modal ──────────────────────────────────────────────────
window.openReportModal = function () {
  const t = getT();
  if (selectedForReport.size === 0) { showToast(t.report.btnHint0); return; }
  const selectedProps = properties.filter(p => selectedForReport.has(p.id));

  const overlay = document.createElement('div');
  overlay.className = 'report-overlay';
  overlay.id = 'reportOverlay';
  overlay.innerHTML = `
    <div class="report-modal" role="dialog" aria-modal="true">
      <div class="report-modal-head">
        <div>
          <h2>${escHtml(t.report.title)}</h2>
          <p>${escHtml(t.report.body)}</p>
        </div>
        <button class="report-modal-close" aria-label="${escHtml(t.report.cancel)}" onclick="closeReportModal()">&#10005;</button>
      </div>
      <div class="report-modal-body" id="reportModalBody"></div>
      <div class="report-modal-foot">
        <div class="report-modal-foot-note">${escHtml(t.report.legend)}</div>
        <button class="btn btn-outline" onclick="closeReportModal()">${escHtml(t.report.cancel)}</button>
        <button class="btn btn-primary" id="reportConfirmBtn" onclick="confirmReport()">${escHtml(t.report.generate)}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeReportModal(); });

  const body = document.getElementById('reportModalBody');
  const confirmBtn = document.getElementById('reportConfirmBtn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = t.report.geocoding; }

  selectedProps.forEach((prop, idx) => {
    const d         = prop.property_data || {};
    const img       = d.image || d.img || d.thumbnail || '';
    const title     = d.title || d.address || 'Property';
    const knownAddr = [d.address, d.localidade, d.concelho].filter(Boolean).join(', ') || d.location || '';
    const concelho  = d.concelho || '';
    const mapId     = `rmap-${String(prop.id).replace(/-/g, '')}`;

    const row = document.createElement('div');
    row.className = 'rconf-row';
    row.dataset.propId = prop.id;

    const numEl = document.createElement('div');
    numEl.className = 'rconf-num';
    numEl.textContent = String(idx + 1).padStart(2, '0');
    row.appendChild(numEl);

    if (img) {
      const thumbEl = document.createElement('img');
      thumbEl.className = 'rconf-thumb'; thumbEl.src = img; thumbEl.alt = '';
      thumbEl.onerror = function () { this.style.display = 'none'; };
      row.appendChild(thumbEl);
    } else {
      const phEl = document.createElement('div');
      phEl.className = 'rconf-thumb-placeholder';
      row.appendChild(phEl);
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'rconf-body';
    const titleEl = document.createElement('div');
    titleEl.className = 'rconf-title'; titleEl.textContent = title;
    bodyEl.appendChild(titleEl);
    const labelEl = document.createElement('label');
    labelEl.className = 'rconf-label'; labelEl.textContent = t.report.label; labelEl.htmlFor = `rconf-in-${idx}`;
    bodyEl.appendChild(labelEl);
    const inputEl = document.createElement('input');
    inputEl.className = 'rconf-addr-input'; inputEl.type = 'text'; inputEl.id = `rconf-in-${idx}`;
    inputEl.placeholder = t.report.ph; inputEl.value = knownAddr;
    inputEl.dataset.propId = prop.id; inputEl.dataset.concelho = concelho;
    bodyEl.appendChild(inputEl);
    const statusEl = document.createElement('div');
    statusEl.className = 'rconf-geo-status';
    statusEl.innerHTML = `<span class="rconf-geo-dot red" id="geoDot-${prop.id}"></span><span id="geoText-${prop.id}">—</span>`;
    bodyEl.appendChild(statusEl);
    const adjBtn = document.createElement('button');
    adjBtn.type = 'button'; adjBtn.className = 'rconf-adjust'; adjBtn.textContent = t.report.adjust;
    adjBtn.addEventListener('click', () => window.toggleReportMap(prop.id, adjBtn));
    bodyEl.appendChild(adjBtn);
    row.appendChild(bodyEl);

    const mapDiv = document.createElement('div');
    mapDiv.className = 'rconf-map'; mapDiv.id = mapId;
    row.appendChild(mapDiv);
    body.appendChild(row);

    // Re-geocodificar al editar (con debounce)
    inputEl.addEventListener('input', () => {
      clearTimeout(_debounceTimers[prop.id]);
      setGeoStatus(prop.id, 'yellow', t.report.geocoding);
      _debounceTimers[prop.id] = setTimeout(async () => {
        const result = await geocodeForReport(inputEl.value, inputEl.dataset.concelho);
        if (_reportGeoData[prop.id] && _reportGeoData[prop.id].type === 'manual' && !result) { setGeoStatus(prop.id, 'green', geoLabel('green', 'manual')); return; }
        if (result) {
          _reportGeoData[prop.id] = result;
          updateMiniMap(prop.id, result.lat, result.lng);
          const color = geoConfidence(result.type);
          setGeoStatus(prop.id, color, geoLabel(color));
        } else {
          delete _reportGeoData[prop.id];
          setGeoStatus(prop.id, 'red', t.report.notFound);
        }
      }, 600);
    });

    // Geocodificación inicial, escalonada (límite de Nominatim)
    setTimeout(async () => {
      const result = await geocodeForReport(knownAddr, concelho);
      if (result) {
        _reportGeoData[prop.id] = result;
        const color = geoConfidence(result.type);
        setGeoStatus(prop.id, color, geoLabel(color));
        initMiniMap(prop.id, mapId, result.lat, result.lng);
      } else {
        setGeoStatus(prop.id, 'red', t.report.approx);
        initMiniMap(prop.id, mapId, d.lat || 38.72, d.lng || -9.45);
      }
      if (idx === selectedProps.length - 1) {
        const btn = document.getElementById('reportConfirmBtn');
        if (btn) { btn.disabled = false; btn.textContent = t.report.generate; }
      }
    }, 100 + idx * 300);
  });
};

window.closeReportModal = function () {
  document.getElementById('reportOverlay')?.remove();
  Object.keys(_reportMaps).forEach(id => {
    try { _reportMaps[id].remove(); } catch {}
    delete _reportMaps[id];
    delete _reportMarkers[id];
  });
};

// ── Confirmar → PDF ─────────────────────────────────────────
window.confirmReport = async function () {
  const t = getT();
  const selectedProps = properties.filter(p => selectedForReport.has(p.id));
  const modal = document.getElementById('reportOverlay');

  const config = {
    generated_at: new Date().toISOString(),
    lang: (window.getCurrentLang ? window.getCurrentLang() : 'pt') || 'pt',
    agent: { tier },
    properties: await Promise.all(selectedProps.map(async (prop, idx) => {
      const d = prop.property_data || {};
      const input = modal ? modal.querySelector(`.rconf-addr-input[data-prop-id="${prop.id}"]`) : null;
      const confirmedAddress = input ? input.value : (d.address || '');
      let geoResult = _reportGeoData[prop.id];
      if (!geoResult && !(d.lat || d.lng) && confirmedAddress) {
        geoResult = await geocodeForReport(confirmedAddress, d.concelho || '');
        if (geoResult) _reportGeoData[prop.id] = geoResult;
      }
      return {
        id: prop.id, idx: idx + 1,
        title:  d.title  || d.address || 'Property',
        portal: d.portal || d.source  || '',
        url:    d.url    || d.link    || '',
        price:  d.price  || 0,
        area_built: d.area || d.areaCons || 0,
        area_total: d.areaTerr || 0,
        bedrooms:   d.rooms || d.quartos || 0,
        image:      d.image || d.img || '',
        address_portal:    d.address || '',
        address_confirmed: confirmedAddress,
        lat: geoResult ? geoResult.lat : (d.lat || 0),
        lng: geoResult ? geoResult.lng : (d.lng || 0),
        geo_source: geoResult ? (geoResult.type === 'manual' ? 'manual-confirmed' : 'nominatim-confirmed') : 'portal-approximate',
        geo_type:   geoResult ? geoResult.type : 'unknown',
        concelho:  d.concelho || '', distrito: d.distrito || '',
        freguesia: d.localidade || d.freguesia || '',
      };
    })),
  };

  const confirmBtn = document.getElementById('reportConfirmBtn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = t.report.generating; }

  // Barra de progreso estimada (la generación tarda ~20-90 s)
  const STAGES = [5, 18, 35, 55, 72, 88].map((pct, i) => ({ pct, t: [0, 8, 20, 38, 54, 70][i], msg: t.report.stages[i] }));
  const TOTAL_SECS = 85;
  const foot = document.querySelector('.report-modal-foot');
  const prog = document.createElement('div');
  prog.className = 'report-progress';
  prog.innerHTML = `
    <div class="report-progress-track"><div class="report-progress-bar" id="_rp_bar"></div></div>
    <div class="report-progress-row"><span id="_rp_msg">…</span><span id="_rp_pct">0%</span></div>`;
  if (foot) foot.appendChild(prog);
  const bar = document.getElementById('_rp_bar'), msg = document.getElementById('_rp_msg'), pct = document.getElementById('_rp_pct');
  const startTs = Date.now();
  const timer = setInterval(() => {
    const elapsed = (Date.now() - startTs) / 1000;
    let stage = STAGES[0];
    for (const s of STAGES) { if (elapsed >= s.t) stage = s; }
    const next = STAGES[STAGES.indexOf(stage) + 1];
    let p = stage.pct;
    if (next) p = stage.pct + (Math.min(elapsed - stage.t, next.t - stage.t) / (next.t - stage.t)) * (next.pct - stage.pct);
    else p = Math.min(95, stage.pct + (elapsed - stage.t) * 0.15);
    const remaining = Math.max(0, Math.round(TOTAL_SECS - elapsed));
    if (bar) bar.style.width = p.toFixed(1) + '%';
    if (msg) msg.textContent = stage.msg + (remaining > 0 ? t.report.left(remaining) : '');
    if (pct) pct.textContent = Math.round(p) + '%';
  }, 800);
  const finish = (ok) => {
    clearInterval(timer);
    if (bar) { bar.style.width = '100%'; bar.classList.add(ok ? 'ok' : 'fail'); }
    if (msg) msg.textContent = ok ? t.report.ready : t.report.failed;
    if (pct) pct.textContent = '100%';
  };

  try {
    // Sesión fresca: el access_token del arranque puede haber caducado (dura 1 h).
    const s = await getSession();
    const token = s?.access_token || access_token;
    const res = await fetch(`${API}/api/generate-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `seculo-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    finish(true);
    setTimeout(() => closeReportModal(), 1200);
    showToast(t.report.done);
  } catch (err) {
    finish(false);
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = t.report.generate; }
    showToast(t.report.error + err.message);
    console.error('[report] error:', err);
  }
};

// El arranque va AL FINAL del módulo: initDashboard() usa CARD_T/getT() y
// otras const declaradas más abajo; llamarlo antes lanzaba
// "Cannot access 'CARD_T' before initialization" (TDZ) y el dashboard quedaba
// en blanco desde el release del rediseño (cazado 01-sep-2026 con la consola).
document.getElementById('dashLoading').style.display = 'none';
initDashboard();
