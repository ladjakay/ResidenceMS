import { Test, TestingModule } from '@nestjs/testing';
import { ResidencesService } from './residences.service';

describe('ResidencesService', () => {
  let service: ResidencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResidencesService],
    }).compile();

    service = module.get<ResidencesService>(ResidencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
