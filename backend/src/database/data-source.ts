import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

// Used only by the TypeORM CLI (migration:generate/run/revert — see
// package.json), never imported by the running app. The app's actual
// connection is DatabaseModule, which gets DB_PATH through Nest's
// ConfigModule instead of loading dotenv directly.
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? './data/incident-case-mgmt.sqlite',
  entities: ENTITIES,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
