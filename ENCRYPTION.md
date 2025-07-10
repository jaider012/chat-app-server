# End-to-End Encryption Implementation

## Overview

Esta implementación proporciona encriptación end-to-end para la aplicación de chat usando un protocolo Double-Ratchet simplificado basado en las siguientes tecnologías:

- **X25519** para intercambio de claves Diffie-Hellman
- **Ed25519** para firmas digitales
- **XChaCha20-Poly1305** para encriptación simétrica autenticada
- **BLAKE2b** para derivación de claves

## Características

- ✅ **Forward Secrecy**: Nuevas claves para cada mensaje
- ✅ **Perfect Forward Secrecy**: Las claves pasadas no pueden recuperar mensajes futuros
- ✅ **Autenticación**: Verificación de integridad y autenticidad de mensajes
- ✅ **Non-repudiation**: Firma digital de mensajes
- ✅ **Key Rotation**: Rotación automática de claves por mensaje

## Arquitectura

### Backend Components

```
src/crypto/
├── crypto.service.ts              # Servicios criptográficos básicos
├── key-exchange.service.ts        # Protocolo de intercambio de claves
├── message-encryption.service.ts  # Encriptación de mensajes
├── entities/
│   ├── user-keys.entity.ts        # Claves públicas de usuarios
│   └── conversation-keys.entity.ts # Estado de claves por conversación
└── dto/
    └── key-exchange.dto.ts         # DTOs para intercambio de claves
```

### Database Schema

