import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { errorHandler } from './errorHandler.js'
import * as DomainErrors from '@errors/DomainErrors.js'

function createResponse() {
    const res = {
        status: vi.fn(),
        json: vi.fn()
    }
    res.status.mockReturnValue(res)
    return res
}

function handle(error: unknown) {
    const res = createResponse()
    errorHandler(error, {} as Request, res as unknown as Response, (() => {}) as NextFunction)
    return res
}

describe('errorHandler', () => {
    it('should map TableNotFoundError to 404', () => {
        const ErrorClass = (DomainErrors as Record<string, new () => Error>)['TableNotFoundError']
        expect(ErrorClass).toBeDefined()

        const res = handle(new ErrorClass!())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'TableNotFoundError', message: expect.any(String) })
    })

    it('should map TableOccupiedError to 400', () => {
        const ErrorClass = (DomainErrors as Record<string, new () => Error>)['TableOccupiedError']
        expect(ErrorClass).toBeDefined()

        const res = handle(new ErrorClass!())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: 'TableOccupiedError', message: expect.any(String) })
    })
})
