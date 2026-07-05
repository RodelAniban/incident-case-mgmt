import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Logout used to be client-side-only — a stolen token stayed valid until it
 * expired. Logging out now records the token's jti here; JwtStrategy rejects
 * any request bearing a revoked jti. Rows are pruned once their token's own
 * expiry has passed (see AuthService.logout), so this table never grows past
 * "tokens revoked within their own lifetime" instead of accumulating forever.
 */
@Entity('revoked_tokens')
export class RevokedToken {
  @PrimaryColumn()
  jti: string;

  @Column()
  expiresAt: Date;
}
