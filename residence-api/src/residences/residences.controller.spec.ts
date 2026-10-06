import { Test, TestingModule } from '@nestjs/testing';
import { ResidencesController } from './residences.controller';

describe('ResidencesController', () => {
  let controller: ResidencesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResidencesController],
    }).compile();

    controller = module.get<ResidencesController>(ResidencesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
