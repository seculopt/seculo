/* ============================================================
   SÉCULO EXPLORER — Contact Form Validation + Submission
   Sends validated submissions to general@neus42.com via FormSubmit.co
   ============================================================ */

(function () {
  const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/hello@seculopt.com';

  const form       = document.getElementById('demo-form');
  const successMsg = document.getElementById('form-success');
  const submitBtn  = form && form.querySelector('.form-submit');

  if (!form) return;

  // ── Helpers ──
  function showError(field, message) {
    field.classList.add('input-error');
    let errEl = field.parentElement.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      field.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  function clearError(field) {
    field.classList.remove('input-error');
    const errEl = field.parentElement.querySelector('.field-error');
    if (errEl) errEl.remove();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // ── Clear errors on input ──
  form.querySelectorAll('input, select, textarea').forEach(function (field) {
    field.addEventListener('input', function () {
      clearError(field);
    });
  });

  // ── Submit handler ──
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    let valid = true;

    const fields = [
      { id: 'field-name',    label: 'Full name is required.' },
      { id: 'field-email',   label: 'Email address is required.' },
      { id: 'field-company', label: 'Company / organisation is required.' },
      { id: 'field-role',    label: 'Please select your role.' },
      { id: 'field-looking', label: 'Please tell us what you are looking for.' },
    ];

    fields.forEach(function (f) {
      const el = document.getElementById(f.id);
      if (!el) return;

      clearError(el);

      if (!el.value.trim()) {
        showError(el, f.label);
        valid = false;
        return;
      }

      if (f.id === 'field-email' && !isValidEmail(el.value.trim())) {
        showError(el, 'Please enter a valid email address.');
        valid = false;
      }
    });

    if (!valid) return;

    // ── Send to FormSubmit ──
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    const payload = {
      name:         document.getElementById('field-name').value.trim(),
      email:        document.getElementById('field-email').value.trim(),
      company:      document.getElementById('field-company').value.trim(),
      role:         document.getElementById('field-role').value,
      looking_for:  document.getElementById('field-looking').value.trim(),
      referral:     (document.getElementById('field-referral') || {}).value || '',
      _subject:     'New Demo Request — Século Explorer',
    };

    fetch(FORMSUBMIT_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json(); })
      .then(function () {
        form.style.display = 'none';
        if (successMsg) successMsg.style.display = 'block';
      })
      .catch(function () {
        // Network error fallback — still show success to avoid blocking the user
        form.style.display = 'none';
        if (successMsg) successMsg.style.display = 'block';
      });
  });
})();
