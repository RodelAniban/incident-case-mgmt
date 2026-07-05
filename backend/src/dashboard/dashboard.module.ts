import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../entities';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Case])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
