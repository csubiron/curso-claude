import { describe, it, expect, beforeEach } from 'vitest'
import { normalizeTableStatus } from '@models/table.model.js'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'

const errorNamed = (name: string) => expect.objectContaining({ name })

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
        expect(() => normalizeTableStatus('rota')).toThrow(errorNamed('InvalidTableStatusError'))
    })

    it('should throw InvalidTableStatusError for a missing status', () => {
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(errorNamed('InvalidTableStatusError'))
    })
})

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    const validInput = {
        number: 5,
        description: 'Terraza',
        capacity: 4,
        restaurantId: 'r1'
    }

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        it('should create a free table by default and persist it', async () => {
            const table = await service.create(validInput)

            expect(table.id).toBeDefined()
            expect(table.number).toBe(5)
            expect(table.description).toBe('Terraza')
            expect(table.capacity).toBe(4)
            expect(table.status).toBe('libre')
            expect(table.restaurantId).toBe('r1')
            expect(table.createdAt).toBeDefined()
            expect(table.updatedAt).toBe(table.createdAt)
            expect(await repo.findById(table.id)).toEqual(table)
        })

        it('should accept and normalize an explicit status', async () => {
            const table = await service.create({ ...validInput, status: ' Reservada ' })
            expect(table.status).toBe('reservada')
        })

        it('should throw InvalidTableStatusError for an invalid status', async () => {
            await expect(service.create({ ...validInput, status: 'rota' })).rejects.toThrow(errorNamed('InvalidTableStatusError'))
        })

        it('should trim the description', async () => {
            const table = await service.create({ ...validInput, description: '  Terraza  ' })
            expect(table.description).toBe('Terraza')
        })

        it.each([undefined, null, '', '   '])('should store a null description when it is %j', async (description) => {
            const table = await service.create({ ...validInput, description })
            expect(table.description).toBeNull()
        })

        it.each([undefined, null, 0, -1, 1.5, '5', NaN])('should throw InvalidTableNumberError when number is %j', async (number) => {
            await expect(service.create({ ...validInput, number })).rejects.toThrow(errorNamed('InvalidTableNumberError'))
        })

        it.each([undefined, null, 0, -2, 2.5, '4', NaN])('should throw InvalidCapacityError when capacity is %j', async (capacity) => {
            await expect(service.create({ ...validInput, capacity })).rejects.toThrow(errorNamed('InvalidCapacityError'))
        })

        it('should throw DuplicatedTableNumberError when the number exists in the restaurant', async () => {
            await service.create(validInput)
            await expect(service.create({ ...validInput, capacity: 2 })).rejects.toThrow(errorNamed('DuplicatedTableNumberError'))
        })

        it('should allow the same number in another restaurant', async () => {
            await service.create(validInput)
            const table = await service.create({ ...validInput, restaurantId: 'r2' })
            expect(table.restaurantId).toBe('r2')
        })
    })
})
