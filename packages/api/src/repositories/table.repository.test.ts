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
})
