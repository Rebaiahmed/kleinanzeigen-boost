import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import * as crypto from 'crypto';

/**
 * Shared service for reading decrypted marketplace session cookies.
 * Centralises the decrypt logic so the Scheduler and any other service
 * can obtain cookies without depending on AuthService directly.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly firebaseService: FirebaseService) {
    const secret = process.env.INTERNAL_SECRET || 'dev_secret_key';
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
  }

  private decryptData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted data format');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Returns the decrypted marketplace cookies for a user, or an empty array
   * if the session doesn't exist or the cookies field is missing.
   */
  async getDecryptedCookies(userId: string): Promise<any[]> {
    try {
      const sessionDoc = await this.firebaseService.firestore
        .collection('sessions')
        .doc(userId)
        .get();

      if (!sessionDoc.exists) return [];

      const raw = sessionDoc.data()?.marketplaceCookies;
      if (!raw) return [];

      // Support both encrypted strings (new format) and legacy plain arrays
      if (typeof raw === 'string') {
        const decrypted = this.decryptData(raw);
        return JSON.parse(decrypted);
      }

      if (Array.isArray(raw)) {
        this.logger.warn(`Session for user ${userId} has unencrypted cookies — consider re-login.`);
        return raw;
      }

      return [];
    } catch (e: any) {
      this.logger.warn(`Could not decrypt cookies for user ${userId}: ${e.message}`);
      return [];
    }
  }
}
