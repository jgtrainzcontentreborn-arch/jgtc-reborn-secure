const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { randomUUID } = require('crypto');
initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();
const ADMIN_UID = 'wkPmVZUdYFdO0P3McTiimxtHbg03';
function rupiah(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
function requireAuth(request) { if (!request.auth) throw new HttpsError('unauthenticated', 'Silakan login terlebih dahulu.'); }
function requireAdmin(request) { requireAuth(request); if (request.auth.uid !== ADMIN_UID) throw new HttpsError('permission-denied', 'Akses hanya untuk admin utama.'); }
function cleanText(value, max=180) { return String(value || '').trim().slice(0,max); }
exports.createOrder = onCall({ region: 'asia-southeast2', enforceAppCheck: false }, async (request) => {
  requireAuth(request);
  if (request.auth.uid === ADMIN_UID) throw new HttpsError('permission-denied', 'Akun admin tidak dapat membuat pesanan pelanggan.');
  const paymentConfig = (await db.collection('settings').doc('payment').get()).data();
  if (!paymentConfig || paymentConfig.enabled !== true) throw new HttpsError('failed-precondition', 'Pembayaran manual belum diaktifkan admin.');
  const addonIds = Array.isArray(request.data?.addonIds) ? [...new Set(request.data.addonIds.map(String))] : [];
  const routeUpdateIds = Array.isArray(request.data?.routeUpdateIds) ? [...new Set(request.data.routeUpdateIds.map(String))] : [];
  if ((!addonIds.length && !routeUpdateIds.length) || addonIds.length + routeUpdateIds.length > 20) throw new HttpsError('invalid-argument', 'Pilih 1 sampai 20 produk atau update rute.');
  const items = [];
  if (addonIds.length) {
    const snaps = await db.getAll(...addonIds.map(id => db.collection('addons').doc(id)));
    snaps.forEach(snap => {
      if (!snap.exists) throw new HttpsError('not-found', 'Salah satu produk tidak lagi tersedia.');
      const a=snap.data(), paid=String(a.status||'').toLowerCase().includes('payware') || !!a.price, price=rupiah(a.price);
      if (a.isSample || !paid || price<=0) throw new HttpsError('failed-precondition', `Harga produk ${a.title||snap.id} belum valid.`);
      items.push({type:'addon',addonId:snap.id,title:cleanText(a.title||'Produk'),category:cleanText(a.category,100),price,quantity:1,routeVersion:cleanText(a.routeVersion,60),trainzVersion:cleanText(a.version,60),downloadPath:cleanText(a.downloadPath,500),url:cleanText(a.url,1000)});
    });
  }
  if (routeUpdateIds.length) {
    const updateSnaps = await db.getAll(...routeUpdateIds.map(id => db.collection('route_updates').doc(id)));
    const userId=request.auth.uid;
    const routeIds=[];
    for (const snap of updateSnaps) {
      if (!snap.exists) throw new HttpsError('not-found','Pilihan update rute tidak ditemukan.');
      const u=snap.data();
      if (u.active !== true) throw new HttpsError('failed-precondition','Pilihan update rute sudah tidak tersedia.');
      const routeAddonId=cleanText(u.routeAddonId,160);
      if (!routeAddonId || routeIds.includes(routeAddonId)) throw new HttpsError('invalid-argument','Satu pesanan hanya boleh memuat satu update untuk setiap rute.');
      if (addonIds.includes(routeAddonId)) throw new HttpsError('invalid-argument','Pisahkan pembelian rute dasar dan update rutenya ke transaksi yang berbeda.');
      routeIds.push(routeAddonId);
      const [routeSnap, ownershipSnap] = await Promise.all([
        db.collection('addons').doc(routeAddonId).get(),
        db.collection('ownerships').doc(`${userId}_${routeAddonId}`).get()
      ]);
      if (!routeSnap.exists || routeSnap.data().category !== 'Rute Indonesia') throw new HttpsError('failed-precondition','Produk rute tidak tersedia.');
      if (!ownershipSnap.exists) throw new HttpsError('failed-precondition',`Kamu harus memiliki ${routeSnap.data().title||'rute ini'} sebelum membeli update.`);
      const ownership=ownershipSnap.data(), currentVersion=cleanText(ownership.currentVersion || routeSnap.data().routeVersion,60);
      const required=cleanText(u.requiredPreviousVersion,60);
      if (required && currentVersion !== required) throw new HttpsError('failed-precondition',`Update ${u.version} memerlukan versi ${required}. Versi yang tercatat: ${currentVersion||'belum diketahui'}.`);
      const price=rupiah(u.price);
      if (price<=0) throw new HttpsError('failed-precondition','Harga update rute belum valid.');
      items.push({type:'route_update',routeUpdateId:snap.id,addonId:routeAddonId,title:`${cleanText(routeSnap.data().title)} — Update ${cleanText(u.version,60)}`,category:'Update Rute',price,quantity:1,version:cleanText(u.version,60),requiredPreviousVersion:required,downloadPath:cleanText(u.downloadPath,500),url:cleanText(u.url,1000)});
    }
  }
  const total=items.reduce((n,x)=>n+x.price,0);
  if (!Number.isSafeInteger(total)||total<=0) throw new HttpsError('failed-precondition','Total pesanan tidak valid.');
  const orderRef=db.collection('orders').doc(), orderNumber=`JGTC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${orderRef.id.slice(0,6).toUpperCase()}`;
  const userSnap=await db.collection('users').doc(request.auth.uid).get(), user=userSnap.exists?userSnap.data():{};
  await orderRef.create({orderNumber,userId:request.auth.uid,customer:{displayName:cleanText(user.displayName||request.auth.token.name),email:cleanText(request.auth.token.email,180)},items,note:cleanText(request.data?.note,500),total,currency:'IDR',paymentMethod:'manual_transfer',status:'awaiting_payment',paymentStatus:'unpaid',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),requestId:randomUUID()});
  return {orderId:orderRef.id,orderNumber,total,status:'awaiting_payment'};
});

