import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Persistent store — survives backend hot-reloads in dev mode
const STORE_FILE = path.resolve(process.cwd(), '.dev-store.json');
function loadStore(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch { return {}; }
}
function saveStore(store: Record<string, any>) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2)); } catch {}
}
const inMemoryStore: Record<string, any> = loadStore();

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App | null = null;
  private readonly logger = new Logger(FirebaseService.name);

  async onModuleInit() {
    try {
      // Try multiple paths — __dirname differs between ts-node watch and compiled dist
      const candidates = [
        path.resolve(__dirname, '../../firebase-credentials.json'),       // from dist/firebase
        path.resolve(__dirname, '../../../firebase-credentials.json'),    // from dist/src/firebase
        path.resolve(process.cwd(), 'firebase-credentials.json'),        // from working dir
      ];
      const credFile = candidates.find(f => fs.existsSync(f)) || candidates[0];
      if (!admin.apps.length) {
        if (!fs.existsSync(credFile)) {
          this.logger.warn('firebase-credentials.json not found. Using file-based mock.');
          this.app = null;
          return;
        }
        const credentialObj = JSON.parse(fs.readFileSync(credFile, 'utf8'));
        this.app = admin.initializeApp({
          credential: admin.credential.cert(credentialObj),
          projectId: credentialObj.project_id,
        });
      } else {
        this.app = admin.apps[0]!;
      }

      // Verify Firestore API is actually enabled by doing a test read
      await this.app!.firestore().collection('_health').doc('ping').get();
      this.logger.log('✅ Firestore connected successfully.');
    } catch (e: any) {
      if (e.code === 5 || e.message?.includes('PERMISSION_DENIED') || e.message?.includes('not been used')) {
        this.logger.warn('⚠️  Firestore API not enabled in GCP — using file-based store. Enable at: https://console.firebase.google.com/project/kleinanzeigen-app/firestore');
      } else {
        this.logger.warn(`Firebase init failed: ${e.message} — using file-based store.`);
      }
      this.app = null;
    }
  }

  get firestore() {
    if (this.app) {
      try {
        return this.app.firestore();
      } catch (e) {
        this.logger.warn('Firestore not available, falling back to mock.');
      }
    }
    
    // Minimal In-Memory Mock — supports collection.get(), .where(), .doc(), sub-collections
    const makeQueryable = (prefix: string, filterFns: ((data: any) => boolean)[] = []) => ({
      where: (field: string, op: string, value: any) => {
        const fn = (data: any) => {
          const v = data?.[field];
          if (op === '==') return v === value;
          if (op === '<=') return v <= value;
          if (op === '>=') return v >= value;
          if (op === '<')  return v < value;
          if (op === '>')  return v > value;
          return true;
        };
        return makeQueryable(prefix, [...filterFns, fn]);
      },
      get: async () => {
        const docs = Object.keys(inMemoryStore)
          .filter(k => k.startsWith(prefix))
          .map(k => {
            const data = inMemoryStore[k];
            const id = k.slice(prefix.length);
            return { id, exists: true, data: () => data };
          })
          .filter(doc => filterFns.every(fn => fn(doc.data())));
        return { docs, empty: docs.length === 0 };
      },
      doc: (docPath: string) => makeDocRef(`${prefix}${docPath}`),
    });

    const makeDocRef = (fullPath: string): any => ({
      id: fullPath.split('/').pop(),
      // Mirror Firestore's ref.parent (collection) → ref.parent.parent (owning doc).
      // Enables collectionGroup consumers to derive e.g. the userId of an ad.
      get parent() {
        const segs = fullPath.split('/');
        return {
          parent: segs.length >= 3 ? makeDocRef(segs.slice(0, -2).join('/')) : null,
        };
      },
      get: async () => ({
        exists: !!inMemoryStore[fullPath],
        id: fullPath.split('/').pop(),
        data: () => inMemoryStore[fullPath],
        ref: makeDocRef(fullPath),
      }),
      set: async (data: any, options?: any) => {
        const existing = inMemoryStore[fullPath] || {};
        inMemoryStore[fullPath] = options?.merge ? { ...existing, ...data } : data;
        saveStore(inMemoryStore);
      },
      update: async (data: any) => {
        inMemoryStore[fullPath] = { ...inMemoryStore[fullPath], ...data };
        saveStore(inMemoryStore);
      },
      delete: async () => {
        delete inMemoryStore[fullPath];
        saveStore(inMemoryStore);
      },
      collection: (subCol: string) => makeQueryable(`${fullPath}/${subCol}/`),
    });

    // collectionGroup('ads') matches every doc whose second-to-last path segment
    // equals the collection id (e.g. users/<uid>/ads/<adId>), across all parents.
    const makeGroupQueryable = (collectionId: string, filterFns: ((data: any) => boolean)[] = []): any => ({
      where: (field: string, op: string, value: any) => {
        const fn = (data: any) => {
          const v = data?.[field];
          if (op === '==') return v === value;
          if (op === '<=') return v <= value;
          if (op === '>=') return v >= value;
          if (op === '<')  return v < value;
          if (op === '>')  return v > value;
          return true;
        };
        return makeGroupQueryable(collectionId, [...filterFns, fn]);
      },
      get: async () => {
        const docs = Object.keys(inMemoryStore)
          .filter(k => {
            const segs = k.split('/');
            return segs.length >= 2 && segs[segs.length - 2] === collectionId;
          })
          .map(k => ({
            id: k.split('/').pop(),
            exists: true,
            data: () => inMemoryStore[k],
            ref: makeDocRef(k),
          }))
          .filter(doc => filterFns.every(fn => fn(doc.data())));
        return { docs, empty: docs.length === 0 };
      },
    });

    return {
      collection: (colPath: string) => makeQueryable(`${colPath}/`),
      collectionGroup: (collectionId: string) => makeGroupQueryable(collectionId),
      batch: () => {
        const ops: (() => Promise<void>)[] = [];
        return {
          set: (ref: any, data: any, options?: any) => { ops.push(() => ref.set(data, options)); },
          update: (ref: any, data: any) => { ops.push(() => ref.update(data)); },
          delete: (ref: any) => { ops.push(() => ref.delete()); },
          commit: async () => { for (const op of ops) await op(); },
        };
      },
      runTransaction: async (cb: any) => {
        const t = {
          get: async (ref: any) => ref.get(),
          update: (ref: any, data: any) => { ref.update(data); },
        };
        await cb(t);
      },
    } as any;

  }

  get auth() {
    return this.app?.auth() as any;
  }
}
