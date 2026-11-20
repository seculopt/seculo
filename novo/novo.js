/* ============================================================
   SÉCULO /novo/ — puente Luneta → Século Explorer (paso 1, sin pago)
   El mapa (luneta.seculopt.com/?embed=seculo) avisa por postMessage de la
   zona FIJADA y de sus filtros; aquí se pinta la barra «Ver imóveis nesta
   zona» y se arma el enlace al buscador con esos filtros (lz_*), que el
   buscador lee al abrir y lanza la búsqueda.
   Paso 2 (pago): solo cambia el destino de este enlace.
   ============================================================ */
(function () {
  var ORIGENES = ['https://luneta.seculopt.com', 'https://seculo-api.vercel.app'];
  var BUSCADOR = 'https://seculo-api.vercel.app/';

  var bar  = document.getElementById('zonaBar');
  var nome = document.getElementById('zonaNome');
  var meta = document.getElementById('zonaMeta');
  var btn  = document.getElementById('zonaBtn');
  var zona = null;

  var T = {
    nivel: { dist: { en: 'district', pt: 'distrito', es: 'distrito' },
             conc: { en: 'municipality', pt: 'concelho', es: 'municipio' },
             freg: { en: 'parish', pt: 'freguesia', es: 'parroquia' } },
    op:    { buy: { en: 'buy', pt: 'compra', es: 'compra' },
             rent: { en: 'rent', pt: 'arrendamento', es: 'alquiler' } },
    tipo:  { all: null,
             apartment: { en: 'apartments', pt: 'apartamentos', es: 'apartamentos' },
             house: { en: 'houses', pt: 'moradias', es: 'casas' },
             terrain: { en: 'land', pt: 'terrenos', es: 'terrenos' },
             commercial: { en: 'commercial', pt: 'comercial', es: 'comercial' } }
  };
  function lang() { return (window.getCurrentLang && window.getCurrentLang()) || 'en'; }
  function t(o) { return o ? (o[lang()] || o.en) : null; }

  function pintar() {
    if (!zona) return;
    var partes = [t(T.nivel[zona.nivel])];
    if (zona.nivel === 'freg' && zona.concelho) partes[0] += ' · ' + zona.concelho;
    partes.push(t(T.op[zona.op]));
    var tp = t(T.tipo[zona.tipoImovel]);
    if (tp) partes.push(tp);
    if (zona.tipologia && zona.tipologia !== 'ALL') partes.push(zona.tipologia);
    nome.removeAttribute('data-en'); nome.removeAttribute('data-pt'); nome.removeAttribute('data-es');
    nome.textContent = zona.nome;
    meta.textContent = partes.filter(Boolean).join(' · ');
    bar.classList.add('is-set');

    var q = new URLSearchParams({
      tier: 'free',
      lz_nome: zona.nome,
      lz_nivel: zona.nivel,
      lz_op: zona.op,
      lz_tipo: zona.tipoImovel || 'all',
      lz_tipol: zona.tipologia || 'ALL',
      utm_source: 'seculo_novo', utm_medium: 'luneta'
    });
    if (zona.concelho) q.set('lz_conc', zona.concelho);
    btn.href = BUSCADOR + '?' + q.toString();
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.classList.remove('is-off');
    btn.removeAttribute('aria-disabled');
  }

  window.addEventListener('message', function (e) {
    if (ORIGENES.indexOf(e.origin) < 0) return;
    var d = e.data;
    if (!d || d.tipo !== 'luneta:zona' || !d.nome) return;
    zona = { nome: String(d.nome), nivel: d.nivel, concelho: d.concelho || null,
             op: d.op === 'rent' ? 'rent' : 'buy', tipoImovel: d.tipoImovel || 'all', tipologia: d.tipologia || 'ALL' };
    pintar();
  });

  document.addEventListener('seculo-lang-change', pintar);
})();
