import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminAuditEntries1783251318197 implements MigrationInterface {
    name = 'AddAdminAuditEntries1783251318197'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admin_audit_entries" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "action" varchar NOT NULL, "details" text, "prevHash" varchar NOT NULL, "hash" varchar NOT NULL, "ts" datetime NOT NULL DEFAULT (datetime('now')), "actorId" integer, "targetUserId" integer)`);
        await queryRunner.query(`CREATE TABLE "temporary_admin_audit_entries" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "action" varchar NOT NULL, "details" text, "prevHash" varchar NOT NULL, "hash" varchar NOT NULL, "ts" datetime NOT NULL DEFAULT (datetime('now')), "actorId" integer, "targetUserId" integer, CONSTRAINT "FK_f8b476659e6852a73932e9852d1" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_e9f87c131d4fc162740e7de541d" FOREIGN KEY ("targetUserId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_admin_audit_entries"("id", "action", "details", "prevHash", "hash", "ts", "actorId", "targetUserId") SELECT "id", "action", "details", "prevHash", "hash", "ts", "actorId", "targetUserId" FROM "admin_audit_entries"`);
        await queryRunner.query(`DROP TABLE "admin_audit_entries"`);
        await queryRunner.query(`ALTER TABLE "temporary_admin_audit_entries" RENAME TO "admin_audit_entries"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admin_audit_entries" RENAME TO "temporary_admin_audit_entries"`);
        await queryRunner.query(`CREATE TABLE "admin_audit_entries" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "action" varchar NOT NULL, "details" text, "prevHash" varchar NOT NULL, "hash" varchar NOT NULL, "ts" datetime NOT NULL DEFAULT (datetime('now')), "actorId" integer, "targetUserId" integer)`);
        await queryRunner.query(`INSERT INTO "admin_audit_entries"("id", "action", "details", "prevHash", "hash", "ts", "actorId", "targetUserId") SELECT "id", "action", "details", "prevHash", "hash", "ts", "actorId", "targetUserId" FROM "temporary_admin_audit_entries"`);
        await queryRunner.query(`DROP TABLE "temporary_admin_audit_entries"`);
        await queryRunner.query(`DROP TABLE "admin_audit_entries"`);
    }

}
