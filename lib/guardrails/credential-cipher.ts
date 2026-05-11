// lib/guardrails/credential-cipher.ts — Cifra/decifra de credenciais com AES-256-GCM
// Formato do output: base64( iv(12B) || ciphertext || authTag(16B) )
// ENCRYPTION_KEY deve ser 32 bytes em hex (64 chars).

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('[credential-cipher] ENCRYPTION_KEY ausente')
  }
  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error('[credential-cipher] ENCRYPTION_KEY deve ser hex')
  }
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `[credential-cipher] ENCRYPTION_KEY deve ter ${KEY_LENGTH} bytes (${
        KEY_LENGTH * 2
      } chars hex); recebido ${buf.length}`,
    )
  }
  return buf
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64')
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('[credential-cipher] ciphertext muito curto')
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH)
  const ct = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()])
  return plaintext.toString('utf8')
}
