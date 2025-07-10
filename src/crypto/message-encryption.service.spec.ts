import { Test, TestingModule } from "@nestjs/testing";
import { MessageEncryptionService } from "./message-encryption.service";
import { CryptoService } from "./crypto.service";
import { KeyExchangeService } from "./key-exchange.service";
import { ConversationKeys } from "./entities/conversation-keys.entity";

describe("MessageEncryptionService", () => {
  let service: MessageEncryptionService;
  let cryptoService: CryptoService;
  let keyExchangeService: KeyExchangeService;

  const mockCryptoService = {
    deriveMessageKey: jest.fn(),
    encryptMessage: jest.fn(),
    decryptMessage: jest.fn(),
    verifySignature: jest.fn(),
    signMessage: jest.fn(),
  };

  const mockKeyExchangeService = {
    getConversationKeys: jest.fn(),
    updateParticipantSequence: jest.fn(),
    generateUserKeys: jest.fn(),
    getKeyExchangeStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageEncryptionService,
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: KeyExchangeService,
          useValue: mockKeyExchangeService,
        },
      ],
    }).compile();

    service = module.get<MessageEncryptionService>(MessageEncryptionService);
    cryptoService = module.get<CryptoService>(CryptoService);
    keyExchangeService = module.get<KeyExchangeService>(KeyExchangeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("encryptMessage", () => {
    it("should encrypt a message successfully", async () => {
      const conversationId = "conv-123";
      const senderId = "user-123";
      const content = "Hello, world!";
      const privateKey = "private-key";
      const privateSigningKey = "private-signing-key";

      const mockConversationKeys: ConversationKeys = {
        id: "keys-123",
        conversationId,
        status: "completed",
        participantKeys: {
          [senderId]: {
            publicKey: "public-key",
            signingKey: "signing-key",
            sequenceNumber: 5,
          },
        },
        sharedSecret: "shared-secret",
        conversation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockKeyExchangeService.getConversationKeys.mockResolvedValue(
        mockConversationKeys,
      );
      mockCryptoService.deriveMessageKey.mockReturnValue("message-key");
      mockCryptoService.encryptMessage.mockReturnValue({
        ciphertext: "encrypted-content",
        nonce: "nonce-123",
      });
      mockCryptoService.signMessage.mockReturnValue("signature-123");

      const result = await service.encryptMessage(
        conversationId,
        senderId,
        content,
        privateKey,
        privateSigningKey,
      );

      expect(result).toEqual({
        ciphertext: "encrypted-content",
        nonce: "nonce-123",
        sequenceNumber: 6,
        signature: "signature-123",
        senderId,
        timestamp: expect.any(Date),
      });

      expect(mockCryptoService.deriveMessageKey).toHaveBeenCalledWith(
        "shared-secret",
        6,
      );
      expect(mockCryptoService.encryptMessage).toHaveBeenCalledWith(
        content,
        "message-key",
      );
      expect(
        mockKeyExchangeService.updateParticipantSequence,
      ).toHaveBeenCalledWith(conversationId, senderId, 6);
    });

    it("should throw error if key exchange not completed", async () => {
      const conversationId = "conv-123";
      const senderId = "user-123";
      const content = "Hello, world!";
      const privateKey = "private-key";
      const privateSigningKey = "private-signing-key";

      const mockConversationKeys: ConversationKeys = {
        id: "keys-123",
        conversationId,
        status: "pending",
        participantKeys: {},
        sharedSecret: null as any,
        conversation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockKeyExchangeService.getConversationKeys.mockResolvedValue(
        mockConversationKeys,
      );

      await expect(
        service.encryptMessage(
          conversationId,
          senderId,
          content,
          privateKey,
          privateSigningKey,
        ),
      ).rejects.toThrow("Key exchange not completed for this conversation");
    });
  });

  describe("decryptMessage", () => {
    it("should decrypt a message successfully", async () => {
      const conversationId = "conv-123";
      const senderId = "user-123";

      const encryptedMessage = {
        ciphertext: "encrypted-content",
        nonce: "nonce-123",
        sequenceNumber: 6,
        signature: "signature-123",
        senderId,
        timestamp: new Date(),
      };

      const mockConversationKeys: ConversationKeys = {
        id: "keys-123",
        conversationId,
        status: "completed",
        participantKeys: {
          [senderId]: {
            publicKey: "public-key",
            signingKey: "signing-key",
            sequenceNumber: 6,
          },
        },
        sharedSecret: "shared-secret",
        conversation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockKeyExchangeService.getConversationKeys.mockResolvedValue(
        mockConversationKeys,
      );
      mockCryptoService.verifySignature.mockReturnValue(
        `${conversationId}:${encryptedMessage.ciphertext}:${encryptedMessage.nonce}:${encryptedMessage.sequenceNumber}`,
      );
      mockCryptoService.deriveMessageKey.mockReturnValue("message-key");
      mockCryptoService.decryptMessage.mockReturnValue("Hello, world!");

      const result = await service.decryptMessage(
        conversationId,
        encryptedMessage,
      );

      expect(result).toEqual({
        content: "Hello, world!",
        senderId,
        timestamp: encryptedMessage.timestamp,
        sequenceNumber: 6,
        isValid: true,
      });

      expect(mockCryptoService.verifySignature).toHaveBeenCalledWith(
        "signature-123",
        "signing-key",
      );
      expect(mockCryptoService.deriveMessageKey).toHaveBeenCalledWith(
        "shared-secret",
        6,
      );
      expect(mockCryptoService.decryptMessage).toHaveBeenCalledWith(
        "encrypted-content",
        "message-key",
        "nonce-123",
      );
    });

    it("should return invalid message if signature verification fails", async () => {
      const conversationId = "conv-123";
      const senderId = "user-123";

      const encryptedMessage = {
        ciphertext: "encrypted-content",
        nonce: "nonce-123",
        sequenceNumber: 6,
        signature: "invalid-signature",
        senderId,
        timestamp: new Date(),
      };

      const mockConversationKeys: ConversationKeys = {
        id: "keys-123",
        conversationId,
        status: "completed",
        participantKeys: {
          [senderId]: {
            publicKey: "public-key",
            signingKey: "signing-key",
            sequenceNumber: 6,
          },
        },
        sharedSecret: "shared-secret",
        conversation: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockKeyExchangeService.getConversationKeys.mockResolvedValue(
        mockConversationKeys,
      );
      mockCryptoService.verifySignature.mockReturnValue(null);

      const result = await service.decryptMessage(
        conversationId,
        encryptedMessage,
      );

      expect(result).toEqual({
        content: "",
        senderId,
        timestamp: encryptedMessage.timestamp,
        sequenceNumber: 6,
        isValid: false,
      });
    });
  });

  describe("getEncryptionStatus", () => {
    it("should return correct encryption status", async () => {
      const conversationId = "conv-123";

      mockKeyExchangeService.getKeyExchangeStatus.mockResolvedValue({
        status: "completed",
        participantCount: 2,
        participants: ["user-1", "user-2"],
      });

      const result = await service.getEncryptionStatus(conversationId);

      expect(result).toEqual({
        isEncrypted: true,
        keyExchangeStatus: "completed",
        participantCount: 2,
      });
    });

    it("should return false for pending key exchange", async () => {
      const conversationId = "conv-123";

      mockKeyExchangeService.getKeyExchangeStatus.mockResolvedValue({
        status: "pending",
        participantCount: 1,
        participants: ["user-1"],
      });

      const result = await service.getEncryptionStatus(conversationId);

      expect(result).toEqual({
        isEncrypted: false,
        keyExchangeStatus: "pending",
        participantCount: 1,
      });
    });
  });
});
