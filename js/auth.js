// auth.js — login.html logic
// Single flow: email + password → signInWithPassword()
// Also handles auth callback from email confirmation links (onAuthStateChange)

import { supabase } from './supabase-client.js';

const form       = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const pwInput    = document.getElementById('password-input');
const togglePw   = document.getElementById('toggle-pw');
const btn        = document.getElementById('send-btn');
const message    = document.getElementById('login-message');

// Handle auth callback: if Supabase redirected here with ?code= (email confirmation),
// exchange the code for a session and go to dashboard immediately.
(async function () {
  const _urlCode = new URLSearchParams(window.location.search).get('code');
  if (_urlCode) {
    const { data } = await supabase.auth.exchangeCodeForSession(_urlCode);
    if (data?.session) { window.location.href = 'dashboard.html'; return; }
  }
  // Also handle hash-based tokens (older Supabase flow)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = 'dashboard.html';
})();

// Catch any subsequent SIGNED_IN event (e.g. magic link via onAuthStateChange)
supabase.auth.onAuthStateChange(function (event, session) {
  if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
    window.location.href = 'dashboard.html';
  }
});

// Show/hide password toggle
if (togglePw) {
  togglePw.addEventListener('click', function () {
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    togglePw.textContent = isHidden ? '🙈' : '👁';
  });
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email    = emailInput.value.trim();
  const password = pwInput ? pwInput.value : '';
  const lang     = document.documentElement.lang || 'pt';

  if (!email) return;

  // Require password — no magic link from this form
  if (!password) {
    message.textContent = lang === 'pt'
      ? 'Por favor introduz a tua password.'
      : 'Please enter your password.';
    message.className = 'auth-message auth-message--error';
    return;
  }

  btn.disabled = true;
  message.textContent = '';
  message.className = '';
  btn.textContent = lang === 'pt' ? 'A entrar...' : 'Signing in...';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Entrar' : 'Log in';

    const msg = error.message ? error.message.toLowerCase() : '';
    const isCredentialError = msg.includes('invalid') || msg.includes('credentials') || msg.includes('password');
    const isNotConfirmed    = msg.includes('confirm') || msg.includes('not confirmed') || msg.includes('email');

    if (isNotConfirmed && !isCredentialError) {
      message.textContent = lang === 'pt'
        ? 'Confirma o teu email antes de entrar. Verifica a tua caixa de entrada e clica no link de confirmação.'
        : 'Please confirm your email before logging in. Check your inbox and click the confirmation link.';
    } else if (isCredentialError) {
      message.textContent = lang === 'pt'
        ? 'Email ou password incorretos.'
        : 'Invalid email or password.';
    } else {
      message.textContent = lang === 'pt'
        ? 'Ocorreu um erro. Por favor tenta de novo.'
        : 'Something went wrong. Please try again.';
    }
    message.className = 'auth-message auth-message--error';
    return;
  }

  if (data.session) {
    window.location.href = 'dashboard.html';
  }
});
