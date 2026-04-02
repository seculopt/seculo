// auth-reset.js — reset-password.html logic
// User arrives here via the email link (Supabase puts session in URL hash).
// They enter a new password → updateUser() → redirect to dashboard.

import { supabase } from './supabase-client.js';

const form    = document.getElementById('reset-form');
const pwIn    = document.getElementById('password-input');
const pw2In   = document.getElementById('password2-input');
const toggles = document.querySelectorAll('.toggle-pw');
const btn     = document.getElementById('reset-btn');
const message = document.getElementById('reset-message');

// Supabase automatically exchanges the token in the URL hash into a session.
// We just need to wait for the SIGNED_IN / PASSWORD_RECOVERY event.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Session is active — user can now set a new password
    if (form) form.style.display = 'block';
    const notice = document.getElementById('waiting-notice');
    if (notice) notice.style.display = 'none';
  }
});

// Show/hide password toggles
toggles.forEach(function (toggle) {
  toggle.addEventListener('click', function () {
    const targetId = toggle.dataset.target;
    const input = document.getElementById(targetId);
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    toggle.textContent = isHidden ? '🙈' : '👁';
  });
});

if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const password  = pwIn.value;
    const password2 = pw2In.value;
    const lang = document.documentElement.lang || 'pt';

    if (password.length < 8) {
      message.textContent = lang === 'pt'
        ? 'A password deve ter pelo menos 8 caracteres.'
        : 'Password must be at least 8 characters.';
      message.className = 'auth-message auth-message--error';
      return;
    }

    if (password !== password2) {
      message.textContent = lang === 'pt'
        ? 'As passwords não coincidem.'
        : 'Passwords do not match.';
      message.className = 'auth-message auth-message--error';
      return;
    }

    btn.disabled = true;
    btn.textContent = lang === 'pt' ? 'A guardar...' : 'Saving...';
    message.textContent = '';
    message.className = '';

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      btn.disabled = false;
      btn.textContent = lang === 'pt' ? 'Guardar nova password' : 'Save new password';
      message.textContent = lang === 'pt'
        ? 'Ocorreu um erro. O link pode ter expirado — pede um novo.'
        : 'Something went wrong. The link may have expired — request a new one.';
      message.className = 'auth-message auth-message--error';
      return;
    }

    // Success
    form.style.display = 'none';
    message.textContent = lang === 'pt'
      ? 'Password atualizada! Redireccionando...'
      : 'Password updated! Redirecting...';
    message.className = 'auth-message auth-message--success';
    setTimeout(function () { window.location.href = 'dashboard.html'; }, 1500);
  });
}
