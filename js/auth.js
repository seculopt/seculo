// auth.js — login.html logic
// Dual flow (restaurado 28-ago-2026, base commit 93309a1):
//   · email + password  → signInWithPassword() → dashboard directo
//   · email solo        → signInWithOtp() (magic link)
// El release del rediseño (084d2ae) dejó solo el magic link y bloqueó las
// cuentas demo/white-label sin buzón; el merge previo (e3eca53) referenciaba
// variables sin declarar y el módulo moría al cargar. Esta versión unifica
// ambos flujos y conserva el manejo del callback ?code= y el resend.
// También la usa register.html para el botón de reenviar confirmación.

import { supabase } from './supabase-client.js';

const form      = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const pwInput   = document.getElementById('password-input');
const togglePw  = document.getElementById('toggle-pw');
const btn       = document.getElementById('send-btn');
const message   = document.getElementById('login-message');
const resendBtn = document.getElementById('resend-btn');
const resendMsg = document.getElementById('resend-message');

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
if (togglePw && pwInput) {
  togglePw.addEventListener('click', function () {
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    togglePw.textContent = isHidden ? '🙈' : '👁';
  });
}

if (form) form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email    = emailInput.value.trim();
  const password = pwInput ? pwInput.value : '';
  const lang     = document.documentElement.lang || 'pt';
  if (!email) return;

  btn.disabled = true;
  message.textContent = '';
  message.className = '';
  btn.textContent = lang === 'pt' ? 'A entrar...' : lang === 'es' ? 'Entrando...' : 'Signing in...';

  let error = null;

  if (password) {
    // Mode 1: email + password → sesión directa
    const { data, error: pwError } = await supabase.auth.signInWithPassword({ email, password });
    if (pwError) {
      error = pwError;
    } else if (data.session) {
      window.location.href = 'dashboard.html';
      return;
    }
  } else {
    // Mode 2: magic link (OTP)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://seculopt.com/dashboard.html' },
    });
    error = otpError;
    if (!error) {
      form.style.display = 'none';
      message.textContent = lang === 'pt' ? 'Link enviado! Verifica o teu email.'
                          : lang === 'es' ? '¡Enlace enviado! Revisa tu correo.'
                          : 'Link sent! Check your inbox.';
      message.className = 'auth-message auth-message--success';
      return;
    }
  }

  if (error) {
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Entrar' : lang === 'es' ? 'Entrar' : 'Log in';
    const isCredentialError = error.message && (
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('credentials') ||
      error.message.toLowerCase().includes('password')
    );
    message.textContent = isCredentialError
      ? (lang === 'pt' ? 'Email ou password incorretos.' : lang === 'es' ? 'Correo o contraseña incorrectos.' : 'Invalid email or password.')
      : (lang === 'pt' ? 'Ocorreu um erro. Por favor tenta de novo.' : lang === 'es' ? 'Ocurrió un error. Inténtalo de nuevo.' : 'Something went wrong. Please try again.');
    message.className = 'auth-message auth-message--error';
  }
});

// Resend confirmation email (register.html)
if (resendBtn) {
  resendBtn.addEventListener('click', async function () {
    const email = emailInput ? emailInput.value.trim() : '';
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
