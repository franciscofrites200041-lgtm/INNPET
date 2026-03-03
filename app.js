// ===== INNPET — Application Logic =====

const DEFAULTS = {
  supabaseUrl: 'https://czagpuxrnucbpjcprwvs.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6YWdwdXhybnVjYnBqY3Byd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDI3MjYsImV4cCI6MjA4ODExODcyNn0.K2o4QhbmEYzyoqRi0_qxKhPSbHI9MCVbvmmcPQ69dkw',
  webhookUrl: 'https://n8n-mg.orkamdz.xyz/webhook/faaa3335-8b2a-4980-b093-eb8b41f0adc6',
};

let supabaseClient = null;

const App = {
  supabaseUrl: localStorage.getItem('innpet_sb_url') || DEFAULTS.supabaseUrl,
  supabaseKey: localStorage.getItem('innpet_sb_key') || DEFAULTS.supabaseKey,
  webhookUrl: localStorage.getItem('innpet_webhook') || DEFAULTS.webhookUrl,
  sessionId: localStorage.getItem('innpet_session') || genId(),

  records: [],
  convos: JSON.parse(localStorage.getItem('innpet_convos') || '[]'),
  current: null,
  typing: false,
  tab: 'chats',
  el: {},

  // ===== INIT =====
  async init() {
    this.cacheDom();
    this.bind();
    this.initSupabase();
    await this.loadRecords();
    this.renderConvos();
    this.updateStatus();
    this.showWelcome();
  },

  cacheDom() {
    const $ = id => document.getElementById(id);
    this.el = {
      chatArea: $('chatArea'), msgs: $('messagesContainer'), welcome: $('welcomeScreen'),
      input: $('chatInput'), sendBtn: $('sendBtn'),
      newBtn: $('newChatBtn'), sidebar: $('sidebar'), overlay: $('sidebarOverlay'),
      toggle: $('sidebarToggle'), list: $('sidebarContent'),
      settingsBtn: $('settingsBtn'), settingsModal: $('settingsModal'),
      sbUrl: $('supabaseUrlInput'), sbKey: $('supabaseKeyInput'), whUrl: $('webhookInput'),
      saveBtn: $('saveSettingsBtn'), cancelBtn: $('cancelSettingsBtn'), closeBtn: $('closeSettingsBtn'),
      panel: $('recordsPanel'), panelBody: $('recordsPanelBody'), panelClose: $('recordsPanelClose'),
      recordsBtn: $('recordsBtn'), addBtn: $('addRecordBtn'),
      formModal: $('recordFormModal'), form: $('recordForm'),
      formTitle: $('recordFormTitle'), formClose: $('closeRecordFormBtn'), formCancel: $('cancelRecordFormBtn'),
      dotDb: $('statusDotDb'), txtDb: $('statusTextDb'),
      dot: $('statusDot'), txt: $('statusText'),
      navChats: $('navChats'), navRecords: $('navRecords'),
      toast: $('toast'),
    };
  },

  bind() {
    const { el } = this;
    el.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); } });
    el.input.addEventListener('input', () => { this.resize(); el.sendBtn.disabled = !el.input.value.trim(); });
    el.sendBtn.addEventListener('click', () => this.send());
    el.newBtn.addEventListener('click', () => this.newConvo());
    el.toggle.addEventListener('click', () => this.toggleSidebar());
    el.overlay.addEventListener('click', () => this.closeSidebar());
    el.navChats.addEventListener('click', () => this.switchTab('chats'));
    el.navRecords.addEventListener('click', () => this.switchTab('records'));
    el.settingsBtn.addEventListener('click', () => this.openSettings());
    el.saveBtn.addEventListener('click', () => this.saveSettings());
    el.cancelBtn.addEventListener('click', () => this.closeSettings());
    el.closeBtn.addEventListener('click', () => this.closeSettings());
    el.settingsModal.addEventListener('click', e => { if (e.target === el.settingsModal) this.closeSettings(); });
    el.recordsBtn.addEventListener('click', () => this.togglePanel());
    el.panelClose.addEventListener('click', () => this.closePanel());
    el.addBtn.addEventListener('click', () => this.openForm());
    el.formClose.addEventListener('click', () => this.closeForm());
    el.formCancel.addEventListener('click', () => this.closeForm());
    el.formModal.addEventListener('click', e => { if (e.target === el.formModal) this.closeForm(); });
    el.form.addEventListener('submit', e => { e.preventDefault(); this.submitForm(); });
    document.querySelectorAll('.prompt-card').forEach(c => {
      c.addEventListener('click', () => { el.input.value = c.dataset.prompt; el.sendBtn.disabled = false; el.input.focus(); });
    });
  },

  // ===== SUPABASE =====
  initSupabase() {
    if (this.supabaseUrl && this.supabaseKey && window.supabase) {
      try { supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseKey); }
      catch (e) { console.error('Supabase init:', e); supabaseClient = null; }
    }
  },

  async loadRecords() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('clinical_records').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        this.records = data;
        return;
      } catch (e) { console.warn('Supabase fetch failed, using fallback:', e.message); }
    }
    this.records = this.fallbackRecords();
  },

  async createRecord(rec) {
    if (!supabaseClient) { this.toast('Configurá Supabase primero', 'err'); return null; }
    const maxN = this.records.reduce((m, r) => { const n = parseInt(r.id.replace('PAT-', ''), 10); return n > m ? n : m; }, 0);
    rec.id = 'PAT-' + String(maxN + 1).padStart(3, '0');
    const { data, error } = await supabaseClient.from('clinical_records').insert(rec).select().single();
    if (error) { this.toast('Error al crear: ' + error.message, 'err'); return null; }
    this.records.push(data);
    this.toast('Paciente ' + data.name + ' (' + data.id + ') creado', 'ok');
    if (this.tab === 'records') this.renderRecords();
    return data;
  },

  async updateRecord(id, upd) {
    if (!supabaseClient) { this.toast('Configurá Supabase primero', 'err'); return null; }
    const { data, error } = await supabaseClient.from('clinical_records').update(upd).eq('id', id).select().single();
    if (error) { this.toast('Error al actualizar: ' + error.message, 'err'); return null; }
    const i = this.records.findIndex(r => r.id === id);
    if (i >= 0) this.records[i] = data;
    this.toast('Paciente ' + data.name + ' actualizado', 'ok');
    if (this.tab === 'records') this.renderRecords();
    return data;
  },

  async deleteRecord(id) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.from('clinical_records').delete().eq('id', id);
    if (error) { this.toast('Error al eliminar: ' + error.message, 'err'); return; }
    this.records = this.records.filter(r => r.id !== id);
    this.toast('Paciente eliminado', 'ok');
    if (this.tab === 'records') this.renderRecords();
    this.closePanel();
  },

  // ===== FORM =====
  openForm(edit = null) {
    this.el.form.reset();
    document.getElementById('rf_editId').value = '';
    if (edit) {
      this.el.formTitle.textContent = 'Editar paciente';
      document.getElementById('rf_editId').value = edit.id;
      document.getElementById('rf_name').value = edit.name || '';
      document.getElementById('rf_species').value = edit.species || '';
      document.getElementById('rf_breed').value = edit.breed || '';
      document.getElementById('rf_age').value = edit.age || '';
      document.getElementById('rf_weight').value = edit.weight || '';
      document.getElementById('rf_sex').value = edit.sex || '';
      document.getElementById('rf_color').value = edit.color || '';
      document.getElementById('rf_microchip').value = edit.microchip || '';
      document.getElementById('rf_owner_name').value = edit.owner?.name || '';
      document.getElementById('rf_owner_phone').value = edit.owner?.phone || '';
      document.getElementById('rf_owner_email').value = edit.owner?.email || '';
      document.getElementById('rf_owner_address').value = edit.owner?.address || '';
      document.getElementById('rf_allergies').value = (edit.allergies || []).join(', ');
      document.getElementById('rf_conditions').value = (edit.conditions || []).join(', ');
    } else {
      this.el.formTitle.textContent = 'Nuevo paciente';
    }
    this.el.formModal.classList.add('open');
  },

  closeForm() { this.el.formModal.classList.remove('open'); },

  async submitForm() {
    const editId = document.getElementById('rf_editId').value;
    const a = document.getElementById('rf_allergies').value;
    const c = document.getElementById('rf_conditions').value;
    const rec = {
      name: document.getElementById('rf_name').value.trim(),
      species: document.getElementById('rf_species').value,
      breed: document.getElementById('rf_breed').value.trim(),
      age: document.getElementById('rf_age').value.trim(),
      weight: document.getElementById('rf_weight').value.trim(),
      sex: document.getElementById('rf_sex').value.trim(),
      color: document.getElementById('rf_color').value.trim(),
      microchip: document.getElementById('rf_microchip').value.trim(),
      owner: {
        name: document.getElementById('rf_owner_name').value.trim(),
        phone: document.getElementById('rf_owner_phone').value.trim(),
        email: document.getElementById('rf_owner_email').value.trim(),
        address: document.getElementById('rf_owner_address').value.trim(),
      },
      allergies: a ? a.split(',').map(s => s.trim()).filter(Boolean) : [],
      conditions: c ? c.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    if (editId) { await this.updateRecord(editId, rec); }
    else { rec.vaccinations = []; rec.visits = []; rec.lab_results = []; await this.createRecord(rec); }
    this.closeForm();
  },

  // ===== SIDEBAR =====
  switchTab(t) {
    this.tab = t;
    this.el.navChats.classList.toggle('active', t === 'chats');
    this.el.navRecords.classList.toggle('active', t === 'records');
    t === 'chats' ? this.renderConvos() : this.renderRecords();
  },

  renderRecords() {
    if (!this.records.length) {
      this.el.list.innerHTML = '<div class="empty-state"><p>No hay pacientes registrados</p></div>';
      return;
    }
    const icon = species => species === 'Perro'
      ? '<svg class="species-badge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
      : '<svg class="species-badge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    this.el.list.innerHTML = this.records.map(r => `
      <div class="record-entry" onclick="App.showDetail('${r.id}')">
        <div class="pet-name">${icon(r.species)} ${esc(r.name)} <span style="font-size:10px;color:var(--text-4);font-weight:400;">${r.id}</span></div>
        <div class="pet-sub">${esc(r.breed)} · ${r.age} · ${r.weight}</div>
      </div>`).join('');
  },

  showDetail(id) {
    const r = this.records.find(x => x.id === id);
    if (!r) return;
    this.el.panelBody.innerHTML = this.detailHTML(r);
    this.el.panel.classList.add('open');
  },

  detailHTML(r) {
    const o = r.owner || {};
    const allerg = (r.allergies || []);
    const conds = (r.conditions || []);
    const vax = (r.vaccinations || []);
    const visits = (r.visits || []);
    const labs = (r.lab_results || r.labResults || []);

    const allergHTML = allerg.length ? allerg.map(a => `<span class="tag tag-warn">${esc(a)}</span>`).join('') : '<span class="tag tag-ok">Sin alergias conocidas</span>';
    const condsHTML = conds.length ? conds.map(c => `<span class="tag tag-err">${esc(c)}</span>`).join('') : '<span class="tag tag-ok">Sin condiciones</span>';

    const vaxHTML = vax.map(v => `<div class="detail-row"><span class="detail-label">${esc(v.vaccine)}</span><span class="detail-value">${v.date}</span></div>`).join('') || '<p style="font-size:12px;color:var(--text-4);">Sin vacunas</p>';

    const visitsHTML = visits.map(v => `
      <div class="visit-entry">
        <div class="visit-date">${v.date}${v.vet ? ' — ' + esc(v.vet) : ''}</div>
        <div class="visit-reason">${esc(v.reason || '')}</div>
        <div class="visit-diag">${esc(v.diagnosis || '')}</div>
        <div class="visit-treat">${esc(v.treatment || '')}</div>
        ${(v.prescriptions || []).length ? '<div style="margin-top:5px;">' + v.prescriptions.map(p => '<span class="tag">' + esc(p) + '</span>').join('') + '</div>' : ''}
        ${v.vitals ? '<div class="visit-vitals">' + (v.vitals.temperature || '-') + ' | ' + (v.vitals.heartRate || '-') + ' | ' + (v.vitals.respRate || '-') + ' | ' + (v.vitals.weight || '-') + '</div>' : ''}
      </div>`).join('') || '<p style="font-size:12px;color:var(--text-4);">Sin visitas</p>';

    const labsHTML = labs.map(l => `
      <div class="visit-entry">
        <div class="visit-date">${l.date} — ${esc(l.type || '')}</div>
        ${Object.entries(l.results || {}).map(([k, v]) => '<div class="detail-row"><span class="detail-label">' + esc(k) + '</span><span class="detail-value">' + esc(String(v)) + '</span></div>').join('')}
      </div>`).join('') || '<p style="font-size:12px;color:var(--text-4);">Sin resultados</p>';

    return `
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="btn-ghost" onclick="App.openForm(App.records.find(r=>r.id==='${r.id}'))">Editar</button>
        <button class="btn-danger-outline" onclick="if(confirm('Eliminar a ${esc(r.name)}?'))App.deleteRecord('${r.id}')">Eliminar</button>
      </div>
      <div class="detail-card">
        <h3>${esc(r.name)}</h3>
        <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value">${r.id}</span></div>
        <div class="detail-row"><span class="detail-label">Especie</span><span class="detail-value">${esc(r.species)}</span></div>
        <div class="detail-row"><span class="detail-label">Raza</span><span class="detail-value">${esc(r.breed || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Edad</span><span class="detail-value">${r.age || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Peso</span><span class="detail-value">${r.weight || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Sexo</span><span class="detail-value">${esc(r.sex || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Color</span><span class="detail-value">${esc(r.color || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Microchip</span><span class="detail-value" style="font-size:11px;font-family:monospace;">${r.microchip || '-'}</span></div>
      </div>
      <div class="detail-card">
        <h3>Propietario</h3>
        <div class="detail-row"><span class="detail-label">Nombre</span><span class="detail-value">${esc(o.name || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Teléfono</span><span class="detail-value">${esc(o.phone || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value" style="font-size:11px;">${esc(o.email || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Dirección</span><span class="detail-value" style="font-size:11px;">${esc(o.address || '-')}</span></div>
      </div>
      <div class="detail-card"><h3>Alergias</h3><div style="padding:3px 0;">${allergHTML}</div></div>
      <div class="detail-card"><h3>Condiciones</h3><div style="padding:3px 0;">${condsHTML}</div></div>
      <div class="detail-card"><h3>Vacunas</h3>${vaxHTML}</div>
      <div class="detail-card"><h3>Visitas</h3>${visitsHTML}</div>
      <div class="detail-card"><h3>Laboratorio</h3>${labsHTML}</div>`;
  },

  // ===== CONVOS =====
  newConvo() {
    const c = { id: Date.now().toString(), title: 'Nueva consulta', messages: [], createdAt: new Date().toISOString() };
    this.convos.unshift(c);
    this.current = c;
    this.saveConvos();
    this.renderConvos();
    this.showChat();
    this.el.msgs.innerHTML = '';
    this.closeSidebar();
    this.el.input.focus();
  },

  loadConvo(id) {
    const c = this.convos.find(x => x.id === id);
    if (!c) return;
    this.current = c;
    this.renderConvos();
    this.showChat();
    this.el.msgs.innerHTML = '';
    c.messages.forEach(m => this.addMsg(m.role, m.content, false));
    this.scrollDown();
    this.closeSidebar();
  },

  renderConvos() {
    if (this.tab !== 'chats') return;
    if (!this.convos.length) {
      this.el.list.innerHTML = '<div class="empty-state"><p>No hay consultas aún.<br>Iniciá una nueva consulta.</p></div>';
      return;
    }
    this.el.list.innerHTML = this.convos.map(c => `
      <div class="s-item ${this.current?.id === c.id ? 'active' : ''}" onclick="App.loadConvo('${c.id}')">
        <span class="s-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <span class="s-label">${esc(c.title)}</span>
      </div>`).join('');
  },

  saveConvos() { localStorage.setItem('innpet_convos', JSON.stringify(this.convos)); },

  // ===== MESSAGES =====
  async send() {
    const text = this.el.input.value.trim();
    if (!text || this.typing) return;
    if (!this.current) this.newConvo();
    if (!this.current.messages.length) {
      this.current.title = text.substring(0, 50) + (text.length > 50 ? '...' : '');
      this.renderConvos();
    }
    this.showChat();
    this.current.messages.push({ role: 'user', content: text });
    this.addMsg('user', text);
    this.saveConvos();
    this.el.input.value = '';
    this.el.sendBtn.disabled = true;
    this.resize();
    this.showTyping();
    try {
      const res = await this.callWebhook(text);
      this.hideTyping();
      if (res.action) await this.handleAction(res);
      const out = res.output || res.response || res.message || res.text || (typeof res === 'string' ? res : JSON.stringify(res));
      this.current.messages.push({ role: 'bot', content: out });
      this.addMsg('bot', out);
      this.saveConvos();
    } catch (e) {
      this.hideTyping();
      const err = 'No se pudo conectar con el asistente. Verificá la URL del webhook en la configuración.';
      this.current.messages.push({ role: 'bot', content: err });
      this.addMsg('bot', err);
      this.saveConvos();
    }
  },

  async callWebhook(msg) {
    if (!this.webhookUrl) return { output: 'Webhook no configurado. Ingresá la URL del webhook en Configuración.' };
    const r = await fetch(this.webhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, sessionId: this.sessionId, action: 'sendMessage' })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  },

  async handleAction(res) {
    const { action, data } = res;
    if (!data) return;
    if (action === 'create_record') await this.createRecord(data);
    else if (action === 'update_record' && data.id) await this.updateRecord(data.id, data);
    else if (action === 'add_visit' && data.patient_id) {
      const p = this.records.find(r => r.id === data.patient_id);
      if (p) { const v = [...(p.visits || [])]; v.unshift(data.visit); await this.updateRecord(data.patient_id, { visits: v }); }
    } else if (action === 'refresh') { await this.loadRecords(); if (this.tab === 'records') this.renderRecords(); }
  },

  addMsg(role, content, anim = true) {
    const d = document.createElement('div');
    d.className = 'msg ' + role;
    if (anim) d.style.animation = 'msgIn 0.25s ease';
    const av = role === 'user' ? 'Tu' : 'IP';
    const nm = role === 'user' ? 'Tú' : 'INNPET';
    d.innerHTML = `<div class="msg-inner"><div class="msg-avatar">${av}</div><div class="msg-body"><div class="msg-role">${nm}</div><div class="msg-text">${this.fmt(content)}</div></div></div>`;
    this.el.msgs.appendChild(d);
    this.scrollDown();
  },

  fmt(t) {
    let h = esc(t);
    h = h.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*(.*?)\*/g, '<em>$1</em>');
    h = h.replace(/`(.*?)`/g, '<code>$1</code>');
    h = h.replace(/\n/g, '<br>');
    return h;
  },

  showTyping() {
    this.typing = true;
    const d = document.createElement('div');
    d.className = 'msg bot'; d.id = 'typingMsg';
    d.innerHTML = '<div class="msg-inner"><div class="msg-avatar">IP</div><div class="msg-body"><div class="msg-role">INNPET</div><div class="typing"><span></span><span></span><span></span></div></div></div>';
    this.el.msgs.appendChild(d);
    this.scrollDown();
  },
  hideTyping() { this.typing = false; const t = document.getElementById('typingMsg'); if (t) t.remove(); },

  showWelcome() { this.el.welcome.style.display = 'flex'; this.el.msgs.style.display = 'none'; },
  showChat() { this.el.welcome.style.display = 'none'; this.el.msgs.style.display = 'block'; },
  scrollDown() { this.el.chatArea.scrollTop = this.el.chatArea.scrollHeight; },
  resize() { const i = this.el.input; i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 180) + 'px'; },

  toggleSidebar() { this.el.sidebar.classList.toggle('open'); this.el.overlay.classList.toggle('active'); },
  closeSidebar() { this.el.sidebar.classList.remove('open'); this.el.overlay.classList.remove('active'); },

  // ===== SETTINGS =====
  openSettings() {
    this.el.sbUrl.value = this.supabaseUrl;
    this.el.sbKey.value = this.supabaseKey;
    this.el.whUrl.value = this.webhookUrl;
    this.el.settingsModal.classList.add('open');
  },
  closeSettings() { this.el.settingsModal.classList.remove('open'); },

  async saveSettings() {
    this.supabaseUrl = this.el.sbUrl.value.trim() || DEFAULTS.supabaseUrl;
    this.supabaseKey = this.el.sbKey.value.trim() || DEFAULTS.supabaseKey;
    this.webhookUrl = this.el.whUrl.value.trim() || DEFAULTS.webhookUrl;
    localStorage.setItem('innpet_sb_url', this.supabaseUrl);
    localStorage.setItem('innpet_sb_key', this.supabaseKey);
    localStorage.setItem('innpet_webhook', this.webhookUrl);
    this.initSupabase();
    await this.loadRecords();
    this.updateStatus();
    if (this.tab === 'records') this.renderRecords();
    this.closeSettings();
    this.toast('Configuración guardada', 'ok');
  },

  updateStatus() {
    this.el.dotDb.className = supabaseClient ? 'dot ok' : 'dot err';
    this.el.txtDb.textContent = supabaseClient ? 'Base de datos conectada' : 'Base de datos sin conectar';
    this.el.dot.className = this.webhookUrl ? 'dot ok' : 'dot err';
    this.el.txt.textContent = this.webhookUrl ? 'Asistente conectado' : 'Asistente sin configurar';
  },

  togglePanel() {
    this.el.panel.classList.toggle('open');
    if (this.el.panel.classList.contains('open') && this.records.length) this.showDetail(this.records[0].id);
  },
  closePanel() { this.el.panel.classList.remove('open'); },

  toast(msg, type = 'ok') {
    this.el.toast.textContent = msg;
    this.el.toast.className = 'toast ' + type + ' show';
    setTimeout(() => this.el.toast.classList.remove('show'), 3000);
  },

  // ===== FALLBACK =====
  fallbackRecords() {
    return [
      { "id": "PAT-001", "name": "Max", "species": "Perro", "breed": "Golden Retriever", "age": "5 años", "weight": "32 kg", "sex": "Macho", "color": "Dorado", "microchip": "985112345678901", "owner": { "name": "Carlos Mendoza", "phone": "+54 11 5555-1234", "email": "carlos.mendoza@email.com", "address": "Av. Libertador 1250, Buenos Aires" }, "vaccinations": [{ "vaccine": "Séxtuple", "date": "2025-03-15", "nextDue": "2026-03-15", "vet": "Dra. García" }, { "vaccine": "Antirrábica", "date": "2025-03-15", "nextDue": "2026-03-15", "vet": "Dra. García" }], "allergies": ["Pollo", "Ciertos antibióticos (amoxicilina)"], "conditions": ["Displasia de cadera leve", "Dermatitis alérgica estacional"], "visits": [{ "date": "2026-01-20", "reason": "Control de rutina", "diagnosis": "Buen estado general. Leve sobrepeso.", "treatment": "Dieta reducida en calorías.", "prescriptions": ["Condroitín sulfato 500mg"], "vitals": { "temperature": "38.5°C", "heartRate": "90 bpm", "respRate": "18 rpm", "weight": "32 kg" }, "vet": "Dra. García" }], "lab_results": [{ "date": "2026-01-20", "type": "Hemograma completo", "results": { "GR": "6.8 x10⁶/µL (normal)", "GB": "10.2 x10³/µL (normal)" } }] },
      { "id": "PAT-002", "name": "Luna", "species": "Gato", "breed": "Siamés", "age": "3 años", "weight": "4.2 kg", "sex": "Hembra (esterilizada)", "color": "Seal point", "microchip": "985112345678902", "owner": { "name": "María Fernández", "phone": "+54 11 5555-5678", "email": "maria.fernandez@email.com", "address": "Calle Florida 820, Buenos Aires" }, "vaccinations": [{ "vaccine": "Triple felina", "date": "2025-05-20", "nextDue": "2026-05-20", "vet": "Dr. López" }], "allergies": [], "conditions": ["Gingivitis leve"], "visits": [{ "date": "2026-02-10", "reason": "Inapetencia y letargia", "diagnosis": "Infección urinaria (cistitis).", "treatment": "Antibiótico oral. Dieta urinaria especial.", "prescriptions": ["Enrofloxacina 25mg"], "vitals": { "temperature": "39.2°C", "heartRate": "180 bpm", "respRate": "28 rpm", "weight": "4.0 kg" }, "vet": "Dr. López" }], "lab_results": [{ "date": "2026-02-10", "type": "Urianálisis", "results": { "pH": "7.8 (elevado)", "Cristales": "Estruvita (+)" } }] },
      { "id": "PAT-003", "name": "Rocky", "species": "Perro", "breed": "Bulldog Francés", "age": "2 años", "weight": "12.5 kg", "sex": "Macho", "color": "Atigrado", "microchip": "985112345678903", "owner": { "name": "Alejandro Ruiz", "phone": "+54 11 5555-9012", "email": "alejandro.ruiz@email.com", "address": "Av. Corrientes 3450, Buenos Aires" }, "vaccinations": [{ "vaccine": "Séxtuple", "date": "2025-09-01", "nextDue": "2026-09-01", "vet": "Dra. García" }], "allergies": ["Granos (trigo, maíz)"], "conditions": ["Síndrome braquicefálico", "Otitis crónica bilateral"], "visits": [{ "date": "2026-02-28", "reason": "Dificultad respiratoria", "diagnosis": "Exacerbación síndrome braquicefálico.", "treatment": "Antiinflamatorio. Evaluar cirugía correctiva.", "prescriptions": ["Prednisolona 5mg"], "vitals": { "temperature": "39.0°C", "heartRate": "120 bpm", "respRate": "35 rpm", "weight": "12.5 kg" }, "vet": "Dra. García" }], "lab_results": [] },
      { "id": "PAT-004", "name": "Michi", "species": "Gato", "breed": "Persa", "age": "7 años", "weight": "5.8 kg", "sex": "Macho (castrado)", "color": "Blanco", "microchip": "985112345678904", "owner": { "name": "Valentina Torres", "phone": "+54 11 5555-3456", "email": "valentina.torres@email.com", "address": "Calle Defensa 1100, Buenos Aires" }, "vaccinations": [{ "vaccine": "Triple felina", "date": "2025-07-10", "nextDue": "2026-07-10", "vet": "Dr. López" }], "allergies": ["Pescado crudo"], "conditions": ["Enfermedad renal crónica (estadio II IRIS)"], "visits": [{ "date": "2026-02-15", "reason": "Control renal trimestral", "diagnosis": "ERC estadio II estable.", "treatment": "Continuar con dieta renal.", "prescriptions": ["Dieta Royal Canin Renal", "Benazepril 2.5mg"], "vitals": { "temperature": "38.3°C", "heartRate": "160 bpm", "respRate": "24 rpm", "weight": "5.6 kg" }, "vet": "Dr. López" }], "lab_results": [{ "date": "2026-02-15", "type": "Panel renal", "results": { "Creatinina": "2.1 mg/dL", "BUN": "38 mg/dL" } }] },
      { "id": "PAT-005", "name": "Canela", "species": "Perro", "breed": "Mestizo", "age": "8 años", "weight": "18 kg", "sex": "Hembra (esterilizada)", "color": "Canela/Marrón", "microchip": "985112345678905", "owner": { "name": "Jorge Sánchez", "phone": "+54 11 5555-7890", "email": "jorge.sanchez@email.com", "address": "Av. Rivadavia 5600, Buenos Aires" }, "vaccinations": [{ "vaccine": "Séxtuple", "date": "2025-04-22", "nextDue": "2026-04-22", "vet": "Dra. García" }], "allergies": [], "conditions": ["Hipotiroidismo", "Artritis en miembros posteriores"], "visits": [{ "date": "2026-01-08", "reason": "Control de tiroides", "diagnosis": "Hipotiroidismo controlado.", "treatment": "Continuar levotiroxina.", "prescriptions": ["Levotiroxina 0.3mg"], "vitals": { "temperature": "38.4°C", "heartRate": "85 bpm", "respRate": "16 rpm", "weight": "18 kg" }, "vet": "Dra. García" }], "lab_results": [{ "date": "2026-01-08", "type": "Panel tiroideo", "results": { "T4 total": "2.8 µg/dL", "TSH": "0.35 ng/mL" } }] },
      { "id": "PAT-006", "name": "Simba", "species": "Gato", "breed": "Maine Coon", "age": "4 años", "weight": "7.5 kg", "sex": "Macho (castrado)", "color": "Tabby marrón", "microchip": "985112345678906", "owner": { "name": "Laura Giménez", "phone": "+54 11 5555-2345", "email": "laura.gimenez@email.com", "address": "Av. Santa Fe 2200, Buenos Aires" }, "vaccinations": [{ "vaccine": "Triple felina", "date": "2025-11-05", "nextDue": "2026-11-05", "vet": "Dra. García" }], "allergies": ["Látex (guantes de exploración)"], "conditions": ["Cardiomiopatía hipertrófica (HCM) leve"], "visits": [{ "date": "2026-02-20", "reason": "Ecocardiograma de control", "diagnosis": "HCM leve-moderada.", "treatment": "Iniciar atenolol.", "prescriptions": ["Atenolol 6.25mg"], "vitals": { "temperature": "38.4°C", "heartRate": "200 bpm", "respRate": "26 rpm", "weight": "7.5 kg" }, "vet": "Dra. García" }], "lab_results": [{ "date": "2026-02-20", "type": "ProBNP cardíaco", "results": { "NT-proBNP": "180 pmol/L" } }] }
    ];
  },
};

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function genId() { const id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('innpet_session', id); return id; }

document.addEventListener('DOMContentLoaded', () => App.init());
