// auth.js — login.html logic
// Supports two modes:
//   1. Email + password → signInWithPassword() (for testers / returning users with password)
//   2. Email only       → signInWithOtp()      (magic link, default for new users)

import { supabase } from './supabase-client.js';

const form       = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const pwInput    = document.getElementById('password-input');
const togglePw   = document.getElementById('toggle-pw');
const btn        = document.getElementById('send-btn');
const message    = document.getElementById('login-message');

// If user is already logged in, redirect to dashboard
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'dashboard.html';
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
  if (!email) return;

  const lang = document.documentElement.lang || 'pt';

  btn.disabled = true;
  message.textContent = '';
  message.className = '';

  const loadingText = lang === 'pt' ? 'A entrar...' : 'Signing in...';
  btn.textContent = loadingText;

  let error = null;

  if (password) {
    // Mode 1: email + password
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
  }

  if (error) {
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Entrar' : 'Log in';
    // Provide a clear error for wrong password without exposing security details
    const isCredentialError = error.message && (
      error.message.toLowerCase().includes('invalid') ||
      error.message.toLowerCase().includes('credentials') ||
      error.message.toLowerCase().includes('password')
    );
    message.textContent = isCredentialError
      ? (lang === 'pt' ? 'Email ou password incorretos.' : 'Invalid email or password.')
      : (lang === 'pt' ? 'Ocorreu um erro. Por favor tenta de novo.' : 'Something went wrong. Please try again.');
    message.className = 'auth-message auth-message--error';
    return;
  }

  // Magic link success (no error, no session yet — email sent)
  form.style.display = 'none';
  message.textContent = lang === 'pt'
    ? 'Link enviado! Verifica o teu email.'
    : 'Link sent! Check your inbox.';
  message.className = 'auth-message auth-message--success';
});
