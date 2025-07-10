import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserKeys } from "./entities/user-keys.entity";
import * as sodium from "sodium-native";

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
    const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
    const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);

    sodium.crypto_box_keypair(publicKey, secretKey);

    return {
      publicKey: publicKey.toString("base64"),
      secretKey: secretKey.toString("base64"),
    };
  }

  /**
   * Genera un par de claves Ed25519 para firma digital
   */
  generateSigningKeyPair(): SigningKeyPair {
    const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
    const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);

    sodium.crypto_sign_keypair(publicKey, secretKey);

    return {
      publicKey: publicKey.toString("base64"),
      secretKey: secretKey.toString("base64"),
    };
  }

  /**
   * Deriva una clave simétrica usando X25519
   */
  deriveSharedSecret(mySecretKey: string, theirPublicKey: string): string {
    const sharedSecret = Buffer.alloc(32); // 256 bits
    const mySecretKeyBuffer = Buffer.from(mySecretKey, "base64");
    const theirPublicKeyBuffer = Buffer.from(theirPublicKey, "base64");

    // Usar crypto_scalarmult para derivar el secreto compartido
    sodium.crypto_scalarmult(
      sharedSecret,
      mySecretKeyBuffer,
      theirPublicKeyBuffer,
    );

    return sharedSecret.toString("base64");
  }

  /**
   * Encripta un mensaje usando AES-256-GCM
   */
  encryptMessage(
    message: string,
    sharedSecret: string,
    nonce?: string,
  ): { ciphertext: string; nonce: string } {
    const messageBuffer = Buffer.from(message, "utf8");
    const keyBuffer = Buffer.from(sharedSecret, "base64");
    const nonceBuffer = nonce
      ? Buffer.from(nonce, "base64")
      : Buffer.alloc(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    if (!nonce) {
      sodium.randombytes_buf(nonceBuffer);
    }

    const ciphertext = Buffer.alloc(
      messageBuffer.length + sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES,
    );

    sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      ciphertext,
      messageBuffer,
      null, // No additional data
      null, // No secret nonce
      nonceBuffer,
      keyBuffer,
    );

    return {
      ciphertext: ciphertext.toString("base64"),
      nonce: nonceBuffer.toString("base64"),
    };
  }

  /**
   * Desencripta un mensaje usando AES-256-GCM
   */
  decryptMessage(
    ciphertext: string,
    sharedSecret: string,
    nonce: string,
  ): string {
    const ciphertextBuffer = Buffer.from(ciphertext, "base64");
    const keyBuffer = Buffer.from(sharedSecret, "base64");
    const nonceBuffer = Buffer.from(nonce, "base64");

    const plaintext = Buffer.alloc(
      ciphertextBuffer.length -
        sodium.crypto_aead_xchacha20poly1305_ietf_ABYTES,
    );

    sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      plaintext,
      null, // No secret nonce
      ciphertextBuffer,
      null, // No additional data
      nonceBuffer,
      keyBuffer,
    );

    return plaintext.toString("utf8");
  }

  /**
   * Firma un mensaje usando Ed25519
   */
  signMessage(message: string, secretKey: string): string {
    const messageBuffer = Buffer.from(message, "utf8");
    const secretKeyBuffer = Buffer.from(secretKey, "base64");
    const signedMessage = Buffer.alloc(
      messageBuffer.length + sodium.crypto_sign_BYTES,
    );

    sodium.crypto_sign(signedMessage, messageBuffer, secretKeyBuffer);

    return signedMessage.toString("base64");
  }

  /**
   * Verifica la firma de un mensaje
   */
  verifySignature(signedMessage: string, publicKey: string): string | null {
    try {
      const signedMessageBuffer = Buffer.from(signedMessage, "base64");
      const publicKeyBuffer = Buffer.from(publicKey, "base64");
      const message = Buffer.alloc(
        signedMessageBuffer.length - sodium.crypto_sign_BYTES,
      );

      sodium.crypto_sign_open(message, signedMessageBuffer, publicKeyBuffer);

      return message.toString("utf8");
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
    const salt = Buffer.alloc(32); // Salt vacío

    // Usamos crypto_generichash para derivar la clave
    const derivedKey = Buffer.alloc(32); // 256 bits
    const input = Buffer.concat([
      key,
      info,
      Buffer.from([sequenceNumber & 0xff]),
    ]);

    sodium.crypto_generichash(derivedKey, input, salt);

    return derivedKey.toString("base64");
  }
}
