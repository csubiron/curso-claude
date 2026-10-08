import { InvalidTableStatusError } from '@errors/DomainErrors.js'

const VALID_TABLE_STATUSES = ['libre', 'ocupada', 'reservada'] as const

export type TableStatusType = typeof VALID_TABLE_STATUSES[number]

export interface Table {
    id: string
    number: number
    description: string | null
    capacity: number
    status: TableStatusType
    restaurantId: string
    createdAt: string
    updatedAt: string
}

export function normalizeTableStatus(value: string): TableStatusType {
    if (!value || typeof value !== 'string') {
        throw new InvalidTableStatusError('Table status must be provided')
    }

    const normalizedValue = value.trim().toLowerCase()
    if (!VALID_TABLE_STATUSES.includes(normalizedValue as TableStatusType)) {
        throw new InvalidTableStatusError(`Invalid table status: ${value}. Must be one of: ${VALID_TABLE_STATUSES.join(', ')}`)
    }
    return normalizedValue as TableStatusType
}
