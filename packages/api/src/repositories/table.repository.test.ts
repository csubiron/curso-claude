import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

function buildTable(overrides: Partial<Table> = {}): Table {
    const now = new Date().toISOString()
    return {
        id: 't1',
        number: 1,
        description: 'Terraza',
        capacity: 4,
        status: 'libre',
        restaurantId: 'r1',
        createdAt: now,
        updatedAt: now,
        ...overrides
    }
}

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)

        const now = new Date().toISOString()
        for (const id of ['r1', 'r2']) {
            await db.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Restaurant ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', now, now]
            )
        }
    })

    afterAll(async () => {
        await db.close()
    })

    describe('save, findById and delete', () => {
        it('should save and find a table by id', async () => {
            await repo.save(buildTable())

            const found = await repo.findById('t1')
            expect(found).toEqual(buildTable({ createdAt: found?.createdAt, updatedAt: found?.updatedAt }))
            expect(typeof found?.number).toBe('number')
            expect(typeof found?.capacity).toBe('number')
        })

        it('should keep a null description', async () => {
            await repo.save(buildTable({ id: 't-null', number: 99, description: null }))

            const found = await repo.findById('t-null')
            expect(found?.description).toBeNull()
            await repo.delete('t-null')
        })

        it('should update an existing table', async () => {
            await repo.save(buildTable({ number: 2, description: 'Salón', capacity: 6, status: 'reservada' }))

            const found = await repo.findById('t1')
            expect(found?.number).toBe(2)
            expect(found?.description).toBe('Salón')
            expect(found?.capacity).toBe(6)
            expect(found?.status).toBe('reservada')
        })

        it('should return null for an unknown id', async () => {
            expect(await repo.findById('unknown')).toBeNull()
        })

        it('should delete a table', async () => {
            await repo.delete('t1')
            expect(await repo.findById('t1')).toBeNull()
        })
    })

    describe('findByRestaurantId and findByNumber', () => {
        beforeAll(async () => {
            await repo.save(buildTable({ id: 'list-3', number: 3, restaurantId: 'r1' }))
            await repo.save(buildTable({ id: 'list-1', number: 1, restaurantId: 'r1' }))
            await repo.save(buildTable({ id: 'list-2', number: 2, restaurantId: 'r1' }))
            await repo.save(buildTable({ id: 'list-other', number: 1, restaurantId: 'r2' }))
        })

        afterAll(async () => {
            for (const id of ['list-3', 'list-1', 'list-2', 'list-other']) {
                await repo.delete(id)
            }
        })

        it('should return only the tables of the restaurant ordered by number', async () => {
            const results = await repo.findByRestaurantId('r1')
            expect(results.map(t => t.id)).toEqual(['list-1', 'list-2', 'list-3'])
        })

        it('should return an empty list for a restaurant without tables', async () => {
            expect(await repo.findByRestaurantId('unknown')).toEqual([])
        })

        it('should find a table by restaurant and number', async () => {
            expect((await repo.findByNumber('r1', 2))?.id).toBe('list-2')
            expect((await repo.findByNumber('r2', 1))?.id).toBe('list-other')
        })

        it('should return null when the number does not exist in the restaurant', async () => {
            expect(await repo.findByNumber('r2', 3)).toBeNull()
        })
    })

    describe('findAvailable', () => {
        const ids = ['av-big', 'av-small', 'av-exact-2', 'av-exact-1', 'av-occupied', 'av-reserved', 'av-other']

        beforeAll(async () => {
            await repo.save(buildTable({ id: 'av-big', number: 10, capacity: 8 }))
            await repo.save(buildTable({ id: 'av-small', number: 11, capacity: 2 }))
            await repo.save(buildTable({ id: 'av-exact-2', number: 13, capacity: 4 }))
            await repo.save(buildTable({ id: 'av-exact-1', number: 12, capacity: 4 }))
            await repo.save(buildTable({ id: 'av-occupied', number: 14, capacity: 6, status: 'ocupada' }))
            await repo.save(buildTable({ id: 'av-reserved', number: 15, capacity: 6, status: 'reservada' }))
            await repo.save(buildTable({ id: 'av-other', number: 10, capacity: 6, restaurantId: 'r2' }))
        })

        afterAll(async () => {
            for (const id of ids) {
                await repo.delete(id)
            }
        })

        it('should return free tables with enough capacity ordered by capacity and number', async () => {
            const results = await repo.findAvailable('r1', 3)
            expect(results.map(t => t.id)).toEqual(['av-exact-1', 'av-exact-2', 'av-big'])
        })

        it('should include tables whose capacity equals the number of people', async () => {
            const results = await repo.findAvailable('r1', 2)
            expect(results.map(t => t.id)).toEqual(['av-small', 'av-exact-1', 'av-exact-2', 'av-big'])
        })

        it('should return an empty list when no table is big enough', async () => {
            expect(await repo.findAvailable('r1', 9)).toEqual([])
        })
    })

    describe('occupyIfAvailable', () => {
        const oldDate = '2020-01-01T00:00:00.000Z'

        beforeAll(async () => {
            await repo.save(buildTable({ id: 'oc-free', number: 20, capacity: 4, createdAt: oldDate, updatedAt: oldDate }))
            await repo.save(buildTable({ id: 'oc-busy', number: 21, capacity: 4, status: 'ocupada' }))
            await repo.save(buildTable({ id: 'oc-reserved', number: 22, capacity: 4, status: 'reservada' }))
            await repo.save(buildTable({ id: 'oc-small', number: 23, capacity: 2 }))
        })

        afterAll(async () => {
            for (const id of ['oc-free', 'oc-busy', 'oc-reserved', 'oc-small']) {
                await repo.delete(id)
            }
        })

        it('should return false for a table of another restaurant and leave it free', async () => {
            expect(await repo.occupyIfAvailable('oc-free', 'r2', 2)).toBe(false)
            expect((await repo.findById('oc-free'))?.status).toBe('libre')
        })

        it('should occupy a free table with enough capacity and update updatedAt', async () => {
            expect(await repo.occupyIfAvailable('oc-free', 'r1', 4)).toBe(true)
            const found = await repo.findById('oc-free')
            expect(found?.status).toBe('ocupada')
            expect(found?.updatedAt).not.toBe(oldDate)
        })

        it('should return false when the table is already occupied', async () => {
            expect(await repo.occupyIfAvailable('oc-free', 'r1', 2)).toBe(false)
            expect(await repo.occupyIfAvailable('oc-busy', 'r1', 2)).toBe(false)
        })

        it('should return false when the table is reserved', async () => {
            expect(await repo.occupyIfAvailable('oc-reserved', 'r1', 2)).toBe(false)
            expect((await repo.findById('oc-reserved'))?.status).toBe('reservada')
        })

        it('should return false when the table is too small', async () => {
            expect(await repo.occupyIfAvailable('oc-small', 'r1', 3)).toBe(false)
            expect((await repo.findById('oc-small'))?.status).toBe('libre')
        })

        it('should return false for an unknown table', async () => {
            expect(await repo.occupyIfAvailable('unknown', 'r1', 1)).toBe(false)
        })
    })
})
