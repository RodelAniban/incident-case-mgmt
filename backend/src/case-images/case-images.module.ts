import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesModule } from '../cases/cases.module';
import { CaseImage, User } from '../entities';
import { CaseImagesController } from './case-images.controller';
import { CaseImagesService } from './case-images.service';

@Module({
  imports: [TypeOrmModule.forFeature([CaseImage, User]), CasesModule],
  controllers: [CaseImagesController],
  providers: [CaseImagesService],
})
export class CaseImagesModule {}
