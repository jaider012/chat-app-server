import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CryptoService } from "./crypto.service";
import { UserKeys } from "./entities/user-keys.entity";

describe("CryptoService", () => {
  let service: CryptoService;
  let userKeysRepository: Repository<UserKeys>;

  const mockUserKeysRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: getRepositoryToken(UserKeys),
          useValue: mockUserKeysRepository,
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    userKeysRepository = module.get<Repository<UserKeys>>(
      getRepositoryToken(UserKeys),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateKeyPair", () => {
    it("should generate a valid X25519 key pair", () => {
      const keyPair = service.generateKeyPair();

      expect(keyPair).toHaveProperty("publicKey");
      expect(keyPair).toHaveProperty("secretKey");
      expect(typeof keyPair.publicKey).toBe("string");
      expect(typeof keyPair.secretKey).toBe("string");

      // Verify base64 encoding
      expect(() => Buffer.from(keyPair.publicKey, "base64")).not.toThrow();
      expect(() => Buffer.from(keyPair.secretKey, "base64")).not.toThrow();
    });

    it("should generate different key pairs each time", () => {
      const keyPair1 = service.generateKeyPair();
      const keyPair2 = service.generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.secretKey).not.toBe(keyPair2.secretKey);
    });
  });

  describe("generateSigningKeyPair", () => {
    it("should generate a valid Ed25519 signing key pair", () => {
      const keyPair = service.generateSigningKeyPair();

      expect(keyPair).toHaveProperty("publicKey");
      expect(keyPair).toHaveProperty("secretKey");
      expect(typeof keyPair.publicKey).toBe("string");
      expect(typeof keyPair.secretKey).toBe("string");

      // Verify base64 encoding
      expect(() => Buffer.from(keyPair.publicKey, "base64")).not.toThrow();
      expect(() => Buffer.from(keyPair.secretKey, "base64")).not.toThrow();
    });
  });

  describe("deriveSharedSecret", () => {
    it("should derive the same shared secret from compatible key pairs", () => {
      const keyPair1 = service.generateKeyPair();
      const keyPair2 = service.generateKeyPair();

      const secret1 = service.deriveSharedSecret(
        keyPair1.secretKey,
        keyPair2.publicKey,
      );
      const secret2 = service.deriveSharedSecret(
        keyPair2.secretKey,
        keyPair1.publicKey,
      );

      expect(secret1).toBe(secret2);
      expect(typeof secret1).toBe("string");
    });
  });

  describe("encryptMessage and decryptMessage", () => {
    it("should encrypt and decrypt a message correctly", () => {
      const keyPair1 = service.generateKeyPair();
      const keyPair2 = service.generateKeyPair();
      const sharedSecret = service.deriveSharedSecret(
        keyPair1.secretKey,
        keyPair2.publicKey,
      );

      const originalMessage = "Hello, this is a secret message!";

      const { ciphertext, nonce } = service.encryptMessage(
        originalMessage,
        sharedSecret,
      );
      const decryptedMessage = service.decryptMessage(
        ciphertext,
        sharedSecret,
        nonce,
      );

      expect(decryptedMessage).toBe(originalMessage);
    });

    it("should produce different ciphertext for the same message", () => {
      const keyPair1 = service.generateKeyPair();
      const keyPair2 = service.generateKeyPair();
      const sharedSecret = service.deriveSharedSecret(
        keyPair1.secretKey,
        keyPair2.publicKey,
      );

      const message = "Same message";

      const result1 = service.encryptMessage(message, sharedSecret);
      const result2 = service.encryptMessage(message, sharedSecret);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.nonce).not.toBe(result2.nonce);
    });

    it("should fail to decrypt with wrong shared secret", () => {
      const keyPair1 = service.generateKeyPair();
      const keyPair2 = service.generateKeyPair();
      const keyPair3 = service.generateKeyPair();

      const correctSecret = service.deriveSharedSecret(
        keyPair1.secretKey,
        keyPair2.publicKey,
      );
      const wrongSecret = service.deriveSharedSecret(
        keyPair1.secretKey,
        keyPair3.publicKey,
      );

      const message = "Secret message";
      const { ciphertext, nonce } = service.encryptMessage(
        message,
        correctSecret,
      );

      expect(() => {
        service.decryptMessage(ciphertext, wrongSecret, nonce);
      }).toThrow();
    });
  });

  describe("signMessage and verifySignature", () => {
    it("should sign and verify a message correctly", () => {
      const signingKeyPair = service.generateSigningKeyPair();
      const message = "This is a message to sign";

      const signature = service.signMessage(message, signingKeyPair.secretKey);
      const verifiedMessage = service.verifySignature(
        signature,
        signingKeyPair.publicKey,
      );

      expect(verifiedMessage).toBe(message);
    });

    it("should fail verification with wrong public key", () => {
      const signingKeyPair1 = service.generateSigningKeyPair();
      const signingKeyPair2 = service.generateSigningKeyPair();
      const message = "This is a message to sign";

      const signature = service.signMessage(message, signingKeyPair1.secretKey);
      const verifiedMessage = service.verifySignature(
        signature,
        signingKeyPair2.publicKey,
      );

      // The verification should return null for invalid signatures or not match the original message
      expect(verifiedMessage).not.toBe(message);
    });
  });

  describe("deriveMessageKey", () => {
    it("should derive different keys for different sequence numbers", () => {
      const sharedSecret = "dGVzdFNoYXJlZFNlY3JldA=="; // base64 encoded test secret

      const key1 = service.deriveMessageKey(sharedSecret, 1);
      const key2 = service.deriveMessageKey(sharedSecret, 2);

      expect(key1).not.toBe(key2);
      expect(typeof key1).toBe("string");
      expect(typeof key2).toBe("string");
    });

    it("should derive the same key for the same parameters", () => {
      const sharedSecret = "dGVzdFNoYXJlZFNlY3JldA==";
      const sequenceNumber = 5;

      const key1 = service.deriveMessageKey(sharedSecret, sequenceNumber);
      const key2 = service.deriveMessageKey(sharedSecret, sequenceNumber);

      expect(key1).toBe(key2);
    });
  });
});
