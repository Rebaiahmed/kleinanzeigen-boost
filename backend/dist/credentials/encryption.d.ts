export declare function getEncryptionKey(): Buffer;
export declare function encrypt(plaintext: string): {
    ciphertext: string;
    iv: string;
    authTag: string;
};
export declare function decrypt(ciphertext: string, iv: string, authTag: string): string;
