import { getSession, signOut } from './supabase-client.js';

const API = 'https://seculo-api.vercel.app';

// ── Bootstrap ──────────────────────────────────────────────
const session = await getSession();
if (!session) {
  window.location.href = 'login.html';
}

const { access_token, refresh_token, user } = session;
const tier   = user?.user_metadata?.tier || 'free';
const name   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Explorer';

// Populate nav user chip
document.getElementById('navUser').style.display = 'flex';
document.getElementById('navUserName').textContent = name;
document.getElementById('signOutBtn').addEventListener('click', () => signOut());

// Populate tier badge
const tierBadge = document.getElementById('tierBadge');
tierBadge.textContent = tier;
tierBadge.style.display = 'inline-block';

// Update engine link — pass tokens in hash for cross-domain session (seculopt.com → seculo-api.vercel.app)
const engineLink = document.getElementById('engineLink');
engineLink.href = `${API}/?load_saved=1#access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}&tier=${tier}`;

// ── Load properties ────────────────────────────────────────
let properties = [];
try {
  const res = await fetch(`${API}/api/my-properties`, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  properties = data.properties || [];
} catch (e) {
  console.error('Failed to load properties', e);
}

document.getElementById('dashLoading').style.display = 'none';

function renderDashGrid() {
  const grid = document.getElementById('dashGrid');
  grid.innerHTML = '';
  properties.forEach(prop => grid.appendChild(buildCard(prop)));
  if (window.applyCurrentLang) window.applyCurrentLang();
}

if (properties.length === 0) {
  document.getElementById('dashEmpty').style.display = 'block';
} else {
  const meta = document.getElementById('dashMeta');
  meta.textContent = `${properties.length} saved propert${properties.length === 1 ? 'y' : 'ies'}`;

  document.getElementById('copyAllBtn').style.display = '';

  const grid = document.getElementById('dashGrid');
  grid.style.display = 'grid';
  renderDashGrid();
}

// Re-render cards when language changes
document.addEventListener('seculo-lang-change', function () {
  if (properties.length > 0) renderDashGrid();
});

// ── Card translations ───────────────────────────────────────
const CARD_T = {
  en: {
    status: { interested: 'Interested', visited: 'Visited', discarded: 'Discarded', saved: 'Saved' },
    view: 'View listing \u2197',
    copy: '\uD83D\uDD17 Copy link',
    del:  'Delete',
    expired:    'Link expired',
    expires_in: (n) => `Link expires in ${n} day${n === 1 ? '' : 's'}`,
    expires_on: (d) => `Link expires ${d}`,
    bed: 'bed',
  },
  pt: {
    status: { interested: 'Interessado', visited: 'Visitado', discarded: 'Descartado', saved: 'Guardado' },
    view: 'Ver anúncio \u2197',
    copy: '\uD83D\uDD17 Copiar link',
    del:  'Apagar',
    expired:    'Link expirado',
    expires_in: (n) => `Link expira em ${n} dia${n === 1 ? '' : 's'}`,
    expires_on: (d) => `Link expira ${d}`,
    bed: 'qto',
  },
  es: {
    status: { interested: 'Interesado', visited: 'Visitado', discarded: 'Descartado', saved: 'Guardado' },
    view: 'Ver anuncio \u2197',
    copy: '\uD83D\uDD17 Copiar link',
    del:  'Eliminar',
    expired:    'Link expirado',
    expires_in: (n) => `Link expira en ${n} día${n === 1 ? '' : 's'}`,
    expires_on: (d) => `Link expira ${d}`,
    bed: 'hab',
  },
};

function getT() { return CARD_T[window.getCurrentLang ? window.getCurrentLang() : 'en'] || CARD_T.en; }

// ── Card builder ───────────────────────────────────────────
function buildCard(prop) {
  const t    = getT();
  const d    = prop.property_data || {};
  const img  = d.image || d.img || d.thumbnail || '';
  const title   = d.title || d.address || d.descricao || 'Property';
  const location = [d.freguesia, d.concelho, d.distrito].filter(Boolean).join(', ')
                || d.location || d.cidade || '';
  const price  = d.price != null ? formatPrice(d.price) : '—';
  const area   = d.area   != null ? `${d.area} m²` : '';
  const rooms  = d.rooms  != null ? `${d.rooms} ${t.bed}` : '';
  const portal = d.portal || d.source || '';
  const url    = d.url    || d.link   || '';

  const statusClass = prop.status || 'saved';

  const expiryText = formatExpiry(prop.expires_at, t);
  const expirySoon = isExpiringSoon(prop.expires_at);

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
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error(`${res.status}`);
      statusSel.className = `prop-status-select ${newStatus}`;
      _currentStatus = newStatus;
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
      const shareUrl = `https://seculopt.com/share.html?id=${shareBtn.dataset.share}`;
      navigator.clipboard.writeText(shareUrl).then(() => showToast('Link copied to clipboard'));
    });
  }

  // Delete button
  const deleteBtn = card.querySelector('[data-delete]');
  deleteBtn.addEventListener('click', () => deleteProperty(prop.id, card));

  return card;
}

// ── Delete ─────────────────────────────────────────────────
async function deleteProperty(id, cardEl) {
  if (!confirm('Remove this property from your saved list?')) return;
  try {
    const res = await fetch(`${API}/api/property/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    cardEl.style.transition = 'opacity 0.3s';
    cardEl.style.opacity = '0';
    setTimeout(() => {
      cardEl.remove();
      const remaining = document.querySelectorAll('.prop-card').length;
      document.getElementById('dashMeta').textContent =
        `${remaining} saved propert${remaining === 1 ? 'y' : 'ies'}`;
      if (remaining === 0) {
        document.getElementById('dashGrid').style.display = 'none';
        document.getElementById('dashEmpty').style.display = 'block';
      }
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
  const d = new Date(ts);
  const now = new Date();
  return (d - now) < 7 * 86400000;
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
  const lines = properties
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
