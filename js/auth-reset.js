// auth-reset.js — reset-password.html
// El usuario llega desde el enlace del email (Supabase deja la sesión de
// recuperación en el hash de la URL). Escribe la nueva password → updateUser()
// → dashboard. Restaurado 23-sep-2026 (ver auth-forgot.js).

import { supabase } from './supabase-client.js';

const form    = document.getElementById('reset-form');
const pwIn    = document.getElementById('password-input');
const pw2In   = document.getElementById('password2-input');
const toggles = document.querySelectorAll('.toggle-pw');
const btn     = document.getElementById('reset-btn');
const message = document.getElementById('reset-message');
const notice  = document.getElementById('waiting-notice');

const T = {
  en: { short: 'Password must be at least 8 characters.', mismatch: 'Passwords do not match.',
        saving: 'Saving…', save: 'Save new password',
        error: 'Something went wrong. The link may have expired: request a new one.',
        expired: 'This link is not valid or has expired. Request a new one below.',
        ok: 'Password updated. Redirecting…' },
  pt: { short: 'A password deve ter pelo menos 8 caracteres.', mismatch: 'As passwords não coincidem.',
        saving: 'A guardar…', save: 'Guardar nova password',
        error: 'Ocorreu um erro. O link pode ter expirado: pede um novo.',
        expired: 'Este link não é válido ou expirou. Pede um novo abaixo.',
        ok: 'Password atualizada. A redirecionar…' },
  es: { short: 'La contraseña debe tener al menos 8 caracteres.', mismatch: 'Las contraseñas no coinciden.',
        saving: 'Guardando…', save: 'Guardar nueva contraseña',
        error: 'Ha ocurrido un error. El enlace puede haber caducado: pide uno nuevo.',
        expired: 'Este enlace no es válido o ha caducado. Pide uno nuevo abajo.',
        ok: 'Contraseña actualizada. Redirigiendo…' },
};
const t = () => T[(window.getCurrentLang ? window.getCurrentLang() : document.documentElement.lang) || 'en'] || T.en;

function showForm() {
  if (form) form.style.display = 'block';
  if (notice) notice.style.display = 'none';
}

// Supabase canjea el token del hash por una sesión y emite PASSWORD_RECOVERY.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') showForm();
});
// Si el hash ya se procesó antes de suscribirnos, la sesión existe igualmente.
supabase.auth.getSession().then(({ data }) => { if (data && data.session) showForm(); });
// Sin sesión pasados unos segundos: el enlace no sirve.
setTimeout(() => {
  if (form && form.style.display === 'none') {
    if (notice) notice.style.display = 'none';
    message.textContent = t().expired;
    message.className = 'auth-message auth-message--error';
  }
}, 6000);

toggles.forEach(function (toggle) {
  toggle.addEventListener('click', function () {
    const input = document.getElementById(toggle.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const password = pwIn.value, password2 = pw2In.value;

    if (password.length < 8) {
      message.textContent = t().short;
      message.className = 'auth-message auth-message--error';
      return;
    }
    if (password !== password2) {
      message.textContent = t().mismatch;
      message.className = 'auth-message auth-message--error';
      return;
    }

    btn.disabled = true;
    btn.textContent = t().saving;
    message.textContent = '';
    message.className = 'auth-message';

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      btn.disabled = false;
      btn.textContent = t().save;
      message.textContent = t().error;
      message.className = 'auth-message auth-message--error';
      return;
    }

    form.style.display = 'none';
    message.textContent = t().ok;
    message.className = 'auth-message auth-message--success';
    setTimeout(function () { window.location.href = 'dashboard.html'; }, 1500);
  });
}
