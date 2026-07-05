import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Case,
  CaseHistoryEntry,
  ChatMessage,
  EvidenceAccessGrant,
  EvidenceCustodyEntry,
  EvidenceItem,
  PirReport,
  Team,
  ThreatIndicator,
  User,
} from '../entities';

const ENTITIES = [
  Case,
  CaseHistoryEntry,
  ChatMessage,
  EvidenceAccessGrant,
  EvidenceCustodyEntry,
  EvidenceItem,
  PirReport,
  Team,
  ThreatIndicator,
  User,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DB_PATH', './data/incident-case-mgmt.sqlite'),
        entities: ENTITIES,
        // Scaffold-only convenience: generates tables from entities automatically.
        // Replace with proper migrations before this touches real incident data.
        synchronize: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
