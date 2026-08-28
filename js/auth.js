// auth.js — login.html logic
// Single flow: email + password → signInWithPassword()
// Also handles auth callback from email confirmation links (onAuthStateChange)

import { supabase } from './supabase-client.js';

// Runtime copy for the three site languages. The page's static text comes from
// data-en/pt/es attributes; these are the strings only JS ever writes.
const COPY = {
  en: {
    sending: 'Sending...',
    submit:  'Send login link',
    error:   'Something went wrong. Please try again.',
    sent:    'Link sent! Check your inbox.',
  },
  pt: {
    sending: 'A enviar...',
    submit:  'Enviar link de acesso',
    error:   'Ocorreu um erro. Por favor tenta de novo.',
    sent:    'Link enviado! Verifica o teu email.',
  },
  es: {
    sending: 'Enviando...',
    submit:  'Enviar enlace de acceso',
    error:   'Ocurrió un error. Inténtalo de nuevo.',
    sent:    '¡Enlace enviado! Revisa tu correo.',
  },
};

const form    = document.getElementById('login-form');
const input   = document.getElementById('email-input');
const btn     = document.getElementById('send-btn');
const message = document.getElementById('login-message');

// Handle auth callback: if Supabase redirected here with ?code= (email confirmation),
// exchange the code for a session and go to dashboard immediately.
(async function () {
  const _urlCode = new URLSearchParams(window.location.search).get('code');
  if (_urlCode) {
    const { data } = await supabase.auth.exchangeCodeForSession(_urlCode);
    if (data?.session?.user) { window.location.href = 'dashboard.html'; return; }
  }
  // Redirect already-authenticated users to dashboard.
  // Use getUser() (network check) instead of getSession() (localStorage-only) to avoid
  // redirecting on stale/partial sessions that would cause a login↔dashboard loop.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) window.location.href = 'dashboard.html';
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

  btn.disabled = true;
  message.textContent = '';
  message.className = '';

  const copy = COPY[document.documentElement.lang] || COPY.en;
  btn.textContent = copy.sending;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'https://seculopt.com/dashboard.html',
    },
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = copy.submit;
    message.textContent = copy.error;
    message.className = 'auth-message auth-message--error';
    return;
  }

  // Success
  form.style.display = 'none';
  message.textContent = copy.sent;
  message.className = 'auth-message auth-message--success';
});

// Resend confirmation email
if (resendBtn) {
  resendBtn.addEventListener('click', async function () {
    const email = emailInput.value.trim();
    const lang  = document.documentElement.lang || 'pt';
    if (!email) {
      if (resendMsg) { resendMsg.textContent = lang === 'pt' ? 'Introduz o teu email acima.' : 'Enter your email above.'; resendMsg.style.display = 'block'; }
      return;
    }
    resendBtn.disabled = true;
    resendBtn.textContent = lang === 'pt' ? 'A enviar...' : 'Sending...';
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    resendBtn.disabled = false;
    resendBtn.textContent = lang === 'pt' ? 'Reenviar email de confirmação' : 'Resend confirmation email';
    if (resendMsg) {
      resendMsg.style.display = 'block';
      resendMsg.textContent = error
        ? (lang === 'pt' ? 'Erro ao reenviar. Tenta de novo.' : 'Error resending. Please try again.')
        : (lang === 'pt' ? 'Email reenviado! Verifica a tua caixa de entrada.' : 'Email sent! Check your inbox.');
    }
  });
}
