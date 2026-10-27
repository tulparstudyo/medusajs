export class ImportException extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImportException"
  }
}

/** HttpStatusException marks a source response that was not successful. */
export class HttpStatusException extends ImportException {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "HttpStatusException"
    this.status = status
  }
}
