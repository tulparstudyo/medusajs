import { MedusaError } from "@medusajs/framework/utils"

import { HttpStatusException, ImportException } from "../kibiimport/errors"

/** RetryableException marks a failure that may pass on a later attempt. */
export class RetryableException extends ImportException {
  constructor(message: string) {
    super(message)
    this.name = "RetryableException"
  }
}

/**
 * IsRetryable tells passing trouble from bad data: a busy file, a source
 * that did not answer and unexpected errors are tried again, a document
 * the importer refused is not.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof RetryableException) {
    return true
  }

  if (error instanceof HttpStatusException) {
    return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500
  }

  if (error instanceof ImportException) {
    return false
  }

  if (error instanceof MedusaError) {
    return ![
      MedusaError.Types.INVALID_DATA,
      MedusaError.Types.NOT_FOUND,
      MedusaError.Types.NOT_ALLOWED,
      MedusaError.Types.DUPLICATE_ERROR,
    ].includes(error.type as never)
  }

  return true
}

export function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "İçe aktarma başarısız oldu."
}
