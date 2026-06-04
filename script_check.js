
const VERSION = 'v0.26.06.03.2340';
const SAVE_KEY = 'scrapShelterStage1_' + VERSION;
const LEGACY_SAVE_KEY = 'scrapShelterStage1';
const RESOURCE_KEYS = ['scrap','gears','wiring','batteries'];
const RESOURCE_LABELS = {scrap:'Scrap', gears:'Gears', wiring:'Wiring', batteries:'Batteries'};
const RESOURCE_ICONS = {scrap:'▣', gears:'⚙', wiring:'⌁', batteries:'▮'};
const ROOM_DATA = {
  workshop:{name:'Workshop', desc:'Central repair bench. Better condition keeps repairs reliable.', repair:{scrap:5,gears:2}, wear:0.7},
  generator:{name:'Generator', desc:'Powers the shelter. Low condition slows the whole base.', repair:{scrap:6,gears:2,wiring:1,batteries:1}, wear:0.95},
  water:{name:'Water Filter', desc:'Keeps the shelter stable. Low condition hurts morale and recovery.', repair:{scrap:4,wiring:2,batteries:1}, wear:0.8}
};
const SHAPES = [
  [[1]], [[1,1]], [[1],[1]], [[1,1,1]], [[1],[1],[1]], [[1,1],[1,0]], [[1,1],[0,1]], [[1,0],[1,1]], [[0,1],[1,1]], [[1,1],[1,1]], [[1,1,1],[0,1,0]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]]
];
let state;
let selectedPiece = 0;
let hoverAnchor = null;
let run = null;
let lastBoardPlaceAt = 0;
let suppressCompatClickUntil = 0;
let lastTouchPreviewAt = 0;
let mobilePreviewLocked = false;
let touchDragActive = false;
let activeTouchPointerId = null;
function defaultState(){return {day:1,hour:8,resources:{scrap:12,gears:3,wiring:2,batteries:1},rooms:{workshop:{condition:80,level:1},generator:{condition:65,level:1},water:{condition:70,level:1}},log:['Prototype initialized. The base is barely running, but recoverable.']};}
function newRun(reset){
  run={board:Array.from({length:8},()=>Array(8).fill(null)), pieces:[], rewards:{scrap:0,gears:0,wiring:0,batteries:0}, score:0, clears:0, placed:0, queueStep:1, nextPieceSeq:1, queueRenderCount:0, lastClear:null, bestClear:0, log:[]};
  selectedPiece=0; hoverAnchor=null; mobilePreviewLocked=false; dealPieces(); renderAll(); if(reset) toast('New puzzle run started.');
}
function dealPieces(){run.pieces = [makePiece(),makePiece(),makePiece()]; run.queueStep=run.queueStep||1; selectedPiece = 0; hoverAnchor=null; mobilePreviewLocked=false;}
function makePiece(){
  const shape=SHAPES[Math.floor(Math.random()*SHAPES.length)];
  const type=RESOURCE_KEYS[Math.floor(Math.random()*RESOURCE_KEYS.length)];
  if(run && (!Number.isFinite(run.nextPieceSeq) || run.nextPieceSeq < 1)) run.nextPieceSeq = Math.max(1, (run.queueStep||1) + (run.pieces?run.pieces.length:0));
  const seq = run ? run.nextPieceSeq++ : Math.floor(Math.random()*99999);
  return {shape,type,used:false,id:'piece-'+seq,seq};
}

