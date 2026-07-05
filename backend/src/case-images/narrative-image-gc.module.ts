import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case, CaseImage, PirReport } from '../entities';
import { NarrativeImageGcService } from './narrative-image-gc.service';

// Deliberately its own module, registering entities directly rather than
// importing CasesModule/PirModule — both of those need to import *this*
// module to call sweepCase() after a save, and CaseImagesModule already
// imports CasesModule, so depending on either back would be circular.
@Module({
  imports: [TypeOrmModule.forFeature([Case, CaseImage, PirReport])],
  providers: [NarrativeImageGcService],
  exports: [NarrativeImageGcService],
})
export class NarrativeImageGcModule {}
