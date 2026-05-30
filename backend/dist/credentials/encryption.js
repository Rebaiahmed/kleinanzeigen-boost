"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEncryptionKey = getEncryptionKey;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = require("crypto");
const ALGORITHM = 'aes-256-gcm';
function getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
        throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    const key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
    }
    return key;
}
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = (0, crypto_1.randomBytes)(16);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    return {
        ciphertext: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex'),
    };
}
function decrypt(ciphertext, iv, authTag) {
    const key = getEncryptionKey();
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'hex')),
        decipher.final(),
    ]);
    return decrypted.toString('utf8');
}
//# sourceMappingURL=encryption.js.map