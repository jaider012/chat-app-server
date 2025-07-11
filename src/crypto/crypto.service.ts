import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserKeys } from "./entities/user-keys.entity";
import { ed25519 } from "@noble/curves/ed25519";
import { x25519 } from "@noble/curves/ed25519";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/hashes/utils";
import { blake3 } from "@noble/hashes/blake3";

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface SigningKeyPair {
  publicKey: string;
  secretKey: string;
}

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);

  constructor(
    @InjectRepository(UserKeys)
    private userKeysRepository: Repository<UserKeys>,
  ) {}

  /**
   * Genera un par de claves X25519 para intercambio de claves
   */
  generateKeyPair(): KeyPair {
    const secretKey = randomBytes(32);
    const publicKey = x25519.getPublicKey(secretKey);

    return {
      publicKey: Buffer.from(publicKey).toString("base64"),
      secretKey: Buffer.from(secretKey).toString("base64"),
    };
  }

  /**
   * Genera un par de claves Ed25519 para firma digital
   */
  generateSigningKeyPair(): SigningKeyPair {
    const secretKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(secretKey);

    return {
      publicKey: Buffer.from(publicKey).toString("base64"),
      secretKey: Buffer.from(secretKey).toString("base64"),
    };
  }

  /**
   * Deriva una clave simétrica usando X25519
   */
  deriveSharedSecret(mySecretKey: string, theirPublicKey: string): string {
    const mySecretKeyBuffer = Buffer.from(mySecretKey, "base64");
    const theirPublicKeyBuffer = Buffer.from(theirPublicKey, "base64");

    const sharedSecret = x25519.getSharedSecret(mySecretKeyBuffer, theirPublicKeyBuffer);

    return Buffer.from(sharedSecret).toString("base64");
  }

  /**
   * Encripta un mensaje usando ChaCha20-Poly1305
   */
  encryptMessage(
    message: string,
    sharedSecret: string,
    nonce?: string,
  ): { ciphertext: string; nonce: string } {
    const messageBuffer = Buffer.from(message, "utf8");
    const keyBuffer = Buffer.from(sharedSecret, "base64");
    const nonceBuffer = nonce ? Buffer.from(nonce, "base64") : randomBytes(12);

    const chacha = chacha20poly1305(keyBuffer, nonceBuffer);
    const ciphertext = chacha.encrypt(messageBuffer);

    return {
      ciphertext: Buffer.from(ciphertext).toString("base64"),
      nonce: Buffer.from(nonceBuffer).toString("base64"),
    };
  }

  /**
   * Desencripta un mensaje usando ChaCha20-Poly1305
   */
  decryptMessage(
    ciphertext: string,
    sharedSecret: string,
    nonce: string,
  ): string {
    const ciphertextBuffer = Buffer.from(ciphertext, "base64");
    const keyBuffer = Buffer.from(sharedSecret, "base64");
    const nonceBuffer = Buffer.from(nonce, "base64");

    const chacha = chacha20poly1305(keyBuffer, nonceBuffer);
    const plaintext = chacha.decrypt(ciphertextBuffer);

    return Buffer.from(plaintext).toString("utf8");
  }

  /**
   * Firma un mensaje usando Ed25519
   */
  signMessage(message: string, secretKey: string): string {
    const messageBuffer = Buffer.from(message, "utf8");
    const secretKeyBuffer = Buffer.from(secretKey, "base64");
    
    const signature = ed25519.sign(messageBuffer, secretKeyBuffer);
    const signedMessage = Buffer.concat([Buffer.from(signature), messageBuffer]);

    return signedMessage.toString("base64");
  }

  /**
   * Verifica la firma de un mensaje
   */
  verifySignature(signedMessage: string, publicKey: string): string | null {
    try {
      const signedMessageBuffer = Buffer.from(signedMessage, "base64");
      const publicKeyBuffer = Buffer.from(publicKey, "base64");
      
      const signature = signedMessageBuffer.subarray(0, 64); // Ed25519 signature is 64 bytes
      const message = signedMessageBuffer.subarray(64);
      
      const isValid = ed25519.verify(signature, message, publicKeyBuffer);
      
      return isValid ? message.toString("utf8") : null;
    } catch (error) {
      this.logger.error("Signature verification failed", error);
      return null;
    }
  }

  /**
   * Guarda las claves públicas de un usuario en la base de datos
   */
  async saveUserKeys(
    userId: string,
    publicKey: string,
    signingKey: string,
  ): Promise<UserKeys> {
    const userKeys = this.userKeysRepository.create({
      userId,
      publicKey,
      signingKey,
    });

    return await this.userKeysRepository.save(userKeys);
  }

  /**
   * Obtiene las claves públicas de un usuario
   */
  async getUserKeys(userId: string): Promise<UserKeys | null> {
    return await this.userKeysRepository.findOne({ where: { userId } });
  }

  /**
   * Actualiza el número de secuencia para un usuario (para double-ratchet)
   */
  async updateSequenceNumber(
    userId: string,
    sequenceNumber: number,
  ): Promise<void> {
    await this.userKeysRepository.update({ userId }, { sequenceNumber });
  }

  /**
   * Genera un hash derivado de una clave (para crear nuevas claves de mensaje)
   */
  deriveMessageKey(sharedSecret: string, sequenceNumber: number): string {
    const key = Buffer.from(sharedSecret, "base64");
    const info = Buffer.from(`message_key_${sequenceNumber}`, "utf8");
    
    const input = Buffer.concat([
      key,
      info,
      Buffer.from([sequenceNumber & 0xff]),
    ]);

    const derivedKey = blake3(input, { dkLen: 32 });

    return Buffer.from(derivedKey).toString("base64");
  }
}