// Pilihan update hanya dapat dikelola admin. Pelanggan hanya menerima opsi aktif
// dan status kelayakan berdasarkan kepemilikan rute mereka.
exports.getRouteUpdates = onCall({region:'asia-southeast2'}, async request => {
  requireAuth(request);
  const snap=await db.collection('route_updates').where('active','==',true).limit(200).get();
  const uid=request.auth.uid;
  const results=await Promise.all(snap.docs.map(async d=>{
    const u=d.data(), routeId=cleanText(u.routeAddonId,160);
    const [routeSnap,ownSnap]=await Promise.all([db.collection('addons').doc(routeId).get(),db.collection('ownerships').doc(`${uid}_${routeId}`).get()]);
    if(!routeSnap.exists)return null;
    const route=routeSnap.data(), own=ownSnap.exists?ownSnap.data():null;
    const currentVersion=cleanText(own?.currentVersion||route.routeVersion,60), required=cleanText(u.requiredPreviousVersion,60);
    return {id:d.id,routeAddonId:routeId,routeTitle:cleanText(route.title),routeImage:cleanText(route.image),routeVersion:currentVersion,version:cleanText(u.version,60),requiredPreviousVersion:required,description:cleanText(u.description,1000),price:rupiah(u.price),active:u.active===true,eligible:!!own&&(!required||currentVersion===required),owned:!!own};
  }));
  return {updates:results.filter(Boolean)};
});

exports.getAdminRouteUpdates = onCall({region:'asia-southeast2'}, async request => {
  requireAdmin(request);
  const snap=await db.collection('route_updates').orderBy('updatedAt','desc').limit(200).get();
  const updates=await Promise.all(snap.docs.map(async d=>{const u=d.data();const a=await db.collection('addons').doc(u.routeAddonId).get();return {id:d.id,...u,routeTitle:a.exists?cleanText(a.data().title):'Rute tidak ditemukan'};}));
  return {updates};
});

