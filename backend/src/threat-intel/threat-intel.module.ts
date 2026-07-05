import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThreatIndicator } from '../entities';
import { ThreatIntelController } from './threat-intel.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ThreatIndicator])],
  controllers: [ThreatIntelController],
})
export class ThreatIntelModule {}
