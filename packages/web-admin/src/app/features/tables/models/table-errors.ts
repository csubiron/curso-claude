import type { HttpErrorResponse } from '@angular/common/http'

const TABLE_ERROR_MESSAGES: Record<string, string> = {
  DuplicatedTableNumberError: 'Ya existe una mesa con ese número en este restaurante.',
  InvalidTableNumberError: 'El número de mesa debe ser un entero mayor o igual que 1.',
  InvalidCapacityError: 'La capacidad debe ser un entero mayor o igual que 1.',
  InvalidTableStatusError: 'El estado de la mesa no es válido.',
  TableNotFoundError: 'La mesa no existe.',
  TableOccupiedError: 'No se puede borrar una mesa ocupada.'
}

export function getTableErrorMessage(err: unknown, fallback: string): string {
  const httpError = err as Partial<HttpErrorResponse> | null
  if (httpError?.status === 403) {
    return 'No tienes permisos para realizar esta acción.'
  }
  const errorName: unknown = httpError?.error?.error
  if (typeof errorName === 'string' && TABLE_ERROR_MESSAGES[errorName]) {
    return TABLE_ERROR_MESSAGES[errorName]
  }
  return fallback
}

export function getTableErrorName(err: unknown): string | null {
  const errorName: unknown = (err as Partial<HttpErrorResponse> | null)?.error?.error
  return typeof errorName === 'string' ? errorName : null
}
