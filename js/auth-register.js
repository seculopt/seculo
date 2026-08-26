// auth-register.js — register.html logic
// Free user registration: name + email → Supabase signUp → confirmation email sent

import { supabase } from './supabase-client.js';

// Runtime copy for the three site languages. The page's static text comes from
// data-en/pt/es attributes; these are the strings only JS ever writes.
const COPY = {
  en: {
    creating: 'Creating account...',
    submit:   'Create account',
    error:    'Something went wrong. Please try again.',
    created:  'Account created! Check your email to log in.',
  },
  pt: {
    creating: 'A criar conta...',
    submit:   'Criar conta',
    error:    'Ocorreu um erro. Por favor tenta de novo.',
    created:  'Conta criada! Verifica o teu email para aceder.',
  },
  es: {
    creating: 'Creando cuenta...',
    submit:   'Crear cuenta',
    error:    'Ocurrió un error. Inténtalo de nuevo.',
    created:  '¡Cuenta creada! Revisa tu correo para acceder.',
  },
};

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

  const copy = COPY[document.documentElement.lang] || COPY.en;
  btn.textContent = copy.creating;

  const utm = (typeof window.SECULO_UTM === 'object') ? window.SECULO_UTM : {};

  const { error } = await supabase.auth.signUp({
    email,
    password: crypto.randomUUID(), // random password — user always uses magic link
    options: {
      data: { full_name: name, tier: 'free', ...utm },
      emailRedirectTo: 'https://seculopt.com' + returnUrl,
    },
  });

  if (error && error.message !== 'User already registered') {
    btn.disabled = false;
    btn.textContent = copy.submit;
    message.textContent = copy.error;
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
  message.textContent = copy.created;
  message.className = 'auth-message auth-message--success';
});
