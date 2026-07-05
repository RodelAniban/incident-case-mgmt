import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DB_PATH', './data/incident-case-mgmt.sqlite'),
        entities: ENTITIES,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        // Runs any pending migration on every boot (dev, test, and prod
        // alike) — the same path is what /database/data-source.ts's CLI
        // scripts use, so there's exactly one way schema changes happen,
        // not "migrations in prod, synchronize everywhere else that could
        // silently drift from what migrations actually produce."
        migrationsRun: true,
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
