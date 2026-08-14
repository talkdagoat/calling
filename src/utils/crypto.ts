/**
 * End-to-End Encryption (E2EE) Cryptographic Utilities
 * Built using the standard Web Crypto API (SubtleCrypto)
 * Supports ECDH P-256 Key Exchange, AES-GCM 256 payload encryption,
 * and SHA-256 formatted Safety Numbers (Fingerprint verification).
 */

export interface KeyPairData {
  keyPair: CryptoKeyPair;
  publicKeyBase64: string;
  fingerprint: string;
}

// Convert ArrayBuffer to Base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate ECDH P-256 Key Pair for session key derivation
export async function generateIdentityKeyPair(): Promise<KeyPairData> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const exportedPub = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(exportedPub);
  const fingerprint = await computeFingerprint(exportedPub);

  return {
    keyPair,
    publicKeyBase64,
    fingerprint,
  };
}

// Compute 40-character formatted SHA-256 fingerprint from public key
export async function computeFingerprint(spkiBuffer: ArrayBuffer): Promise<string> {
  const hash = await window.crypto.subtle.digest('SHA-256', spkiBuffer);
  const hashArray = Array.from(new Uint8Array(hash));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  
  // Format as 8 blocks of 4 hex chars: "A1B2 C3D4 E5F6 7890 ..."
  const formatted = hex.match(/.{1,4}/g)?.slice(0, 8).join(' ') || hex.slice(0, 32);
  return formatted;
}

// Derive AES-GCM 256 session key between local private key and remote public key
export async function deriveSessionKey(
  localPrivateKey: CryptoKey,
  remotePublicKeyBase64: string
): Promise<CryptoKey> {
  const remotePubBuffer = base64ToArrayBuffer(remotePublicKeyBase64);
  const remotePublicKey = await window.crypto.subtle.importKey(
    'spki',
    remotePubBuffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: remotePublicKey,
    },
    localPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // not extractable for security
    ['encrypt', 'decrypt']
  );
}

// Generate human-readable 60-digit or 20-digit Signal-style Safety Number
export async function generateSafetyNumber(
  localPublicKeyBase64: string,
  remotePublicKeyBase64: string,
  salt: string = 'CIPHER_CALL_V1'
): Promise<string> {
  const encoder = new TextEncoder();
  // Sort lexicographically to ensure both parties calculate the exact same safety number
  const sortedKeys = [localPublicKeyBase64, remotePublicKeyBase64].sort();
  const input = encoder.encode(sortedKeys[0] + sortedKeys[1] + salt);
  
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', input);
  const bytes = new Uint8Array(hashBuffer);

  // Convert hash bytes into 4 groups of 5-digit decimal numbers (e.g. 49102 38472 91823 64910)
  const numbers: string[] = [];
  for (let i = 0; i < 4; i++) {
    const chunk = (bytes[i * 4] << 24) | (bytes[i * 4 + 1] << 16) | (bytes[i * 4 + 2] << 8) | bytes[i * 4 + 3];
    const absVal = Math.abs(chunk) % 100000;
    numbers.push(absVal.toString().padStart(5, '0'));
  }

  return numbers.join(' ');
}

// Encrypt string with AES-GCM 256 and random 12-byte IV
export async function encryptPayload(text: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(text);

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedText
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

// Decrypt ciphertext with AES-GCM 256 and IV
export async function decryptPayload(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(ciphertext);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(ivBuffer),
    },
    key,
    encryptedBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
