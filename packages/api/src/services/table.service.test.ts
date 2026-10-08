import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from '@models/table.model.js'

describe('normalizeTableStatus', () => {
    it('should accept all valid statuses', () => {
        for (const s of ['libre', 'ocupada', 'reservada']) {
            expect(normalizeTableStatus(s)).toBe(s)
        }
    })

    it('should normalize to lowercase and trim spaces', () => {
        expect(normalizeTableStatus(' LIBRE ')).toBe('libre')
    })

    it('should throw InvalidTableStatusError for an invalid status', () => {
        expect(() => normalizeTableStatus('rota')).toThrow(expect.objectContaining({ name: 'InvalidTableStatusError' }))
    })

    it('should throw InvalidTableStatusError for a missing status', () => {
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(expect.objectContaining({ name: 'InvalidTableStatusError' }))
    })
})
