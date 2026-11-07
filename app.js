const OWNER = "QSHao2022";
const ARCHIVE_REPO = "research-archive";
const BRANCH = "main";
const API = "https://api.github.com";
const $ = (id) => document.getElementById(id);
const fields = ["company","meeting-date","note-title","above","below","followup","judgment"];
let notes = [];
let currentPath = null;
let currentSha = null;
let token = localStorage.getItem("research_archive_token") || sessionStorage.getItem("research_archive_token") || "";

function setStatus(text, connected=false) {
  $("cloud-status").innerHTML = "<i></i>" + text;
  $("cloud-status").classList.toggle("connected", connected);
}
function headers() {
  return { "Accept":"application/vnd.github+json", "Authorization":"Bearer "+token, "X-GitHub-Api-Version":"2022-11-28" };
}
async function api(path, options={}) {
  const response = await fetch(API+path, { ...options, headers:{...headers(), ...(options.headers||{})} });
  const data = response.status === 204 ? null : await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.message || ("GitHub API error: "+response.status));
  return data;
}
function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function noteFromForm() {
  return {
    company:$("company").value.trim(),
    date:$("meeting-date").value,
    title:$("note-title").value.trim(),
    above:$("above").value.trim(),
    below:$("below").value.trim(),
    followup:$("followup").value.trim(),
    judgment:$("judgment").value.trim(),
    updatedAt:new Date().toISOString()
  };
}
function fillForm(note, path=null, sha=null) {
  $("company").value=note?.company||"";
  $("meeting-date").value=note?.date||new Date().toISOString().slice(0,10);
  $("note-title").value=note?.title||"";
  $("above").value=note?.above||"";
  $("below").value=note?.below||"";
  $("followup").value=note?.followup||"";
  $("judgment").value=note?.judgment||"";
  currentPath=path; currentSha=sha;
  $("editor-heading").textContent=path?"编辑历史纪要":"新建研究纪要";
  $("save-button").textContent=path?"更新云端纪要":"保存到云端";
  $("updated-at").textContent=note?.updatedAt?"最近更新："+new Date(note.updatedAt).toLocaleString("zh-CN"):"";
}
function clearForm() { fillForm({date:new Date().toISOString().slice(0,10)}); }
async function loadHistory() {
  if (!token) { setStatus("尚未连接云端"); return; }
  setStatus("正在读取…");
  try {
    const tree = await api("/repos/"+OWNER+"/"+ARCHIVE_REPO+"/git/trees/"+BRANCH+"?recursive=1");
    const paths = (tree.tree||[]).filter(x=>x.type==="blob" && x.path.startsWith("notes/") && x.path.endsWith(".json"));
    const loaded = await Promise.all(paths.map(async item=>{
      try {
        const file=await api("/repos/"+OWNER+"/"+ARCHIVE_REPO+"/contents/"+item.path+"?ref="+BRANCH);
        const decoded=decodeURIComponent(escape(atob(file.content.replace(/\n/g,""))));
        return { ...JSON.parse(decoded), path:item.path, sha:file.sha };
      } catch(e) { console.warn("Skipped unreadable note",item.path,e); return null; }
    }));
    notes=loaded.filter(Boolean).sort((a,b)=>(b.date||"").localeCompare(a.date||"") || (b.updatedAt||"").localeCompare(a.updatedAt||""));
    setStatus("云端已连接",true);
    renderHistory();
    $("settings-message").textContent="";
    $("save-hint").textContent="已连接私有仓库 research-archive，保存后将同步至云端。";
  } catch(e) {
    setStatus("连接失败");
    $("settings-message").textContent=e.message;
    throw e;
  }
}
function renderHistory() {
  const query=$("history-search").value.trim().toLowerCase();
  const companyFilter=$("filter-company").value.trim().toLowerCase();
  const year=$("filter-year").value;
  const filtered=notes.filter(n=>{
    const hay=[n.company,n.title,n.above,n.below,n.followup,n.judgment].join(" ").toLowerCase();
    return (!query||hay.includes(query))&&(!companyFilter||(n.company||"").toLowerCase().includes(companyFilter))&&(!year||(n.date||"").startsWith(year));
  });
  $("history-count").textContent=filtered.length;
  $("history-list").innerHTML=filtered.length?filtered.map(n=>`<button class="history-item ${n.path===currentPath?"active":""}" data-path="${escapeHtml(n.path)}"><span class="history-company">${escapeHtml(n.company||"未命名公司")}</span><span class="history-title">${escapeHtml(n.title||"研究纪要")}</span><span class="history-date">${escapeHtml(n.date||"日期未填写")}</span></button>`).join(""):'<div class="empty-state">没有找到匹配的历史纪要。</div>';
  $("history-list").querySelectorAll(".history-item").forEach(btn=>btn.addEventListener("click",()=>openNote(btn.dataset.path)));
  const years=[...new Set(notes.map(n=>(n.date||"").slice(0,4)).filter(Boolean))].sort().reverse();
  const current=$("filter-year").value;
  $("filter-year").innerHTML='<option value="">全部年份</option>'+years.map(y=>'<option value="'+y+'">'+y+'</option>').join("");
  $("filter-year").value=current;
}
async function openNote(path) {
  const note=notes.find(n=>n.path===path); if(!note)return;
  fillForm(note,note.path,note.sha); renderHistory();
  $("save-hint").textContent="正在编辑云端历史记录。保存将更新原记录。";
}
function encodeBase64Utf8(str) { return btoa(unescape(encodeURIComponent(str))); }
async function saveNote() {
  if(!token){$("settings-dialog").showModal();$("settings-message").textContent="请先连接 GitHub 私有仓库。";return;}
  const note=noteFromForm();
  if(!note.company||!note.date){$("save-hint").textContent="请先填写公司名称和会议日期。";return;}
  $("save-button").disabled=true; $("save-button").textContent="保存中…";
  try {
    const slug=note.company.replace(/[^\p{L}\p{N}-]+/gu,"-").replace(/^-|-$/g,"").slice(0,45)||"company";
    const id=currentPath?currentPath.split("/").pop().replace(/\.json$/,""):Date.now()+"-"+Math.random().toString(36).slice(2,8);
    const path=currentPath||("notes/"+note.date.slice(0,4)+"/"+note.date.slice(5,7)+"/"+note.date+"-"+slug+"-"+id+".json");
    const body={message:(currentPath?"Update":"Add")+" research note: "+note.company+" "+note.date,content:encodeBase64Utf8(JSON.stringify(note,null,2)),branch:BRANCH};
    if(currentPath) body.sha=currentSha;
    const result=await api("/repos/"+OWNER+"/"+ARCHIVE_REPO+"/contents/"+path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    currentPath=path; currentSha=result.content.sha;
    await loadHistory();
    fillForm(note,currentPath,currentSha);
    $("save-hint").textContent="已成功保存至 GitHub 私有仓库。";
  } catch(e) { $("save-hint").textContent="保存失败："+e.message; }
  finally { $("save-button").disabled=false;$("save-button").textContent=currentPath?"更新云端纪要":"保存到云端"; }
}
function init() {
  fillForm({date:new Date().toISOString().slice(0,10)});
  $("settings-button").addEventListener("click",()=>{$("github-token").value=token;$("settings-dialog").showModal();});
  $("connect-button").addEventListener("click",async()=>{
    const candidate=$("github-token").value.trim();
    if(!candidate){$("settings-message").textContent="请粘贴 GitHub Token。";return;}
    token=candidate;
    try { await loadHistory();localStorage.setItem("research_archive_token",token);sessionStorage.removeItem("research_archive_token");$("settings-dialog").close(); }
    catch(e){token=localStorage.getItem("research_archive_token") || "";sessionStorage.removeItem("research_archive_token");}
  });
  $("disconnect-button").addEventListener("click",()=>{token="";localStorage.removeItem("research_archive_token");sessionStorage.removeItem("research_archive_token");notes=[];renderHistory();setStatus("尚未连接云端");$("settings-message").textContent="已清除此浏览器保存的 Token；GitHub 中的历史纪要不会删除。";$("save-hint").textContent="重新连接后即可读取云端历史。";});
  $("save-button").addEventListener("click",saveNote);
  $("new-note-button").addEventListener("click",()=>{clearForm();renderHistory();});
  $("clear-button").addEventListener("click",clearForm);
  ["history-search","filter-company","filter-year"].forEach(id=>$(id).addEventListener(id==="filter-year"?"change":"input",renderHistory));
  if(token) { localStorage.setItem("research_archive_token",token); sessionStorage.removeItem("research_archive_token"); loadHistory().catch(()=>{}); }
}
init();