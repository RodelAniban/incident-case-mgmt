import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_JWT_SECRET = 'change-me-in-production';
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Fails fast at boot rather than lazily the first time something touches the
 * bad config — e.g. EVIDENCE_ENCRYPTION_KEY was previously only validated on
 * the first evidence upload, which meant a misconfigured production instance
 * could run for weeks before anyone noticed. NODE_ENV gates strictness: local
 * dev gets a warning, production refuses to start.
 */
export function validateStartupConfig(config: ConfigService): void {
  const logger = new Logger('StartupValidation');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const jwtSecret = config.get<string>('JWT_SECRET', DEFAULT_JWT_SECRET);
  const evidenceKey = config.get<string>('EVIDENCE_ENCRYPTION_KEY');

  if (nodeEnv !== 'production') {
    if (jwtSecret === DEFAULT_JWT_SECRET) {
      logger.warn('Using the default JWT_SECRET — fine for local development, never for a real deployment.');
    }
    return;
  }

  const errors: string[] = [];

  if (jwtSecret === DEFAULT_JWT_SECRET) {
    errors.push('JWT_SECRET is still the scaffold default — set a real secret before running in production.');
  } else if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET is only ${jwtSecret.length} characters — use at least ${MIN_JWT_SECRET_LENGTH}.`);
  }

  if (!evidenceKey) {
    errors.push('EVIDENCE_ENCRYPTION_KEY is not set — evidence and case-image encryption cannot start.');
  } else if (Buffer.from(evidenceKey, 'base64').length !== 32) {
    errors.push('EVIDENCE_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key).');
  }

  if (errors.length > 0) {
    logger.error('Refusing to start in production with insecure configuration:');
    errors.forEach((e) => logger.error(`  - ${e}`));
    process.exit(1);
  }
}
