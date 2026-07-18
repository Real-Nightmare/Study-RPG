import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class AddSLCDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  source: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class DeductSLCDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RevisionCentreUpdateDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsNumber()
  @Min(1)
  totalQuestions: number;
}
