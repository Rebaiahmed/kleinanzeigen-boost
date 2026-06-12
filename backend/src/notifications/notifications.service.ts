import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';

/**
 * Live notification fan-out. Holds a per-user RxJS Subject so the SSE endpoint
 * can push events to the dashboard in real time (no polling). `emit` also
 * persists to Firestore so notifications survive if no stream is open.
 */
@Injectable()
export class NotificationsService {
  private streams = new Map<string, Subject<any>>();

  constructor(private readonly firebase: FirebaseService) {}

  private subject(userId: string): Subject<any> {
    let s = this.streams.get(userId);
    if (!s) { s = new Subject(); this.streams.set(userId, s); }
    return s;
  }

  /** Live stream for a user (used by the SSE controller). */
  stream(userId: string): Observable<any> {
    return this.subject(userId).asObservable();
  }

  /** Push a live event only (no persistence). */
  push(userId: string, data: any): void {
    this.subject(userId).next(data);
  }

  /** Persist to Firestore AND push live to any open stream. */
  async emit(userId: string, notif: { type: string; message: string; adId?: string; adTitle?: string }): Promise<void> {
    const doc: any = { ...notif, read: false, createdAt: new Date().toISOString() };
    try {
      const ref = await this.firebase.firestore
        .collection('users').doc(userId).collection('notifications').add(doc);
      this.push(userId, { id: ref.id, ...doc });
    } catch {
      // Even if persistence fails, deliver live.
      this.push(userId, { id: 'live-' + Date.now(), ...doc });
    }
  }
}
