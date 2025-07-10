import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1752174377524 implements MigrationInterface {
  name = "InitialMigration1752174377524";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "ciphertext" text, "nonce" text, "signature" text, "sequenceNumber" integer, "isEncrypted" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "senderId" uuid NOT NULL, "conversationId" uuid NOT NULL, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "googleId" character varying NOT NULL, "email" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "profilePicture" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "publicKey" text NOT NULL, "signingKey" text NOT NULL, "sequenceNumber" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_689231abfc8d250d0a0580c9a6f" UNIQUE ("userId"), CONSTRAINT "REL_689231abfc8d250d0a0580c9a6" UNIQUE ("userId"), CONSTRAINT "PK_a9df16797b63998be19abb49b34" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_689231abfc8d250d0a0580c9a6" ON "user_keys" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "participantKeys" json NOT NULL, "sharedSecret" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5bb27c3600b882576e2b432aca6" UNIQUE ("conversationId"), CONSTRAINT "REL_5bb27c3600b882576e2b432aca" UNIQUE ("conversationId"), CONSTRAINT "PK_6740fd6449b5fe9739817b236db" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5bb27c3600b882576e2b432aca" ON "conversation_keys" ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "conversation_participants" ("conversationId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_e43efbfa3b850160b5b2c50e3ec" PRIMARY KEY ("conversationId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4453e20858b14ab765a09ad728" ON "conversation_participants" ("conversationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_18c4ba3b127461649e5f5039db" ON "conversation_participants" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_keys" ADD CONSTRAINT "FK_689231abfc8d250d0a0580c9a6f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_keys" ADD CONSTRAINT "FK_5bb27c3600b882576e2b432aca6" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" ADD CONSTRAINT "FK_4453e20858b14ab765a09ad728c" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" ADD CONSTRAINT "FK_18c4ba3b127461649e5f5039dbf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" DROP CONSTRAINT "FK_18c4ba3b127461649e5f5039dbf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_participants" DROP CONSTRAINT "FK_4453e20858b14ab765a09ad728c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_keys" DROP CONSTRAINT "FK_5bb27c3600b882576e2b432aca6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_keys" DROP CONSTRAINT "FK_689231abfc8d250d0a0580c9a6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_18c4ba3b127461649e5f5039db"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4453e20858b14ab765a09ad728"`,
    );
    await queryRunner.query(`DROP TABLE "conversation_participants"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5bb27c3600b882576e2b432aca"`,
    );
    await queryRunner.query(`DROP TABLE "conversation_keys"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_689231abfc8d250d0a0580c9a6"`,
    );
    await queryRunner.query(`DROP TABLE "user_keys"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
