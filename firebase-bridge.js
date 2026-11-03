/* Firebase compat bridge untuk JGTC REBORN. */
(function () {
  const config = window.JGTC_FIREBASE_CONFIG || {};
  const valid = config.apiKey && !config.apiKey.startsWith('ISI_') &&
    config.projectId && !config.projectId.startsWith('ISI_') &&
    config.appId && !config.appId.startsWith('ISI_');
  const adminUid = window.JGTC_ADMIN_UID || '';
  let auth = null, db = null, functions = null, storage = null, unsubscribeCatalog = null;
  const api = {
    enabled: false,
    configured: !!valid,
    user: null,
    isAdmin: false,
    get currentUser() { return auth ? auth.currentUser : null; },
    onAuth(callback) {
      if (!api.enabled) { callback(null); return; }
      auth.onAuthStateChanged(user => {
        api.user = user;
        api.isAdmin = !!(user && adminUid && user.uid === adminUid);
        callback(user);
      });
    },
    async login(email, password) {
      if (!api.enabled) throw new Error('Firebase belum dikonfigurasi. Isi firebase-config.js terlebih dahulu.');
      const result = await auth.signInWithEmailAndPassword(email, password);
      if (!adminUid || result.user.uid !== adminUid) {
        await auth.signOut();
        throw new Error('Akun berhasil dikenali, tetapi UID ini belum terdaftar sebagai admin JGTC.');
      }
      return result.user;
    },
    async register(email, password, displayName) {
      if (!api.enabled) throw new Error('Firebase belum dikonfigurasi.');
      const result = await auth.createUserWithEmailAndPassword(email, password);
      if (displayName) await result.user.updateProfile({ displayName });
      await api.ensureProfile(result.user);
      return result.user;
    },
    async loginCustomer(email, password) {
      if (!api.enabled) throw new Error('Firebase belum dikonfigurasi.');
      const result = await auth.signInWithEmailAndPassword(email, password);
      if (result.user.uid === adminUid) return result.user;
      await api.ensureProfile(result.user);
      return result.user;
    },
    async loginGoogle() {
      if (!api.enabled) throw new Error('Firebase belum dikonfigurasi.');
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await auth.signInWithPopup(provider);
      if (result.user.uid !== adminUid) await api.ensureProfile(result.user);
      return result.user;
    },
    async ensureProfile(user) {
      if (!user || user.uid === adminUid) return;
      const ref = db.collection('users').doc(user.uid);
      const snap = await ref.get();
      const profile = {
        uid: user.uid,
        displayName: user.displayName || '',
        email: user.email || '',
        phone: (snap.exists && snap.data().phone) || '',
        photoURL: user.photoURL || '',
        role: 'customer',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!snap.exists) profile.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await ref.set(profile, { merge: true });
    },
    async createOrder(addonIds, note = '', routeUpdateIds = []) {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      if (!functions) throw new Error('Firebase Functions belum tersedia. Deploy backend functions terlebih dahulu.');
      const call = functions.httpsCallable('createOrder');
      const result = await call({ addonIds, routeUpdateIds, note: String(note || '').slice(0, 500) });
      return result.data;
    },
    async getCustomerDashboard() {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      return (await functions.httpsCallable('getCustomerDashboard')({})).data;
    },
    async markNotificationsRead(ids) {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      return (await functions.httpsCallable('markNotificationsRead')({ ids })).data;
    },
    async getAdminSalesSummary() {
      if (!api.isAdmin) throw new Error('Akses admin diperlukan.');
      return (await functions.httpsCallable('getAdminSalesSummary')({})).data;
    },
    async getMyOrders() {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      const snap = await db.collection('orders').where('userId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').limit(50).get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    async getRouteUpdates() {
      // Daftar update rute bersifat publik. Kelayakan kepemilikan tetap dihitung server.
      return (await functions.httpsCallable('getRouteUpdates')({})).data.updates || [];
    },
    async getAdminRouteUpdates() {
      if (!api.isAdmin) throw new Error('Akses admin diperlukan.');
      return (await functions.httpsCallable('getAdminRouteUpdates')({})).data.updates || [];
    },
    async saveRouteUpdate(update) {
      if (!api.isAdmin) throw new Error('Hanya admin utama yang dapat mengatur update rute.');
      return (await functions.httpsCallable('saveRouteUpdate')(update)).data;
    },
    async deleteRouteUpdate(id) {
      if (!api.isAdmin) throw new Error('Hanya admin utama yang dapat mengatur update rute.');
      return (await functions.httpsCallable('deleteRouteUpdate')({ id })).data;
    },
    async getPaymentSettings() {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      return (await functions.httpsCallable('getPaymentSettings')({})).data;
    },
    async savePaymentSettings(settings) {
      if (!api.isAdmin) throw new Error('Hanya admin utama yang dapat mengatur pembayaran.');
      return (await functions.httpsCallable('savePaymentSettings')(settings)).data;
    },
    async uploadPaymentProof(orderId, file) {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      if (!storage) throw new Error('Firebase Storage belum tersedia.');
      if (!file || file.size > 5 * 1024 * 1024) throw new Error('Ukuran bukti maksimal 5 MB.');
      if (!['image/jpeg','image/png','application/pdf'].includes(file.type)) throw new Error('Format bukti harus JPG, PNG, atau PDF.');
      const path = `payment-proofs/${auth.currentUser.uid}/${orderId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const ref = storage.ref().child(path);
      await ref.put(file, { contentType: file.type, customMetadata: { ownerUid: auth.currentUser.uid, orderId } });
      await functions.httpsCallable('submitPaymentProof')({ orderId, storagePath: path });
      return true;
    },
    async getPendingPayments() {
      if (!api.isAdmin) throw new Error('Akses admin diperlukan.');
      return (await functions.httpsCallable('getPendingPayments')({})).data.payments || [];
    },
    async reviewPayment(orderId, decision, note = '') {
      if (!api.isAdmin) throw new Error('Akses admin diperlukan.');
      return (await functions.httpsCallable('reviewPayment')({ orderId, decision, note })).data;
    },
    async getOrderDownloads(orderId) {
      if (!auth || !auth.currentUser) throw new Error('Silakan login terlebih dahulu.');
      return (await functions.httpsCallable('getOrderDownloads')({ orderId })).data.downloads || [];
    },
    async logout() { if (auth) await auth.signOut(); },
    subscribeCatalog(onData, onError) {
      if (!api.enabled) return null;
      if (unsubscribeCatalog) unsubscribeCatalog();
      unsubscribeCatalog = db.collection('addons').onSnapshot(snapshot => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        items.sort((a,b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
        onData(items);
      }, onError);
      return unsubscribeCatalog;
    },
    async save(item) {
      if (!api.isAdmin) throw new Error('Hanya admin terdaftar yang boleh mengubah katalog.');
      const data = { ...item, updatedAt: new Date().toISOString() };
      const id = String(data.id || ('addon-' + Date.now()));
      delete data.id;
      await db.collection('addons').doc(id).set(data, { merge: true });
      return id;
    },
    async remove(id) {
      if (!api.isAdmin) throw new Error('Hanya admin terdaftar yang boleh menghapus katalog.');
      await db.collection('addons').doc(String(id)).delete();
    },
    async replaceAll(items) {
      if (!api.isAdmin) throw new Error('Hanya admin terdaftar yang boleh mengimpor katalog.');
      if (!Array.isArray(items) || items.length > 5000) throw new Error('Impor harus berupa array maksimal 5.000 item.');
      // Firestore membatasi 500 operasi per batch; gunakan chunk konservatif.
      for (let offset = 0; offset < items.length; offset += 450) {
        const batch = db.batch();
        items.slice(offset, offset + 450).forEach((item, index) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Format item katalog tidak valid.');
          const id = String(item.id || ('import-' + Date.now() + '-' + (offset + index))).slice(0, 150);
          const ref = db.collection('addons').doc(id);
          const data = { ...item, updatedAt: new Date().toISOString() };
          delete data.id;
          batch.set(ref, data);
        });
        await batch.commit();
      }
    }
  };
  try {
    if (valid && window.firebase) {
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
      auth = app.auth();
      db = app.firestore();
      functions = app.functions('asia-southeast2');
      storage = app.storage();
      api.enabled = true;
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    api.initError = error;
  }
  window.JGTCFirebase = api;
})();
