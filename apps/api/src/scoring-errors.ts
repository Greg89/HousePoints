export class ScoringWriteError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) {
    super(message);
    this.name = "ScoringWriteError";
  }
}

export class SeasonScopeError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: "SEASON_NOT_FOUND" | "ACTIVE_SEASON_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "SeasonScopeError";
  }
}

