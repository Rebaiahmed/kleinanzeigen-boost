import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { encrypt, decrypt } from '../credentials/encryption';
import axios from 'axios';

@Injectable()
export class VintedService {
  private readonly workerUrl = process.env.AUTOMATION_WORKER_URL || 'http://localhost:3001';
  private readonly internalSecret = process.env.INTERNAL_SECRET || 'dev_secret_key';

  constructor(private readonly firebaseService: FirebaseService) {}

  private async callWorker(endpoint: string, payload: any): Promise<any> {
    try {
      const response = await axios.post(`${this.workerUrl}/${endpoint}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        timeout: 120000, // Playwright automation can take up to 2 minutes
      });
      return response.data;
    } catch (error: any) {
      const errorData = error.response?.data;
      const status = error.response?.status;
      if (errorData && errorData.error) {
        throw new HttpException(errorData.error, status || HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        error.message || 'Verbindung zum Automation-Worker fehlgeschlagen.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private translateError(err: string): string {
    if (!err) return 'Unbekannter Vinted-Fehler.';
    if (err === 'sessionExpired') {
      return 'Vinted-Sitzung abgelaufen. Bitte verbinde dein Vinted-Konto erneut in den Einstellungen.';
    }
    if (err === 'categoryNotSupported') {
      return 'Vinted unterstützt diese Kategorie nicht (z.B. Fahrzeuge, Immobilien, Jobs, Dienstleistungen, Tickets).';
    }
    const lower = err.toLowerCase();
    if (
      lower.includes('credential') ||
      lower.includes('anmeldedaten') ||
      lower.includes('passwort') ||
      lower.includes('password') ||
      lower.includes('username') ||
      lower.includes('e-mail')
    ) {
      return 'Ungültige Vinted-Anmeldedaten. Bitte überprüfe deine E-Mail und dein Passwort.';
    }
    return `Vinted-Fehler: ${err}`;
  }

  async connectVinted(userId: string, email: string, password: string) {
    try {
      const result = await this.callWorker('automate/vinted-login', { email, password });
      if (!result.success) {
        throw new HttpException(result.error || 'Fehler bei der Vinted-Anmeldung.', HttpStatus.BAD_REQUEST);
      }

      // Encrypt cookies
      const cookiesStr = JSON.stringify(result.cookies);
      const encryptedCookies = encrypt(cookiesStr);

      const db = this.firebaseService.firestore;
      await db.collection('credentials').doc(userId).set({
        vintedSession: {
          ciphertext: encryptedCookies.ciphertext,
          iv: encryptedCookies.iv,
          authTag: encryptedCookies.authTag,
        },
        vintedUsername: result.username,
        vintedLastVerifiedAt: new Date().toISOString(),
      }, { merge: true });

      return { success: true, username: result.username };
    } catch (error: any) {
      let status = HttpStatus.BAD_REQUEST;
      let errMsg = error.message;

      if (error instanceof HttpException) {
        status = error.getStatus();
        errMsg = error.getResponse() as string;
      }

      throw new HttpException(this.translateError(errMsg), status);
    }
  }

  async getStatus(userId: string) {
    const db = this.firebaseService.firestore;
    const credDoc = await db.collection('credentials').doc(userId).get();
    if (!credDoc.exists) {
      return { connected: false };
    }
    const data = credDoc.data()!;
    if (!data.vintedSession) {
      return { connected: false };
    }
    return {
      connected: true,
      username: data.vintedUsername || 'Vinted-Verkäufer',
      lastVerifiedAt: data.vintedLastVerifiedAt,
    };
  }

  async disconnect(userId: string) {
    const db = this.firebaseService.firestore;
    const credRef = db.collection('credentials').doc(userId);
    const doc = await credRef.get();
    if (doc.exists) {
      await credRef.update({
        vintedSession: null,
        vintedUsername: null,
        vintedLastVerifiedAt: null,
      });
    }
    return { success: true };
  }

  async crossPostAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adDoc = await db.collection('users').doc(userId).collection('ads').doc(adId).get();
    if (!adDoc.exists) {
      throw new HttpException('Anzeige nicht gefunden.', HttpStatus.NOT_FOUND);
    }
    const ad = adDoc.data()!;

    // Proactive check of unsupported categories
    const unsupportedCategories = [
      'Auto, Rad & Boot',
      'Immobilien',
      'Jobs',
      'Dienstleistungen',
      'Nachbarschaft',
      'Eintrittskarten & Tickets',
    ];
    if (unsupportedCategories.includes(ad.category)) {
      throw new HttpException(
        'Vinted unterstützt diese Kategorie nicht (z.B. Fahrzeuge, Immobilien, Jobs, Dienstleistungen, Tickets).',
        HttpStatus.BAD_REQUEST
      );
    }

    const credDoc = await db.collection('credentials').doc(userId).get();
    if (!credDoc.exists) {
      throw new HttpException(
        'Vinted-Konto ist nicht verbunden. Bitte verbinde es in den Einstellungen.',
        HttpStatus.UNAUTHORIZED
      );
    }
    const data = credDoc.data()!;
    if (!data.vintedSession) {
      throw new HttpException(
        'Vinted-Konto ist nicht verbunden. Bitte verbinde es in den Einstellungen.',
        HttpStatus.UNAUTHORIZED
      );
    }

    // Decrypt cookies
    let cookies: any[];
    try {
      const decrypted = decrypt(
        data.vintedSession.ciphertext,
        data.vintedSession.iv,
        data.vintedSession.authTag
      );
      cookies = JSON.parse(decrypted);
    } catch (err) {
      throw new HttpException(
        'Vinted-Verbindungsdaten konnten nicht entschlüsselt werden. Bitte verbinde dich erneut.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // Prepare adData
    const adData = {
      title: ad.title,
      description: ad.description,
      category: ad.category,
      condition: ad.condition,
      price: ad.price,
      images: ad.images || (ad.image ? [ad.image] : []),
    };

    try {
      const result = await this.callWorker('automate/vinted-post', { adData, cookies });
      if (!result.success) {
        if (result.error === 'sessionExpired') {
          await this.disconnect(userId);
          throw new HttpException('sessionExpired', HttpStatus.UNAUTHORIZED);
        }
        if (result.error === 'categoryNotSupported') {
          throw new HttpException('categoryNotSupported', HttpStatus.BAD_REQUEST);
        }
        throw new HttpException(result.error || 'Fehler beim Posten auf Vinted.', HttpStatus.BAD_REQUEST);
      }

      // Update ad document on success
      await db.collection('users').doc(userId).collection('ads').doc(adId).update({
        vintedId: result.vintedId,
        vintedUrl: result.vintedUrl,
        vintedLastPostedAt: new Date().toISOString(),
      });

      return {
        success: true,
        vintedId: result.vintedId,
        url: result.vintedUrl,
      };
    } catch (error: any) {
      let status = HttpStatus.BAD_REQUEST;
      let errMsg = error.message;

      if (error instanceof HttpException) {
        status = error.getStatus();
        errMsg = error.getResponse() as string;
      } else if (error.response?.data?.error) {
        errMsg = error.response.data.error;
        status = error.response.status || HttpStatus.BAD_REQUEST;
      }

      if (errMsg === 'sessionExpired') {
        await this.disconnect(userId);
      }

      throw new HttpException(this.translateError(errMsg), status);
    }
  }
}
