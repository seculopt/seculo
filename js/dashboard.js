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

document.getElementById('dashLoading').style.display = 'none';
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
    status: { interested: 'Interesado', visited: 'Visitado', discarded: 'Descartado', saved: 'Guardado' },
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
      const location = [d.freguesia, d.concelho, d.distrito].filter(Boolean).join(', ')
                    || d.location || d.cidade || '';
      const link = `https://seculopt.com/share.html?id=${p.id}`;
      return [
        `${i + 1}. ${title}${price ? ' — ' + price : ''}`,
        location ? `   📍 ${location}` : '',
        `   🔗 ${link}`,
      ].filter(Boolean).join('\n');
    });

  if (!lines.length) { showToast('Nenhuma propriedade para partilhar'); return; }

  const text = `As minhas propriedades no Século Explorador:\n\n${lines.join('\n\n')}\n\nEncontrado em seculopt.com`;
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast(`✓ ${lines.length} link${lines.length === 1 ? '' : 's'} copiado${lines.length === 1 ? '' : 's'}!`);
      const btn = document.getElementById('copyAllBtn');
      if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(() => { btn.innerHTML = '&#128203; Copiar todos os links'; }, 2500); }
    })
    .catch(() => showToast('Erro ao copiar — tenta de novo'));
};
