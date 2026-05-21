import { supabase, getSession, signOut } from './supabase-client.js';

const API = 'https://seculo-api.vercel.app';

// ── Bootstrap ──────────────────────────────────────────────
// Handle email confirmation callback: Supabase redirects here with ?code=xxx
// Must exchange the code BEFORE checking the session, otherwise we'd redirect
// to login immediately and lose the auth code.
const _urlCode = new URLSearchParams(window.location.search).get('code');
if (_urlCode) {
  await supabase.auth.exchangeCodeForSession(_urlCode);
}

const session = await getSession();
if (!session) {
  window.location.href = 'login.html';
  throw new Error('no session'); // stop module execution so line below doesn't crash on null
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

// Update engine link — pass tokens in hash for cross-domain session
const engineLink = document.getElementById('engineLink');
const _tokenHash = `#access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}&tier=${tier}`;
engineLink.href = `${API}/?load_saved=1${_tokenHash}`;

// Bug fix: update ALL other engine links with tokens (cross-domain SSO)
// Without this, the nav "Open Engine" and "Start searching" links have no auth → user sees "Create Account"
document.querySelectorAll('a[href*="seculo-api.vercel.app"]').forEach(link => {
  if (link.id === 'engineLink') return; // already handled with ?load_saved=1
  link.href = `${API}/${_tokenHash}`;
});

// ── State ──────────────────────────────────────────────────
let properties = [];
let folders    = [];
let activeFolderId = null; // null=All, 'unfiled'=no folder, uuid=folder

// Report state — declared here (top-level) so initDashboard() can access them
// before the function definitions below reach the temporal dead zone
const selectedForReport = new Set();
const _reportMaps     = {};
const _reportMarkers  = {};
const _reportGeoData  = {};
const _debounceTimers = {};

// ── Translations ───────────────────────────────────────────
const CARD_T = {
  en: {
    status: { interested: 'Interested', visited: 'Visited', discarded: 'Discarded', saved: 'Saved' },
    view: 'View listing \u2197',
    copy: '\uD83D\uDD17 Copy link',
    del:  'Delete',
    expired:     'Link expired',
    expires_in:  (n) => `Link expires in ${n} day${n === 1 ? '' : 's'}`,
    expires_on:  (d) => `Link expires ${d}`,
    bed: 'bed',
    propSingular: 'saved property',
    propPlural:   'saved properties',
    folderNone:  '📋 No folder',
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
    view: 'Ver anúncio \u2197',
    copy: '\uD83D\uDD17 Copiar link',
    del:  'Apagar',
    expired:     'Link expirado',
    expires_in:  (n) => `Link expira em ${n} dia${n === 1 ? '' : 's'}`,
    expires_on:  (d) => `Link expira ${d}`,
    bed: 'qto',
    propSingular: 'propriedade guardada',
    propPlural:   'propriedades guardadas',
    folderNone:  '📋 Sem pasta',
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
    status: { interested: 'Interesado', visited: 'Visited', discarded: 'Descartado', saved: 'Guardado' },
    view: 'Ver anuncio \u2197',
    copy: '\uD83D\uDD17 Copiar link',
    del:  'Eliminar',
    expired:     'Link expirado',
    expires_in:  (n) => `Link expira en ${n} día${n === 1 ? '' : 's'}`,
    expires_on:  (d) => `Link expira ${d}`,
    bed: 'hab',
    propSingular: 'propiedad guardada',
    propPlural:   'propiedades guardadas',
    folderNone:  '📋 Sin carpeta',
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

// ── Load data ──────────────────────────────────────────────
let _loadError = false;
const _ctrl = new AbortController();
const _timeout = setTimeout(() => _ctrl.abort(), 12000); // 12s max wait

try {
  const authHeader = { Authorization: `Bearer ${access_token}` };
  const opts = { headers: authHeader, signal: _ctrl.signal };
  const [propsRes, foldsRes] = await Promise.all([
    fetch(`${API}/api/my-properties`, opts),
    fetch(`${API}/api/folders`,       opts),
  ]);
  clearTimeout(_timeout);
  if (propsRes.ok) {
    const d = await propsRes.json();
    properties = d.properties || [];
  } else {
    console.error('my-properties API error:', propsRes.status);
    _loadError = true;
  }
  if (foldsRes.ok) { const d = await foldsRes.json(); folders = d.folders || []; }
} catch (e) {
  clearTimeout(_timeout);
  console.error('Failed to load dashboard data', e);
  _loadError = true;
}

const dashLoadingEl = document.getElementById('dashLoading');
if (dashLoadingEl) dashLoadingEl.style.display = 'none';

if (_loadError && properties.length === 0) {
  // Show a visible error so the user knows it's a network/auth issue, not empty list
  const errEl = document.createElement('div');
  errEl.style.cssText = 'text-align:center;padding:3rem 1rem;color:#c0392b;';
  errEl.innerHTML = '<p style="font-size:1rem;font-weight:500;">⚠️ Could not load your saved properties.</p><p style="font-size:0.85rem;margin-top:0.5rem;color:#888;">Please refresh the page or <a href="login.html" style="color:inherit;">log in again</a>.</p>';
  const mainEl = document.getElementById('dashMain') || document.querySelector('.dash-main');
  if (mainEl) mainEl.prepend(errEl);
}
initDashboard();

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

  sidebar.appendChild(makeFoldItem(null, '🗂️', t.folders.all, countInFolder(null)));

  const unfiledCount = countInFolder('unfiled');
  if (folders.length > 0 || unfiledCount < properties.length) {
    sidebar.appendChild(makeFoldItem('unfiled', '📋', t.folders.unfiled, unfiledCount));
  }

  const topFolders = folders.filter(f => !f.parent_id);
  if (topFolders.length > 0) {
    const hr = document.createElement('hr');
    hr.className = 'fold-divider';
    sidebar.appendChild(hr);

    for (const f of topFolders) {
      sidebar.appendChild(makeFoldItem(f.id, '📁', f.name, countInFolder(f.id), f));
      const subs = folders.filter(s => s.parent_id === f.id);
      for (const s of subs) {
        sidebar.appendChild(makeFoldItem(s.id, '📄', s.name, countInFolder(s.id), s, true));
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
  menu.style.cssText = 'position:fixed;background:#fff;border:1px solid #ddd;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:9000;min-width:140px;padding:0.4rem 0;font-size:0.84rem;font-family:\'DM Sans\',sans-serif;';

  const rect = anchor.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(8, rect.left - 100) + 'px';

  const makeItem = (label, color, onClick) => {
    const item = document.createElement('div');
    item.style.cssText = `padding:0.5rem 1rem;cursor:pointer;color:${color || 'inherit'};`;
    item.textContent = label;
    item.addEventListener('mouseenter', () => item.style.background = '#f8f5f0');
    item.addEventListener('mouseleave', () => item.style.background = '');
    item.addEventListener('click', () => { menu.remove(); onClick(); });
    return item;
  };

  menu.appendChild(makeItem(t.folders.rename, null, () => promptRenameFolder(folder)));
  menu.appendChild(makeItem(t.folders.delete, '#c0392b', () => confirmDeleteFolder(folder)));

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
    showToast(`📁 ${folder.name}`);
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
      opt.textContent = '📁 ' + folder.name;
    });
    showToast('✓');
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
    showToast('🗑️');
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
    updateReportBtn();
    renderFolderSidebar();
    renderDashGrid();
  }
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
  try {
    filtered.forEach(prop => grid.appendChild(buildCard(prop)));
  } catch(e) {
    console.error('Dashboard card render error:', e);
    showToast('Error loading cards — check console');
  }

  const t = getT();
  meta.textContent = `${filtered.length} ${filtered.length === 1 ? t.propSingular : t.propPlural}`;

  if (window.applyCurrentLang) window.applyCurrentLang();
}

// Re-render when language changes
document.addEventListener('seculo-lang-change', function () {
  if (properties.length > 0) { renderFolderSidebar(); renderDashGrid(); }
});


// ── Card builder ───────────────────────────────────────────
function addFolderOption(sel, folder) {
  const opt = document.createElement('option');
  opt.value = folder.id;
  opt.textContent = '📁 ' + folder.name;
  sel.appendChild(opt);
}

function buildCard(prop) {
  const t    = getT();
  const d    = prop.property_data || {};
  const img  = d.image || d.img || d.thumbnail || '';
  const title    = d.title || d.address || d.descricao || 'Property';
  // Support both dashboard field names (area/rooms/freguesia) and engine field names (areaCons/quartos/localidade)
  const location = [d.freguesia || d.localidade, d.concelho, d.distrito].filter(Boolean).join(', ')
                || d.location || d.cidade || d.address || '';
  const price  = d.price != null ? formatPrice(d.price) : '—';
  const areaVal = d.area ?? d.areaCons ?? null;
  const area   = areaVal != null ? `${areaVal} m²` : '';
  const roomsVal = d.rooms ?? d.quartos ?? null;
  const rooms  = roomsVal != null ? `${roomsVal} ${t.bed}` : '';
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
      ? `<img class="prop-img" src="${escHtml(img)}" alt="${escHtml(title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="prop-img-placeholder" style="display:none;">&#127968;</div>`
      : `<div class="prop-img-placeholder">&#127968;</div>`
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
      ${location ? `<div class="prop-location">&#128205; ${escHtml(location)}</div>` : ''}
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
      <button class="prop-btn report-sel" data-report="${escHtml(prop.id)}">&#128196; Report</button>
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
      showToast('✓');
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
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReportSelect(prop.id, card, reportBtn);
    });
    // Reflect existing selection state
    if (selectedForReport.has(prop.id)) {
      card.classList.add('in-report');
      reportBtn.classList.add('active');
      reportBtn.textContent = '✓ In Report';
    }
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
        showToast('✓');
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
      renderFolderSidebar();
      renderDashGrid();
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
      const location = [d.freguesia || d.localidade, d.concelho, d.distrito].filter(Boolean).join(', ')
                    || d.location || d.cidade || d.address || '';
      const link = `https://seculopt.com/share.html?id=${p.id}`;
      return [
        `${i + 1}. ${title}${price ? ' — ' + price : ''}`,
        location ? `   📍 ${location}` : '',
        `   🔗 ${link}`,
      ].filter(Boolean).join('\n');
    });

  if (!lines.length) { showToast('Nenhuma propriedade para partilhar'); return; }

  const text = `As minhas propriedades no Século Explorador:\n\n${lines.join('\n\n')}\n\nEncontrado em seculopt.com`;
  const _doCopy = () => {
    showToast(`✓ ${lines.length} link${lines.length === 1 ? '' : 's'} copiado${lines.length === 1 ? '' : 's'}!`);
    const btn = document.getElementById('copyAllBtn');
    if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.innerHTML = '&#128203; Copiar todos os links'; }, 2500); }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(_doCopy).catch(() => {
      // Clipboard API blocked (incognito/permissions) — textarea fallback
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); _doCopy(); } catch(_) { showToast('Erro ao copiar — selecciona manualmente'); }
      document.body.removeChild(ta);
    });
  } else {
    showToast('Clipboard não disponível neste browser');
  }
};

