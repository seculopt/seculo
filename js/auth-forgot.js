// auth-forgot.js — forgot-password.html logic
// User enters email → Supabase sends password reset link → user clicks → reset-password.html

import { supabase } from './supabase-client.js';

const form    = document.getElementById('forgot-form');
const emailIn = document.getElementById('email-input');
const btn     = document.getElementById('send-btn');
const message = document.getElementById('forgot-message');

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = emailIn.value.trim();
  if (!email) return;

  const lang = document.documentElement.lang || 'pt';
  btn.disabled = true;
  btn.textContent = lang === 'pt' ? 'A enviar...' : 'Sending...';
  message.textContent = '';
  message.className = '';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://seculopt.com/reset-password.html',
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = lang === 'pt' ? 'Enviar link' : 'Send link';
    message.textContent = lang === 'pt'
      ? 'Ocorreu um erro. Por favor tenta de novo.'
      : 'Something went wrong. Please try again.';
    message.className = 'auth-message auth-message--error';
    return;
  }

  // Success — always show success (don't reveal whether email exists)
  form.style.display = 'none';
  message.textContent = lang === 'pt'
    ? 'Se esse email estiver registado, receberás um link para redefinir a password.'
    : 'If that email is registered, you will receive a password reset link.';
  message.className = 'auth-message auth-message--success';
});
