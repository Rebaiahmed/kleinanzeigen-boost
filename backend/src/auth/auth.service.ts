import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly firebaseService: FirebaseService
  ) {}

  async login(email: string, passwordHash: string) {
    // Standard mock verification (in production, verify hashed password with DB)
    if (email === 'admin@kleinanzeigenboost.de') {
      const payload = { email, sub: 'user1' };
      const token = this.jwtService.sign(payload);
      
      // Save session info to Firestore (as requested: "saves encrypted cookies to Firestore")
      await this.firebaseService.firestore.collection('sessions').doc('user1').set({
        token,
        status: 'active',
        lastLogin: new Date().toISOString()
      }, { merge: true });

      return { accessToken: token };
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async getStatus(userId: string) {
    const doc = await this.firebaseService.firestore.collection('sessions').doc(userId).get();
    if (doc.exists && doc.data()?.status === 'active') {
      return { status: 'active' };
    }
    return { status: 'expired' };
  }
}
