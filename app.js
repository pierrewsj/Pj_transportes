const fmtMoney = v => Number(v || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtNum = v => Number(v || 0).toLocaleString('pt-BR');
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const storeKey = 'pj_transportes_app_v1';
let db = load();

function load(){
  const saved = localStorage.getItem(storeKey);
  if(saved) return JSON.parse(saved);
  return { vehicles:['Cegonha','Fiorino'], drivers:['Jorge'], trips:[], expenses:[] };
}
function save(){ localStorage.setItem(storeKey, JSON.stringify(db)); }
function n(v){ return Number(String(v || '0').replace(',','.')) || 0; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function expenseTotal(e){ return ['combustivel','arla','refeicao','pedagio','ajudante','hospedagem','lavagem','estacionamento','manutencao','multas','outros'].reduce((s,k)=>s+n(e[k]),0); }
function tripExpenses(id){ return db.expenses.filter(e=>e.tripId===id).reduce((s,e)=>s+expenseTotal(e),0); }
function tripLiters(id){ return db.expenses.filter(e=>e.tripId===id).reduce((s,e)=>s+n(e.litros),0); }
function tripKm(t){ return Math.max(0,n(t.kmFinal)-n(t.kmInicial)); }
function tripProfit(t){ return n(t.frete)-tripExpenses(t.id); }
function tripMargin(t){ return n(t.frete)>0 ? (tripProfit(t)/n(t.frete))*100 : 0; }

window.addEventListener('DOMContentLoaded',()=>{
  $('#todayText').textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  $$('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
  $('#tripForm').addEventListener('submit',saveTrip);
  $('#expenseForm').addEventListener('submit',saveExpense);
  $('#vehicleForm').addEventListener('submit',addVehicle);
  $('#driverForm').addEventListener('submit',addDriver);
  renderAll();
});

function login(){
  const u = $('#loginUser').value.trim(); const p = $('#loginPass').value.trim();
  if((u==='admin' && p==='1234') || (u && p)){
    $('#loginScreen').classList.remove('active'); $('#appScreen').classList.add('active'); renderAll();
  } else alert('Informe usuário e senha.');
}
function logout(){ $('#appScreen').classList.remove('active'); $('#loginScreen').classList.add('active'); }
function showPage(page){
  $$('.page').forEach(p=>p.classList.remove('active')); $('#'+page).classList.add('active');
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  $('#pageTitle').textContent = {dashboard:'Painel de Controle',viagens:'Controle de Viagens',despesas:'Despesas da Viagem',cadastros:'Cadastros',relatorios:'Relatórios'}[page];
  renderAll();
}

function renderAll(){ renderSelects(); renderDashboard(); renderTrips(); renderExpenses(); renderCadastros(); renderMeals(); }
function renderSelects(){
  const vehicleOpts = db.vehicles.map(v=>`<option>${v}</option>`).join('');
  const driverOpts = db.drivers.map(v=>`<option>${v}</option>`).join('');
  $('#tripVehicle').innerHTML = vehicleOpts; $('#tripDriver').innerHTML = driverOpts;
  $('#expenseTrip').innerHTML = db.trips.length ? db.trips.map(t=>`<option value="${t.id}">${t.id} - ${t.origem} → ${t.destino}</option>`).join('') : '<option value="">Cadastre uma viagem primeiro</option>';
}
function renderDashboard(){
  const receita = db.trips.reduce((s,t)=>s+n(t.frete),0);
  const despesa = db.expenses.reduce((s,e)=>s+expenseTotal(e),0);
  const lucro = receita-despesa;
  const km = db.trips.reduce((s,t)=>s+tripKm(t),0);
  const litros = db.expenses.reduce((s,e)=>s+n(e.litros),0);
  $('#kpiReceita').textContent = fmtMoney(receita); $('#kpiDespesa').textContent = fmtMoney(despesa); $('#kpiLucro').textContent = fmtMoney(lucro);
  $('#kpiMargem').textContent = receita>0 ? `${(lucro/receita*100).toFixed(2)}%` : '0%';
  $('#kpiKm').textContent = fmtNum(km); $('#kpiConsumo').textContent = litros>0 ? `${(km/litros).toFixed(2)} km/L` : '0 km/L';
  $('#recentTrips').innerHTML = db.trips.slice(-5).reverse().map(t=>`<tr><td>${t.id}</td><td>${t.veiculo}</td><td>${t.origem} → ${t.destino}</td><td><span class="badge">${t.status}</span></td><td>${fmtMoney(tripProfit(t))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhuma viagem cadastrada.</td></tr>';
}
function renderTrips(){
  const f = ($('#tripFilter')?.value || '').toLowerCase();
  const trips = db.trips.filter(t=>JSON.stringify(t).toLowerCase().includes(f));
  $('#tripList').innerHTML = trips.map(t=>`
    <div class="trip-card">
      <div><b>${t.id}</b> <span class="badge">${t.status}</span></div>
      <div>${t.veiculo} • ${t.motorista} • ${t.cliente}</div>
      <div>${t.origem} → ${t.destino}</div>
      <div>KM: ${fmtNum(tripKm(t))} • Frete: ${fmtMoney(t.frete)} • Despesas: ${fmtMoney(tripExpenses(t.id))} • Lucro: <b>${fmtMoney(tripProfit(t))}</b> • Margem: ${tripMargin(t).toFixed(2)}%</div>
      <div class="actions">
        <button class="mini-btn" onclick="openMaps('${encodeURIComponent(t.origem)}','${encodeURIComponent(t.destino)}')">Abrir rota no Google Maps</button>
        <button class="mini-btn" onclick="printTrip('${t.id}')">PDF da viagem</button>
        <button class="mini-btn danger" onclick="deleteTrip('${t.id}')">Excluir</button>
      </div>
    </div>`).join('') || '<div class="empty">Nenhuma viagem encontrada.</div>';
}
function renderExpenses(){
  $('#expenseList').innerHTML = db.expenses.map((e,i)=>`<tr><td>${e.data}</td><td>${e.tripId}</td><td>${e.cidade||'-'}</td><td>${fmtMoney(expenseTotal(e))}</td><td><button class="mini-btn danger" onclick="deleteExpense(${i})">Excluir</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhuma despesa lançada.</td></tr>';
}
function renderCadastros(){
  $('#vehicleList').innerHTML = db.vehicles.map(v=>`<li>${v}</li>`).join(''); $('#driverList').innerHTML = db.drivers.map(v=>`<li>${v}</li>`).join('');
}
function renderMeals(){
  const good = db.expenses.filter(e=>e.refeicaoBoa==='Sim' && e.localRefeicao);
  $('#mealPlaces').innerHTML = good.length ? good.map(e=>`<div class="trip-card"><b>${e.localRefeicao}</b><span>${e.cidade||'Cidade não informada'} • Viagem ${e.tripId} • ${fmtMoney(e.refeicao)}</span></div>`).join('') : '<div class="empty">Sem locais recomendados ainda.</div>';
}

function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
function saveTrip(ev){
  ev.preventDefault(); const data = formData(ev.target);
  if(db.trips.some(t=>t.id===data.id)){ alert('Já existe uma viagem com esse ID.'); return; }
  db.trips.push(data); save(); ev.target.reset(); renderAll(); alert('Viagem salva com sucesso.');
}
function saveExpense(ev){ ev.preventDefault(); const data = formData(ev.target); db.expenses.push(data); save(); ev.target.reset(); renderAll(); alert('Despesa salva com sucesso.'); }
function addVehicle(ev){ ev.preventDefault(); const v = ev.target.veiculo.value.trim(); if(v && !db.vehicles.includes(v)) db.vehicles.push(v); save(); ev.target.reset(); renderAll(); }
function addDriver(ev){ ev.preventDefault(); const v = ev.target.motorista.value.trim(); if(v && !db.drivers.includes(v)) db.drivers.push(v); save(); ev.target.reset(); renderAll(); }
function deleteTrip(id){ if(confirm('Excluir viagem e despesas vinculadas?')){ db.trips=db.trips.filter(t=>t.id!==id); db.expenses=db.expenses.filter(e=>e.tripId!==id); save(); renderAll(); } }
function deleteExpense(i){ if(confirm('Excluir despesa?')){ db.expenses.splice(i,1); save(); renderAll(); } }
function openMaps(origem,destino){ window.open(`https://www.google.com/maps/dir/?api=1&origin=${origem}&destination=${destino}&travelmode=driving`,'_blank'); }

function seedExampleData(){
  db = { vehicles:['Cegonha','Fiorino'], drivers:['Jorge'], trips:[
    {id:'V001',veiculo:'Cegonha',motorista:'Jorge',cliente:'Carrocerias Heringer',origem:'Betim - MG',destino:'Governador Valadares - MG',dataInicio:'2026-05-07',dataFim:'2026-05-07',kmInicial:'1125651',kmFinal:'1125988',tipoCarga:'Outros',qtd:'0',frete:'0',status:'Concluída',obs:'Frete cheio, sem intercorrências'},
    {id:'V002',veiculo:'Cegonha',motorista:'Jorge',cliente:'GS Jateamento e Pinturas Industriais',origem:'Governador Valadares - MG',destino:'Sorocaba - SP',dataInicio:'2026-05-07',dataFim:'2026-05-08',kmInicial:'1125988',kmFinal:'1126986',tipoCarga:'Carros',qtd:'18',frete:'14400',status:'Concluída',obs:'km 975'}
  ], expenses:[
    {tripId:'V001',data:'2026-05-07',cidade:'Betim',combustivel:'2000',litros:'298',tipoCombustivel:'Diesel S10',posto:'Posto da Curva BR-381',arla:'0',refeicao:'80',localRefeicao:'Latoree Betim',refeicaoBoa:'Sim',pedagio:'113',ajudante:'0',hospedagem:'0',lavagem:'0',estacionamento:'0',manutencao:'0',multas:'0',outros:'0',obs:'Cara'},
    {tripId:'V001',data:'2026-05-07',cidade:'Governador Valadares',combustivel:'0',litros:'0',tipoCombustivel:'Diesel S10',posto:'',arla:'0',refeicao:'55',localRefeicao:'Restaurante',refeicaoBoa:'Sim',pedagio:'0',ajudante:'0',hospedagem:'0',lavagem:'0',estacionamento:'0',manutencao:'0',multas:'0',outros:'0',obs:''}
  ]}; save(); renderAll(); alert('Dados de exemplo carregados.');
}
function clearData(){ if(confirm('Deseja apagar todos os dados salvos neste navegador?')){ localStorage.removeItem(storeKey); db=load(); renderAll(); } }

function exportPDF(){
  const { jsPDF } = window.jspdf || {}; if(!jsPDF){ alert('Biblioteca PDF não carregou. Verifique a internet.'); return; }
  const doc = new jsPDF('landscape');
  doc.setFontSize(16); doc.text('PJ Transportes - Relatório Geral',14,15);
  const receita = db.trips.reduce((s,t)=>s+n(t.frete),0), despesa = db.expenses.reduce((s,e)=>s+expenseTotal(e),0);
  doc.setFontSize(10); doc.text(`Receita: ${fmtMoney(receita)} | Despesa: ${fmtMoney(despesa)} | Lucro: ${fmtMoney(receita-despesa)}`,14,23);
  doc.autoTable({startY:30,head:[['ID','Veículo','Motorista','Cliente','Trecho','KM','Frete','Despesas','Lucro','Status']],body:db.trips.map(t=>[t.id,t.veiculo,t.motorista,t.cliente,`${t.origem} > ${t.destino}`,tripKm(t),fmtMoney(t.frete),fmtMoney(tripExpenses(t.id)),fmtMoney(tripProfit(t)),t.status])});
  doc.save('pj-transportes-relatorio.pdf');
}
function printTrip(id){
  const t = db.trips.find(x=>x.id===id); if(!t) return;
  const { jsPDF } = window.jspdf || {}; if(!jsPDF){ alert('Biblioteca PDF não carregou. Verifique a internet.'); return; }
  const doc = new jsPDF(); doc.setFontSize(16); doc.text(`PJ Transportes - Viagem ${t.id}`,14,16);
  doc.setFontSize(11); doc.text(`${t.origem} > ${t.destino}`,14,25); doc.text(`Veículo: ${t.veiculo} | Motorista: ${t.motorista} | Cliente: ${t.cliente}`,14,33);
  doc.text(`KM: ${tripKm(t)} | Frete: ${fmtMoney(t.frete)} | Despesas: ${fmtMoney(tripExpenses(t.id))} | Lucro: ${fmtMoney(tripProfit(t))}`,14,41);
  const exps = db.expenses.filter(e=>e.tripId===id);
  doc.autoTable({startY:50,head:[['Data','Cidade','Combustível','Litros','Refeição','Pedágio','Total']],body:exps.map(e=>[e.data,e.cidade,fmtMoney(e.combustivel),e.litros,fmtMoney(e.refeicao),fmtMoney(e.pedagio),fmtMoney(expenseTotal(e))])});
  doc.save(`viagem-${id}.pdf`);
}
function exportCSV(){
  const rows = [['ID','Veiculo','Motorista','Cliente','Origem','Destino','Data Inicio','Data Fim','KM Rodados','Frete','Despesas','Lucro','Margem','Status'],...db.trips.map(t=>[t.id,t.veiculo,t.motorista,t.cliente,t.origem,t.destino,t.dataInicio,t.dataFim,tripKm(t),n(t.frete),tripExpenses(t.id),tripProfit(t),tripMargin(t).toFixed(2),t.status])];
  const csv = rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='pj-transportes-viagens.csv'; a.click();
}
