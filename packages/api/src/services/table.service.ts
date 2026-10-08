import { randomUUID } from 'crypto'
import type { Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidCapacityError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError,
    TableNotAvailableError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

export interface CreateTableDTO {
    number: unknown
    description?: unknown
    capacity: unknown
    status?: unknown
    restaurantId: string
}

export interface UpdateTableDTO {
    number: unknown
    description?: unknown
    capacity: unknown
    status?: unknown
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function normalizeDescription(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(dto: CreateTableDTO): Promise<Table> {
        const now = new Date().toISOString()
        const table = this.buildTable({
            id: randomUUID(),
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: dto.status ?? 'libre',
            restaurantId: dto.restaurantId,
            createdAt: now,
            updatedAt: now
        })

        await this.ensureNumberIsFree(table)
        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(restaurantId, id)

        const updated = this.buildTable({
            id: existing.id,
            number: dto.number,
            description: dto.description,
            capacity: dto.capacity,
            status: dto.status ?? existing.status,
            restaurantId: existing.restaurantId,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
        })

        await this.ensureNumberIsFree(updated)
        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const existing = await this.findById(restaurantId, id)
        if (existing.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    async changeStatus(restaurantId: string, id: string, status: unknown): Promise<Table> {
        const existing = await this.findById(restaurantId, id)

        const updated: Table = {
            ...existing,
            status: normalizeTableStatus(status as string),
            updatedAt: new Date().toISOString()
        }

        await this.tableRepository.save(updated)
        return updated
    }

    async findAvailable(restaurantId: string, people: unknown): Promise<Table[]> {
        this.ensureValidPeople(people)
        return this.tableRepository.findAvailable(restaurantId, people)
    }

    async occupy(restaurantId: string, id: string, people: unknown): Promise<Table> {
        this.ensureValidPeople(people)

        const occupied = await this.tableRepository.occupyIfAvailable(id, restaurantId, people)
        const table = await this.findById(restaurantId, id)
        if (!occupied) {
            throw new TableNotAvailableError()
        }
        return table
    }

    private ensureValidPeople(people: unknown): asserts people is number {
        if (!isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
    }

    async findById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    async findByRestaurantId(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurantId(restaurantId)
    }

    private async ensureNumberIsFree(table: Table): Promise<void> {
        const existing = await this.tableRepository.findByNumber(table.restaurantId, table.number)
        if (existing && existing.id !== table.id) {
            throw new DuplicatedTableNumberError()
        }
    }

    private buildTable(props: {
        id: string
        number: unknown
        description: unknown
        capacity: unknown
        status: unknown
        restaurantId: string
        createdAt: string
        updatedAt: string
    }): Table {
        if (!isPositiveInteger(props.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(props.capacity)) {
            throw new InvalidCapacityError()
        }

        return {
            id: props.id,
            number: props.number,
            description: normalizeDescription(props.description),
            capacity: props.capacity,
            status: normalizeTableStatus(props.status as string),
            restaurantId: props.restaurantId,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }
}
