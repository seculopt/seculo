// auth-register.js — register.html logic
// Free user registration: name + email → Supabase signUp → confirmation email sent

import { supabase } from './supabase-client.js';

const form    = document.getElementById('register-form');
const nameIn  = document.getElementById('name-input');
const emailIn = document.getElementById('email-input');
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

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const name  = nameIn.value.trim();
  const email = emailIn.value.trim();
  if (!name || !email) return;

  btn.disabled = true;
  message.textContent = '';
  message.className = '';

  const lang = document.documentElement.lang || 'pt';
  btn.textContent = lang === 'pt' ? 'A criar conta...' : 'Creating account...';

  const { error } = await supabase.auth.signUp({
    email,
    password: crypto.randomUUID(), // random password — user always uses magic link
    options: {
      data: { full_name: name, tier: 'free' },
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
    // User exists → send magic link instead
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://seculopt.com' + returnUrl },
    });
  }

  // Success either way
  form.style.display = 'none';
  message.textContent = lang === 'pt'
    ? 'Conta criada! Verifica o teu email para aceder.'
    : 'Account created! Check your email to log in.';
  message.className = 'auth-message auth-message--success';
});
