(() => {
"use strict";
const SUPABASE_URL = "https://eopvkwhcgznvubesaszv.supabase.co";
const SUPABASE_KEY = "sb_publishable_d3hVgDqwTuB63BtfumPwoQ_ngy2ig_c";
const MAILCORE_URL = "https://lordlolqdh.github.io/MAILCORE/";
const $ = id => document.getElementById(id);
const state = { db:null, user:null, profile:null, chats:[], activeChatId:null, activePartner:null, channel:null, searchTimer:null, heartbeatTimer:null, toastTimer:null, booting:false, credits:0, inviteClaimed:false, systemMessages:[], chatControl:null, blockedUsers:[], isAdmin:false };
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials = name => (String(name || "?").trim().charAt(0) || "?").toUpperCase();
function toast(message){ $("toast").textContent=message; $("toast").classList.add("show"); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>$("toast").classList.remove("show"),3200); }
function authMessage(message,error=false){ $("authMessage").textContent=message; $("authMessage").classList.toggle("error",error); }
function setAuthMode(mode){ const signup=mode==="signup"; $("authForm").dataset.mode=mode; $("authTitle").innerHTML=signup?'Konto erstellen<span>.</span>':'Willkommen zurück<span>.</span>'; $("authCopy").textContent=signup?'Erstelle deinen Zugang und starte deine ersten Unterhaltungen.':'Melde dich an und setze deine Unterhaltungen fort.'; $("displayNameWrap").classList.toggle("hidden",!signup); $("displayName").required=signup; $("authPassword").autocomplete=signup?"new-password":"current-password"; $("authSubmit").innerHTML=signup?'Konto erstellen <span>→</span>':'Anmelden <span>→</span>'; $("authModeBtn").textContent=signup?'Du hast bereits ein Konto? Anmelden':'Noch kein Konto? Konto erstellen'; authMessage(""); }
function closeSidebar(){ $("sidebar").classList.remove("open"); $("sidebarBackdrop").classList.remove("visible"); $("mobileMenu").setAttribute("aria-expanded","false"); }
function openSidebar(){ $("sidebar").classList.add("open"); $("sidebarBackdrop").classList.add("visible"); $("mobileMenu").setAttribute("aria-expanded","true"); }
function showLogin(){ closeSidebar(); $("chatView").classList.add("hidden"); $("authView").classList.remove("hidden"); state.user=null; state.profile=null; state.activeChatId=null; state.activePartner=null; state.chats=[]; if(state.channel){state.db.removeChannel(state.channel);state.channel=null;} clearInterval(state.heartbeatTimer); }
function showWelcome(){ $("welcomePanel").classList.remove("hidden"); $("conversation").classList.add("hidden"); $("conversationPerson").innerHTML='<div class="avatar placeholder-avatar">M</div><div><strong>Dein Chatbereich</strong><small>Wähle eine Unterhaltung</small></div>'; }
async function ensureProfile(){
  let {data,error}=await state.db.from("mailcore_profiles").select("*").eq("id",state.user.id).maybeSingle();
  if(error) throw error;
  if(!data){
    const base=(state.user.email||"nutzer").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,14)||"nutzer";
    const username=base+"_"+state.user.id.slice(0,6);
    const result=await state.db.from("mailcore_profiles").upsert({id:state.user.id,username,display_name:state.user.user_metadata?.display_name||base},{onConflict:"id"}).select().single();
    if(result.error) throw result.error; data=result.data;
  }
  state.profile=data; $("profileName").textContent=data.display_name||data.username; $("profileHandle").textContent="@"+data.username; $("profileAvatar").textContent=initials(data.display_name||data.username);
}
async function mailcoreApi(action,payload={}){
 const {data,error}=await state.db.functions.invoke("mailcore-api",{body:{action,...payload}});
 if(error){
  let detail=data?.error;
  try{if(!detail&&error.context?.clone)detail=(await error.context.clone().json())?.error;}catch{}
  throw new Error(detail||error.message||"API-Fehler");
 }
 if(data?.error)throw new Error(data.error);return data;
}
function updateCredits(value){state.credits=Number(value)||0;["creditPill","aiCreditPill"].forEach(id=>{if($(id))$(id).textContent=state.credits+" Credits";});}
async function loadWallet(){try{return await mailcoreApi("wallet");}catch(apiError){const {data,error}=await state.db.from("mailcore_wallets").select("credits").eq("user_id",state.user.id).maybeSingle();if(error||!data)throw apiError;return {credits:Number(data.credits)||0};}}
function aiBubble(role,content){const el=document.createElement("div");el.className="ai-message "+(role==="user"?"user":"assistant");el.textContent=content;return el;}
async function loadAIHistory(){const data=await mailcoreApi("ai_history");$("aiMessages").innerHTML="";if(!data.messages?.length){const welcome=document.createElement("div");welcome.className="ai-welcome";welcome.textContent="Hi! Ich bin MAILCORE AI. Frag mich etwas oder lass dir beim Schreiben helfen.";$("aiMessages").append(welcome);}else data.messages.forEach(m=>$("aiMessages").append(aiBubble(m.role,m.content)));$("aiMessages").scrollTop=$("aiMessages").scrollHeight;}
async function openAI(){$("aiModal").classList.remove("hidden");try{const w=await loadWallet();updateCredits(w.credits);await loadAIHistory();}catch(e){toast("KI konnte nicht geladen werden: "+e.message);}$("aiInput").focus();}
async function sendAI(e){e.preventDefault();const message=$("aiInput").value.trim();if(!message)return;const send=$("aiSend");send.disabled=true;$("aiMessages").append(aiBubble("user",message));$("aiInput").value="";const pending=aiBubble("assistant","MAILCORE AI denkt nach …");$("aiMessages").append(pending);$("aiMessages").scrollTop=$("aiMessages").scrollHeight;try{const result=await mailcoreApi("ai",{message});pending.textContent=(result.reply||"Keine Antwort erhalten.")+"\n\n−"+result.cost+" Credits · "+result.elapsed_seconds+" s · "+result.tokens+" Tokens";updateCredits(result.credits);}catch(error){pending.textContent="Fehler: "+error.message;try{const w=await mailcoreApi("wallet");updateCredits(w.credits);}catch{}}finally{send.disabled=false;$("aiMessages").scrollTop=$("aiMessages").scrollHeight;$("aiInput").focus();}}
async function createInvite(){$("inviteModal").classList.remove("hidden");$("inviteLink").value="";$("inviteMessage").textContent="Link wird erstellt …";try{const result=await mailcoreApi("invite");$("inviteLink").value=result.url;$("inviteMessage").textContent="Dein persönlicher Einladungslink ist bereit.";}catch(error){$("inviteMessage").textContent="Fehler: "+error.message;}}
async function heartbeat(){ if(!state.user)return; const {error}=await state.db.from("mailcore_profiles").update({last_seen_at:new Date().toISOString()}).eq("id",state.user.id); if(error) console.warn("MAILCORE heartbeat:",error.message); }
async function loadChats(){
  const {data:mine,error}=await state.db.from("mailcore_participants").select("conversation_id").eq("user_id",state.user.id);
  if(error) throw error;
  const ids=[...new Set((mine||[]).map(x=>x.conversation_id))];
  if(!ids.length){state.chats=[];renderChats();return;}
  const {data:controls}=await state.db.from("mailcore_chat_controls").select("conversation_id,is_hidden,is_muted,lock_hash").eq("user_id",state.user.id);
  const controlMap=new Map((controls||[]).map(x=>[x.conversation_id,x]));
  const [membersResult,messagesResult]=await Promise.all([
    state.db.from("mailcore_participants").select("conversation_id,user_id,mailcore_profiles(username,display_name,last_seen_at)").in("conversation_id",ids),
    state.db.from("mailcore_messages").select("id,conversation_id,sender_id,body,created_at,read_at").in("conversation_id",ids).order("created_at",{ascending:false})
  ]);
  if(membersResult.error) throw membersResult.error; if(messagesResult.error) throw messagesResult.error;
  const messages=messagesResult.data||[];
  state.chats=ids.map(id=>{
    const member=(membersResult.data||[]).find(x=>x.conversation_id===id&&x.user_id!==state.user.id);
    const partner={...(member?.mailcore_profiles||{username:"unbekannt",display_name:"MAILCORE Nutzer"}),id:member?.user_id};
    return {id,partner,latest:messages.find(m=>m.conversation_id===id)||null,control:controlMap.get(id)||null,unread:messages.filter(m=>m.conversation_id===id&&m.sender_id!==state.user.id&&!m.read_at).length};
  }).filter(c=>!c.control?.is_hidden).sort((a,b)=>new Date(b.latest?.created_at||0)-new Date(a.latest?.created_at||0));
  renderChats();
}
function shortTime(value){if(!value)return"";const d=new Date(value);return d.toDateString()===new Date().toDateString()?d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"});}
function renderChats(){
  const query=$("chatSearch").value.trim().toLowerCase();
  const visible=state.chats.filter(c=>(c.partner.display_name+" "+c.partner.username).toLowerCase().includes(query));
  const latestSystem=state.systemMessages[state.systemMessages.length-1];
  const systemItem='<button type="button" class="chat-item system-chat-item '+(state.activeChatId==="mailcore-system"?"active":"")+'" data-system-chat="true"><span class="avatar system-avatar">M</span><span class="chat-item-copy"><span class="chat-item-top"><strong>MAILCORE</strong><time>'+shortTime(latestSystem?.created_at)+'</time></span><span class="chat-preview">'+esc(latestSystem?.body||"Willkommen bei MAILCORE. Hier erscheinen wichtige Hinweise.")+'</span></span><span class="system-check">✓</span></button>';
  $("chatList").innerHTML=systemItem+(visible.length?visible.map(c=>'<button type="button" class="chat-item '+(c.id===state.activeChatId?"active":"")+'" data-chat="'+esc(c.id)+'"><span class="avatar">'+esc(initials(c.partner.display_name))+'</span><span class="chat-item-copy"><span class="chat-item-top"><strong>'+esc(c.partner.display_name)+'</strong><time>'+shortTime(c.latest?.created_at)+'</time></span><span class="chat-preview">'+(c.latest?esc((c.latest.sender_id===state.user.id?"Du: ":"")+c.latest.body):"Noch keine Nachrichten")+'</span></span>'+(c.unread?'<span class="unread-count">'+c.unread+'</span>':"")+'</button>').join(""):'<div class="empty-chats">Noch keine Chats.<br>Starte eine Unterhaltung über das Plus.</div>');
}
async function loadSystemMessages(){const data=await mailcoreApi("system_messages");state.systemMessages=data.messages||[];renderChats();}
function renderSystemMessages(){$("messages").innerHTML=state.systemMessages.map(m=>'<article class="message system-message"><div class="system-message-label">MAILCORE</div><div class="message-bubble">'+esc(m.body)+'</div><div class="message-meta"><time>'+new Date(m.created_at).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"})+'</time></div></article>').join("");$("messages").scrollTop=$("messages").scrollHeight;}
async function openSystemChat(){state.activeChatId="mailcore-system";state.activePartner={id:null,display_name:"MAILCORE",username:"system"};$("welcomePanel").classList.add("hidden");$("conversation").classList.remove("hidden");$("conversationPerson").innerHTML='<div class="avatar system-avatar">M</div><div><strong>MAILCORE</strong><small>Offizielle Systemnachrichten</small></div>';$("messageInput").placeholder=state.isAdmin?"Nachricht an alle MAILCORE-Nutzer …":"Systemnachrichten können nicht beantwortet werden";$("messageInput").disabled=!state.isAdmin;$("messageForm").querySelector("button").disabled=!state.isAdmin;if(state.channel){await state.db.removeChannel(state.channel);state.channel=null;}await loadSystemMessages();renderSystemMessages();subscribeSystemMessages();}
function subscribeSystemMessages(){if(state.channel)state.db.removeChannel(state.channel);state.channel=state.db.channel("mailcore-system").on("postgres_changes",{event:"INSERT",schema:"public",table:"mailcore_system_messages"},payload=>{const m=payload.new;if(m.recipient_id===null||m.recipient_id===state.user.id){if(!state.systemMessages.some(x=>x.id===m.id)){state.systemMessages.push(m);renderChats();if(state.activeChatId==="mailcore-system")renderSystemMessages();}}}).subscribe();}
async function openAdminDirectChat(){const adminId="11045788-37a4-458d-98e7-378c0cfaddfd";if(state.user.id===adminId){toast("Du bist mit dem Admin-Konto angemeldet.");return;}try{const {data,error}=await state.db.rpc("mailcore_create_direct_chat",{p_target_user_id:adminId});if(error)throw error;const id=typeof data==="string"?data:data?.id||data?.conversation_id;if(!id)throw new Error("Admin-Chat konnte nicht erstellt werden.");await loadChats();await openChat(id,{id:adminId,display_name:"Administrator",username:"admin_11045788"});}catch(e){toast("Admin-Chat nicht verfügbar: "+e.message);}}
function renderMessage(m){const mine=m.sender_id===state.user.id;return '<article class="message '+(mine?"mine":"")+'" data-message="'+esc(m.id)+'"><div class="message-bubble">'+esc(m.body)+'</div><div class="message-meta"><time>'+new Date(m.created_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+'</time>'+(mine?" · Gesendet":"")+'</div></article>';}
function appendMessage(m){if(m.conversation_id!==state.activeChatId||$("messages").querySelector('[data-message="'+CSS.escape(String(m.id))+'"]'))return;$("messages").insertAdjacentHTML("beforeend",renderMessage(m));$("messages").scrollTop=$("messages").scrollHeight;}
async function loadMessages(){if(state.activeChatId==="mailcore-system"){await loadSystemMessages();renderSystemMessages();return;}$("messageInput").disabled=false;$("messageInput").placeholder="Nachricht schreiben …";$("messageForm").querySelector("button").disabled=false;const {data,error}=await state.db.from("mailcore_messages").select("*").eq("conversation_id",state.activeChatId).order("created_at",{ascending:true}).limit(300);if(error)throw error;$("messages").innerHTML=(data||[]).map(renderMessage).join("");$("messages").scrollTop=$("messages").scrollHeight;}
async function markRead(id){const {error}=await state.db.from("mailcore_messages").update({read_at:new Date().toISOString()}).eq("conversation_id",id).neq("sender_id",state.user.id).is("read_at",null);if(error)console.warn("Lesestatus:",error.message);const c=state.chats.find(x=>x.id===id);if(c)c.unread=0;renderChats();}
async function openChat(id,partner,unlocked=false){
  const existingControl=state.chats.find(c=>c.id===id)?.control;
  if(existingControl?.lock_hash&&!unlocked){
    const pass=prompt("Dieser Chat ist gesperrt. Passwort eingeben.");if(pass===null)return;
    if(await deriveLock(pass,existingControl.lock_salt)!==existingControl.lock_hash){toast("Falsches Passwort.");return;}
  }
  state.activeChatId=id;state.activePartner=partner||state.chats.find(c=>c.id===id)?.partner||{display_name:"MAILCORE Nutzer",username:"nutzer"};
  renderChats();closeSidebar();await loadChatControl(id);$("blockUserBtn").textContent=state.blockedUsers.includes(state.activePartner.id)?"Blockierung aufheben":"Person blockieren";$("welcomePanel").classList.add("hidden");$("conversation").classList.remove("hidden");
  $("conversationPerson").innerHTML='<div class="avatar">'+esc(initials(state.activePartner.display_name))+'</div><div><strong>'+esc(state.activePartner.display_name)+'</strong><small>@'+esc(state.activePartner.username||"nutzer")+'</small></div>';
  if(state.channel){await state.db.removeChannel(state.channel);state.channel=null;}
  await loadMessages(); await markRead(id);
  state.channel=state.db.channel("mailcore-chat-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"mailcore_messages",filter:"conversation_id=eq."+id},async payload=>{appendMessage(payload.new);await loadChats();if(payload.new.sender_id!==state.user.id)await markRead(id);}).subscribe(status=>{if(status==="CHANNEL_ERROR")toast("Live-Verbindung unterbrochen. Aktualisiere den Chat.");});
}
async function enterApp(session){
  if(state.booting||state.user?.id===session.user.id)return;
  state.booting=true;state.user=session.user;
  try{$("authView").classList.add("hidden");$("chatView").classList.remove("hidden");await ensureProfile();const {data:blockedRows}=await state.db.from("mailcore_blocks").select("blocked_id").eq("owner_id",state.user.id);state.blockedUsers=(blockedRows||[]).map(x=>x.blocked_id);await loadAppearance();if(!state.inviteClaimed){state.inviteClaimed=true;const code=new URLSearchParams(location.search).get("invite");if(code){try{const claim=await mailcoreApi("claim_invite",{code});if(claim.claimed)toast("Einladung eingelöst. 10 Bonus-Credits erhalten.");history.replaceState({},document.title,location.pathname);}catch(e){console.warn("Einladung:",e.message);}}}try{const wallet=await loadWallet();updateCredits(wallet.credits);}catch(e){console.warn("Credits:",e.message);toast("Guthaben konnte nicht geladen werden: "+e.message);}
  try{const role=await mailcoreApi("admin_check");state.isAdmin=!!role.is_admin;$("adminBtn").classList.toggle("hidden",!state.isAdmin);$("adminSideBtn").classList.toggle("hidden",!state.isAdmin);$("adminContactBtn").classList.toggle("hidden",state.isAdmin);}catch{state.isAdmin=false;$("adminBtn").classList.add("hidden");$("adminSideBtn").classList.add("hidden");$("adminContactBtn").classList.remove("hidden");}
  try{const system=await mailcoreApi("system_status");if(system.lockdown&&!state.isAdmin){await state.db.auth.signOut({scope:"local"});showLogin();authMessage(system.lockdown_message||"MAILCORE ist vorübergehend im Wartungsmodus.",true);return;}}catch(e){console.warn("Systemstatus:",e.message);}
  try{await mailcoreApi("onboard");}catch(e){console.warn("MAILCORE Onboarding:",e.message);}
  await loadChats();
  try{await loadSystemMessages();}catch(e){console.warn("MAILCORE Systemchat:",e.message);}
  try{const {data:announcement}=await state.db.from("mailcore_announcements").select("message,created_at").order("created_at",{ascending:false}).limit(1).maybeSingle();if(announcement&&Date.now()-new Date(announcement.created_at).getTime()<7*24*60*60*1000)toast("MAILCORE: "+announcement.message);}catch(e){console.warn("Systemnachricht:",e.message);}await heartbeat();clearInterval(state.heartbeatTimer);state.heartbeatTimer=setInterval(heartbeat,60000);}
  catch(error){console.error(error);toast("MAILCORE konnte nicht geladen werden: "+(error.message||"Unbekannter Fehler"));showLogin();authMessage("Backend-Fehler: "+(error.message||"Bitte später erneut versuchen."),true);}
  finally{state.booting=false;}
}
function openUserModal(){$("userModal").classList.remove("hidden");$("userSearch").value="";$("userResults").innerHTML='<div class="result-placeholder">Gib mindestens 2 Zeichen ein.</div>';$("userSearch").focus();}
async function searchUsers(){
  const q=$("userSearch").value.trim().replace(/^@/,"");if(q.length<2){$("userResults").innerHTML='<div class="result-placeholder">Gib mindestens 2 Zeichen ein.</div>';return;}
  $("userResults").innerHTML='<div class="result-placeholder">Suche läuft …</div>';
  const {data,error}=await state.db.from("mailcore_profiles").select("id,username,display_name,last_seen_at").ilike("username","%"+q+"%").neq("id",state.user.id).limit(12);
  if(error){$("userResults").innerHTML='<div class="result-placeholder">Fehler: '+esc(error.message)+'</div>';return;}
  if(!data?.length){$("userResults").innerHTML='<div class="result-placeholder">Kein Nutzer gefunden.</div>';return;}
  $("userResults").innerHTML=data.map(p=>'<button type="button" class="user-result" data-user="'+esc(p.id)+'" data-username="'+esc(p.username)+'" data-display="'+esc(p.display_name)+'"><span class="avatar">'+esc(initials(p.display_name))+'</span><span class="user-result-copy"><strong>'+esc(p.display_name)+'</strong><small>@'+esc(p.username)+'</small></span><span class="result-arrow">→</span></button>').join("");
}
async function startDirectChat(row){
  const target=row.dataset.user,partner={id:target,display_name:row.dataset.display||"MAILCORE Nutzer",username:row.dataset.username||"nutzer"};
  $("userModal").classList.add("hidden");row.disabled=true;
  try{const {data,error}=await state.db.rpc("mailcore_create_direct_chat",{p_target_user_id:target});if(error)throw error;const id=typeof data==="string"?data:data?.id||data?.conversation_id;if(!id)throw new Error("Die Chat-ID wurde vom Server nicht zurückgegeben.");await loadChats();await openChat(id,partner);}
  catch(error){toast("Chat konnte nicht gestartet werden: "+error.message);row.disabled=false;}
}
function openDeleteAccount(){ $("deleteAccountConfirm").value=""; $("confirmDeleteAccount").disabled=true; $("deleteAccountMessage").textContent=""; $("deleteAccountModal").classList.remove("hidden"); }
function closeDeleteAccount(){ $("deleteAccountModal").classList.add("hidden"); }
async function deleteOwnAccount(){
  if(!$("deleteAccountConfirm").value.trim().toUpperCase().normalize("NFC").includes("LÖSCHEN")) return;
  const button=$("confirmDeleteAccount"); button.disabled=true; button.textContent="Konto wird gelöscht …";
  $("deleteAccountMessage").textContent="Deine Daten werden dauerhaft gelöscht.";
  try{
    const {data:{session},error:sessionError}=await state.db.auth.getSession();
    if(sessionError) throw sessionError;
    if(!session?.access_token) throw new Error("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
    const {data,error}=await state.db.functions.invoke("mailcore-delete-account",{headers:{Authorization:"Bearer "+session.access_token},body:{}});
    if(error) throw error;
    if(!data?.success) throw new Error(data?.error||"Die Löschung wurde nicht bestätigt.");
    closeDeleteAccount();
    await state.db.auth.signOut({scope:"local"});
    showLogin(); setAuthMode("login");
    authMessage("Dein Konto und die zugehörigen Daten wurden gelöscht.");
  }catch(error){
    console.error("MAILCORE account deletion:",error);
    $("deleteAccountMessage").textContent=error.message||"Die Kontolöschung ist fehlgeschlagen.";
    $("deleteAccountMessage").classList.add("error");
    button.disabled=false;button.textContent="Konto endgültig löschen";
  }
}

async function loadAppearance(){
 const {data,error}=await state.db.from("mailcore_user_settings").select("theme").eq("user_id",state.user.id).maybeSingle();
 if(error)throw error;
 const settings=data||{theme:"light"};
 $("themeSelect").value=settings.theme||"light";
 $("accentColor").value="#16a34a";
 applyAppearance();
}
function applyAppearance(){
 const theme=$("themeSelect").value;
 document.documentElement.dataset.theme=theme==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;
 document.documentElement.style.setProperty("--accent","#16a34a");
 document.documentElement.style.setProperty("--accent-soft","rgba(22,163,74,.10)");
 $("accentColor").value="#16a34a";
}
function openSettings(){
 $("settingsDisplayName").value=state.profile?.display_name||"";
 $("settingsUsername").value=state.profile?.username||"";
 $("settingsAbout").value=state.profile?.about||"";
 $("settingsEmail").value=state.user?.email||"";
 $("settingsPassword").value="";$("settingsMessage").textContent="";
 $("settingsModal").classList.remove("hidden");loadAppearance().catch(e=>toast("Einstellungen: "+e.message));
}
function closeSettings(){$("settingsModal").classList.add("hidden");}
async function saveSettings(e){
 e.preventDefault();const btn=$("settingsSave");btn.disabled=true;btn.textContent="Speichern …";
 try{
  const display_name=$("settingsDisplayName").value.trim(),username=$("settingsUsername").value.trim().replace(/^@/,"").toLowerCase(),about=$("settingsAbout").value.trim();
  if(!/^[a-z0-9_]{3,24}$/.test(username))throw new Error("@-Name: 3 bis 24 Zeichen, nur a-z, 0-9 und _.");
  const {data,error}=await state.db.from("mailcore_profiles").update({display_name,username,about,updated_at:new Date().toISOString()}).eq("id",state.user.id).select().single();
  if(error)throw error;state.profile=data;
  const newEmail=$("settingsEmail").value.trim();
  if(newEmail&&newEmail!==state.user.email){const {error:emailError}=await state.db.auth.updateUser({email:newEmail});if(emailError)throw emailError;$("settingsMessage").textContent="Profil gespeichert. Bitte bestätige die neue E-Mail-Adresse über deinen Posteingang.";}
  const newPassword=$("settingsPassword").value;
  if(newPassword){if(newPassword.length<8)throw new Error("Das neue Passwort muss mindestens 8 Zeichen haben.");const {error:pwError}=await state.db.auth.updateUser({password:newPassword});if(pwError)throw pwError;}
  const {error:prefError}=await state.db.from("mailcore_user_settings").upsert({user_id:state.user.id,theme:$("themeSelect").value,accent_color:"#16a34a",updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(prefError)throw prefError;
  $("profileName").textContent=data.display_name;$("profileHandle").textContent="@"+data.username;$("profileAvatar").textContent=initials(data.display_name);
  $("settingsMessage").textContent=$("settingsMessage").textContent||"Änderungen gespeichert.";toast("Profil aktualisiert.");
 }catch(error){$("settingsMessage").textContent=error.message||"Speichern fehlgeschlagen.";}
 finally{btn.disabled=false;btn.textContent="Änderungen speichern";}
}
async function loadChatControl(id){
 const {data,error}=await state.db.from("mailcore_chat_controls").select("*").eq("user_id",state.user.id).eq("conversation_id",id).maybeSingle();
 if(error)throw error;state.chatControl=data||null;
 $("muteChatBtn").textContent=data?.is_muted?"Stummschaltung aufheben":"Stummschalten";
 $("hideChatBtn").textContent=data?.is_hidden?"Chat wieder anzeigen":"Chat verstecken";
 $("lockChatBtn").textContent=data?.lock_hash?"Chatsperre ändern":"Chat mit Passwort sperren";
}
async function saveChatControl(patch){
 if(!state.activeChatId)throw new Error("Wähle zuerst einen Chat aus.");
 const next={user_id:state.user.id,conversation_id:state.activeChatId,...(state.chatControl||{}),...patch,updated_at:new Date().toISOString()};
 const {data,error}=await state.db.from("mailcore_chat_controls").upsert(next,{onConflict:"user_id,conversation_id"}).select().single();
 if(error)throw error;state.chatControl=data;await loadChats();await loadChatControl(state.activeChatId);
}
async function toggleMuteChat(){try{await saveChatControl({is_muted:!state.chatControl?.is_muted});toast(state.chatControl?.is_muted?"Chat stummgeschaltet.":"Stummschaltung aufgehoben.");}catch(e){toast(e.message);}}
async function toggleHideChat(){try{await saveChatControl({is_hidden:!state.chatControl?.is_hidden});if(state.chatControl?.is_hidden){$("conversation").classList.add("hidden");$("welcomePanel").classList.remove("hidden");state.activeChatId=null;}toast("Chatliste aktualisiert.");}catch(e){toast(e.message);}}
async function deriveLock(password,salt){
 const enc=new TextEncoder();const material=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:180000,hash:"SHA-256"},material,256);
 return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,"0")).join("");
}
async function toggleChatLock(){
 try{
  if(state.chatControl?.lock_hash){
   const old=prompt("Aktuelles Chat-Passwort eingeben, um die Sperre zu entfernen oder zu ändern.");if(old===null)return;
   if(await deriveLock(old,state.chatControl.lock_salt)!==state.chatControl.lock_hash)throw new Error("Falsches Passwort.");
   const next=prompt("Neues Passwort eingeben. Leer lassen, um die Sperre zu entfernen.");if(next===null)return;
   if(!next){await saveChatControl({lock_hash:null,lock_salt:null});toast("Chatsperre entfernt.");return;}
   if(next.length<6)throw new Error("Mindestens 6 Zeichen verwenden.");
   const salt=crypto.randomUUID();await saveChatControl({lock_salt:salt,lock_hash:await deriveLock(next,salt)});
  }else{
   const password=prompt("Passwort für diesen versteckten Chat festlegen (mindestens 6 Zeichen).");if(password===null)return;
   if(password.length<6)throw new Error("Mindestens 6 Zeichen verwenden.");
   const salt=crypto.randomUUID();await saveChatControl({lock_salt:salt,lock_hash:await deriveLock(password,salt),is_hidden:true});
  }
  toast("Chatsperre aktualisiert.");
 }catch(e){toast(e.message);}
}
async function toggleBlockUser(){
 if(!state.activePartner?.id){toast("Profil der Person konnte nicht zugeordnet werden.");return;}
 const blocked=state.blockedUsers.includes(state.activePartner.id);
 if(!blocked&&!confirm("@"+state.activePartner.username+" blockieren?"))return;
 try{
  if(blocked){const {error}=await state.db.from("mailcore_blocks").delete().eq("owner_id",state.user.id).eq("blocked_id",state.activePartner.id);if(error)throw error;state.blockedUsers=state.blockedUsers.filter(x=>x!==state.activePartner.id);}
  else{const {error}=await state.db.from("mailcore_blocks").insert({owner_id:state.user.id,blocked_id:state.activePartner.id});if(error)throw error;state.blockedUsers.push(state.activePartner.id);}
  $("blockUserBtn").textContent=blocked?"Person blockieren":"Blockierung aufheben";await loadChats();toast(blocked?"Blockierung aufgehoben.":"Person blockiert.");
 }catch(e){toast(e.message);}
}
async function addActiveContact(){
 if(!state.activePartner?.id){toast("Person nicht gefunden.");return;}
 try{const {error}=await state.db.from("mailcore_contacts").upsert({owner_id:state.user.id,contact_id:state.activePartner.id},{onConflict:"owner_id,contact_id"});if(error)throw error;toast("Kontakt gespeichert.");}catch(e){toast(e.message);}
}

async function openHiddenChats(){
 $("hiddenChatsModal").classList.remove("hidden");$("hiddenChatsList").textContent="Versteckte Chats werden geladen …";
 try{
  const {data:controls,error}=await state.db.from("mailcore_chat_controls").select("conversation_id,lock_salt,lock_hash").eq("user_id",state.user.id).eq("is_hidden",true);
  if(error)throw error;
  if(!controls?.length){$("hiddenChatsList").textContent="Keine versteckten Chats.";return;}
  const ids=controls.map(x=>x.conversation_id);
  const {data:members,error:memberError}=await state.db.from("mailcore_participants").select("conversation_id,user_id,mailcore_profiles(username,display_name)").in("conversation_id",ids).neq("user_id",state.user.id);
  if(memberError)throw memberError;
  const memberMap=new Map((members||[]).map(m=>[m.conversation_id,m]));
  $("hiddenChatsList").innerHTML=controls.map(x=>{const p=memberMap.get(x.conversation_id);const name=p?.mailcore_profiles?.display_name||"Versteckter Chat";return '<button class="user-result" type="button" data-hidden-chat="'+esc(x.conversation_id)+'"><span class="avatar">⌑</span><span class="user-result-copy"><strong>'+esc(name)+'</strong><small>Passwortgeschützt</small></span><span class="result-arrow">Öffnen</span></button>';}).join("");
  $("hiddenChatsList").querySelectorAll("[data-hidden-chat]").forEach(btn=>btn.addEventListener("click",async()=>{
   const control=controls.find(x=>x.conversation_id===btn.dataset.hiddenChat);const pass=prompt("Passwort für diesen Chat eingeben.");if(pass===null)return;
   if(await deriveLock(pass,control.lock_salt)!==control.lock_hash){toast("Falsches Passwort.");return;}
   const m=memberMap.get(control.conversation_id);const profile=m?.mailcore_profiles||{};const partner={id:m?.user_id,username:profile.username||"nutzer",display_name:profile.display_name||"Chat"};
   $("hiddenChatsModal").classList.add("hidden");await openChat(control.conversation_id,partner,true);toast("Chat entsperrt.");
  }));
 }catch(e){$("hiddenChatsList").textContent="Fehler: "+e.message;}
}

async function openContacts(){
 $("contactsModal").classList.remove("hidden");$("contactsList").innerHTML="Kontakte werden geladen …";
 try{
  const {data,error}=await state.db.from("mailcore_contacts").select("contact_id,nickname").eq("owner_id",state.user.id).order("created_at",{ascending:false});
  if(error)throw error;
  const ids=(data||[]).map(x=>x.contact_id);
  const {data:profiles,error:profileError}=ids.length?await state.db.from("mailcore_profiles").select("id,username,display_name").in("id",ids):{data:[],error:null};
  if(profileError)throw profileError;
  const map=new Map((profiles||[]).map(p=>[p.id,p]));
  $("contactsList").innerHTML=data?.length?data.map(x=>{const p=map.get(x.contact_id)||{};return '<div class="contact-row"><span class="avatar">'+esc(initials(p.display_name))+'</span><span><strong>'+esc(x.nickname||p.display_name||"Kontakt")+'</strong><small>@'+esc(p.username||"unbekannt")+'</small></span></div>';}).join(""):"Noch keine Kontakte gespeichert.";
 }catch(e){$("contactsList").textContent="Fehler: "+e.message;}
}


async function openAdmin(){
 if(!state.isAdmin){toast("Kein Administratorzugriff.");return;}
 $("adminModal").classList.remove("hidden");await refreshAdminUsers();
}
async function refreshAdminUsers(){
 $("adminUsers").textContent="Konten werden geladen …";
 try{
  const data=await mailcoreApi("admin_users");
  $("adminUsers").innerHTML=data.users.map(u=>{
   const p=u.profile||{},banned=!!u.banned_until&&new Date(u.banned_until)>new Date();
   return '<div class="admin-user"><div><strong>'+esc(p.display_name||p.username||u.email||("Konto "+String(u.id).slice(0,8)))+'</strong><small>'+esc(u.email||"Keine E-Mail hinterlegt")+' · '+esc(p.username?"@"+p.username:"Noch kein Profil")+' · '+u.credits+' Credits</small><small>Erstellt: '+new Date(u.created_at).toLocaleDateString("de-DE")+(u.last_sign_in_at?" · Zuletzt aktiv: "+new Date(u.last_sign_in_at).toLocaleDateString("de-DE"):"")+'</small></div><button class="'+(banned?"secondary-btn":"danger-btn")+'" data-admin-ban="'+esc(u.id)+'" data-banned="'+(banned?"true":"false")+'">'+(banned?"Entsperren":"Sperren")+'</button></div>';
  }).join("")||"Keine MAILCORE-Konten gefunden.";
  $("creditTarget").innerHTML='<option value="">MAILCORE-Nutzer auswählen …</option>'+data.users.map(u=>'<option value="'+esc(u.id)+'">'+esc((u.profile?.display_name||u.email||("Konto "+String(u.id).slice(0,8)))+" · "+u.credits+" Credits")+"</option>").join("");
  $("adminUsers").querySelectorAll("[data-admin-ban]").forEach(btn=>btn.addEventListener("click",async()=>{
   const ban=btn.dataset.banned!=="true";if(!confirm(ban?"Dieses Konto wirklich sperren?":"Dieses Konto wieder freigeben?"))return;
   btn.disabled=true;try{await mailcoreApi("admin_ban",{user_id:btn.dataset.adminBan,banned:ban});await refreshAdminUsers();}catch(e){toast(e.message);btn.disabled=false;}
  }));
 }catch(e){$("adminUsers").textContent="Fehler: "+e.message;}
}
async function sendAdminBroadcast(){
 const message=$("adminBroadcastText").value.trim();if(!message)return;
 $("adminBroadcastSend").disabled=true;
 try{await mailcoreApi("admin_broadcast",{message});$("adminBroadcastText").value="";toast("Systemnachricht an alle Konten veröffentlicht.");}
 catch(e){toast("Senden fehlgeschlagen: "+e.message);}
 finally{$("adminBroadcastSend").disabled=false;}
}
async function toggleAdminLockdown(){
 const enabling=$("adminLockdownBtn").dataset.active!=="true";
 const phrase=enabling?"WARTUNG AKTIVIEREN":"WARTUNG BEENDEN";
 if(prompt("Sicherheitsbestätigung eingeben: "+phrase)!==phrase)return;
 const message=enabling?($("adminLockdownMessage").value.trim()||"MAILCORE ist vorübergehend im Wartungsmodus."):"";
 try{
  await mailcoreApi("admin_set_lockdown",{lockdown:enabling,message});
  $("adminLockdownBtn").dataset.active=String(enabling);
  $("adminLockdownBtn").textContent=enabling?"Wartungsmodus beenden":"Not-Aus aktivieren";
  toast(enabling?"Not-Aus aktiviert.":"Wartungsmodus beendet.");
 }catch(e){toast(e.message);}
}

async function init(){
  if(!window.supabase?.createClient){authMessage("Die Verbindungskomponente konnte nicht geladen werden. Bitte Seite neu laden.",true);return;}
  state.db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  $("authModeBtn").addEventListener("click",()=>setAuthMode($("authForm").dataset.mode==="signup"?"login":"signup"));
  $("forgotPasswordBtn").addEventListener("click",async()=>{
    const email=$("authEmail").value.trim();
    if(!email){authMessage("Bitte zuerst deine E-Mail-Adresse eingeben.");$("authEmail").focus();return;}
    const button=$("forgotPasswordBtn");button.disabled=true;authMessage("");
    try{const {error}=await state.db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;authMessage("Wenn für diese Adresse ein Konto besteht, wurde eine E-Mail zum Festlegen eines Passworts versendet.");}
    catch(error){authMessage("Passwort-E-Mail konnte nicht versendet werden: "+error.message,true);}
    finally{button.disabled=false;}
  });
  $("passwordRecoveryForm").addEventListener("submit",async e=>{
    e.preventDefault();const password=$("recoveryPassword").value,button=$("recoverySave");button.disabled=true;$("recoveryMessage").textContent="Passwort wird gespeichert …";
    try{const {error}=await state.db.auth.updateUser({password});if(error)throw error;$("recoveryMessage").textContent="Passwort erfolgreich festgelegt. Du bist jetzt angemeldet.";$("passwordRecoveryModal").classList.add("hidden");$("recoveryPassword").value="";}
    catch(error){$("recoveryMessage").textContent=error.message||"Passwort konnte nicht gespeichert werden.";$("recoveryMessage").classList.add("error");}
    finally{button.disabled=false;}
  });
  $("googleSignIn").addEventListener("click",async()=>{const button=$("googleSignIn");button.disabled=true;button.classList.add("loading");try{const {error}=await state.db.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname+location.search,queryParams:{prompt:"select_account"}}});if(error)throw error;}catch(error){authMessage("Google-Anmeldung fehlgeschlagen: "+error.message,true);button.disabled=false;button.classList.remove("loading");}});
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();const signup=$("authForm").dataset.mode==="signup",button=$("authSubmit"),email=$("authEmail").value.trim(),password=$("authPassword").value;
    button.disabled=true;button.textContent="Einen Moment …";authMessage("");
    try{
      if(signup){const display_name=$("displayName").value.trim()||email.split("@")[0];const {data,error}=await state.db.auth.signUp({email,password,options:{data:{app:"mailcore",display_name},emailRedirectTo:location.origin+location.pathname+location.search}});if(error)throw error;if(data.session)await enterApp(data.session);else authMessage("Konto erstellt. Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.");}
      else{const {data,error}=await state.db.auth.signInWithPassword({email,password});if(error)throw error;if(data.session)await enterApp(data.session);}
    }catch(error){authMessage(error.message||"Anmeldung fehlgeschlagen.",true);}
    finally{button.disabled=false;button.innerHTML=signup?'Konto erstellen <span>→</span>':'Anmelden <span>→</span>';}
  });
  $("chatList").addEventListener("click",e=>{if(e.target.closest("[data-system-chat]")){openSystemChat().catch(err=>toast(err.message));return;}const item=e.target.closest("[data-chat]");if(item){const c=state.chats.find(x=>x.id===item.dataset.chat);if(c)openChat(c.id,c.partner).catch(err=>toast(err.message));}});
  $("chatSearch").addEventListener("input",renderChats);
  $("messageForm").addEventListener("submit",async e=>{e.preventDefault();const body=$("messageInput").value.trim();if(!body||!state.activeChatId)return;const button=$("messageForm").querySelector("button");button.disabled=true;try{if(state.activeChatId==="mailcore-system"){if(!state.isAdmin)throw new Error("Nur Administratoren können in den MAILCORE-Systemchat schreiben.");await mailcoreApi("admin_broadcast",{message:body});$("messageInput").value="";await loadSystemMessages();renderSystemMessages();toast("Nachricht als MAILCORE an alle Nutzer gesendet.");return;}const {data,error}=await state.db.from("mailcore_messages").insert({conversation_id:state.activeChatId,sender_id:state.user.id,body}).select().single();if(error)throw error;$("messageInput").value="";if(data)appendMessage(data);await loadChats();$("messageInput").focus();}catch(error){toast("Nachricht nicht gesendet: "+error.message);}finally{button.disabled=state.activeChatId==="mailcore-system"&&!state.isAdmin;}});
  $("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("messageForm").requestSubmit();}});
  $("adminContactBtn").addEventListener("click",openAdminDirectChat);
  $("newChatBtn").addEventListener("click",openUserModal);$("welcomeNewChat").addEventListener("click",openUserModal);
  $("closeUserModal").addEventListener("click",()=>$("userModal").classList.add("hidden"));
  $("userModal").addEventListener("click",e=>{if(e.target===$("userModal"))$("userModal").classList.add("hidden");});
  $("userSearch").addEventListener("input",()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>searchUsers().catch(err=>toast(err.message)),300);});
  $("userResults").addEventListener("click",e=>{const row=e.target.closest("[data-user]");if(row)startDirectChat(row);});
  $("mobileMenu").addEventListener("click",()=> $("sidebar").classList.contains("open")?closeSidebar():openSidebar());
  $("sidebarClose").addEventListener("click",closeSidebar);
  $("sidebarBackdrop").addEventListener("click",closeSidebar);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSidebar();$("userModal").classList.add("hidden");closeDeleteAccount();closeSettings();$("contactsModal").classList.add("hidden");}});
  $("refreshBtn").addEventListener("click",async()=>{const button=$("refreshBtn");button.disabled=true;try{await loadChats();if(state.activeChatId)await loadMessages();toast("Chats aktualisiert");}catch(error){toast("Aktualisierung fehlgeschlagen: "+error.message);}finally{button.disabled=false;}});
  $("accountSettingsBtn").addEventListener("click",openSettings);
  $("inviteBtn").addEventListener("click",createInvite);
  $("settingsClose").addEventListener("click",closeSettings);
  $("openDeleteFromSettings").addEventListener("click",()=>{closeSettings();openDeleteAccount();});
  $("contactsClose").addEventListener("click",()=>$("contactsModal").classList.add("hidden"));
  $("hiddenChatsBtn").addEventListener("click",openHiddenChats);
  $("hiddenChatsClose").addEventListener("click",()=>$("hiddenChatsModal").classList.add("hidden"));
  $("hiddenChatsModal").addEventListener("click",e=>{if(e.target===$("hiddenChatsModal"))$("hiddenChatsModal").classList.add("hidden");});
  $("contactsModal").addEventListener("click",e=>{if(e.target===$("contactsModal"))$("contactsModal").classList.add("hidden");});
  $("settingsModal").addEventListener("click",e=>{if(e.target===$("settingsModal"))closeSettings();});
  $("settingsForm").addEventListener("submit",saveSettings);
  $("themeSelect").addEventListener("change",applyAppearance);
  $("accentColor").addEventListener("input",applyAppearance);
  $("addContactBtn").addEventListener("click",addActiveContact);
  $("muteChatBtn").addEventListener("click",toggleMuteChat);
  $("hideChatBtn").addEventListener("click",toggleHideChat);
  $("lockChatBtn").addEventListener("click",toggleChatLock);
  $("blockUserBtn").addEventListener("click",toggleBlockUser);
  $("contactsBtn").addEventListener("click",openContacts);
  $("adminBtn").addEventListener("click",openAdmin);
  $("adminSideBtn").addEventListener("click",openAdmin);
  $("adminClose").addEventListener("click",()=>$("adminModal").classList.add("hidden"));
  $("adminRefresh").addEventListener("click",refreshAdminUsers);
  $("creditGrantBtn").addEventListener("click",async()=>{const user_id=$("creditTarget").value,amount=Number($("creditAmount").value),reason=$("creditReason").value.trim()||"Admin-Gutschrift";if(!user_id||!Number.isInteger(amount)||amount<1||amount>100000){toast("Bitte Nutzer und gültigen Credit-Betrag auswählen.");return;}const btn=$("creditGrantBtn");btn.disabled=true;try{const result=await mailcoreApi("admin_credit",{user_id,amount,reason});$("creditAdminStatus").textContent="Gutschrift erfolgreich. Neuer Kontostand: "+result.credits+" Credits.";await refreshAdminUsers();}catch(e){$("creditAdminStatus").textContent="Fehler: "+e.message;}finally{btn.disabled=false;}});
  $("adminBroadcastSend").addEventListener("click",sendAdminBroadcast);
  $("adminLockdownBtn").addEventListener("click",toggleAdminLockdown);
  $("adminModal").addEventListener("click",e=>{if(e.target===$("adminModal"))$("adminModal").classList.add("hidden");});
  $("closeInvite").addEventListener("click",()=>$("inviteModal").classList.add("hidden"));
  $("inviteModal").addEventListener("click",e=>{if(e.target===$("inviteModal"))$("inviteModal").classList.add("hidden");});
  $("copyInvite").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("inviteLink").value);$("inviteMessage").textContent="Einladungslink kopiert.";}catch{$("inviteLink").select();$("inviteMessage").textContent="Link markieren und kopieren.";}});
  $("aiBtn").addEventListener("click",openAI);
  $("closeAI").addEventListener("click",()=>$("aiModal").classList.add("hidden"));
  $("aiModal").addEventListener("click",e=>{if(e.target===$("aiModal"))$("aiModal").classList.add("hidden");});
  $("aiForm").addEventListener("submit",sendAI);
  $("cancelDeleteAccount").addEventListener("click",closeDeleteAccount);
  $("cancelDeleteAccountTop").addEventListener("click",closeDeleteAccount);
  $("deleteAccountModal").addEventListener("click",e=>{if(e.target===$("deleteAccountModal"))closeDeleteAccount();});
  $("deleteAccountConfirm").addEventListener("input",()=>{$("confirmDeleteAccount").disabled=$("deleteAccountConfirm").value.trim().toUpperCase().normalize("NFC")!=="LÖSCHEN";});
  $("confirmDeleteAccount").addEventListener("click",deleteOwnAccount);
  $("logoutBtn").addEventListener("click",async()=>{try{await state.db.auth.signOut({scope:"local"});showLogin();setAuthMode("login");authMessage("Du wurdest abgemeldet.");}catch(error){toast(error.message);}});
  state.db.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY"){$("passwordRecoveryModal").classList.remove("hidden");return;}if(event==="SIGNED_IN"&&session)enterApp(session);if(event==="SIGNED_OUT")showLogin();});
  const {data,error}=await state.db.auth.getSession();if(error)throw error;if(data.session)await enterApp(data.session);
}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error("MAILCORE init:",error);authMessage("MAILCORE-Start fehlgeschlagen: "+(error.message||"Bitte Seite neu laden."),true);}));
})();