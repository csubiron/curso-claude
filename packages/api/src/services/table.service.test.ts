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

    describe('changeStatus', () => {
        const oldDate = '2020-01-01T00:00:00.000Z'

        beforeEach(async () => {
            await repo.save({
                id: 't1', number: 1, description: 'Ventana', capacity: 2, status: 'libre',
                restaurantId: 'r1', createdAt: oldDate, updatedAt: oldDate
            })
        })

        it('should change the status, refresh updatedAt and persist it', async () => {
            const updated = await service.changeStatus('r1', 't1', ' OCUPADA ')

            expect(updated).toMatchObject({ id: 't1', number: 1, description: 'Ventana', capacity: 2, status: 'ocupada', createdAt: oldDate })
            expect(updated.updatedAt).not.toBe(oldDate)
            expect(await repo.findById('t1')).toEqual(updated)
        })

        it('should accept the same status (idempotent)', async () => {
            const updated = await service.changeStatus('r1', 't1', 'libre')
            expect(updated.status).toBe('libre')
            expect(updated.updatedAt).not.toBe(oldDate)
        })

        it('should allow any transition', async () => {
            await service.changeStatus('r1', 't1', 'reservada')
            await service.changeStatus('r1', 't1', 'ocupada')
            const updated = await service.changeStatus('r1', 't1', 'libre')
            expect(updated.status).toBe('libre')
        })

        it('should throw InvalidTableStatusError for an invalid or missing status', async () => {
            await expect(service.changeStatus('r1', 't1', 'rota')).rejects.toThrow(errorNamed('InvalidTableStatusError'))
            await expect(service.changeStatus('r1', 't1', undefined)).rejects.toThrow(errorNamed('InvalidTableStatusError'))
            expect((await repo.findById('t1'))?.status).toBe('libre')
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            await expect(service.changeStatus('r1', 'unknown', 'libre')).rejects.toThrow(errorNamed('TableNotFoundError'))
            await expect(service.changeStatus('r2', 't1', 'ocupada')).rejects.toThrow(errorNamed('TableNotFoundError'))
        })
    })

    describe('findAvailable and occupy', () => {
        const now = new Date().toISOString()
        const base = { description: null, restaurantId: 'r1', createdAt: now, updatedAt: now }

        beforeEach(async () => {
            await repo.save({ ...base, id: 'big', number: 1, capacity: 8, status: 'libre' })
            await repo.save({ ...base, id: 'four-b', number: 3, capacity: 4, status: 'libre' })
            await repo.save({ ...base, id: 'four-a', number: 2, capacity: 4, status: 'libre' })
            await repo.save({ ...base, id: 'small', number: 4, capacity: 2, status: 'libre' })
            await repo.save({ ...base, id: 'busy', number: 5, capacity: 6, status: 'ocupada' })
            await repo.save({ ...base, id: 'reserved', number: 6, capacity: 6, status: 'reservada' })
            await repo.save({ ...base, id: 'other', number: 1, capacity: 6, status: 'libre', restaurantId: 'r2' })
        })

        it('should list free tables with enough capacity ordered by capacity and number', async () => {
            const tables = await service.findAvailable('r1', 3)
            expect(tables.map(t => t.id)).toEqual(['four-a', 'four-b', 'big'])
        })

        it('should return an empty list when no table fits', async () => {
            expect(await service.findAvailable('r1', 20)).toEqual([])
        })

        it.each([undefined, null, 0, -1, 2.5, '3', NaN])('should throw InvalidPeopleCountError in findAvailable when people is %j', async (people) => {
            await expect(service.findAvailable('r1', people)).rejects.toThrow(errorNamed('InvalidPeopleCountError'))
        })

        it('should occupy a free table and return it occupied', async () => {
            const table = await service.occupy('r1', 'four-a', 3)

            expect(table).toMatchObject({ id: 'four-a', number: 2, capacity: 4, status: 'ocupada' })
            expect((await repo.findById('four-a'))?.status).toBe('ocupada')
        })

        it('should throw TableNotAvailableError when the table is occupied or reserved', async () => {
            await expect(service.occupy('r1', 'busy', 2)).rejects.toThrow(errorNamed('TableNotAvailableError'))
            await expect(service.occupy('r1', 'reserved', 2)).rejects.toThrow(errorNamed('TableNotAvailableError'))
        })

        it('should throw TableNotAvailableError when the table is too small', async () => {
            await expect(service.occupy('r1', 'small', 3)).rejects.toThrow(errorNamed('TableNotAvailableError'))
            expect((await repo.findById('small'))?.status).toBe('libre')
        })

        it('should let only the first of two clients occupy the same table', async () => {
            await service.occupy('r1', 'big', 2)
            await expect(service.occupy('r1', 'big', 2)).rejects.toThrow(errorNamed('TableNotAvailableError'))
        })

        it('should throw TableNotFoundError for an unknown table or a table of another restaurant', async () => {
            await expect(service.occupy('r1', 'unknown', 2)).rejects.toThrow(errorNamed('TableNotFoundError'))
            await expect(service.occupy('r1', 'other', 2)).rejects.toThrow(errorNamed('TableNotFoundError'))
            expect((await repo.findById('other'))?.status).toBe('libre')
        })

        it.each([undefined, null, 0, 1.5, '2'])('should throw InvalidPeopleCountError in occupy when people is %j', async (people) => {
            await expect(service.occupy('r1', 'big', people)).rejects.toThrow(errorNamed('InvalidPeopleCountError'))
            expect((await repo.findById('big'))?.status).toBe('libre')
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