exports.saveRouteUpdate = onCall({region:'asia-southeast2'}, async request => {
  requireAdmin(request);
  const d=request.data||{}, id=cleanText(d.id,160), routeAddonId=cleanText(d.routeAddonId,160), version=cleanText(d.version,60), requiredPreviousVersion=cleanText(d.requiredPreviousVersion,60), price=rupiah(d.price);
  if(!routeAddonId||!version||!requiredPreviousVersion||version===requiredPreviousVersion||price<=0) throw new HttpsError('invalid-argument','Rute, versi baru yang berbeda, versi sebelumnya, dan harga wajib diisi.');
  const route=await db.collection('addons').doc(routeAddonId).get();
  if(!route.exists||route.data().category!=='Rute Indonesia') throw new HttpsError('failed-precondition','Pilih produk dengan kategori Rute Indonesia.');
  const url=cleanText(d.url,1000), downloadPath=cleanText(d.downloadPath,500);
  if(url&&!/^https:\/\//i.test(url)) throw new HttpsError('invalid-argument','Tautan eksternal harus menggunakan HTTPS.');
  if(downloadPath&&!downloadPath.startsWith('product-files/')) throw new HttpsError('invalid-argument','Path file harus berada di folder product-files/.');
  const ref=id?db.collection('route_updates').doc(id):db.collection('route_updates').doc();
  const payload={routeAddonId,version,requiredPreviousVersion,description:cleanText(d.description,1000),price,active:d.active!==false,downloadPath,url,updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid};
  if(!id)payload.createdAt=FieldValue.serverTimestamp();
  await ref.set(payload,{merge:true});
  await db.collection('admin_logs').add({action:'route_update_saved',routeUpdateId:ref.id,adminUid:request.auth.uid,createdAt:FieldValue.serverTimestamp()});
  return {ok:true,id:ref.id};
});

exports.deleteRouteUpdate = onCall({region:'asia-southeast2'}, async request => {
  requireAdmin(request);
  const id=cleanText(request.data?.id,160); if(!id)throw new HttpsError('invalid-argument','ID update tidak valid.');
  // Nonaktifkan, jangan menghapus dokumen agar snapshot transaksi lama tetap terlacak.
  await db.collection('route_updates').doc(id).set({active:false,updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid},{merge:true});
  await db.collection('admin_logs').add({action:'route_update_deactivated',routeUpdateId:id,adminUid:request.auth.uid,createdAt:FieldValue.serverTimestamp()});
  return {ok:true};
});

exports.getPaymentSettings = onCall({region:'asia-southeast2'}, async request => {
  requireAuth(request);
  const snap=await db.collection('settings').doc('payment').get();
  if(!snap.exists) return {enabled:false,methods:[],instructions:'Informasi pembayaran belum diatur admin.'};
  const d=snap.data(); return {enabled:d.enabled===true,methods:Array.isArray(d.methods)?d.methods:[],instructions:cleanText(d.instructions,1000),accountName:cleanText(d.accountName,120)};
});

exports.savePaymentSettings = onCall({region:'asia-southeast2'}, async request => {
  requireAdmin(request);
  const methods=Array.isArray(request.data?.methods)?request.data.methods.slice(0,8).map(m=>({type:cleanText(m.type,30),name:cleanText(m.name,80),accountNumber:cleanText(m.accountNumber,80),accountName:cleanText(m.accountName,120)})).filter(m=>m.name&&m.accountNumber):[];
  if(request.data?.enabled===true&&!methods.length) throw new HttpsError('invalid-argument','Tambahkan minimal satu rekening atau e-wallet.');
  await db.collection('settings').doc('payment').set({enabled:request.data?.enabled===true,methods,instructions:cleanText(request.data?.instructions,1000),accountName:cleanText(request.data?.accountName,120),updatedAt:FieldValue.serverTimestamp(),updatedBy:request.auth.uid},{merge:true});
  await db.collection('admin_logs').add({action:'payment_settings_updated',adminUid:request.auth.uid,createdAt:FieldValue.serverTimestamp()});
  return {ok:true};
});

exports.submitPaymentProof = onCall({region:'asia-southeast2'}, async request => {
  requireAuth(request);
  const uid=request.auth.uid, orderId=cleanText(request.data?.orderId,120), path=cleanText(request.data?.storagePath,500);
  if(!orderId||!path.startsWith(`payment-proofs/${uid}/${orderId}/`)) throw new HttpsError('invalid-argument','Lokasi bukti pembayaran tidak valid.');
  const orderRef=db.collection('orders').doc(orderId), orderSnap=await orderRef.get();
  if(!orderSnap.exists||orderSnap.data().userId!==uid) throw new HttpsError('not-found','Pesanan tidak ditemukan.');
  const order=orderSnap.data(); if(order.status!=='awaiting_payment') throw new HttpsError('failed-precondition','Pesanan tidak sedang menunggu pembayaran.');
  const settings=(await db.collection('settings').doc('payment').get()).data();
  if(!settings||settings.enabled!==true) throw new HttpsError('failed-precondition','Pembayaran manual belum diaktifkan admin.');
  const file=bucket.file(path); let metadata;
  try { [metadata]=await file.getMetadata(); } catch { throw new HttpsError('not-found','File bukti pembayaran tidak ditemukan.'); }
  const type=metadata.contentType||'', size=Number(metadata.size||0), owner=metadata.metadata?.ownerUid;
  if(owner!==uid||!['image/jpeg','image/png','application/pdf'].includes(type)||size>5*1024*1024) throw new HttpsError('invalid-argument','File bukti pembayaran tidak valid.');
  const paymentRef=db.collection('payments').doc(orderId);
  await db.runTransaction(async tx=>{
    const fresh=await tx.get(orderRef); if(!fresh.exists||fresh.data().userId!==uid||fresh.data().status!=='awaiting_payment') throw new HttpsError('aborted','Status pesanan sudah berubah.');
    tx.set(paymentRef,{orderId,orderNumber:order.orderNumber,userId:uid,storagePath:path,contentType:type,size,amount:order.total,status:'pending_verification',submittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.update(orderRef,{status:'awaiting_verification',paymentStatus:'pending_verification',updatedAt:FieldValue.serverTimestamp()});
  });
  return {ok:true,status:'pending_verification'};
});

exports.getPendingPayments = onCall({region:'asia-southeast2'}, async request => {
  requireAdmin(request);
  const snap=await db.collection('payments').where('status','==','pending_verification').limit(100).get();
  const payments=await Promise.all(snap.docs.map(async d=>{const p=d.data();let proofUrl='';try{[proofUrl]=await bucket.file(p.storagePath).getSignedUrl({action:'read',expires:Date.now()+15*60*1000});}catch{}return {id:d.id,...p,proofUrl};}));
  return {payments};
});

exports.reviewPayment = onCall({region:'asia-southeast2'}, async request => {
  requireAdmin(request);
  const orderId=cleanText(request.data?.orderId,120), decision=request.data?.decision, note=cleanText(request.data?.note,500);
  if(!orderId||!['approve','reject'].includes(decision)) throw new HttpsError('invalid-argument','Keputusan pembayaran tidak valid.');
  const orderRef=db.collection('orders').doc(orderId), paymentRef=db.collection('payments').doc(orderId);
  await db.runTransaction(async tx=>{
    const [o,p]=await Promise.all([tx.get(orderRef),tx.get(paymentRef)]);
    if(!o.exists||!p.exists||p.data().status!=='pending_verification') throw new HttpsError('failed-precondition','Pembayaran tidak ditemukan atau sudah diproses.');
    const order=o.data();
    let ownershipReads=[], addonReads=[], routeBaseReads=[];
    if(decision==='approve'){
      const updateItems=(order.items||[]).filter(i=>i.type==='route_update');
      const refs=updateItems.map(i=>db.collection('ownerships').doc(`${order.userId}_${i.addonId}`));
      const addonItems=(order.items||[]).filter(i=>i.type!=='route_update');
      const addonRefs=addonItems.map(i=>db.collection('addons').doc(i.addonId));
      ownershipReads=refs.length?await tx.getAll(...refs):[];
      addonReads=addonRefs.length?await tx.getAll(...addonRefs):[];
      const routeBaseRefs=updateItems.map(i=>db.collection('addons').doc(i.addonId));
      routeBaseReads=routeBaseRefs.length?await tx.getAll(...routeBaseRefs):[];
      updateItems.forEach((item,index)=>{
        const own=ownershipReads[index];
        if(!own.exists) throw new HttpsError('failed-precondition','Kepemilikan rute berubah sebelum pembayaran disetujui.');
        const current=cleanText(own.data().currentVersion||(routeBaseReads[index]?.exists?routeBaseReads[index].data().routeVersion:''),60);
        if(item.requiredPreviousVersion&&current!==item.requiredPreviousVersion) throw new HttpsError('failed-precondition',`Versi rute sudah berubah. Versi sekarang ${current||'tidak diketahui'}.`);
      });
      tx.update(orderRef,{status:'paid',paymentStatus:'paid',paidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      let updateIndex=0, addonIndex=0;
      for(const item of order.items||[]){
        if(item.type==='route_update'){
          const own=ownershipReads[updateIndex++];
          tx.set(own.ref,{currentVersion:item.version,lastUpdateOrderId:orderId,lastUpdatedAt:FieldValue.serverTimestamp(),updateHistory:FieldValue.arrayUnion({orderId,orderNumber:order.orderNumber,version:item.version,routeUpdateId:item.routeUpdateId,updatedAt:new Date().toISOString()})},{merge:true});
        } else {
          const addonSnap=addonReads[addonIndex++];
          const initialVersion=cleanText(item.routeVersion||(addonSnap?.exists?addonSnap.data().routeVersion:''),60);
          tx.set(db.collection('ownerships').doc(`${order.userId}_${item.addonId}`),{userId:order.userId,addonId:item.addonId,orderId,orderNumber:order.orderNumber,acquiredAt:FieldValue.serverTimestamp(),currentVersion:initialVersion,source:'purchase'});
        }
      }
      tx.update(paymentRef,{status:'approved',reviewNote:note,reviewedBy:request.auth.uid,reviewedAt:FieldValue.serverTimestamp()});
    } else {
      tx.update(orderRef,{status:'awaiting_payment',paymentStatus:'rejected',paymentReviewNote:note,updatedAt:FieldValue.serverTimestamp()});
      tx.update(paymentRef,{status:'rejected',reviewNote:note,reviewedBy:request.auth.uid,reviewedAt:FieldValue.serverTimestamp()});
    }
    tx.set(db.collection('notifications').doc(),{userId:order.userId,type:decision==='approve'?'payment_approved':'payment_rejected',orderId,orderNumber:order.orderNumber,createdAt:FieldValue.serverTimestamp(),read:false});
    tx.set(db.collection('admin_logs').doc(),{action:`payment_${decision}`,orderId,adminUid:request.auth.uid,createdAt:FieldValue.serverTimestamp()});
  });
  return {ok:true,status:decision==='approve'?'paid':'awaiting_payment'};
});

exports.getOrderDownloads = onCall({region:'asia-southeast2'}, async request => {
  requireAuth(request);
  const orderId=cleanText(request.data?.orderId,120), snap=await db.collection('orders').doc(orderId).get();
  if(!snap.exists||snap.data().userId!==request.auth.uid) throw new HttpsError('not-found','Pesanan tidak ditemukan.');
  const order=snap.data(); if(order.paymentStatus!=='paid'&&order.status!=='paid') throw new HttpsError('failed-precondition','Akses download tersedia setelah pembayaran disetujui.');
  const downloads=[];
  for(const item of order.items||[]){
    let downloadPath=cleanText(item.downloadPath,500), externalUrl=cleanText(item.url,1000), title=cleanText(item.title);
    if(item.type==='route_update'&&item.routeUpdateId){
      const updateSnap=await db.collection('route_updates').doc(item.routeUpdateId).get();
      if(updateSnap.exists){const u=updateSnap.data();downloadPath=downloadPath||cleanText(u.downloadPath,500);externalUrl=externalUrl||cleanText(u.url,1000);}
    } else if(!downloadPath&&!externalUrl){
      const aSnap=await db.collection('addons').doc(item.addonId).get();if(aSnap.exists){const a=aSnap.data();downloadPath=cleanText(a.downloadPath,500);externalUrl=cleanText(a.url,1000);}
    }
    let url='';
    if(downloadPath){try{[url]=await bucket.file(downloadPath).getSignedUrl({action:'read',expires:Date.now()+10*60*1000});}catch{}}
    if(!url&&/^https:\/\//i.test(externalUrl))url=externalUrl;
    if(url)downloads.push({title,url,kind:downloadPath?'private':'external'});
  }
  return {downloads};
});

// Tahap 6: ringkasan dashboard pelanggan, notifikasi, dan statistik admin.
exports.getCustomerDashboard = onCall({ region: 'asia-southeast2' }, async request => {
  requireAuth(request);
  if (request.auth.uid === ADMIN_UID) throw new HttpsError('permission-denied', 'Dashboard pelanggan tidak tersedia untuk akun admin.');
  const uid = request.auth.uid;
  const [ordersSnap, ownershipSnap, notificationsSnap] = await Promise.all([
    db.collection('orders').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(10).get(),
    db.collection('ownerships').where('userId', '==', uid).limit(100).get(),
    db.collection('notifications').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(30).get()
  ]);
  const orders = ordersSnap.docs.map(d => { const x=d.data(); return {id:d.id,orderNumber:x.orderNumber||d.id,total:x.total||0,status:x.status||'unknown',paymentStatus:x.paymentStatus||'',createdAt:x.createdAt?.toDate?.()?.toISOString?.()||null,items:(x.items||[]).map(i=>({title:i.title||'Produk',type:i.type||'addon'}))}; });
  const ownershipRows=ownershipSnap.docs.map(d=>({id:d.id,...d.data()}));
  const addonIds=[...new Set(ownershipRows.map(x=>cleanText(x.addonId,150)).filter(Boolean))];
  const addonSnaps=addonIds.length?await db.getAll(...addonIds.map(id=>db.collection('addons').doc(id))):[];
  const addonTitles=new Map(addonSnaps.filter(x=>x.exists).map(x=>[x.id,cleanText(x.data().title,120)]));
  const ownerships=ownershipRows.map(x=>({id:x.id,addonId:x.addonId||'',title:addonTitles.get(x.addonId)||'Produk dimiliki',currentVersion:x.currentVersion||''}));
  const notifications = notificationsSnap.docs.map(d => { const x=d.data(); return {id:d.id,type:x.type||'info',title:x.title||notificationTitle(x.type),message:x.message||notificationMessage(x.type,x.orderNumber),orderNumber:x.orderNumber||'',read:x.read===true,createdAt:x.createdAt?.toDate?.()?.toISOString?.()||null}; });
  return {orders,ownerships,notifications,unreadCount:notifications.filter(n=>!n.read).length};
});
function notificationTitle(type) { return ({payment_approved:'Pembayaran disetujui',payment_rejected:'Pembayaran perlu diperbaiki',route_update:'Update rute tersedia'})[type]||'Notifikasi JGTC REBORN'; }
function notificationMessage(type,number) { return type==='payment_approved'?`Pembayaran pesanan ${number||''} telah disetujui.`:type==='payment_rejected'?`Pembayaran pesanan ${number||''} ditolak. Silakan periksa catatan admin pada riwayat pesanan.`:'Ada informasi baru untuk akun kamu.'; }
exports.markNotificationsRead = onCall({ region: 'asia-southeast2' }, async request => {
  requireAuth(request);
  const ids=Array.isArray(request.data?.ids)?[...new Set(request.data.ids.map(x=>cleanText(x,150)))].filter(Boolean).slice(0,30):[];
  if(!ids.length) return {ok:true,updated:0};
  const refs=ids.map(id=>db.collection('notifications').doc(id));
  await db.runTransaction(async tx=>{ const snaps=await tx.getAll(...refs); snaps.forEach(s=>{if(s.exists&&s.data().userId===request.auth.uid)tx.update(s.ref,{read:true,readAt:FieldValue.serverTimestamp()});}); });
  return {ok:true,updated:ids.length};
});
exports.getAdminSalesSummary = onCall({ region: 'asia-southeast2' }, async request => {
  requireAdmin(request);
  const snap=await db.collection('orders').orderBy('createdAt','desc').limit(500).get();
  const rows=snap.docs.map(d=>d.data());
  const paid=rows.filter(x=>x.status==='paid'||x.paymentStatus==='paid');
  const pending=rows.filter(x=>['awaiting_payment','awaiting_verification'].includes(x.status));
  const revenue=paid.reduce((n,x)=>n+(Number(x.total)||0),0);
  const counts={};
  paid.forEach(x=>{const day=x.createdAt?.toDate?.()?.toISOString?.().slice(0,10)||'Tidak diketahui';counts[day]=(counts[day]||0)+(Number(x.total)||0);});
  return {sampledOrders:rows.length,paidOrders:paid.length,pendingOrders:pending.length,revenue,averageOrder:paid.length?Math.round(revenue/paid.length):0,dailyRevenue:Object.entries(counts).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14).map(([date,total])=>({date,total}))};
});