function normalizeRunQueue(){
  if(!run) return;
  if(!Array.isArray(run.pieces)) run.pieces=[];
  run.pieces = run.pieces.filter(p=>p && !p.used).slice(0,3);
  while(run.pieces.length<3) run.pieces.push(makePiece());
  if(!Number.isFinite(run.queueStep) || run.queueStep < 1) run.queueStep = 1;
  if(!Number.isFinite(run.nextPieceSeq) || run.nextPieceSeq < run.queueStep + run.pieces.length){
    run.nextPieceSeq = run.queueStep + run.pieces.length;
  }
  run.pieces.forEach((piece, index)=>{
    if(!piece.seq) piece.seq = run.queueStep + index;
    if(!piece.id) piece.id = 'piece-' + piece.seq;
  });
  selectedPiece=0;
}
function showTab(tab){
  document.body.classList.toggle('puzzle-mode', tab==='puzzle');
  for(const id of ['base','puzzle','inventory']){document.getElementById(id+'View').classList.toggle('hidden', id!==tab); document.getElementById('tab'+cap(id)).classList.toggle('active', id===tab)}
  if(tab==='puzzle' && !run) newRun(false); renderAll();
}
function cap(s){return s[0].toUpperCase()+s.slice(1)}
function renderAll(){renderResources(); renderRooms(); renderStatus(); renderLog(); if(run){normalizeRunQueue(); renderBoard(); renderPieces(); renderSelectedBanner(); renderRunStats(); renderPuzzleLog();} saveGame(false);}
function renderResources(){
  const html = RESOURCE_KEYS.map(k=>`<div class="resource"><span><span class="dot ${k}"></span> <span class="label">${RESOURCE_LABELS[k]}</span></span><span class="value">${state.resources[k]}</span></div>`).join('');
  document.getElementById('resourceBar').innerHTML=html; document.getElementById('inventoryResources').innerHTML=html;
}
function conditionClass(c){return c<30?'bad':c<60?'warn':''}
function conditionLabel(c){return c<=0?'Offline':c<20?'Critical':c<40?'Damaged':c<70?'Worn':'Stable'}
function renderRooms(){
  document.getElementById('rooms').innerHTML = Object.keys(ROOM_DATA).map(id=>{
    const meta=ROOM_DATA[id], room=state.rooms[id], c=Math.round(room.condition), cost=costText(meta.repair), afford=canAfford(meta.repair);
    return `<div class="room"><div class="room-head"><div><div class="room-title">${meta.name} <span class="room-status">Lv ${room.level}</span></div><div class="room-status">${conditionLabel(c)} - ${c}%</div></div><button class="btn small ${afford?'good':''}" onclick="repairRoom('${id}')">Repair</button></div><div class="bar"><div class="fill ${conditionClass(c)}" style="width:${Math.max(0,c)}%"></div></div><p>${meta.desc}</p><div class="room-actions"><span class="cost">Repair cost: ${cost}</span><button class="btn small" onclick="upgradeRoom('${id}')">Upgrade</button></div></div>`
  }).join('');
}
function renderStatus(){
  const avg = Math.round(Object.values(state.rooms).reduce((a,r)=>a+r.condition,0)/Object.keys(state.rooms).length);
  const gen=state.rooms.generator.condition;
  document.getElementById('shelterStatus').innerHTML = `
    <div class="kv"><span>In-game time</span><strong>Day ${state.day}, ${String(state.hour).padStart(2,'0')}:00</strong></div>
    <div class="kv"><span>Average condition</span><strong>${avg}%</strong></div>
    <div class="kv"><span>Power state</span><strong>${gen<=0?'Offline':gen<40?'Unstable':'Online'}</strong></div>
    <div class="kv"><span>Prototype goal</span><strong>Survive 7 days</strong></div>
  `;
}
function renderLog(){document.getElementById('log').innerHTML = state.log.slice(-10).reverse().map(l=>`<div>${l}</div>`).join('') || '<div>No events yet.</div>';}
function renderBoard(){
  ensureBoardCells();
  updateBoardVisuals();
}
function ensureBoardCells(){
  const b=document.getElementById('board');
  if(!b) return;
  if(b.dataset.ready === '1' && b.querySelectorAll('.cell').length === 64) return;
  b.innerHTML='';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const cell=document.createElement('button');
    cell.type='button';
    cell.dataset.r=String(r);
    cell.dataset.c=String(c);
    cell.className='cell';
    cell.setAttribute('aria-label',`row ${r+1} column ${c+1}`);
    cell.onpointerenter=(event)=>{ if(event.pointerType==='mouse') setHoverAnchor(r,c); };
    cell.onpointermove=(event)=>{ if(event.pointerType==='mouse' && !touchDragActive) setHoverAnchor(r,c); };
    cell.onfocus=()=>setHoverAnchor(r,c);
    cell.onkeydown=(event)=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); setHoverAnchor(r,c); commitPreviewPlacement(); } };
    b.appendChild(cell);
  }
  b.dataset.ready='1';
  b.onpointerdown=handleBoardPointerDown;
  b.onpointermove=handleBoardPointerMove;
  b.onpointerup=handleBoardPointerUp;
  b.onpointercancel=handleBoardPointerCancel;
  b.onclick=handleBoardClick;
  b.onpointerleave=(event)=>{ if(event.pointerType==='mouse' && !mobilePreviewLocked){ hoverAnchor=null; applyGhostPreview(); renderSelectedBanner(); } };
}
function updateBoardVisuals(){
  const board=document.getElementById('board');
  if(!board || !run) return;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const cell=board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if(!cell) continue;
    const type=run.board[r][c];
    cell.classList.remove('occupied','scrap','gears','wiring','batteries','ghost-fit','ghost-blocked','anchor-cell');
    cell.style.removeProperty('--ghost-color');
    cell.dataset.occupied = type ? '1' : '0';
    const existing=cell.querySelector('.tile');
    if(type){
      cell.classList.add('occupied', type);
      if(!existing || existing.dataset.tileType !== type){
        cell.innerHTML='';
        const t=document.createElement('div');
        t.className='tile '+type;
        t.dataset.tileType=type;
        t.textContent=RESOURCE_ICONS[type];
        cell.appendChild(t);
      }
    }else if(existing){
      existing.remove();
    }
  }
  applyGhostPreview();
}
function paintPlacedCellsNow(cells){
  const board=document.getElementById('board');
  if(!board || !Array.isArray(cells)) return;
  cells.forEach(([r,c,type])=>{
    const cell=board.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    if(!cell) return;
    cell.classList.remove('ghost-fit','ghost-blocked','anchor-cell');
    cell.classList.add('occupied', type);
    cell.dataset.occupied='1';
    cell.innerHTML='';
    const t=document.createElement('div');
    t.className='tile '+type;
    t.dataset.tileType=type;
    t.textContent=RESOURCE_ICONS[type];
    cell.appendChild(t);
  });
}
function boardCellFromEvent(event){
  const cell = event.target.closest && event.target.closest('.cell');
  const board = document.getElementById('board');
  if(!cell || !board || !board.contains(cell)) return null;
  return {r:Number(cell.dataset.r), c:Number(cell.dataset.c)};
}
function boardCellFromPoint(x,y){
  const board = document.getElementById('board');
  if(!board) return null;
  const el = document.elementFromPoint(x,y);
  const cell = el && el.closest ? el.closest('.cell') : null;
  if(!cell || !board.contains(cell)) return null;
  return {r:Number(cell.dataset.r), c:Number(cell.dataset.c)};
}
function handleBoardPointerDown(event){
  const pos = boardCellFromEvent(event) || boardCellFromPoint(event.clientX,event.clientY);
  if(!pos) return;
  event.preventDefault();

  if(event.pointerType === 'touch' || event.pointerType === 'pen'){
    suppressCompatClickUntil = Date.now() + 900;
    touchDragActive = true;
    activeTouchPointerId = event.pointerId;
    mobilePreviewLocked = true;
    const board=document.getElementById('board');
    if(board && board.setPointerCapture){
      try{board.setPointerCapture(event.pointerId);}catch(e){}
    }
    setHoverAnchor(pos.r,pos.c);
    return;
  }

  setHoverAnchor(pos.r,pos.c);
  commitPreviewPlacement();
}
function handleBoardPointerMove(event){
  if(event.pointerType === 'touch' || event.pointerType === 'pen'){
    if(!touchDragActive || event.pointerId !== activeTouchPointerId) return;
    event.preventDefault();
    const pos = boardCellFromPoint(event.clientX,event.clientY);
    if(pos) setHoverAnchor(pos.r,pos.c);
    return;
  }
  const pos = boardCellFromEvent(event) || boardCellFromPoint(event.clientX,event.clientY);
  if(pos) setHoverAnchor(pos.r,pos.c);
}
function handleBoardPointerUp(event){
  if(event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
  if(!touchDragActive || event.pointerId !== activeTouchPointerId) return;
  event.preventDefault();
  suppressCompatClickUntil = Date.now() + 900;
  const pos = boardCellFromPoint(event.clientX,event.clientY) || hoverAnchor;
  if(pos) setHoverAnchor(pos.r,pos.c);
  const board=document.getElementById('board');
  if(board && board.releasePointerCapture){
    try{board.releasePointerCapture(event.pointerId);}catch(e){}
  }
  touchDragActive = false;
  activeTouchPointerId = null;
  mobilePreviewLocked = false;
  if(hoverAnchor && canPlace(getActivePiece(), hoverAnchor.r, hoverAnchor.c)){
    commitPreviewPlacement();
  }else{
    toast('That part will not fit there. Drag to a valid footprint and lift to place.');
  }
}
function handleBoardPointerCancel(event){
  if(event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
  touchDragActive = false;
  activeTouchPointerId = null;
  mobilePreviewLocked = false;
}
function handleBoardClick(event){
  const pos = boardCellFromEvent(event);
  if(!pos) return;
  event.preventDefault();
  if(Date.now() < suppressCompatClickUntil) return;
  if(Date.now() - lastBoardPlaceAt > 250){ setHoverAnchor(pos.r,pos.c); commitPreviewPlacement(); }
}
function applyGhostPreview(){
  const board=document.getElementById('board');
  if(!board || !run) return;
  const cells=[...board.querySelectorAll('.cell')];
  cells.forEach(cell=>{
    cell.classList.remove('ghost-fit','ghost-blocked','anchor-cell');
    cell.style.removeProperty('--ghost-color');
  });
  const piece=getActivePiece();
  const btn=document.getElementById('placePieceBtn');
  if(!piece || !hoverAnchor){
    if(btn){ btn.disabled=true; btn.textContent='Choose Preview Square'; }
    return;
  }
  const valid=canPlace(piece,hoverAnchor.r,hoverAnchor.c);
  const ghosts=ghostCellsRaw(piece,hoverAnchor.r,hoverAnchor.c);
  ghosts.forEach(([rr,cc])=>{
    const cell=board.querySelector(`.cell[data-r="${rr}"][data-c="${cc}"]`);
    if(cell){
      cell.classList.add(valid?'ghost-fit':'ghost-blocked');
      cell.style.setProperty('--ghost-color', `var(--${piece.type})`);
    }
  });
  const anchor=board.querySelector(`.cell[data-r="${hoverAnchor.r}"][data-c="${hoverAnchor.c}"]`);
  if(anchor) anchor.classList.add('anchor-cell');
  if(btn){
    btn.disabled=!valid;
    btn.textContent=valid?'Place Piece at Preview':'Preview Does Not Fit';
  }
}
function commitPreviewPlacement(){
  if(!hoverAnchor){toast('Choose a board square first.'); return;}
  lastBoardPlaceAt=Date.now();
  placeActive(hoverAnchor.r, hoverAnchor.c);
}
function clearPreviewAnchor(){
  hoverAnchor=null;
  mobilePreviewLocked=false;
  applyGhostPreview();
  renderSelectedBanner();
}
function renderPieces(){
  if(!run) return;
  normalizeRunQueue();
  const oldPanel=document.getElementById('pieces');
  const q=document.getElementById('queueDebug');
  if(!oldPanel) return;
  run.queueRenderCount = (run.queueRenderCount || 0) + 1;
  const signature = `${run.queueStep}|${run.pieces.map(piece=>piece.id).join('|')}|render${run.queueRenderCount}`;

  // Hard refresh the queue panel instead of only changing innerHTML. Some browser/mobile
  // combinations were visually keeping the original three piece cards even after the
  // queue state advanced, while the selected-banner state updated correctly.
  const freshPanel=document.createElement('div');
  freshPanel.className='pieces';
  freshPanel.id='pieces';
  freshPanel.dataset.queueSignature = signature;
  freshPanel.dataset.activePieceId = run.pieces[0] ? run.pieces[0].id : '';
  freshPanel.dataset.queueStep = String(run.queueStep || 1);
  run.pieces.forEach((piece,i)=>freshPanel.appendChild(pieceNode(piece,i)));
  oldPanel.replaceWith(freshPanel);

  if(q){
    const active=run.pieces[0];
    const previews=run.pieces.slice(1).map(piece=>`#${piece.seq || '?'} ${RESOURCE_LABELS[piece.type]}`).join(' → ');
    q.innerHTML = `<strong>Queue step ${run.queueStep}</strong> · Place #${active ? active.seq : '?'} ${active ? RESOURCE_LABELS[active.type] : 'None'} · Next: ${previews || 'none'} · UI refresh ${run.queueRenderCount}`;
  }
}
function pieceNode(piece,i){
  const rows=piece.shape.length, cols=Math.max(...piece.shape.map(r=>r.length));
  const slotLabel = i===0 ? 'Place now' : `Preview ${i}`;
  const label = `${slotLabel} #${piece.seq || ((run && run.queueStep ? run.queueStep : 1)+i)}`;
  const wrapper=document.createElement('div');
  wrapper.className=`piece ${i===0?'active-piece':'preview-piece'}`;
  wrapper.dataset.pieceId=piece.id||'';
  wrapper.dataset.queueSlot=String(i);
  wrapper.dataset.pieceSeq=String(piece.seq||'');

  const labelEl=document.createElement('span');
  labelEl.className='queue-label';
  labelEl.textContent=label;
  wrapper.appendChild(labelEl);

  const mini=document.createElement('div');
  mini.className='mini-grid';
  mini.style.gridTemplateColumns=`repeat(${cols},22px)`;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const cell=document.createElement('div');
    const filled=piece.shape[r][c];
    cell.className=`mini-cell ${filled?'filled '+piece.type:''}`;
    mini.appendChild(cell);
  }
  wrapper.appendChild(mini);

  const strong=document.createElement('strong');
  strong.textContent=`${RESOURCE_ICONS[piece.type]} ${RESOURCE_LABELS[piece.type]}`;
  wrapper.appendChild(strong);

  const note=document.createElement('span');
  note.className='tap-note';
  note.textContent=i===0?'Active piece · PC click · phone drag + lift':`Coming after #${run.pieces[i-1] ? run.pieces[i-1].seq : '?'}`;
  wrapper.appendChild(note);

  const id=document.createElement('span');
  id.className='tap-note';
  id.textContent=`ID ${(piece.id||'NEW').replace('piece-','#')}`;
  wrapper.appendChild(id);
  return wrapper;
}
function renderRunStats(){
  const total=RESOURCE_KEYS.reduce((sum,k)=>sum+(run.rewards[k]||0),0);
  const last=run.lastClear ? `${run.lastClear.lines} line${run.lastClear.lines>1?'s':''} · ${rewardText(run.lastClear.counts)}` : 'None yet';
  document.getElementById('runStats').innerHTML = `<div class="stat">Score<b>${run.score}</b></div><div class="stat">Pieces placed<b>${run.placed}</b></div><div class="stat">Line clears<b>${run.clears}</b></div><div class="stat highlight">Total salvage<b>${total}</b></div><div class="stat highlight" style="grid-column:1/-1">Last clear<b style="font-size:16px">${last}</b></div>` + RESOURCE_KEYS.map(k=>`<div class="stat">${RESOURCE_LABELS[k]}<b>${run.rewards[k]}</b></div>`).join('');
}
function renderPuzzleLog(){document.getElementById('puzzleLog').innerHTML = run.log.slice(-8).reverse().map(l=>`<div>${l}</div>`).join('') || '<div>Place the left part first. PC: hover/click. Phone: drag across the board to preview, then lift your finger to place.</div>';}
function renderSelectedBanner(){
  const el=document.getElementById('selectedBanner'); if(!el||!run) return;
  const piece=getActivePiece();
  if(!piece){el.innerHTML='<span>No part can fit.</span><b>Claim salvage or start a new puzzle.</b>'; return;}
  const fitText = hoverAnchor ? (canPlace(piece,hoverAnchor.r,hoverAnchor.c) ? 'Fits here — PC click places; phone users lift finger to place.' : 'Does not fit here.') : 'PC: hover/click. Phone: drag across the board to preview, then lift to place.';
  el.innerHTML=`<span>Current part: <b>${RESOURCE_LABELS[piece.type]}</b></span><span>${fitText}</span>`;
}
function getActivePiece(){ return run && run.pieces && run.pieces.length ? run.pieces[0] : null; }
function setHoverAnchor(r,c){
  hoverAnchor={r,c};
  applyGhostPreview();
  renderSelectedBanner();
}
function ghostCellsRaw(piece,r,c){
  const cells=[];
  for(let pr=0;pr<piece.shape.length;pr++) for(let pc=0;pc<piece.shape[pr].length;pc++) if(piece.shape[pr][pc]) cells.push([r+pr,c+pc]);
  return cells;
}
function ghostCells(piece,r,c){
  return ghostCellsRaw(piece,r,c).filter(([rr,cc])=>rr>=0&&rr<8&&cc>=0&&cc<8);
}
function placeActive(r,c){
  const piece=getActivePiece();
  if(!piece){toast('No part is available. Claim salvage or start a new puzzle.'); return;}
  if(!canPlace(piece,r,c)){hoverAnchor={r,c}; updateBoardVisuals(); renderSelectedBanner(); toast('That part will not fit there.'); return;}
  const placedCells=[];
  for(let pr=0;pr<piece.shape.length;pr++) for(let pc=0;pc<piece.shape[pr].length;pc++) if(piece.shape[pr][pc]){ run.board[r+pr][c+pc]=piece.type; placedCells.push([r+pr,c+pc,piece.type]); }
  run.lastPlacedCells=placedCells;
  // Paint immediately before any other state/UI work so the player gets instant visual confirmation.
  paintPlacedCellsNow(placedCells);
  run.placed++; run.score += countCells(piece.shape)*5; run.log.push(`Placed #${run.queueStep||1}: ${RESOURCE_LABELS[piece.type]} part from the front of the queue.`);
  advancePieceQueue();
  renderPieces(); // immediately rebuild queue cards before any later board/ghost updates
  hoverAnchor=null;
  mobilePreviewLocked=false;
  clearLines();
  updateBoardVisuals();
  if(!canPlaceAny(getActivePiece())) run.log.push('The next queued part has no legal placement. Claim salvage or start a new run.');
  renderResources(); renderPieces(); renderSelectedBanner(); renderRunStats(); renderPuzzleLog(); saveGame(false);
  // Force the queue panel to repaint after layout as a guard against stale mobile/browser rendering.
  requestAnimationFrame(()=>{ renderPieces(); updateBoardVisuals(); verifyQueuePanelFresh(); verifyPlacedTilesRendered(); });
}
function advancePieceQueue(){
  if(!run) return;
  run.pieces.shift();
  run.queueStep = (run.queueStep || 1) + 1;
  run.pieces.push(makePiece());
  normalizeRunQueue();
}
function verifyQueuePanelFresh(){
  const active = getActivePiece();
  const panel = document.querySelector('#pieces .active-piece');
  const visibleSeq = panel ? Number(panel.dataset.pieceSeq) : NaN;
  const visibleId = panel ? panel.dataset.pieceId : '';
  if(active && (!panel || visibleId !== active.id || visibleSeq !== Number(active.seq))){
    renderPieces();
    renderSelectedBanner();
    const q=document.getElementById('queueDebug');
    if(q) q.innerHTML += ' · <strong>hard refreshed</strong>';
  }
}
function verifyPlacedTilesRendered(){
  if(!run || !Array.isArray(run.lastPlacedCells) || !run.lastPlacedCells.length) return;
  const stillOccupied = run.lastPlacedCells.filter(([r,c,type]) => run.board[r] && run.board[r][c] === type);
  if(!stillOccupied.length) return; // a completed row/column may have cleared immediately.
  const missing = stillOccupied.filter(([r,c,type]) => {
    const cell=document.querySelector(`#board .cell[data-r="${r}"][data-c="${c}"]`);
    return !cell || !cell.classList.contains('occupied') || !cell.querySelector(`.tile.${type}`);
  });
  if(missing.length){
    renderBoard();
    run.log.push('Render guard refreshed placed tiles after placement.');
    renderPuzzleLog();
  }
}

function runPlacementSelfTest(){
  const before = run.board.flat().filter(Boolean).length;
  const piece=getActivePiece();
  if(!piece){toast('Self-test: no active piece.'); return;}
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    if(canPlace(piece,r,c)){
      placeActive(r,c);
      const after = run.board.flat().filter(Boolean).length;
      toast(after>before ? 'Self-test placed the active piece.' : 'Self-test ran, but cleared lines may have removed tiles.');
      return;
    }
  }
  toast('Self-test: no legal placement for current piece.');
}
function countCells(shape){return shape.flat().filter(Boolean).length}
function canPlace(piece,r,c){
  for(let pr=0;pr<piece.shape.length;pr++) for(let pc=0;pc<piece.shape[pr].length;pc++) if(piece.shape[pr][pc]){if(r+pr>=8||c+pc>=8||run.board[r+pr][c+pc]) return false;}
  return true;
}
function canPlaceAny(piece){return !!piece && Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>canPlace(piece,r,c)).some(row=>row.some(Boolean)));}
function anyFits(){return run.pieces.some(p=>canPlaceAny(p));}
function clearLines(){
  const rows=[], cols=[];
  for(let r=0;r<8;r++) if(run.board[r].every(Boolean)) rows.push(r);
  for(let c=0;c<8;c++) if(run.board.every(row=>row[c])) cols.push(c);
  if(!rows.length && !cols.length) return;
  const cleared=[];
  rows.forEach(r=>{for(let c=0;c<8;c++) cleared.push([r,c]);});
  cols.forEach(c=>{for(let r=0;r<8;r++) if(!cleared.some(x=>x[0]===r&&x[1]===c)) cleared.push([r,c]);});
  const counts={scrap:0,gears:0,wiring:0,batteries:0};
  cleared.forEach(([r,c])=>{const t=run.board[r][c]; if(t) counts[t]++; run.board[r][c]=null;});
  RESOURCE_KEYS.forEach(k=>{run.rewards[k]+=counts[k];});
  const lineCount=rows.length+cols.length;
  const multiBonus=Math.max(0,lineCount-1)*25;
  run.clears += lineCount;
  run.bestClear=Math.max(run.bestClear||0,lineCount);
  run.score += cleared.length*10 + multiBonus;
  run.lastClear={lines:lineCount, cells:cleared.length, counts, score:cleared.length*10+multiBonus};
  const message=`Cleared ${lineCount} line${lineCount>1?'s':''} and recovered ${rewardText(counts)}${multiBonus?` · multi-line bonus +${multiBonus}`:''}.`;
  run.log.push(message);
  showClearPop(lineCount, counts, multiBonus);
}
function showClearPop(lineCount, counts, bonus){
  const old=document.querySelector('.clear-pop');
  if(old) old.remove();
  const el=document.createElement('div');
  el.className='clear-pop';
  el.innerHTML=`${lineCount} LINE${lineCount>1?'S':''} CLEARED<small>${rewardText(counts)}${bonus?` · +${bonus} score bonus`:''}</small>`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1400);
}
function showRunSummary(){
  if(!run) return;
  const total=RESOURCE_KEYS.reduce((sum,k)=>sum+(run.rewards[k]||0),0);
  document.getElementById('summaryLead').textContent = total>0 ? 'Recovered salvage is ready to move into base inventory.' : 'No salvage recovered yet. You can keep playing or return with nothing.';
  const rows=[
    ['Score', run.score],
    ['Pieces placed', run.placed],
    ['Line clears', run.clears],
    ['Best clear', `${run.bestClear||0} line${(run.bestClear||0)===1?'':'s'}`],
    ...RESOURCE_KEYS.map(k=>[RESOURCE_LABELS[k], run.rewards[k]||0]),
    ['Total salvage', total]
  ];
  document.getElementById('summaryGrid').innerHTML = rows.map(([label,value])=>`<div class="summary-item ${label==='Total salvage'?'summary-total':''}">${label}<strong>${value}</strong></div>`).join('');
  document.getElementById('runSummaryModal').classList.remove('hidden');
}
function closeRunSummary(){document.getElementById('runSummaryModal').classList.add('hidden');}
function confirmClaimRun(){closeRunSummary(); claimRun();}
function claimRun(){
  if(!run) return;
  RESOURCE_KEYS.forEach(k=>state.resources[k]+=run.rewards[k]);
  const summary = `Salvage claimed: ${rewardText(run.rewards)} · score ${run.score}. Base advanced by 12 hours.`;
  state.log.push(summary); run=null; advanceTime(12, null, false); showTab('base'); toast(summary);
}
function advanceTime(hours, note, doRender=true){
  state.hour += hours; while(state.hour>=24){state.hour-=24; state.day++;}
  const genPenalty = state.rooms.generator.condition < 40 ? 0.35 : 0;
  Object.keys(state.rooms).forEach(id=>{
    const room=state.rooms[id], meta=ROOM_DATA[id];
    const reduction = (meta.wear + (id==='generator'?0:genPenalty)) * (hours/12) / room.level;
    room.condition = Math.max(0, room.condition - reduction*10);
  });
  if(note) state.log.push(note);
  if(state.day>=7 && !state.log.some(x=>x.includes('7-day stability goal'))){state.log.push('7-day stability goal reached. Stage 1 loop is viable if the player can still recover and repair.');}
  if(doRender) renderAll();
}
function repairRoom(id){
  const cost=ROOM_DATA[id].repair; if(!canAfford(cost)){toast('Not enough parts for that repair. Play the puzzle for more salvage.'); return;}
  pay(cost); state.rooms[id].condition=Math.min(100,state.rooms[id].condition+35); state.log.push(`${ROOM_DATA[id].name} repaired using ${costText(cost)}.`); renderAll(); toast(`${ROOM_DATA[id].name} repaired.`);
}
function upgradeRoom(id){
  const cost={scrap:10*state.rooms[id].level, gears:3*state.rooms[id].level, wiring:2*state.rooms[id].level};
  if(!canAfford(cost)){toast(`Upgrade needs ${costText(cost)}.`); return;}
  pay(cost); state.rooms[id].level++; state.rooms[id].condition=Math.min(100,state.rooms[id].condition+15); state.log.push(`${ROOM_DATA[id].name} upgraded to level ${state.rooms[id].level}. Wear rate reduced.`); renderAll(); toast(`${ROOM_DATA[id].name} upgraded.`);
}
function canAfford(cost){return Object.keys(cost).every(k=>state.resources[k]>=cost[k]);}
function pay(cost){Object.keys(cost).forEach(k=>state.resources[k]-=cost[k]);}
function costText(cost){return Object.keys(cost).map(k=>`${cost[k]} ${RESOURCE_LABELS[k]}`).join(', ');}
function rewardText(obj){return RESOURCE_KEYS.filter(k=>obj[k]>0).map(k=>`${obj[k]} ${RESOURCE_LABELS[k]}`).join(', ') || 'no parts';}
function saveGame(show){localStorage.setItem(SAVE_KEY, JSON.stringify({state,run,version:VERSION})); if(show) toast('Saved.');}
function loadGame(show){
  const raw=localStorage.getItem(SAVE_KEY);
  if(raw){
    try{const data=JSON.parse(raw); state=data.state||defaultState(); run=data.run||null; renderAll(); if(show) toast('Loaded.');}
    catch(e){toast('Save file was unreadable.');}
    return;
  }
  const legacy=localStorage.getItem(LEGACY_SAVE_KEY);
  if(legacy){
    try{
      const data=JSON.parse(legacy);
      state=data.state||defaultState();
      run=null;
      state.log.push('Started this patched version with a fresh puzzle run so old broken puzzle state cannot carry forward.');
      if(show) toast('Loaded base resources; old puzzle state was reset for this version.');
    }catch(e){/* ignore legacy read errors */}
  }
}
function resetGame(){if(confirm('Reset the Stage 1 prototype save?')){localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_SAVE_KEY); state=defaultState(); newRun(false); run=null; renderAll(); toast('Prototype reset.');}}
function toast(msg){const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function init(){state=defaultState(); loadGame(false); renderAll();}
init();
