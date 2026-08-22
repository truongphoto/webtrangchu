(() => {
  const CONFIG = window.TRUONG_AI_CONFIG || {};
  const API_URL = CONFIG.apiUrl || 'https://truong-gpp-vercel-backend.vercel.app/api/chat';
  const LOGO = CONFIG.logoUrl || './assets/logo.png';
  const BOT_NAME = CONFIG.botName || 'Trường GPP';
  const AUTHOR = CONFIG.author || 'Ngô Quang Trường';
  const MAX_HISTORY = 12;
  let history = [];
  let busy = false;

  const root = document.createElement('div');
  root.id = 'truong-ai-root';
  root.innerHTML = `
    <div class="truong-ai-fab" aria-label="Mở Trường GPP">
      <div class="truong-ai-hint">💬 Click vào để đặt câu hỏi</div>
      <button class="truong-ai-launcher" aria-label="Mở Trường GPP">
        <img src="${LOGO}" alt="Logo"><span class="badge"></span>
      </button>
    </div>
    <section class="truong-ai-panel" aria-label="${BOT_NAME}">
      <header class="truong-ai-header">
        <div class="truong-ai-headrow">
          <div class="truong-ai-avatar"><img src="${LOGO}" alt="Logo"></div>
          <div class="truong-ai-title">
            <strong>${BOT_NAME}</strong>
            <span>${AUTHOR}</span>
            <div class="truong-ai-online">● Đang hoạt động</div>
          </div>
          <button class="truong-ai-close" aria-label="Đóng">×</button>
        </div>
        <div class="truong-ai-tagline"><strong>Tư vấn GPHĐ Phòng khám, GPP, CCHN, CME Y-Dược &amp; Hiệu chuẩn TBYT</strong></div>
      </header>
      <div class="truong-ai-actions">
        <button class="truong-ai-chip" data-prompt="Tra cứu thuốc: ">💊 Tra cứu thuốc</button>
        <button class="truong-ai-chip" data-prompt="Tra cứu văn bản pháp luật hiện hành về: ">⚖️ Văn bản pháp luật</button>
        <button class="truong-ai-chip" data-prompt="Giải thích thuật ngữ Y-Dược: ">📚 Y-Dược</button>
        <button class="truong-ai-chip" data-prompt="">💬 Hỏi đáp</button>
      </div>
      <div class="truong-ai-messages" role="log" aria-live="polite"></div>
      <div class="truong-ai-compose">
        <div class="truong-ai-inputrow">
          <textarea class="truong-ai-input" rows="1" placeholder="Nhập câu hỏi của bạn..."></textarea>
          <button class="truong-ai-send" aria-label="Gửi">➤</button>
        </div>
        <div class="truong-ai-contact">☎ <a href="tel:0829076979">0829.076979</a> · Zalo: <strong>truongphotoart</strong></div>
        <div class="truong-ai-footer">AI hỗ trợ tra cứu thông tin. Nội dung Y-Dược không thay thế chẩn đoán, kê đơn hoặc tư vấn trực tiếp của người hành nghề.</div>
      </div>
    </section>`;
  document.body.appendChild(root);

  const fab = root.querySelector('.truong-ai-fab');
  const launcher = root.querySelector('.truong-ai-launcher');
  const panel = root.querySelector('.truong-ai-panel');
  const closeBtn = root.querySelector('.truong-ai-close');
  const messages = root.querySelector('.truong-ai-messages');
  const input = root.querySelector('.truong-ai-input');
  const sendBtn = root.querySelector('.truong-ai-send');

  function esc(s='') { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function inlineFormat(s='') {
    let out = esc(s);
    out = out.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    out = out.replace(/`([^`]+)`/g,'<code>$1</code>');
    out = out.replace(/\n/g,'<br>');
    return out;
  }
  function formatText(text='') {
    const lines = text.replace(/\r/g,'').split('\n');
    let html='', inUl=false, inOl=false;
    const closeLists=()=>{ if(inUl){html+='</ul>';inUl=false;} if(inOl){html+='</ol>';inOl=false;} };
    for(const raw of lines){
      const line=raw.trim();
      if(!line){closeLists(); continue;}
      if(/^[-*•]\s+/.test(line)){
        if(inOl){html+='</ol>';inOl=false;} if(!inUl){html+='<ul>';inUl=true;}
        html+=`<li>${inlineFormat(line.replace(/^[-*•]\s+/,''))}</li>`; continue;
      }
      if(/^\d+[.)]\s+/.test(line)){
        if(inUl){html+='</ul>';inUl=false;} if(!inOl){html+='<ol>';inOl=true;}
        html+=`<li>${inlineFormat(line.replace(/^\d+[.)]\s+/,''))}</li>`; continue;
      }
      closeLists(); html+=`<p>${inlineFormat(line)}</p>`;
    }
    closeLists(); return html || '<p>Không có nội dung.</p>';
  }
  function addMessage(role, text, sources=[]) {
    const row = document.createElement('div');
    row.className = `truong-ai-message ${role}`;
    const sourceHtml = sources.length ? `<div class="truong-ai-sources"><div class="truong-ai-sources-title">Nguồn tham khảo</div>${sources.slice(0,6).map((s,i)=>{
      const official = s.official ? '<span class="truong-ai-official">Chính thống</span>' : '';
      return `<a class="truong-ai-source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${i+1}. ${esc(s.title || s.url)}${official}</a>`;
    }).join('')}</div>` : '';
    if(role === 'bot'){
      row.innerHTML = `<div class="truong-ai-miniavatar"><img src="${LOGO}" alt=""></div><div class="truong-ai-bubble"><div class="truong-ai-label">${BOT_NAME} · ${AUTHOR}</div>${formatText(text)}${sourceHtml}</div>`;
    } else {
      row.innerHTML = `<div class="truong-ai-bubble">${formatText(text)}</div>`;
    }
    messages.appendChild(row); messages.scrollTop = messages.scrollHeight;
  }
  function showTyping(){
    const row=document.createElement('div'); row.className='truong-ai-message bot tq-typing-row';
    row.innerHTML=`<div class="truong-ai-miniavatar"><img src="${LOGO}" alt=""></div><div class="truong-ai-bubble"><div class="truong-ai-label">${BOT_NAME}</div><span class="truong-ai-typing"><i></i><i></i><i></i></span></div>`;
    messages.appendChild(row); messages.scrollTop=messages.scrollHeight;
  }
  function hideTyping(){ root.querySelector('.tq-typing-row')?.remove(); }
  function resize(){ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,104)+'px'; }

  async function ask(){
    const text=input.value.trim(); if(!text || busy) return;
    busy=true; sendBtn.disabled=true; input.value=''; resize(); addMessage('user',text); showTyping();
    const requestHistory = history.slice(-MAX_HISTORY);
    try{
      const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:requestHistory})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error || `Lỗi kết nối (${r.status})`);
      hideTyping(); addMessage('bot',data.answer || 'Mình chưa nhận được nội dung trả lời.',data.sources || []);
      history.push({role:'user',text},{role:'model',text:data.answer || ''});
      history=history.slice(-MAX_HISTORY);
    }catch(e){
      hideTyping(); addMessage('bot',`Hiện chưa kết nối được máy chủ AI. ${e.message || ''}\n\nVui lòng thử lại sau hoặc liên hệ 0829.076979.`);
    }finally{busy=false;sendBtn.disabled=false;input.focus();}
  }

  const POS_KEY = 'truong-gpp-chat-position-v1';
  let dragState = null;
  let suppressClick = false;

  function clampFab(x,y){
    const r=fab.getBoundingClientRect();
    const pad=8;
    const maxX=Math.max(pad,window.innerWidth-r.width-pad);
    const maxY=Math.max(pad,window.innerHeight-r.height-pad);
    return {x:Math.min(Math.max(x,pad),maxX),y:Math.min(Math.max(y,pad),maxY)};
  }
  function setFabPosition(x,y,save=false){
    const p=clampFab(x,y);
    fab.style.left=p.x+'px'; fab.style.top=p.y+'px';
    fab.style.right='auto'; fab.style.bottom='auto';
    if(save){ try{localStorage.setItem(POS_KEY,JSON.stringify(p));}catch(_){} }
  }
  function restoreFabPosition(){
    try{
      const p=JSON.parse(localStorage.getItem(POS_KEY)||'null');
      if(p && Number.isFinite(p.x) && Number.isFinite(p.y)) setFabPosition(p.x,p.y,false);
    }catch(_){}
  }
  function positionPanel(){
    if(!panel.classList.contains('is-open')) return;
    const fr=fab.getBoundingClientRect();
    const pr=panel.getBoundingClientRect();
    const pad=8, gap=12;
    let x = fr.left + fr.width/2 > window.innerWidth/2 ? fr.right-pr.width : fr.left;
    let y = fr.top-pr.height-gap;
    if(y<pad) y=fr.bottom+gap;
    x=Math.min(Math.max(x,pad),Math.max(pad,window.innerWidth-pr.width-pad));
    y=Math.min(Math.max(y,pad),Math.max(pad,window.innerHeight-pr.height-pad));
    panel.style.left=x+'px'; panel.style.top=y+'px'; panel.style.right='auto'; panel.style.bottom='auto';
  }
  function openPanel(){
    panel.classList.add('is-open'); root.classList.add('chat-open');
    requestAnimationFrame(()=>{positionPanel(); input.focus();});
  }
  function closePanel(){ panel.classList.remove('is-open'); root.classList.remove('chat-open'); }
  function togglePanel(){ panel.classList.contains('is-open') ? closePanel() : openPanel(); }

  fab.addEventListener('pointerdown',e=>{
    if(e.button!==undefined && e.button!==0) return;
    const r=fab.getBoundingClientRect();
    dragState={id:e.pointerId,startX:e.clientX,startY:e.clientY,offX:e.clientX-r.left,offY:e.clientY-r.top,moved:false};
    fab.classList.add('is-dragging');
    try{fab.setPointerCapture(e.pointerId);}catch(_){}
  });
  fab.addEventListener('pointermove',e=>{
    if(!dragState || e.pointerId!==dragState.id) return;
    const dx=e.clientX-dragState.startX, dy=e.clientY-dragState.startY;
    if(!dragState.moved && Math.hypot(dx,dy)>5) dragState.moved=true;
    if(!dragState.moved) return;
    e.preventDefault();
    setFabPosition(e.clientX-dragState.offX,e.clientY-dragState.offY,false);
    positionPanel();
  });
  function endDrag(e){
    if(!dragState || e.pointerId!==dragState.id) return;
    const moved=dragState.moved;
    dragState=null;
    fab.classList.remove('is-dragging');
    if(moved){
      const r=fab.getBoundingClientRect(); setFabPosition(r.left,r.top,true);
      suppressClick=true; setTimeout(()=>suppressClick=false,80);
    }
  }
  fab.addEventListener('pointerup',endDrag);
  fab.addEventListener('pointercancel',endDrag);
  fab.addEventListener('click',e=>{
    if(suppressClick){e.preventDefault();e.stopPropagation();return;}
    togglePanel();
  });
  closeBtn.addEventListener('click',closePanel);
  window.addEventListener('resize',()=>{
    const r=fab.getBoundingClientRect();
    if(fab.style.left) setFabPosition(r.left,r.top,false);
    positionPanel();
  });
  restoreFabPosition();
  sendBtn.addEventListener('click',ask);
  input.addEventListener('input',resize);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask();}});
  root.querySelectorAll('.truong-ai-chip').forEach(b=>b.addEventListener('click',()=>{input.value=b.dataset.prompt||'';resize();input.focus();}));

  addMessage('bot','Xin chào! Tôi là **Trường GPP**. Tôi hỗ trợ **tra cứu thuốc, kiến thức Y-Dược, văn bản pháp luật hiện hành và hỏi đáp thông thường**. Bạn muốn tìm thông tin gì?');
})();
