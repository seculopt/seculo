// auth.js — login.html logic
// Magic link: user enters email → Supabase sends link → user clicks → session created

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

// If user is already logged in, redirect to dashboard
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'dashboard.html';
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = input.value.trim();
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