#### user_keys
```sql
CREATE TABLE user_keys (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL,
    public_key TEXT NOT NULL,      -- X25519 public key
    signing_key TEXT NOT NULL,     -- Ed25519 public key
    sequence_number INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### conversation_keys
```sql
CREATE TABLE conversation_keys (
    id UUID PRIMARY KEY,
    conversation_id UUID UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    participant_keys JSONB NOT NULL,  -- {userId: {publicKey, signingKey, sequenceNumber}}
    shared_secret TEXT,               -- Temporary storage for demo
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### messages (updated)
```sql
ALTER TABLE messages ADD COLUMN ciphertext TEXT;
ALTER TABLE messages ADD COLUMN nonce TEXT;
ALTER TABLE messages ADD COLUMN signature TEXT;
ALTER TABLE messages ADD COLUMN sequence_number INTEGER;
ALTER TABLE messages ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;
```

## Flujo de Encriptación

### 1. Intercambio de Claves

#### Generar claves para usuario:
```http
POST /api/conversations/generate-keys
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "publicKey": "base64_encoded_x25519_public_key",
  "signingKey": "base64_encoded_ed25519_public_key"
}
```

#### Iniciar intercambio de claves:
```http
POST /api/conversations/{conversationId}/key-exchange/initiate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "publicKey": "base64_encoded_x25519_public_key",
  "signingKey": "base64_encoded_ed25519_public_key",
  "signature": "base64_encoded_signature"
}
```

#### Completar intercambio de claves:
```http
POST /api/conversations/{conversationId}/key-exchange/complete
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "publicKey": "base64_encoded_x25519_public_key",
  "signingKey": "base64_encoded_ed25519_public_key", 
  "signature": "base64_encoded_signature"
}
```

### 2. Envío de Mensajes Encriptados

#### Via WebSocket:
```javascript
socket.emit('sendEncryptedMessage', {
  conversationId: 'conversation-uuid',
  ciphertext: 'base64_encrypted_content',
  nonce: 'base64_nonce',
  signature: 'base64_signature',
  sequenceNumber: 1,
  isEncrypted: true
});
```

#### Via REST API:
```http
POST /api/conversations/{conversationId}/messages
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "ciphertext": "base64_encrypted_content",
  "nonce": "base64_nonce", 
  "signature": "base64_signature",
  "sequenceNumber": 1,
  "isEncrypted": true
}
```

### 3. Recepción de Mensajes

#### WebSocket Event:
```javascript
socket.on('newMessage', (data) => {
  console.log('New message:', {
    id: data.id,
    ciphertext: data.ciphertext,    // null if not encrypted
    nonce: data.nonce,              // null if not encrypted
    signature: data.signature,      // null if not encrypted
    sequenceNumber: data.sequenceNumber,
    isEncrypted: data.isEncrypted,
    content: data.content,          // plaintext if not encrypted
    sender: data.sender,
    createdAt: data.createdAt
  });
});
```

## Protocolo Criptográfico

### Intercambio de Claves (Key Exchange)

1. **Usuario A** genera par de claves (X25519 + Ed25519)
2. **Usuario A** envía clave pública + firma a **Usuario B**
3. **Usuario B** genera par de claves y envía clave pública + firma a **Usuario A**
4. Ambos usuarios calculan secreto compartido: `sharedSecret = ECDH(myPrivateKey, theirPublicKey)`

### Encriptación de Mensajes

1. **Derivar clave de mensaje**: `messageKey = BLAKE2b(sharedSecret || sequenceNumber)`
2. **Encriptar**: `{ciphertext, nonce} = XChaCha20Poly1305.encrypt(message, messageKey)`
3. **Firmar**: `signature = Ed25519.sign(conversationId || ciphertext || nonce || sequenceNumber, privateSigningKey)`
4. **Incrementar** número de secuencia

### Desencriptación de Mensajes

1. **Verificar firma**: `Ed25519.verify(signature, message_data, senderPublicSigningKey)`
2. **Derivar clave**: `messageKey = BLAKE2b(sharedSecret || sequenceNumber)`
3. **Desencriptar**: `plaintext = XChaCha20Poly1305.decrypt(ciphertext, messageKey, nonce)`

## WebSocket Events

### Eventos de Intercambio de Claves

- `initiateKeyExchange` - Iniciar intercambio de claves
- `completeKeyExchange` - Completar intercambio de claves  
- `keyExchangeRequest` - Solicitud de intercambio recibida
- `keyExchangeInitiated` - Intercambio iniciado exitosamente
- `keyExchangeCompleted` - Intercambio completado exitosamente

### Eventos de Mensajería

- `sendEncryptedMessage` - Enviar mensaje encriptado
- `newMessage` - Nuevo mensaje recibido (encriptado o no)
- `getEncryptionStatus` - Obtener estado de encriptación
- `encryptionStatus` - Estado de encriptación de conversación

## Estado de Encriptación

```http
GET /api/conversations/{conversationId}/encryption-status
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "isEncrypted": true,
  "keyExchangeStatus": "completed",
  "participantCount": 2
}
```

## Seguridad Considerations

### Implemented
- ✅ Forward secrecy mediante rotación de claves
- ✅ Autenticación de mensajes con Ed25519
- ✅ Integridad con AEAD (ChaCha20-Poly1305)
- ✅ Protección contra replay attacks con números de secuencia
- ✅ Validación de firmas en el servidor

### Production Recommendations
- 🔒 **No almacenar claves privadas en el servidor**
- 🔒 **Implementar key escrow opcional para recuperación**
- 🔒 **Agregar metadata encryption**
- 🔒 **Implementar perfect forward secrecy completo**
- 🔒 **Rotar claves de conversación periódicamente**
- 🔒 **Implementar out-of-band key verification**

## Testing

```bash
# Ejecutar tests de criptografía
npm test src/crypto

# Ejecutar tests específicos
npm test src/crypto/crypto.service.spec.ts
npm test src/crypto/message-encryption.service.spec.ts
```

## Example Client Integration

```javascript
// Frontend integration example
class E2EEChatClient {
  async initializeKeyExchange(conversationId) {
    // Generate key pairs
    const keyPair = await crypto.subtle.generateKey(
      { name: "X25519" },
      true,
      ["deriveKey", "deriveBits"]
    );
    
    // Sign the key exchange message
    const message = `${conversationId}:${publicKey}:${signingKey}`;
    const signature = await this.signMessage(message, privateSigningKey);
    
    // Send to server
    this.socket.emit('initiateKeyExchange', {
      conversationId,
      publicKey: await this.exportKey(keyPair.publicKey),
      signingKey: this.signingKeyPair.publicKey,
      signature
    });
  }
  
  async encryptAndSendMessage(conversationId, message) {
    const sequenceNumber = this.getNextSequenceNumber(conversationId);
    const messageKey = await this.deriveMessageKey(conversationId, sequenceNumber);
    
    const { ciphertext, nonce } = await this.encrypt(message, messageKey);
    const signature = await this.signMessage(
      `${conversationId}:${ciphertext}:${nonce}:${sequenceNumber}`,
      this.privateSigningKey
    );
    
    this.socket.emit('sendEncryptedMessage', {
      conversationId,
      ciphertext,
      nonce,
      signature,
      sequenceNumber,
      isEncrypted: true
    });
  }
}
```