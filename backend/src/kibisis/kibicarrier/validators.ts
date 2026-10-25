import { z } from "@medusajs/framework/zod"

import { ShipmentRequest } from "./contract"

const text = (min: number, max: number) => z.string().trim().min(min).max(max)

export const InstallCarrierSchema = z
  .object({
    repo: z.string().regex(/^kibisis-[a-z0-9-]{2,60}$/, "Geçersiz paket adı."),
  })
  .strict()

export type InstallCarrierInput = z.infer<typeof InstallCarrierSchema>

export const CreateShipmentSchema = z
  .object({
    reference: text(1, 40),
    invoice_number: text(1, 40).nullish(),
    receiver: z
      .object({
        name: text(1, 200),
        phone: text(7, 30),
        email: z.string().trim().email().max(200).nullish(),
        address: text(1, 500),
        city: text(1, 80),
        district: text(1, 80),
        postal_code: text(1, 10).nullish(),
      })
      .strict(),
    parcels: z.number().int().min(1).max(99).default(1),
    weight_kg: z.number().positive().max(1000).nullish(),
    description: text(1, 200).nullish(),
    cash_on_delivery: z
      .object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Tutar 123.45 biçiminde olmalı."),
        currency: z.string().length(3).default("TRY"),
      })
      .strict()
      .nullish(),
  })
  .strict()

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>

export function toShipmentRequest(input: CreateShipmentInput): ShipmentRequest {
  return {
    reference: input.reference,
    invoiceNumber: input.invoice_number ?? null,
    receiver: {
      name: input.receiver.name,
      phone: input.receiver.phone,
      email: input.receiver.email ?? null,
      address: input.receiver.address,
      city: input.receiver.city,
      district: input.receiver.district,
      postalCode: input.receiver.postal_code ?? null,
    },
    parcels: input.parcels,
    weightKg: input.weight_kg ?? null,
    description: input.description ?? null,
    cashOnDelivery: input.cash_on_delivery
      ? { amount: input.cash_on_delivery.amount, currency: input.cash_on_delivery.currency.toUpperCase() }
      : null,
  }
}
