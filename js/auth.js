// auth.js — login.html logic
// Magic link: user enters email → Supabase sends link → user clicks → session created

import { supabase } from './supabase-client.js';

const form    = document.getElementById('login-form');
const input   = document.getElementById('email-input');
const btn     = document.getElementById('send-btn');
const message = document.getElementById('login-message');

// If user is already logged in, redirect to dashboard
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = '/dashboard';
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = input.value.trim();
  if (!email) return;

  btn.disabled = true;
  message.textContent = '';
  message.className = '';

  const lang = document.documentElement.lang || 'pt';
  btn.textContent = lang === 'pt' ? 'A enviar...' : 'Sending...';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'https://seculopt.com/dashboard',
    },
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Enviar link de acesso' : 'Send login link';
    message.textContent = lang === 'pt'
      ? 'Ocorreu um erro. Por favor tenta de novo.'
      : 'Something went wrong. Please try again.';
    message.className = 'auth-message auth-message--error';
    return;
  }

  // Success
  form.style.display = 'none';
  message.textContent = lang === 'pt'
    ? 'Link enviado! Verifica o teu email.'
    : 'Link sent! Check your inbox.';
  message.className = 'auth-message auth-message--success';
});
