import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { encrypt, decrypt } from '../credentials/encryption';
import axios from 'axios';

@Injectable()
export class EbayService {
  constructor(private readonly firebaseService: FirebaseService) {}

  getAuthUrl(userId: string): string {
    const clientId = process.env.EBAY_CLIENT_ID;
    const redirectUri = process.env.EBAY_REDIRECT_URI;
    const scopes = 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory';
    
    if (!clientId || !redirectUri) {
      throw new HttpException(
        'eBay Client ID oder Redirect URI nicht in backend/.env konfiguriert.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return `https://auth.ebay.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${userId}`;
  }

  async handleCallback(code: string, state: string) {
    const userId = state;
    if (!userId) {
      throw new HttpException('OAuth-State (userId) fehlt.', HttpStatus.BAD_REQUEST);
    }

    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;
    const redirectUri = process.env.EBAY_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new HttpException(
        'eBay-Anmeldedaten unvollständig konfiguriert.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      // 1. Exchange auth code for tokens
      const tokenResponse = await axios.post(
        'https://api.ebay.com/identity/v1/oauth2/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
        }
      );

      const accessToken = tokenResponse.data.access_token;
      const refreshToken = tokenResponse.data.refresh_token;
      const expiresAt = Date.now() + tokenResponse.data.expires_in * 1000;

      // 2. Fetch eBay User Details to get username
      let ebayUsername = 'eBay-Verkäufer';
      try {
        const userResponse = await axios.get('https://api.ebay.com/commerce/identity/v1/user/', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (userResponse.data?.username) {
          ebayUsername = userResponse.data.username;
        }
      } catch (err) {
        console.warn('Could not fetch eBay username, fallback to placeholder:', err.message);
      }

      // 3. Encrypt and save to credentials collection in Firestore
      const encryptedAccess = encrypt(accessToken);
      const encryptedRefresh = encrypt(refreshToken);

      const db = this.firebaseService.firestore;
      await db.collection('credentials').doc(userId).set({
        ebayAccessToken: {
          ciphertext: encryptedAccess.ciphertext,
          iv: encryptedAccess.iv,
          authTag: encryptedAccess.authTag,
        },
        ebayRefreshToken: {
          ciphertext: encryptedRefresh.ciphertext,
          iv: encryptedRefresh.iv,
          authTag: encryptedRefresh.authTag,
        },
        ebayTokenExpiresAt: expiresAt,
        ebayUserId: ebayUsername,
      }, { merge: true });

    } catch (error: any) {
      console.error('eBay token exchange failed:', error.response?.data || error.message);
      throw new HttpException(
        `eBay-Verbindung fehlgeschlagen: ${error.response?.data?.error_description || error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getStatus(userId: string) {
    const db = this.firebaseService.firestore;
    const credDoc = await db.collection('credentials').doc(userId).get();
    if (!credDoc.exists) {
      return { connected: false };
    }
    const data = credDoc.data()!;
    if (!data.ebayAccessToken || !data.ebayRefreshToken) {
      return { connected: false };
    }
    return {
      connected: true,
      username: data.ebayUserId || 'eBay-Verkäufer',
    };
  }

  async disconnect(userId: string) {
    const db = this.firebaseService.firestore;
    const credRef = db.collection('credentials').doc(userId);
    const doc = await credRef.get();
    if (doc.exists) {
      await credRef.update({
        ebayAccessToken: null,
        ebayRefreshToken: null,
        ebayTokenExpiresAt: null,
        ebayUserId: null,
      });
    }
    return { success: true };
  }

  async getOrRefreshAccessToken(userId: string): Promise<string> {
    const db = this.firebaseService.firestore;
    const credRef = db.collection('credentials').doc(userId);
    const doc = await credRef.get();
    if (!doc.exists) {
      throw new HttpException('eBay-Konto ist nicht verbunden. Bitte verbinde es in den Einstellungen.', HttpStatus.UNAUTHORIZED);
    }
    const data = doc.data()!;
    if (!data.ebayAccessToken || !data.ebayRefreshToken) {
      throw new HttpException('eBay-Konto ist nicht verbunden. Bitte verbinde es in den Einstellungen.', HttpStatus.UNAUTHORIZED);
    }

    const expiresAt = data.ebayTokenExpiresAt || 0;
    // Check if expires in less than 5 minutes (300 seconds)
    if (Date.now() + 5 * 60 * 1000 < expiresAt) {
      return decrypt(data.ebayAccessToken.ciphertext, data.ebayAccessToken.iv, data.ebayAccessToken.authTag);
    }

    // Refresh token exchange
    const refreshToken = decrypt(data.ebayRefreshToken.ciphertext, data.ebayRefreshToken.iv, data.ebayRefreshToken.authTag);
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new HttpException('eBay-Anmeldedaten nicht konfiguriert.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        'https://api.ebay.com/identity/v1/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
        }
      );

      const newAccessToken = response.data.access_token;
      const newExpiresAt = Date.now() + response.data.expires_in * 1000;

      const encryptedAccess = encrypt(newAccessToken);
      const updatePayload: any = {
        ebayAccessToken: {
          ciphertext: encryptedAccess.ciphertext,
          iv: encryptedAccess.iv,
          authTag: encryptedAccess.authTag,
        },
        ebayTokenExpiresAt: newExpiresAt,
      };

      if (response.data.refresh_token) {
        const encryptedRefresh = encrypt(response.data.refresh_token);
        updatePayload.ebayRefreshToken = {
          ciphertext: encryptedRefresh.ciphertext,
          iv: encryptedRefresh.iv,
          authTag: encryptedRefresh.authTag,
        };
      }

      await credRef.update(updatePayload);
      return newAccessToken;
    } catch (error: any) {
      console.error('Failed to refresh eBay token:', error.response?.data || error.message);
      throw new HttpException('eBay-Sitzung abgelaufen. Bitte verbinde dich erneut.', HttpStatus.UNAUTHORIZED);
    }
  }

  async crossPostAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    
    // 1. Fetch ad details
    const adDoc = await db.collection('users').doc(userId).collection('ads').doc(adId).get();
    if (!adDoc.exists) {
      throw new HttpException('Anzeige nicht gefunden.', HttpStatus.NOT_FOUND);
    }
    const ad = adDoc.data()!;

    // 2. Fetch authenticated eBay Token
    const accessToken = await this.getOrRefreshAccessToken(userId);

    // 3. Prepare properties for listing
    const sku = ad.id || adId;

    // Condition mapping
    const conditionMap: Record<string, string> = {
      'Neu': 'NEW',
      'Wie neu': 'LIKE_NEW',
      'Gut': 'VERY_GOOD',
      'In Ordnung': 'GOOD',
      'Defekt': 'FOR_PARTS_OR_NOT_WORKING'
    };
    const conditionEnum = conditionMap[ad.condition] || 'VERY_GOOD';

    // Image list formatting
    let imageUrls: string[] = [];
    if (Array.isArray(ad.images) && ad.images.length > 0) {
      imageUrls = ad.images;
    } else if (ad.image) {
      imageUrls = [ad.image];
    }
    const publicImages = imageUrls.filter(url => url && url.startsWith('http')).slice(0, 24);

    // Price clean formatting
    let priceStr = '0.00';
    if (ad.price) {
      if (typeof ad.price === 'number') {
        priceStr = ad.price.toFixed(2);
      } else {
        const cleaned = ad.price.replace(/[^\d.,]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        priceStr = isNaN(num) ? '0.00' : num.toFixed(2);
      }
    }

    // Category mapping
    const CATEGORY_MAP: Record<string, string> = {
      "Auto, Rad & Boot": "9884",
      "Elektronik": "293",
      "Haus & Garten": "11700",
      "Freizeit, Hobby & Nachbarschaft": "12081",
      "Familie, Kind & Baby": "12081",
      "Mode & Beauty": "11450",
      "Eintrittskarten & Tickets": "1305",
      "Haustiere": "1281",
      "Immobilien": "10542",
      "Jobs": "160000",
      "Dienstleistungen": "316",
      "Nachbarschaft": "12081",
      "Musik, Filme & Bücher": "11232",
      "Spielzeug": "220",
      "Sport & Outdoor": "888",
      "Büro & Schreibwaren": "12576",
      "Antiquitäten & Kunst": "353",
      "Musik & Instrumente": "619",
      "Beauty & Gesundheit": "26395",
      "Sonstiges": "9355"
    };
    const categoryId = CATEGORY_MAP[ad.category] || '9355';

    try {
      // --- Call 1: Create or update inventory item (PUT) ---
      await axios.put(
        `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
        {
          product: {
            title: ad.title.replace(/<\/?[^>]+(>|$)/g, ''), // Strip html tags from title
            aspects: {
              Brand: [ad.brand || 'No-Name']
            },
            description: ad.description || 'Keine Beschreibung vorhanden.',
            imageUrls: publicImages
          },
          condition: conditionEnum,
          availability: {
            shipToLocationAvailability: {
              quantity: 1
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': 'de-DE'
          }
        }
      );

      // --- Call 2: Manage fulfillment policy (POST if needed) ---
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      let policyId = userDoc.data()?.ebayFulfillmentPolicyId;

      if (!policyId) {
        try {
          const policyResponse = await axios.post(
            'https://api.ebay.com/sell/account/v1/fulfillment_policy',
            {
              name: 'Local Pickup Only Policy',
              description: 'Fulfillment policy for local pickup only.',
              marketplaceId: 'EBAY_DE',
              categoryTypes: [
                {
                  name: 'ALL_EXCLUDING_MOTORS_VEHICLES',
                  default: true
                }
              ],
              localPickupOnly: true,
              shippingOptions: []
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          policyId = policyResponse.data.fulfillmentPolicyId;
          await userDocRef.update({ ebayFulfillmentPolicyId: policyId });
        } catch (policyErr: any) {
          console.error('Failed to create fulfillment policy:', policyErr.response?.data || policyErr.message);
          throw policyErr;
        }
      }

      // --- Location Check/Creation (Proactive default) ---
      try {
        await axios.post(
          'https://api.ebay.com/sell/inventory/v1/location/default',
          {
            location: {
              address: {
                addressLine1: 'Hauptstrasse 1',
                city: 'Berlin',
                stateOrProvince: 'Berlin',
                postalCode: '10115',
                country: 'DE'
              }
            },
            locationInstructions: 'Abholung vor Ort.',
            locationTypes: ['STORE'],
            name: 'Hauptstandort'
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (locErr: any) {
        // 409 Conflict means it already exists, which is fine
        if (locErr.response?.status !== 409) {
          console.warn('Could not register default location (may already exist):', locErr.response?.data || locErr.message);
        }
      }

      // --- Call 3: Create offer (POST) ---
      const offerResponse = await axios.post(
        'https://api.ebay.com/sell/inventory/v1/offer',
        {
          sku,
          marketplaceId: 'EBAY_DE',
          format: 'FIXED_PRICE',
          availableQuantity: 1,
          categoryId,
          listingDescription: ad.description || 'Keine Beschreibung.',
          listingPolicies: {
            fulfillmentPolicyId: policyId
          },
          pricingSummary: {
            price: {
              value: priceStr,
              currency: 'EUR'
            }
          },
          merchantLocationKey: 'default'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': 'de-DE'
          }
        }
      );
      const offerId = offerResponse.data.offerId;

      // --- Call 4: Publish offer (POST) ---
      const publishResponse = await axios.post(
        `https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const listingId = publishResponse.data.listingId;
      const ebayUrl = `https://www.ebay.de/itm/${listingId}`;

      // Update Firestore Ad document on success
      await db.collection('users').doc(userId).collection('ads').doc(adId).update({
        ebayListingId: listingId,
        ebayUrl,
        ebayLastPostedAt: new Date().toISOString()
      });

      return {
        success: true,
        listingId,
        url: ebayUrl
      };

    } catch (error: any) {
      console.error('eBay Cross-Posting Error details:', error.response?.data || error.message);
      
      let errMsg = 'Unbekannter eBay-Fehler';
      const ebayErrors = error.response?.data?.errors;
      if (Array.isArray(ebayErrors) && ebayErrors.length > 0 && ebayErrors[0].longMessage) {
        errMsg = ebayErrors[0].longMessage;
      } else if (error.message) {
        errMsg = error.message;
      }
      
      const translatedMsg = this.translateEbayError(errMsg);
      throw new HttpException(translatedMsg, HttpStatus.BAD_REQUEST);
    }
  }

  private translateEbayError(msg: string): string {
    if (!msg) return 'Unbekannter eBay-Fehler.';
    const lower = msg.toLowerCase();
    
    if (lower.includes('sku') && lower.includes('not provided')) {
      return 'Die Artikel-SKU wurde nicht bereitgestellt.';
    }
    if (lower.includes('token') || lower.includes('unauthorized') || lower.includes('expired')) {
      return 'Der eBay-Sitzungstoken ist ungültig oder abgelaufen. Bitte verbinde dein eBay-Konto erneut in den Einstellungen.';
    }
    if (lower.includes('price') || lower.includes('pricing')) {
      return 'Ungültiger Preis. Bitte überprüfe den Preis der Anzeige.';
    }
    if (lower.includes('policy')) {
      return 'Fehler bei der Abwicklungsrichtlinie (Fulfillment Policy) auf eBay. Bitte wende dich an den Support.';
    }
    if (lower.includes('merchant location') || lower.includes('location')) {
      return 'Händler-Standort ist auf eBay nicht eingerichtet. Bitte richte deinen Standort in eBay ein.';
    }
    if (lower.includes('currency') || lower.includes('eur')) {
      return 'Ungültige Währung. Die Währung muss in Euro (EUR) angegeben sein.';
    }
    if (lower.includes('quantity') || lower.includes('availablequantity')) {
      return 'Die angegebene Menge ist ungültig. Die Menge muss mindestens 1 betragen.';
    }
    
    return `eBay-Fehler: ${msg}`;
  }
}
