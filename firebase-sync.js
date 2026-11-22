import { firebaseConfig } from './firebase-config.js';

const $ = id => document.getElementById(id);
const bridge = window.OnomichiTripBridge;
const TRIP_PATH = ['trips', 'onomichi-2026', 'itinerary', 'main'];
const LOCKED_TRAVEL = new Set(['saga-out','shink-out','localtrain','bus-on','bus-return','dinner-bus-out','dinner-bus-back','return-shink','midori']);
let auth, db, api, snapshotUnsubscribe=null, currentUser=null, sharedReady=false, editMode=false;
let itineraryRef=null, saving=false, autoSigningIn=false, attemptedInit=false;

function status(text){if($('sharedStatus'))$('sharedStatus').textContent=text;}
function help(text){if($('sharedHelp'))$('sharedHelp').textContent=text;}
function show(id,value){const el=$(id);if(el)el.hidden=!value;}
function disableSaving(flag){saving=flag;$('sharedSave').disabled=flag;$('sharedDelete').disabled=flag;}
function editModeSet(on){
  editMode=!!on&&sharedReady&&!!currentUser;
  document.body.classList.toggle('shared-editing',editMode);
  $('sharedEditMode').textContent=editMode?'編集モードをOFF':'編集モードをON';
  show('sharedAdd',editMode);
}
function refreshActions(){
  // Guest editing: all users are silently authenticated as anonymous visitors.
  show('sharedSignIn',false);
  show('sharedSignOut',false);
  show('sharedCopyUid',false);
  show('sharedInit',false);
  show('sharedIdentity',false);
  show('sharedEditMode',!!currentUser&&sharedReady);
  if(!sharedReady)editModeSet(false);
}
function errorMessage(error){
  const code=String(error?.code||'');
  if(code.includes('permission-denied'))return 'Firestoreのセキュリティルールが未設定か、公開されていません。Firebase ConsoleのFirestore → ルールで設定してね。';
  if(code.includes('popup-blocked')||code.includes('popup-closed-by-user'))return 'Googleログイン画面を開けませんでした。SafariまたはChromeでサイトを直接開いて試してね。';
  if(code.includes('unauthorized-domain'))return 'Firebase認証の承認済みドメインに kokiaus0216-prog.github.io を追加してね。';
  if(code.includes('operation-not-allowed'))return 'Firebase Authentication → ログイン方法で「匿名」を有効にしてね。';
  return '処理できませんでした：'+(error?.message||String(error));
}
function timeValue(text){
  const m=String(text||'').match(/(\d{1,2}):(\d{2})/);
  return m?m[1].padStart(2,'0')+':'+m[2]:'';
}
function generateId(){
  const candidate=window.crypto?.randomUUID?.();
  return 'custom-'+(candidate||String(Date.now())+'-'+Math.random().toString(36).slice(2));
}
function transitUI(){
  const kind=$('sharedKind').value;
  show('sharedTransit',kind==='train'||kind==='bus');
}
function openForm(id=null){
  if(!currentUser||!sharedReady||!editMode)return;
  const s=id?bridge.getStop(id):null;
  if(id&&!s){help('その予定は別の端末で削除されたようです。最新の旅程を確認してね。');return;}
  $('sharedDialogTitle').textContent=s?'予定を編集':'予定を追加';
  $('sharedId').value=s?.id||'';
  $('sharedDay').value=String(s?.d||1);
  $('sharedTime').value=timeValue(s?.t)||'12:00';
  $('sharedName').value=s?.name||'';
  $('sharedDesc').value=s?.desc||'';
  $('sharedTag').value=s?.tag||'';
  $('sharedMap').value=s?.map||'';
  $('sharedIcon').value=s?.i||'🍁';
  const kind=s?bridge.kindOf(s):'other';
  $('sharedKind').value=kind;
  $('sharedKind').disabled=!!s&&LOCKED_TRAVEL.has(s.id);
  const tr=s?bridge.transportOf(s):null;
  $('sharedFrom').value=tr?.from||'';
  $('sharedTo').value=tr?.to||'';
  $('sharedArrive').value=timeValue(tr?.arrive);
  $('sharedTransportDetail').value=tr?.detail||'';
  const statusSelect=$('sharedTravelStatus');
  statusSelect.value=tr?.status==='予約済'?'予約済':tr?.status==='要確認'?'要確認':'利用予定';
  show('sharedDelete',!!s);
  $('sharedError').textContent='';
  transitUI();
  $('sharedDialog').showModal();
}
function closeForm(){
  if($('sharedDialog').open)$('sharedDialog').close();
}
async function transact(mutator){
  if(!currentUser||!sharedReady||!api||!itineraryRef)throw new Error('共有編集が準備できていません');
  await api.runTransaction(db,async transaction=>{
    const snap=await transaction.get(itineraryRef);
    if(!snap.exists()||!Array.isArray(snap.data().items))throw new Error('共有旅程がまだ初期登録されていません');
    const items=snap.data().items;
    const next=mutator(items.map(s=>({...s})));
    if(!Array.isArray(next)||next.length>100)throw new Error('予定が多すぎるため保存できません');
    transaction.set(itineraryRef,{
      items:next,
      schemaVersion:1,
      updatedBy:currentUser.uid,
      updatedName:currentUser.displayName||currentUser.email||'メンバー',
      updatedAt:api.serverTimestamp()
    });
  });
}
function readForm(){
  const id=$('sharedId').value||generateId();
  const previous=bridge.getStop(id);
  const d=Number($('sharedDay').value);
  const t=$('sharedTime').value;
  const name=$('sharedName').value.trim();
  const kind=$('sharedKind').value;
  if(!/^\d{2}:\d{2}$/.test(t)||!name||![1,2].includes(d))throw new Error('日付・時刻・予定名を入力してね');
  const result={
    ...(previous||{}),id,d,t,
    name:name.slice(0,90),
    kind, i:($('sharedIcon').value.trim()||'🍁').slice(0,8),
    desc:$('sharedDesc').value.trim().slice(0,800),
    tag:$('sharedTag').value.trim().slice(0,140),
    map:$('sharedMap').value.trim().slice(0,600)
  };
  if(kind==='bus'||kind==='train'){
    const currentTransport=previous?bridge.transportOf(previous):null;
    result.transport={
      type:currentTransport?.type||(kind==='bus'?'路線バス':'鉄道'),
      from:$('sharedFrom').value.trim().slice(0,80),
      to:$('sharedTo').value.trim().slice(0,80),
      depart:t,
      arrive:$('sharedArrive').value||'',
      detail:$('sharedTransportDetail').value.trim().slice(0,240),
      status:$('sharedTravelStatus').value
    };
  }else{delete result.transport;}
  return result;
}

