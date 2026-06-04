import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

// In-Memory store for local development without Firebase credentials
const inMemoryStore: Record<string, any> = {};

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App | null = null;
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    try {
      const credentialStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!credentialStr) {
        this.logger.warn('No FIREBASE_SERVICE_ACCOUNT provided. Forcing In-Memory Mock database!');
        this.app = null;
        return;
      }
      
      if (!admin.apps.length) {
        let cleanCredentialStr = credentialStr.trim();
        // Unwrap quotes if present
        if (
          (cleanCredentialStr.startsWith('"') && cleanCredentialStr.endsWith('"')) ||
          (cleanCredentialStr.startsWith("'") && cleanCredentialStr.endsWith("'"))
        ) {
          cleanCredentialStr = cleanCredentialStr.slice(1, -1);
        }
        // Unescape newlines, double quotes, and backslashes
        cleanCredentialStr = cleanCredentialStr
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');

        const credentialObj = JSON.parse(cleanCredentialStr);
        this.app = admin.initializeApp({
          credential: admin.credential.cert(credentialObj),
          projectId: credentialObj.project_id || 'demo-kleinanzeigen-boost',
        });
      } else {
        this.app = admin.apps[0]!;
      }
    } catch (e: any) {
      this.logger.warn(`Firebase initialization failed: ${e.message}. Using In-Memory Mock.`);
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

    const makeDocRef = (fullPath: string) => ({
      id: fullPath.split('/').pop(),
      get: async () => ({
        exists: !!inMemoryStore[fullPath],
        id: fullPath.split('/').pop(),
        data: () => inMemoryStore[fullPath],
      }),
      set: async (data: any, options?: any) => {
        const existing = inMemoryStore[fullPath] || {};
        inMemoryStore[fullPath] = options?.merge ? { ...existing, ...data } : data;
      },
      update: async (data: any) => {
        inMemoryStore[fullPath] = { ...inMemoryStore[fullPath], ...data };
      },
      delete: async () => {
        delete inMemoryStore[fullPath];
      },
      collection: (subCol: string) => makeQueryable(`${fullPath}/${subCol}/`),
    });

    return {
      collection: (colPath: string) => makeQueryable(`${colPath}/`),
      batch: () => {
        const ops: (() => Promise<void>)[] = [];
        return {
          set: (ref: any, data: any, options?: any) => { ops.push(() => ref.set(data, options)); },
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
