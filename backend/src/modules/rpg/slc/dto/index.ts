export class AddSLCDto {
  amount: number;
  source: string;
  referenceId?: string;
  description?: string;
}

export class DeductSLCDto {
  amount: number;
  reason: string;
  description?: string;
}

export class RevisionCentreUpdateDto {
  score: number;
  totalQuestions: number;
}