$('sharedKind').addEventListener('change',transitUI);
$('sharedCancel').addEventListener('click',closeForm);
$('sharedDialog').addEventListener('click',e=>{if(e.target===$('sharedDialog'))closeForm();});
document.addEventListener('click',event=>{
  const btn=event.target.closest('[data-shared-edit]');
  if(btn){event.preventDefault();openForm(btn.dataset.sharedEdit);}
});
$('sharedEditMode').addEventListener('click',()=>editModeSet(!editMode));
$('sharedAdd').addEventListener('click',()=>openForm(null));
$('sharedCopyUid').addEventListener('click',async()=>{
  if(!currentUser)return;
  try{await navigator.clipboard.writeText(currentUser.uid);help('UIDをコピーしました。Firebaseのアクセスルールに登録してね。');}
  catch{window.prompt('このUIDをコピーしてね',currentUser.uid);}
});
$('sharedForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(saving)return;
  let value;
  try{value=readForm();}
  catch(e){$('sharedError').textContent=e.message;return;}
  const old=bridge.getStop(value.id);
  if(old&&LOCKED_TRAVEL.has(old.id)&&
    (timeValue(old.t)!==value.t||Number(old.d)!==value.d||bridge.transportOf(old)?.arrive!==value.transport?.arrive)&&
    !window.confirm('予約・乗車時刻を変更します。実際の予約や時刻表には自動反映されません。続ける？'))return;
  disableSaving(true);
  $('sharedError').textContent='';
  try{
    await transact(items=>{
      const i=items.findIndex(x=>x.id===value.id);
      if(old&&i<0)throw new Error('ほかの端末で削除されています。画面を確認してね');
      if(i>=0)items[i]=value;else items.push(value);
      return items;
    });
    closeForm();
    help('保存できました。変更はもう一方の端末にも反映されます。');
  }catch(e){$('sharedError').textContent=errorMessage(e);}
  finally{disableSaving(false);}
});
$('sharedDelete').addEventListener('click',async()=>{
  if(saving)return;
  const id=$('sharedId').value;
  const old=bridge.getStop(id);
  if(!old)return;
  if(!window.confirm('「'+old.name+'」を2人の共有旅程から削除する？ この予定に紐づく端末内の写真は自動削除されません。'))return;
  disableSaving(true);
  try{
    await transact(items=>items.filter(x=>x.id!==id));
    closeForm();
    help('共有旅程から削除しました。');
  }catch(e){$('sharedError').textContent=errorMessage(e);}
  finally{disableSaving(false);}
});

