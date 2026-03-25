const API = 'https://seculo-api.vercel.app';

const id = new URLSearchParams(window.location.search).get('id');
if (!id) {
  showError('No property ID in URL.');
} else {
  loadShare(id);
}

async function loadShare(shareId) {
  try {
    const res = await fetch(`${API}/api/share/${shareId}`);

    if (res.status === 410) {
      const data = await res.json().catch(() => ({}));
      showExpired(data.message || 'This share link has expired.');
      return;
    }
    if (!res.ok) throw new Error(`${res.status}`);

    const property = await res.json();
    renderProperty(property);
  } catch (e) {
    showError('Could not load this property. Please try again.');
  }
}

function renderProperty(prop) {
  const d        = prop.property_data || {};
  const img      = d.image || d.img || d.thumbnail || '';
  const title    = d.title || d.address || d.descricao || 'Property';
  const location = [d.freguesia, d.concelho, d.distrito].filter(Boolean).join(', ')
                || d.location || d.cidade || '';
  const price    = d.price != null ? '€ ' + Number(d.price).toLocaleString('pt-PT') : null;
  const area     = d.area  != null ? `${d.area} m²` : null;
  const rooms    = d.rooms != null ? `${d.rooms} bed` : null;
  const portal   = d.portal || d.source || '';
  const url      = d.url   || d.link   || '';
  const notes    = prop.notes || '';

  document.title = `${title} — Século Explorer`;

  document.getElementById('shareLoading').style.display = 'none';
  const card = document.getElementById('shareCard');
  card.style.display = 'block';

  if (img) {
    const imgEl = document.getElementById('shareImg');
    imgEl.src = img;
    imgEl.alt = title;
    imgEl.style.display = 'block';
    imgEl.onerror = () => { imgEl.style.display = 'none'; };
  }

  if (portal) {
    document.getElementById('sharePortal').textContent = portal;
    document.getElementById('sharePortal').style.display = 'inline-block';
  }

  document.getElementById('shareTitle').textContent = title;

  if (location) {
    const el = document.getElementById('shareLocation');
    el.textContent = '\u{1F4CD} ' + location;
    el.style.display = 'block';
  }

  if (price) {
    document.getElementById('sharePrice').textContent = price;
  }

  const details = [rooms, area].filter(Boolean).join(' · ');
  if (details) {
    const el = document.getElementById('shareDetails');
    el.textContent = details;
    el.style.display = 'block';
  }

  if (notes) {
    const el = document.getElementById('shareNotes');
    el.textContent = notes;
    el.parentElement.style.display = 'block';
  }

  if (url) {
    const btn = document.getElementById('shareCTA');
    btn.href = url;
    btn.style.display = 'inline-flex';
  }
}

function showExpired(msg) {
  document.getElementById('shareLoading').style.display = 'none';
  const el = document.getElementById('shareExpired');
  el.style.display = 'block';
  document.getElementById('expiredMsg').textContent = msg;
}

function showError(msg) {
  document.getElementById('shareLoading').style.display = 'none';
  const el = document.getElementById('shareError');
  el.style.display = 'block';
  document.getElementById('errorMsg').textContent = msg;
}
