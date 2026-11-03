(() => {
"use strict";
const SUPABASE_URL = "https://eopvkwhcgznvubesaszv.supabase.co";
const SUPABASE_KEY = "sb_publishable_d3hVgDqwTuB63BtfumPwoQ_ngy2ig_c";
const MAILCORE_URL = "https://lordlolqdh.github.io/mailcore/";
const $ = id => document.getElementById(id);
const state = { db:null, user:null, profile:null, chats:[], activeChatId:null, activePartner:null, channel:null, searchTimer:null, heartbeatTimer:null, toastTimer:null, booting:false, credits:0, inviteClaimed:false };
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
async function mailcoreApi(action,payload={}){const {data,error}=await state.db.functions.invoke("mailcore-api",{body:{action,...payload}});if(error)throw new Error(data?.error||error.message||"API-Fehler");if(data?.error)throw new Error(data.error);return data;}
function updateCredits(value){state.credits=Number(value)||0;["creditPill","aiCreditPill"].forEach(id=>{if($(id))$(id).textContent=state.credits+" Credits";});}
function aiBubble(role,content){const el=document.createElement("div");el.className="ai-message "+(role==="user"?"user":"assistant");el.textContent=content;return el;}
async function loadAIHistory(){const data=await mailcoreApi("ai_history");$("aiMessages").innerHTML="";if(!data.messages?.length){const welcome=document.createElement("div");welcome.className="ai-welcome";welcome.textContent="Hi! Ich bin MAILCORE AI. Frag mich etwas oder lass dir beim Schreiben helfen.";$("aiMessages").append(welcome);}else data.messages.forEach(m=>$("aiMessages").append(aiBubble(m.role,m.content)));$("aiMessages").scrollTop=$("aiMessages").scrollHeight;}
async function openAI(){$("aiModal").classList.remove("hidden");try{const w=await mailcoreApi("wallet");updateCredits(w.credits);await loadAIHistory();}catch(e){toast("KI konnte nicht geladen werden: "+e.message);}$("aiInput").focus();}
async function sendAI(e){e.preventDefault();const message=$("aiInput").value.trim();if(!message)return;const send=$("aiSend");send.disabled=true;$("aiMessages").append(aiBubble("user",message));$("aiInput").value="";const pending=aiBubble("assistant","MAILCORE AI denkt nach …");$("aiMessages").append(pending);$("aiMessages").scrollTop=$("aiMessages").scrollHeight;try{const result=await mailcoreApi("ai",{message});pending.textContent=(result.reply||"Keine Antwort erhalten.")+"\n\n−"+result.cost+" Credits · "+result.elapsed_seconds+" s · "+result.tokens+" Tokens";updateCredits(result.credits);}catch(error){pending.textContent="Fehler: "+error.message;try{const w=await mailcoreApi("wallet");updateCredits(w.credits);}catch{}}finally{send.disabled=false;$("aiMessages").scrollTop=$("aiMessages").scrollHeight;$("aiInput").focus();}}
async function createInvite(){$("inviteModal").classList.remove("hidden");$("inviteLink").value="";$("inviteMessage").textContent="Link wird erstellt …";try{const result=await mailcoreApi("invite");$("inviteLink").value=result.url;$("inviteMessage").textContent="Dein persönlicher Einladungslink ist bereit.";}catch(error){$("inviteMessage").textContent="Fehler: "+error.message;}}
async function heartbeat(){ if(!state.user)return; const {error}=await state.db.from("mailcore_profiles").update({last_seen_at:new Date().toISOString()}).eq("id",state.user.id); if(error) console.warn("MAILCORE heartbeat:",error.message); }
async function loadChats(){
  const {data:mine,error}=await state.db.from("mailcore_participants").select("conversation_id").eq("user_id",state.user.id);
  if(error) throw error;
  const ids=[...new Set((mine||[]).map(x=>x.conversation_id))];
  if(!ids.length){state.chats=[];renderChats();return;}
  const [membersResult,messagesResult]=await Promise.all([
    state.db.from("mailcore_participants").select("conversation_id,user_id,mailcore_profiles(username,display_name,last_seen_at)").in("conversation_id",ids),
    state.db.from("mailcore_messages").select("id,conversation_id,sender_id,body,created_at,read_at").in("conversation_id",ids).order("created_at",{ascending:false})
  ]);
  if(membersResult.error) throw membersResult.error; if(messagesResult.error) throw messagesResult.error;
  const messages=messagesResult.data||[];
  state.chats=ids.map(id=>{
    const member=(membersResult.data||[]).find(x=>x.conversation_id===id&&x.user_id!==state.user.id);
    const partner=member?.mailcore_profiles||{username:"unbekannt",display_name:"MAILCORE Nutzer"};
    return {id,partner,latest:messages.find(m=>m.conversation_id===id)||null,unread:messages.filter(m=>m.conversation_id===id&&m.sender_id!==state.user.id&&!m.read_at).length};
  }).sort((a,b)=>new Date(b.latest?.created_at||0)-new Date(a.latest?.created_at||0));
  renderChats();
}
function shortTime(value){if(!value)return"";const d=new Date(value);return d.toDateString()===new Date().toDateString()?d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"});}
function renderChats(){
  const query=$("chatSearch").value.trim().toLowerCase();
  const visible=state.chats.filter(c=>(c.partner.display_name+" "+c.partner.username).toLowerCase().includes(query));
  $("chatList").innerHTML=visible.length?visible.map(c=>'<button type="button" class="chat-item '+(c.id===state.activeChatId?"active":"")+'" data-chat="'+esc(c.id)+'"><span class="avatar">'+esc(initials(c.partner.display_name))+'</span><span class="chat-item-copy"><span class="chat-item-top"><strong>'+esc(c.partner.display_name)+'</strong><time>'+shortTime(c.latest?.created_at)+'</time></span><span class="chat-preview">'+(c.latest?esc((c.latest.sender_id===state.user.id?"Du: ":"")+c.latest.body):"Noch keine Nachrichten")+'</span></span>'+(c.unread?'<span class="unread-count">'+c.unread+'</span>':"")+'</button>').join(""):'<div class="empty-chats">Noch keine Chats.<br>Starte eine Unterhaltung über das Plus.</div>';
}
function renderMessage(m){const mine=m.sender_id===state.user.id;return '<article class="message '+(mine?"mine":"")+'" data-message="'+esc(m.id)+'"><div class="message-bubble">'+esc(m.body)+'</div><div class="message-meta"><time>'+new Date(m.created_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})+'</time>'+(mine?" · Gesendet":"")+'</div></article>';}
function appendMessage(m){if(m.conversation_id!==state.activeChatId||$("messages").querySelector('[data-message="'+CSS.escape(String(m.id))+'"]'))return;$("messages").insertAdjacentHTML("beforeend",renderMessage(m));$("messages").scrollTop=$("messages").scrollHeight;}
async function loadMessages(){const {data,error}=await state.db.from("mailcore_messages").select("*").eq("conversation_id",state.activeChatId).order("created_at",{ascending:true}).limit(300);if(error)throw error;$("messages").innerHTML=(data||[]).map(renderMessage).join("");$("messages").scrollTop=$("messages").scrollHeight;}
async function markRead(id){const {error}=await state.db.from("mailcore_messages").update({read_at:new Date().toISOString()}).eq("conversation_id",id).neq("sender_id",state.user.id).is("read_at",null);if(error)console.warn("Lesestatus:",error.message);const c=state.chats.find(x=>x.id===id);if(c)c.unread=0;renderChats();}
async function openChat(id,partner){
  state.activeChatId=id;state.activePartner=partner||state.chats.find(c=>c.id===id)?.partner||{display_name:"MAILCORE Nutzer",username:"nutzer"};
  renderChats();closeSidebar();$("welcomePanel").classList.add("hidden");$("conversation").classList.remove("hidden");
  $("conversationPerson").innerHTML='<div class="avatar">'+esc(initials(state.activePartner.display_name))+'</div><div><strong>'+esc(state.activePartner.display_name)+'</strong><small>@'+esc(state.activePartner.username||"nutzer")+'</small></div>';
  if(state.channel){await state.db.removeChannel(state.channel);state.channel=null;}
  await loadMessages(); await markRead(id);
  state.channel=state.db.channel("mailcore-chat-"+id).on("postgres_changes",{event:"INSERT",schema:"public",table:"mailcore_messages",filter:"conversation_id=eq."+id},async payload=>{appendMessage(payload.new);await loadChats();if(payload.new.sender_id!==state.user.id)await markRead(id);}).subscribe(status=>{if(status==="CHANNEL_ERROR")toast("Live-Verbindung unterbrochen. Aktualisiere den Chat.");});
}
async function enterApp(session){
  if(state.booting||state.user?.id===session.user.id)return;
  state.booting=true;state.user=session.user;
  try{$("authView").classList.add("hidden");$("chatView").classList.remove("hidden");await ensureProfile();if(!state.inviteClaimed){state.inviteClaimed=true;const code=new URLSearchParams(location.search).get("invite");if(code){try{const claim=await mailcoreApi("claim_invite",{code});if(claim.claimed)toast("Einladung eingelöst. 10 Bonus-Credits erhalten.");history.replaceState({},document.title,location.pathname);}catch(e){console.warn("Einladung:",e.message);}}}try{const wallet=await mailcoreApi("wallet");updateCredits(wallet.credits);}catch(e){console.warn("Credits:",e.message);}await loadChats();await heartbeat();clearInterval(state.heartbeatTimer);state.heartbeatTimer=setInterval(heartbeat,60000);}
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
  const target=row.dataset.user,partner={display_name:row.dataset.display||"MAILCORE Nutzer",username:row.dataset.username||"nutzer"};
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
async function init(){
  if(!window.supabase?.createClient){authMessage("Die Verbindungskomponente konnte nicht geladen werden. Bitte Seite neu laden.",true);return;}
  state.db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  $("authModeBtn").addEventListener("click",()=>setAuthMode($("authForm").dataset.mode==="signup"?"login":"signup"));
  $("googleSignIn").addEventListener("click",async()=>{const button=$("googleSignIn");button.disabled=true;button.classList.add("loading");try{const {error}=await state.db.auth.signInWithOAuth({provider:"google",options:{redirectTo:MAILCORE_URL+location.search,queryParams:{prompt:"select_account"}}});if(error)throw error;}catch(error){authMessage("Google-Anmeldung fehlgeschlagen: "+error.message,true);button.disabled=false;button.classList.remove("loading");}});
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();const signup=$("authForm").dataset.mode==="signup",button=$("authSubmit"),email=$("authEmail").value.trim(),password=$("authPassword").value;
    button.disabled=true;button.textContent="Einen Moment …";authMessage("");
    try{
      if(signup){const display_name=$("displayName").value.trim()||email.split("@")[0];const {data,error}=await state.db.auth.signUp({email,password,options:{data:{display_name},emailRedirectTo:MAILCORE_URL+location.search}});if(error)throw error;if(data.session)await enterApp(data.session);else authMessage("Konto erstellt. Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.");}
      else{const {data,error}=await state.db.auth.signInWithPassword({email,password});if(error)throw error;if(data.session)await enterApp(data.session);}
    }catch(error){authMessage(error.message||"Anmeldung fehlgeschlagen.",true);}
    finally{button.disabled=false;button.innerHTML=signup?'Konto erstellen <span>→</span>':'Anmelden <span>→</span>';}
  });
  $("chatList").addEventListener("click",e=>{const item=e.target.closest("[data-chat]");if(item){const c=state.chats.find(x=>x.id===item.dataset.chat);if(c)openChat(c.id,c.partner).catch(err=>toast(err.message));}});
  $("chatSearch").addEventListener("input",renderChats);
  $("messageForm").addEventListener("submit",async e=>{e.preventDefault();const body=$("messageInput").value.trim();if(!body||!state.activeChatId)return;const button=$("messageForm").querySelector("button");button.disabled=true;try{const {data,error}=await state.db.from("mailcore_messages").insert({conversation_id:state.activeChatId,sender_id:state.user.id,body}).select().single();if(error)throw error;$("messageInput").value="";if(data)appendMessage(data);await loadChats();$("messageInput").focus();}catch(error){toast("Nachricht nicht gesendet: "+error.message);}finally{button.disabled=false;}});
  $("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("messageForm").requestSubmit();}});
  $("newChatBtn").addEventListener("click",openUserModal);$("welcomeNewChat").addEventListener("click",openUserModal);
  $("closeUserModal").addEventListener("click",()=>$("userModal").classList.add("hidden"));
  $("userModal").addEventListener("click",e=>{if(e.target===$("userModal"))$("userModal").classList.add("hidden");});
  $("userSearch").addEventListener("input",()=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>searchUsers().catch(err=>toast(err.message)),300);});
  $("userResults").addEventListener("click",e=>{const row=e.target.closest("[data-user]");if(row)startDirectChat(row);});
  $("mobileMenu").addEventListener("click",()=> $("sidebar").classList.contains("open")?closeSidebar():openSidebar());
  $("sidebarClose").addEventListener("click",closeSidebar);
  $("sidebarBackdrop").addEventListener("click",closeSidebar);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSidebar();$("userModal").classList.add("hidden");closeDeleteAccount();}});
  $("refreshBtn").addEventListener("click",async()=>{const button=$("refreshBtn");button.disabled=true;try{await loadChats();if(state.activeChatId)await loadMessages();toast("Chats aktualisiert");}catch(error){toast("Aktualisierung fehlgeschlagen: "+error.message);}finally{button.disabled=false;}});
  $("accountSettingsBtn").addEventListener("click",openDeleteAccount);
  $("inviteBtn").addEventListener("click",createInvite);
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
  $("logoutBtn").addEventListener("click",async()=>{try{await state.db.auth.signOut();showLogin();setAuthMode("login");}catch(error){toast(error.message);}});
  state.db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session)enterApp(session);if(event==="SIGNED_OUT")showLogin();});
  const {data,error}=await state.db.auth.getSession();if(error)throw error;if(data.session)await enterApp(data.session);
}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error("MAILCORE init:",error);authMessage("MAILCORE-Start fehlgeschlagen: "+(error.message||"Bitte Seite neu laden."),true);}));
})();