// ══════════════════════════════════════════════════════════════
// REPORT GENERATION — Address Confirmation Flow
// ══════════════════════════════════════════════════════════════

// selectedForReport + report state consts moved to top-level state section (line ~44) to avoid temporal dead zone

function updateReportBtn() {
  const btn   = document.getElementById('reportBtn');
  const badge = document.getElementById('reportBadge');
  if (!btn) return;
  const count = selectedForReport.size;
  badge.textContent = count;
  // Always show when there are properties; disabled+dimmed until at least 1 selected for report
  btn.style.display = properties.length > 0 ? 'flex' : 'none';
  btn.disabled = count === 0;
  btn.title = count === 0 ? 'Click "📄 Report" on any property card to add it to the report' : `Generate PDF with ${count} propert${count === 1 ? 'y' : 'ies'}`;
  btn.style.opacity = count === 0 ? '0.45' : '1';
}

function toggleReportSelect(propId, cardEl, btnEl) {
  if (selectedForReport.has(propId)) {
    selectedForReport.delete(propId);
    cardEl.classList.remove('in-report');
    btnEl.textContent = '📄 Report';
    btnEl.classList.remove('active');
  } else {
    if (selectedForReport.size >= 5) {
      showToast('Maximum 5 properties per report');
      return;
    }
    selectedForReport.add(propId);
    cardEl.classList.add('in-report');
    btnEl.textContent = '✓ In Report';
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
      { headers: { 'Accept-Language': 'pt', 'User-Agent': 'seculopt.com/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display: data[0].display_name,
      type:    data[0].type,        // building/house/road/suburb/city
    };
  } catch { return null; }
}

function geoConfidence(type) {
  if (!type) return 'red';
  if (['house','building','apartments','residential'].includes(type)) return 'green';
  if (['road','street','pedestrian','path','cycleway'].includes(type)) return 'yellow';
  return 'red';
}

function geoLabel(type, color) {
  if (color === 'green')  return 'Building-level ✓';
  if (color === 'yellow') return 'Street-level';
  return 'Approximate';
}

// ── Update mini-map pin ─────────────────────────────────────
function updateMiniMap(propId, lat, lng) {
  const map    = _reportMaps[propId];
  const marker = _reportMarkers[propId];
  if (!map || !marker) return;
  marker.setLatLng([lat, lng]);
  map.setView([lat, lng], 14, { animate: true });
}

// ── Modal open ─────────────────────────────────────────────
window.openReportModal = function() {
  if (selectedForReport.size === 0) { showToast('Select at least one property first'); return; }

  const selectedProps = properties.filter(p => selectedForReport.has(p.id));

  const overlay = document.createElement('div');
  overlay.className = 'report-overlay';
  overlay.id = 'reportOverlay';

  overlay.innerHTML = `
    <div class="report-modal">
      <div class="report-modal-head">
        <div>
          <h2>&#128205; Confirm Property Locations</h2>
          <p>Exact addresses improve the accuracy of isochrones and POI analysis in the report.
             Pre-filled from portal data — correct any that are imprecise before generating.</p>
        </div>
        <button class="report-modal-close" onclick="closeReportModal()">&#10005;</button>
      </div>
      <div class="report-modal-body" id="reportModalBody"></div>
      <div class="report-modal-foot">
        <div class="report-modal-foot-note">
          &#9888; Coordinates are approximate when based only on portal data.
          Confirm exact address to improve isochrone precision.
        </div>
        <button class="btn-report-cancel" onclick="closeReportModal()">Cancel</button>
        <button class="btn-report-confirm" id="reportConfirmBtn" onclick="confirmReport()">
          &#128196; Download Config
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeReportModal(); });

  const body = document.getElementById('reportModalBody');

  selectedProps.forEach((prop, idx) => {
    const d         = prop.property_data || {};
    const img       = d.image || d.img || d.thumbnail || '';
    const title     = d.title || d.address || 'Property';
    const portal    = d.portal || d.source || '';
    const price     = d.price != null ? '€ ' + Number(d.price).toLocaleString('pt-PT') : '';
    const knownAddr = [d.address, d.localidade, d.concelho].filter(Boolean).join(', ')
                   || d.location || '';
    const concelho  = d.concelho || '';
    const mapId     = `rmap-${prop.id.replace(/-/g, '')}`;

    const row = document.createElement('div');
    row.className = 'rconf-row';
    row.dataset.propId = prop.id;
    row.innerHTML = `
      <div class="rconf-num">${String(idx + 1).padStart(2, '0')}</div>
      ${img
        ? `<img class="rconf-thumb" src="${escHtml(img)}" alt="" onerror="this.style.display='none'">`
        : `<div class="rconf-thumb-placeholder">&#127968;</div>`
      }
      <div class="rconf-body">
        <div class="rconf-title">${escHtml(title)}</div>
        <div class="rconf-meta">${escHtml([portal, price].filter(Boolean).join(' · '))}</div>
        ${knownAddr
          ? `<div class="rconf-known"><span class="rconf-label">Portal data</span>${escHtml(knownAddr)}</div>`
          : ''}
        <div>
          <span class="rconf-label">Exact address for geocoding</span>
          <div class="rconf-input-wrap">
            <input class="rconf-addr-input" type="text"
              placeholder="Street, number, city, Portugal"
              value="${escHtml(knownAddr)}"
              data-prop-id="${escHtml(prop.id)}"
              data-concelho="${escHtml(concelho)}" />
            <div class="rconf-geo-status" id="geoStatus-${escHtml(prop.id)}">
              <div class="rconf-geo-dot red" id="geoDot-${escHtml(prop.id)}"></div>
              <span id="geoText-${escHtml(prop.id)}">Not geocoded</span>
            </div>
          </div>
        </div>
      </div>
      <div class="rconf-map" id="${mapId}"></div>
    `;

    body.appendChild(row);

    // Wire up address input with debounced geocoding
    const input = row.querySelector('.rconf-addr-input');
    input.addEventListener('input', () => {
      clearTimeout(_debounceTimers[prop.id]);
      const dotEl  = document.getElementById(`geoDot-${prop.id}`);
      const textEl = document.getElementById(`geoText-${prop.id}`);
      if (dotEl)  dotEl.className  = 'rconf-geo-dot yellow';
      if (textEl) textEl.textContent = 'Geocoding…';

      _debounceTimers[prop.id] = setTimeout(async () => {
        const result = await geocodeForReport(input.value, input.dataset.concelho);
        if (result) {
          _reportGeoData[prop.id] = result;
          updateMiniMap(prop.id, result.lat, result.lng);
          const color = geoConfidence(result.type);
          if (dotEl)  dotEl.className  = `rconf-geo-dot ${color}`;
          if (textEl) textEl.textContent = geoLabel(result.type, color);
        } else {
          delete _reportGeoData[prop.id];
          if (dotEl)  dotEl.className  = 'rconf-geo-dot red';
          if (textEl) textEl.textContent = 'Not found';
        }
      }, 600);
    });

    // Pre-geocode the known address
    setTimeout(async () => {
      const result = await geocodeForReport(knownAddr, concelho);
      const dotEl  = document.getElementById(`geoDot-${prop.id}`);
      const textEl = document.getElementById(`geoText-${prop.id}`);
      if (result) {
        _reportGeoData[prop.id] = result;
        const color = geoConfidence(result.type);
        if (dotEl)  dotEl.className  = `rconf-geo-dot ${color}`;
        if (textEl) textEl.textContent = geoLabel(result.type, color);
        // Init map with geocoded position
        initMiniMap(prop.id, mapId, result.lat, result.lng);
      } else {
        // Init map at approximate position using lat/lng from property_data if available
        const fallLat = d.lat || 38.72;
        const fallLng = d.lng || (-9.45);
        if (dotEl)  { dotEl.className = 'rconf-geo-dot red'; }
        if (textEl) { textEl.textContent = 'Approximate (confirm address)'; }
        initMiniMap(prop.id, mapId, fallLat, fallLng);
      }
    }, 100 + idx * 300); // stagger requests to respect Nominatim rate limit
  });
};

function initMiniMap(propId, containerId, lat, lng) {
  const container = document.getElementById(containerId);
  if (!container || !window.L) return;
  const map = window.L.map(container, {
    center: [lat, lng],
    zoom: 14,
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
  });
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(map);
  const marker = window.L.circleMarker([lat, lng], {
    radius: 7,
    fillColor: '#b8a882',
    color: '#6b5a3a',
    weight: 2,
    fillOpacity: 1,
  }).addTo(map);
  _reportMaps[propId]    = map;
  _reportMarkers[propId] = marker;
}

window.closeReportModal = function() {
  const overlay = document.getElementById('reportOverlay');
  if (overlay) overlay.remove();
  // Clean up map instances
  Object.keys(_reportMaps).forEach(id => {
    try { _reportMaps[id].remove(); } catch {}
    delete _reportMaps[id];
    delete _reportMarkers[id];
  });
};

// ── Confirm → download config JSON ─────────────────────────
window.confirmReport = async function() {
  const selectedProps = properties.filter(p => selectedForReport.has(p.id));
  const modal = document.getElementById('reportOverlay');
  const inputs = modal ? modal.querySelectorAll('.rconf-addr-input') : [];

  const config = {
    generated_at: new Date().toISOString(),
    agent: { tier },
    properties: selectedProps.map((prop, idx) => {
      const d    = prop.property_data || {};
      const input = modal
        ? modal.querySelector(`.rconf-addr-input[data-prop-id="${prop.id}"]`)
        : null;
      const confirmedAddress = input ? input.value : (d.address || '');
      const geoResult = _reportGeoData[prop.id];

      return {
        id:               prop.id,
        idx:              idx + 1,
        title:            d.title     || d.address || 'Property',
        portal:           d.portal    || d.source  || '',
        url:              d.url       || d.link    || '',
        price:            d.price     || 0,
        area_built:       d.area      || d.areaCons || 0,
        area_total:       d.areaTerr  || 0,
        bedrooms:         d.rooms     || d.quartos || 0,
        image:            d.image     || d.img     || '',
        address_portal:   d.address   || '',
        address_confirmed: confirmedAddress,
        lat:  geoResult ? geoResult.lat : (d.lat || 0),
        lng:  geoResult ? geoResult.lng : (d.lng || 0),
        geo_source:  geoResult ? 'nominatim-confirmed' : 'portal-approximate',
        geo_type:    geoResult ? geoResult.type : 'unknown',
        concelho:    d.concelho   || '',
        distrito:    d.distrito   || '',
        freguesia:   d.localidade || d.freguesia || '',
      };
    }),
  };

  // Show loading state + progress bar
  const confirmBtn = document.getElementById('reportConfirmBtn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳ Generating PDF…'; }

  // Progress bar — injected into modal footer
  const STAGES = [
    { pct:  5, t:  0, msg: 'Connecting to report server…' },
    { pct: 18, t:  8, msg: 'Fetching isochrones…' },
    { pct: 35, t: 20, msg: 'Generating maps…' },
    { pct: 55, t: 38, msg: 'Building slides…' },
    { pct: 72, t: 54, msg: 'Rendering PDF…' },
    { pct: 88, t: 70, msg: 'Finalizing…' },
  ];
  const TOTAL_SECS = 85; // expected generation time

  const _foot = document.querySelector('.report-modal-foot');
  const _prog = document.createElement('div');
  _prog.style.cssText = 'width:100%;margin-top:10px;';
  _prog.innerHTML = `
    <div id="_rp_bar_wrap" style="background:#eee;border-radius:6px;height:8px;overflow:hidden;margin-bottom:6px;">
      <div id="_rp_bar" style="background:#C9A26D;height:8px;width:0%;border-radius:6px;transition:width 0.8s ease;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span id="_rp_msg" style="font-size:0.75rem;color:#888;">Starting…</span>
      <span id="_rp_pct" style="font-size:0.75rem;font-weight:600;color:#C9A26D;font-family:monospace;">0%</span>
    </div>`;
  if (_foot) _foot.appendChild(_prog);

  const _bar = document.getElementById('_rp_bar');
  const _msg = document.getElementById('_rp_msg');
  const _pct = document.getElementById('_rp_pct');

  const _startTs = Date.now();
  const _timer = setInterval(() => {
    const elapsed = (Date.now() - _startTs) / 1000;
    // Find current stage
    let stage = STAGES[0];
    for (const s of STAGES) { if (elapsed >= s.t) stage = s; }
    // Interpolate within stage to next stage
    const stageIdx = STAGES.indexOf(stage);
    const next = STAGES[stageIdx + 1];
    let pct = stage.pct;
    if (next) {
      const segLen = next.t - stage.t;
      const segPct = next.pct - stage.pct;
      pct = stage.pct + (Math.min(elapsed - stage.t, segLen) / segLen) * segPct;
    } else {
      // Past last stage — creep slowly toward 95%
      pct = Math.min(95, stage.pct + (elapsed - stage.t) * 0.15);
    }
    // Estimate seconds remaining
    const remaining = Math.max(0, Math.round(TOTAL_SECS - elapsed));
    const remStr = remaining > 0 ? ` — ~${remaining}s left` : '';
    if (_bar) _bar.style.width = pct.toFixed(1) + '%';
    if (_msg) _msg.textContent = stage.msg + remStr;
    if (_pct) _pct.textContent = Math.round(pct) + '%';
  }, 800);

  const _finishProgress = (success) => {
    clearInterval(_timer);
    if (_bar) { _bar.style.width = '100%'; _bar.style.background = success ? '#5a9660' : '#c05030'; }
    if (_msg) _msg.textContent = success ? '✓ PDF ready — downloading…' : '✗ Generation failed';
    if (_pct) _pct.textContent = '100%';
  };

  try {
    const res = await fetch(`${API}/api/generate-report`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify(config),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    // Trigger PDF download
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `seculo-report-${new Date().toISOString().slice(0,10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    _finishProgress(true);
    setTimeout(() => { closeReportModal(); }, 1200);
    showToast('✓ Report generated — check your downloads folder');

  } catch (err) {
    _finishProgress(false);
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '📄 Generate Report'; }
    showToast(`Error generating report: ${err.message}`);
    console.error('[report] error:', err);
  }
};
