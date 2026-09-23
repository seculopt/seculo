// auth-forgot.js — forgot-password.html
// El usuario indica su email → Supabase envía el enlace de recuperación →
// el enlace abre reset-password.html con la sesión de recuperación en el hash.
// Restaurado 23-sep-2026: la página desapareció con el release del rediseño
// (084d2ae, 26-ago-2026) y desde entonces no había forma de recuperar la password.

import { supabase } from './supabase-client.js';

const form    = document.getElementById('forgot-form');
const emailIn = document.getElementById('email-input');
const btn     = document.getElementById('send-btn');
const message = document.getElementById('forgot-message');

const T = {
  en: { sending: 'Sending…', send: 'Send link',
        error: 'Something went wrong. Please try again.',
        ok: 'If that email is registered, you will receive a link to reset your password.' },
  pt: { sending: 'A enviar…', send: 'Enviar link',
        error: 'Ocorreu um erro. Por favor, tenta de novo.',
        ok: 'Se esse email estiver registado, vais receber um link para redefinir a password.' },
  es: { sending: 'Enviando…', send: 'Enviar enlace',
        error: 'Ha ocurrido un error. Inténtalo de nuevo.',
        ok: 'Si ese correo está registrado, recibirás un enlace para restablecer la contraseña.' },
};
const t = () => T[(window.getCurrentLang ? window.getCurrentLang() : document.documentElement.lang) || 'en'] || T.en;

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const email = emailIn.value.trim();
  if (!email) return;

  btn.disabled = true;
  btn.textContent = t().sending;
  message.textContent = '';
  message.className = 'auth-message';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://seculopt.com/reset-password.html',
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = t().send;
    message.textContent = t().error;
    message.className = 'auth-message auth-message--error';
    return;
  }

  // Éxito: siempre el mismo mensaje (no revelar si el email existe)
  form.style.display = 'none';
  message.textContent = t().ok;
  message.className = 'auth-message auth-message--success';
});