async function startSharing(){
  if(!currentUser||!itineraryRef)return;
  $('sharedInit').disabled=true;
  status('初期旅程を保存中…');
  try{
    await api.runTransaction(db,async transaction=>{
      const snap=await transaction.get(itineraryRef);
      if(snap.exists())return;
      transaction.set(itineraryRef,{
        items:bridge.getDefaults(),
        schemaVersion:1,
        updatedBy:currentUser.uid,
        updatedName:currentUser.displayName||currentUser.email||'メンバー',
        updatedAt:api.serverTimestamp()
      });
    });
    help('共有旅程を作成しました。このサイトを開いている人のスマホに自動反映されます。');
  }catch(e){status('初期登録に失敗');help(errorMessage(e));}
  finally{$('sharedInit').disabled=false;}
}
$('sharedInit').addEventListener('click',startSharing);

function listen(user){
  if(snapshotUnsubscribe){snapshotUnsubscribe();snapshotUnsubscribe=null;}
  sharedReady=false;
  editModeSet(false);
  status('旅程を読み込み中…');
  snapshotUnsubscribe=api.onSnapshot(itineraryRef,snap=>{
    if(!snap.exists()){
      sharedReady=false;editModeSet(false);refreshActions();
      status('共有旅程を自動作成中…');
      help('初回アクセスのため旅程を作成しています。');
      if(!attemptedInit){attemptedInit=true;void startSharing();}
      return;
    }
    const items=snap.data().items;
    if(!bridge.apply(items)){
      sharedReady=false;editModeSet(false);refreshActions();
      status('旅程データの読み込みエラー');
      help('共有データの形式を確認してね。既存の旅程は表示したままにしています。');
      return;
    }
    sharedReady=true;refreshActions();
    if(!editMode)editModeSet(true);
    status(snap.metadata.hasPendingWrites?'変更を同期中…':'共有中・編集できます');
    help('ログイン不要。予定を追加・編集するとほかのスマホにも反映されます。公開URLを知っている人なら誰でも旅程を変更できます。写真・旅費メモは端末別保存です。');
  },error=>{
    sharedReady=false;editModeSet(false);refreshActions();
    status('共有旅程へアクセスできません');
    help(errorMessage(error));
    $('sharedPanel').open=true;
  });
}

$('sharedSignIn').addEventListener('click',async()=>{
  if(!auth||!api)return;
  status('Googleログイン中…');
  try{await api.signInWithPopup(auth,new api.GoogleAuthProvider());}
  catch(e){status('ログインできませんでした');help(errorMessage(e));$('sharedPanel').open=true;}
});
$('sharedSignOut').addEventListener('click',async()=>{
  if(auth)try{await api.signOut(auth);}catch(e){help(errorMessage(e));}
});

async function boot(){
  if(!bridge){status('サイトの読み込みに失敗');return;}
  if(!firebaseConfig||!firebaseConfig.apiKey||!firebaseConfig.projectId||!firebaseConfig.appId){
    status('Firebase未接続（閲覧のみ）');
    help('管理者がFirebase設定を完了するまで旅程の閲覧はできます。');
    return;
  }
  try{
    status('ゲスト接続を準備中…');
    const version='13.4.0';
    const base='https://www.gstatic.com/firebasejs/'+version+'/';
    const [fa,au,fs]=await Promise.all([
      import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')
    ]);
    api={...au,...fs};
    const app=fa.initializeApp(firebaseConfig);
    auth=au.getAuth(app);
    db=fs.getFirestore(app);
    itineraryRef=fs.doc(db,...TRIP_PATH);
    au.onAuthStateChanged(auth,async user=>{
      if(user?.isAnonymous){
        if(snapshotUnsubscribe){snapshotUnsubscribe();snapshotUnsubscribe=null;}
        currentUser=user;
        sharedReady=false;editModeSet(false);refreshActions();
        status('旅程を同期中…');
        listen(user);
        return;
      }
      // Do not ask the visitor to log in. Existing Google sessions are signed out
      // for this app and replaced with a persistent Firebase anonymous identity.
      if(autoSigningIn)return;
      autoSigningIn=true;
      currentUser=null;sharedReady=false;refreshActions();
      status('ログイン不要で接続中…');
      try{
        if(user)await au.signOut(auth);
        await au.signInAnonymously(auth);
      }catch(error){
        status('ゲスト接続ができません');
        help(errorMessage(error));
        $('sharedPanel').open=true;
      }finally{autoSigningIn=false;}
    },error=>{
      status('認証設定を確認してね');
      help(errorMessage(error));
    });
  }catch(e){
    status('Firebase接続エラー');
    help(errorMessage(e));
  }
}
boot();
