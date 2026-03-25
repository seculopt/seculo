import { getSession, signOut } from './supabase-client.js';

const API = 'https://seculo-api.vercel.app';

// ── Bootstrap ──────────────────────────────────────────────
const session = await getSession();
if (!session) {
  window.location.href = 'login.html';
}

const { access_token, user } = session;
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

// Update engine link with tier
const engineLink = document.getElementById('engineLink');
engineLink.href = `${API}/?tier=${tier}`;

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

if (properties.length === 0) {
  document.getElementById('dashEmpty').style.display = 'block';
} else {
  const meta = document.getElementById('dashMeta');
  meta.textContent = `${properties.length} saved propert${properties.length === 1 ? 'y' : 'ies'}`;

  const grid = document.getElementById('dashGrid');
  grid.style.display = 'grid';
  properties.forEach(prop => grid.appendChild(buildCard(prop)));
}

// ── Card builder ───────────────────────────────────────────
function buildCard(prop) {
  const d    = prop.property_data || {};
  const img  = d.image || d.img || d.thumbnail || '';
  const title   = d.title || d.address || d.descricao || 'Property';
  const location = [d.freguesia, d.concelho, d.distrito].filter(Boolean).join(', ')
                || d.location || d.cidade || '';
  const price  = d.price != null ? formatPrice(d.price) : '—';
  const area   = d.area   != null ? `${d.area} m²` : '';
  const rooms  = d.rooms  != null ? `${d.rooms} bed` : '';
  const portal = d.portal || d.source || '';
  const url    = d.url    || d.link   || '';

  const statusMap = { interested: 'Interested', visited: 'Visited', discarded: 'Discarded', saved: 'Saved' };
  const statusLabel = statusMap[prop.status] || prop.status || 'Saved';
  const statusClass = prop.status || '';

  const expiryText = formatExpiry(prop.expires_at);
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
        <span class="prop-status ${escHtml(statusClass)}">${escHtml(statusLabel)}</span>
      </div>
      <div class="prop-title">${escHtml(title)}</div>
      ${location ? `<div class="prop-location">&#128205; ${escHtml(location)}</div>` : ''}
      <div class="prop-price">${price}</div>
      ${(area || rooms) ? `<div class="prop-details">${[rooms, area].filter(Boolean).join(' · ')}</div>` : ''}
      ${prop.notes ? `<div class="prop-notes">${escHtml(prop.notes)}</div>` : ''}
      ${expiryText ? `<div class="prop-expiry${expirySoon ? ' expiring-soon' : ''}">${expiryText}</div>` : ''}
    </div>
    <div class="prop-footer">
      ${url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" class="prop-btn">View listing &#8599;</a>` : ''}
      ${prop.share_id
        ? `<button class="prop-btn share" data-share="${escHtml(prop.share_id)}">&#128279; Copy link</button>`
        : ''}
      <button class="prop-btn delete" data-delete="${escHtml(prop.id)}">Delete</button>
    </div>
  `;

  // Share button
  const shareBtn = card.querySelector('[data-share]');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const shareUrl = `https://seculopt.com/share/${shareBtn.dataset.share}`;
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

function formatExpiry(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d < now) return 'Link expired';
  const diff = Math.ceil((d - now) / 86400000);
  if (diff <= 7)  return `Link expires in ${diff} day${diff === 1 ? '' : 's'}`;
  return `Link expires ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
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
