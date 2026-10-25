export class ImportException extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImportException"
  }
}
