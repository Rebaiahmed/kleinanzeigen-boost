import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: admin.app.App;

  onModuleInit() {
    if (!admin.apps.length) {
      this.app = admin.initializeApp({
        // For local development, setting GOOGLE_APPLICATION_CREDENTIALS env var is standard
        // Alternatively, use service account JSON string from env
        credential: process.env.FIREBASE_SERVICE_ACCOUNT 
          ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
          : admin.credential.applicationDefault()
      });
    } else {
      this.app = admin.apps[0]!;
    }
  }

  get firestore() {
    return this.app.firestore();
  }

  get auth() {
    return this.app.auth();
  }
}
