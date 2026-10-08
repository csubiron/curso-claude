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

    describe('update', () => {
        const oldDate = '2020-01-01T00:00:00.000Z'

        beforeEach(async () => {
            await repo.save({
                id: 't1', number: 1, description: 'Ventana', capacity: 2, status: 'reservada',
                restaurantId: 'r1', createdAt: oldDate, updatedAt: oldDate
            })
            await repo.save({
                id: 't2', number: 2, description: null, capacity: 4, status: 'libre',
                restaurantId: 'r1', createdAt: oldDate, updatedAt: oldDate
            })
        })

        it('should replace number, description and capacity and refresh updatedAt', async () => {
            const updated = await service.update('r1', 't1', { number: 7, description: ' Terraza ', capacity: 6, status: 'ocupada' })

            expect(updated).toMatchObject({ id: 't1', number: 7, description: 'Terraza', capacity: 6, status: 'ocupada', restaurantId: 'r1', createdAt: oldDate })
            expect(updated.updatedAt).not.toBe(oldDate)
            expect(await repo.findById('t1')).toEqual(updated)
        })

        it('should keep the current status when status is missing', async () => {
            const updated = await service.update('r1', 't1', { number: 1, capacity: 2 })
            expect(updated.status).toBe('reservada')
        })

        it('should store a null description when it is missing', async () => {
            const updated = await service.update('r1', 't1', { number: 1, capacity: 2 })
            expect(updated.description).toBeNull()
        })

        it('should allow keeping its own number', async () => {
            const updated = await service.update('r1', 't1', { number: 1, capacity: 3 })
            expect(updated.capacity).toBe(3)
        })

        it('should throw DuplicatedTableNumberError when the number belongs to another table', async () => {
            await expect(service.update('r1', 't1', { number: 2, capacity: 2 })).rejects.toThrow(errorNamed('DuplicatedTableNumberError'))
        })

        it('should validate number, capacity and status', async () => {
            await expect(service.update('r1', 't1', { number: '1', capacity: 2 })).rejects.toThrow(errorNamed('InvalidTableNumberError'))
            await expect(service.update('r1', 't1', { number: 1, capacity: 0 })).rejects.toThrow(errorNamed('InvalidCapacityError'))
            await expect(service.update('r1', 't1', { number: 1, capacity: 2, status: 'rota' })).rejects.toThrow(errorNamed('InvalidTableStatusError'))
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            await expect(service.update('r1', 'unknown', { number: 1, capacity: 2 })).rejects.toThrow(errorNamed('TableNotFoundError'))
            await expect(service.update('r2', 't1', { number: 1, capacity: 2 })).rejects.toThrow(errorNamed('TableNotFoundError'))
        })
    })

    describe('delete', () => {
        const now = new Date().toISOString()

        beforeEach(async () => {
            await repo.save({ id: 'free', number: 1, description: null, capacity: 2, status: 'libre', restaurantId: 'r1', createdAt: now, updatedAt: now })
            await repo.save({ id: 'reserved', number: 2, description: null, capacity: 2, status: 'reservada', restaurantId: 'r1', createdAt: now, updatedAt: now })
            await repo.save({ id: 'busy', number: 3, description: null, capacity: 2, status: 'ocupada', restaurantId: 'r1', createdAt: now, updatedAt: now })
        })

        it('should delete free and reserved tables', async () => {
            await service.delete('r1', 'free')
            await service.delete('r1', 'reserved')
            expect(await repo.findById('free')).toBeNull()
            expect(await repo.findById('reserved')).toBeNull()
        })

        it('should throw TableOccupiedError for an occupied table and keep it', async () => {
            await expect(service.delete('r1', 'busy')).rejects.toThrow(errorNamed('TableOccupiedError'))
            expect(await repo.findById('busy')).not.toBeNull()
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            await expect(service.delete('r1', 'unknown')).rejects.toThrow(errorNamed('TableNotFoundError'))
            await expect(service.delete('r2', 'free')).rejects.toThrow(errorNamed('TableNotFoundError'))
            expect(await repo.findById('free')).not.toBeNull()
        })
    })

    describe('findById and findByRestaurantId', () => {
        beforeEach(async () => {
            await service.create({ ...validInput, number: 3 })
            await service.create({ ...validInput, number: 1 })
            await service.create({ ...validInput, number: 2, restaurantId: 'r2' })
        })

        it('should list the tables of a restaurant ordered by number', async () => {
            const tables = await service.findByRestaurantId('r1')
            expect(tables.map(t => t.number)).toEqual([1, 3])
        })

        it('should find a table of the restaurant', async () => {
            const [first] = await service.findByRestaurantId('r1')
            const found = await service.findById('r1', first!.id)
            expect(found).toEqual(first)
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            const [first] = await service.findByRestaurantId('r1')
            await expect(service.findById('r1', 'unknown')).rejects.toThrow(errorNamed('TableNotFoundError'))
            await expect(service.findById('r2', first!.id)).rejects.toThrow(errorNamed('TableNotFoundError'))
        })
    })
})
