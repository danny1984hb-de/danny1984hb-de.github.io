
(() => {
'use strict';
const BACKEND = 'https://drb-homepage.de';
const API = BACKEND + '/drb-customers/api';
const TOKEN_KEY = 'drb_customer_frontend_v04';
const PKCE_KEY = 'drb_customer_pkce_v04';
const page = document.body.dataset.drbPage || '';
const $ = id => document.getElementById(id);
const SOCIAL = ['github','google','discord','steam','microsoft','twitch','apple'];

function message(msg,kind='error') {
  const elem=$('auth-status');
  if (!elem) return;
  elem.textContent=String(msg || 'Unbekannter Fehler.');
  elem.className='auth-message ' + kind;
  elem.hidden=false;
  elem.setAttribute('role','status');
}
function clearMessage() { const e=$('auth-status'); if(e) {e.hidden=true;e.textContent='';} }
function saveToken(payload) {
  if(!payload || typeof payload.access_token!=='string'||!Number.isFinite(Number(payload.expires_in)))throw Error('Ungültige Antwort des Anmeldeservers.');
  sessionStorage.setItem(TOKEN_KEY,JSON.stringify({value:payload.access_token,until:Date.now()+Number(payload.expires_in)*1000}));
}
function token() {
  try {
    const t=JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null');
    if(!t || typeof t.value!=='string'||Date.now()>t.until-3000){ sessionStorage.removeItem(TOKEN_KEY);return null; }
    return t.value;
  } catch(e) {sessionStorage.removeItem(TOKEN_KEY);return null;}
}
async function request(path,{method='GET',body=null,authenticated=false}={}) {
  const headers={'Accept':'application/json'};
  if(body!==null)headers['Content-Type']='application/json';
  if(authenticated){const t=token();if(!t)throw Error('Deine Anmeldung ist abgelaufen. Bitte erneut anmelden.');headers['Authorization']='Bearer '+t;}
  const response=await fetch(API+path,{method,headers,body:body!==null?JSON.stringify(body):undefined,credentials:'omit',mode:'cors',cache:'no-store',referrerPolicy:'no-referrer'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) {
    if(response.status===401 && authenticated)sessionStorage.removeItem(TOKEN_KEY);
    const errors=data.errors&&typeof data.errors==='object'?Object.values(data.errors).flat().filter(x=>typeof x==='string').slice(0,3):[];
    throw Error(errors.join('\n')||data.message||'Verbindung zum DRB-Server fehlgeschlagen.');
  }
  return data;
}
function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function randomString(){return base64url(crypto.getRandomValues(new Uint8Array(48)));}
async function socialLogin(provider){
  if(!SOCIAL.includes(provider))throw Error('Unbekannter Anbieter.');
  if(!crypto?.subtle)throw Error('Sicherer Browser für die Anmeldung erforderlich.');
  const verifier=randomString(),nonce=randomString();
  const encoded=new TextEncoder().encode(verifier);
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)));
  sessionStorage.setItem(PKCE_KEY,JSON.stringify({verifier,nonce,time:Date.now()}));
  window.location.assign(BACKEND+'/drb-customers/oauth/'+encodeURIComponent(provider)+'/start?'+new URLSearchParams({
    frontend:'1',challenge,frontend_nonce:nonce
  }).toString());
}
async function setupProviders(){
  const nodes=Array.from(document.querySelectorAll('[data-social]'));
  if(!nodes.length)return;
  let providers={};
  try{
    const data=await request('/providers');providers=data.providers||{};
    if(data.registration_enabled===false&&page==='register') message('Die Registrierung ist wegen des Wartungsmodus derzeit deaktiviert.');
  }catch(e){message('Die Anmeldeanbieter können derzeit nicht vom DRB-Server abgefragt werden. Bitte prüfe das Backend-Update.');}
  for(const node of nodes){
    const provider=node.dataset.social;
    const ready=providers[provider]===true;
    node.setAttribute('aria-disabled',ready?'false':'true');
    node.title=ready?'Mit '+provider+' anmelden':'Dieser Anbieter ist noch nicht freigeschaltet.';
    const small=node.querySelector('small');
    if(small)small.textContent=ready?'Anmeldung starten':'Nicht eingerichtet';
    node.addEventListener('click',async event=>{
      event.preventDefault();
      if(!ready){message('Dieser Anbieter wurde im DRB-Backend noch nicht aktiviert.');return;}
      try{await socialLogin(provider);}catch(e){message(e.message);}
    });
  }
  const suggested=new URLSearchParams(location.search).get('provider');
  if(page==='login'&&suggested&&SOCIAL.includes(suggested)&&providers[suggested]===true){
    try{await socialLogin(suggested);}catch(e){message(e.message);}
  }
}
function initLogin(){
  $('login-form')?.addEventListener('submit',async event=>{
    event.preventDefault();clearMessage();
    const f=event.currentTarget,button=f.querySelector('button[type="submit"]');
    button.disabled=true;
    try{
      const data=await request('/login',{method:'POST',body:{login:f.elements.login.value.trim(),password:f.elements.password.value}});
      saveToken(data);
      f.elements.password.value='';
      location.assign('mein-konto.html');
    }catch(e){message(e.message);}finally{button.disabled=false;}
  });
}
function initRegister(){
  $('register-form')?.addEventListener('submit',async event=>{
    event.preventDefault();clearMessage();
    const f=event.currentTarget,b=f.querySelector('button[type="submit"]');b.disabled=true;
    try{
      const payload={name:f.elements.name.value.trim(),email:f.elements.email.value.trim(),password:f.elements.password.value,password_confirmation:f.elements.password_confirmation.value,conditions:f.elements.conditions.checked?'1':''};
      const data=await request('/register',{method:'POST',body:payload});
      f.reset();message(data.message||'Registrierung abgeschlossen. Bitte bestätige deine E-Mail.','success');
    }catch(e){message(e.message);}finally{b.disabled=false;}
  });
}
const FIELDNAMES=['customer_type','first_name','last_name','company','vat_id','contact_email','phone','mobile'];
function fillForm(form,data,names){for(const n of names)if(form.elements[n])form.elements[n].value=data?.[n] ?? '';}
function readForm(form,names){const payload={};for(const n of names)if(form.elements[n])payload[n]=form.elements[n].value.trim();return payload;}
const ADDRESS_FIELDS=['label','type','company','first_name','last_name','street','house_number','address_line_2','postal_code','city','country'];
function renderAddresses(addresses){
  const container=$('addresses-list');if(!container)return;container.replaceChildren();
  if(!addresses?.length){let p=document.createElement('p');p.className='auth-note';p.textContent='Noch keine Adresse hinterlegt.';container.append(p);return;}
  addresses.forEach(a=>{
    const box=document.createElement('div');box.className='auth-address-card';
    const text=document.createElement('div');
    text.textContent=[a.label+' ('+({billing:'Rechnung',shipping:'Lieferung',both:'Beides'}[a.type]||a.type)+')',a.company,[a.first_name,a.last_name].filter(Boolean).join(' '),[a.street,a.house_number].filter(Boolean).join(' '),a.address_line_2,[a.postal_code,a.city].filter(Boolean).join(' '),a.country,a.default_billing?'Standard-Rechnungsadresse':'',a.default_shipping?'Standard-Lieferadresse':''].filter(Boolean).join('\n');
    const actions=document.createElement('div');actions.className='auth-address-actions';
    const edit=document.createElement('button');edit.type='button';edit.textContent='Bearbeiten';edit.addEventListener('click',()=>{fillForm($('address-form'),a,ADDRESS_FIELDS);$('address-form').elements.id.value=a.id;$('address-form').elements.default_billing.checked=!!a.default_billing;$('address-form').elements.default_shipping.checked=!!a.default_shipping;$('address-form').scrollIntoView({behavior:'smooth',block:'center'});});
    const del=document.createElement('button');del.type='button';del.textContent='Löschen';del.addEventListener('click',async()=>{if(!confirm('Diese Adresse wirklich löschen?'))return;try{await request('/addresses/'+encodeURIComponent(a.id),{method:'DELETE',authenticated:true});await loadProfile();message('Adresse gelöscht.','success');}catch(e){message(e.message);}});
    actions.append(edit,del);box.append(text,actions);container.append(box);
  });
}
async function loadProfile(){
  const result=await request('/me',{authenticated:true});
  $('account-name').textContent=result.user?.name||'Kunde';
  $('account-email').textContent=result.user?.email||'Keine E-Mail-Adresse';
  fillForm($('profile-form'),result.profile,FIELDNAMES);
  $('connected-accounts').textContent=result.connected?.length?'Verknüpft: '+result.connected.join(', '):'Noch keine Social-Verknüpfung vorhanden.';
  renderAddresses(result.addresses);
  $('profile-area').hidden=false;
  if(!result.profile_complete)message('Bitte vervollständige deine Kundendaten.','success');
}
async function initProfile(){
  const params=new URLSearchParams(location.search);
  const code=params.get('code'),nonce=params.get('nonce');
  if(code||nonce){
    history.replaceState({},'',location.pathname+location.hash);
    const raw=sessionStorage.getItem(PKCE_KEY);sessionStorage.removeItem(PKCE_KEY);
    try{
      const pkce=JSON.parse(raw||'null');
      if(!pkce||!nonce||nonce!==pkce.nonce||Date.now()-pkce.time>600000||!code)throw Error('Sicherheitsprüfung abgelaufen. Bitte neu anmelden.');
      saveToken(await request('/oauth/exchange',{method:'POST',body:{code,verifier:pkce.verifier}}));
    }catch(e){message(e.message);return;}
  }
  if(!token()){message('Du bist nicht angemeldet. Bitte melde dich zuerst an.');$('profile-login-link').hidden=false;return;}
  try{await loadProfile();}catch(e){message(e.message);$('profile-login-link').hidden=false;}
  $('profile-form')?.addEventListener('submit',async event=>{
    event.preventDefault();clearMessage();const f=event.currentTarget,b=f.querySelector('button[type=submit]');b.disabled=true;
    try{await request('/me',{method:'PUT',authenticated:true,body:readForm(f,FIELDNAMES)});message('Deine Kundendaten wurden gespeichert.','success');await loadProfile();}catch(e){message(e.message);}finally{b.disabled=false;}
  });
  $('address-form')?.addEventListener('submit',async event=>{
    event.preventDefault();clearMessage();const f=event.currentTarget,b=f.querySelector('button[type=submit]');b.disabled=true;
    try{
      const body=readForm(f,ADDRESS_FIELDS);body.default_billing=f.elements.default_billing.checked;body.default_shipping=f.elements.default_shipping.checked;
      const id=f.elements.id.value;await request(id?'/addresses/'+encodeURIComponent(id):'/addresses',{method:id?'PUT':'POST',authenticated:true,body});
      f.reset();f.elements.id.value='';message('Adresse gespeichert.','success');await loadProfile();
    }catch(e){message(e.message);}finally{b.disabled=false;}
  });
  $('address-cancel')?.addEventListener('click',()=>{$('address-form').reset();$('address-form').elements.id.value='';});
  $('logout-button')?.addEventListener('click',async()=>{
    try{await request('/logout',{method:'POST',authenticated:true});}catch(e){}
    sessionStorage.removeItem(TOKEN_KEY);location.assign('anmelden.html');
  });
}
if(page==='login')initLogin();
if(page==='register')initRegister();
if(page==='profile')initProfile();
setupProviders();
})();
