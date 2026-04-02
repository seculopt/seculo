// auth-register.js — register.html logic
// Flow: name + email + password → signUp → Supabase sends ONE confirmation email
// After confirmation, all future logins use email + password directly (no magic link).

import { supabase } from './supabase-client.js';

const form    = document.getElementById('register-form');
const nameIn  = document.getElementById('name-input');
const emailIn = document.getElementById('email-input');
const pwIn    = document.getElementById('password-input');
const togglePw = document.getElementById('toggle-pw');
const btn     = document.getElementById('register-btn');
const message = document.getElementById('register-message');

// If user is already logged in, redirect to dashboard
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'dashboard.html';
});

// Read ?action=share&prop=xxx from URL so we can redirect back after register
const params    = new URLSearchParams(window.location.search);
const action    = params.get('action');
const propId    = params.get('prop');
const returnUrl = (action === 'share' && propId)
  ? `/dashboard.html?action=share&prop=${propId}`
  : '/dashboard.html';

// Show/hide password toggle
if (togglePw) {
  togglePw.addEventListener('click', function () {
    const isHidden = pwIn.type === 'password';
    pwIn.type = isHidden ? 'text' : 'password';
    togglePw.textContent = isHidden ? '🙈' : '👁';
  });
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const name     = nameIn.value.trim();
  const email    = emailIn.value.trim();
  const password = pwIn.value;
  const lang     = document.documentElement.lang || 'pt';

  if (!name || !email || !password) return;

  if (password.length < 8) {
    message.textContent = lang === 'pt'
      ? 'A password deve ter pelo menos 8 caracteres.'
      : 'Password must be at least 8 characters.';
    message.className = 'auth-message auth-message--error';
    return;
  }

  btn.disabled = true;
  message.textContent = '';
  message.className = '';
  btn.textContent = lang === 'pt' ? 'A criar conta...' : 'Creating account...';

  const utm = (typeof window.SECULO_UTM === 'object') ? window.SECULO_UTM : {};

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, tier: 'free', ...utm },
      emailRedirectTo: 'https://seculopt.com' + returnUrl,
    },
  });

  if (error && error.message !== 'User already registered') {
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Criar conta' : 'Create account';
    message.textContent = lang === 'pt'
      ? 'Ocorreu um erro. Por favor tenta de novo.'
      : 'Something went wrong. Please try again.';
    message.className = 'auth-message auth-message--error';
    return;
  }

  if (error && error.message === 'User already registered') {
    // User exists — tell them to log in
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Criar conta' : 'Create account';
    message.innerHTML = lang === 'pt'
      ? 'Já tens uma conta. <a href="login.html">Entra aqui</a>.'
      : 'You already have an account. <a href="login.html">Log in here</a>.';
    message.className = 'auth-message auth-message--error';
    return;
  }

  // Success — confirmation email sent
  form.style.display = 'none';
  message.textContent = lang === 'pt'
    ? 'Conta criada! Verifica o teu email para confirmar e aceder.'
    : 'Account created! Check your email to confirm and log in.';
  message.className = 'auth-message auth-message--success';
});
