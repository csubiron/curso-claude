import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Table, TableStatus } from '../models/table.model';
import { TableService } from '../services/table.service';

const ERROR_MESSAGES: Record<string, string> = {
  InvalidTableStatusError: 'El estado de la mesa no es válido',
  TableNotFoundError: 'La mesa no existe'
};

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const tables = await firstValueFrom(this.tableService.getAll(restaurantId));
      this._tables.set(tables);
    } catch (err: unknown) {
      this._error.set(this.toMessage(err, 'Error al cargar las mesas'));
    } finally {
      this._loading.set(false);
    }
  }

  async changeStatus(restaurantId: string, id: string, status: TableStatus): Promise<void> {
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.tableService.updateStatus(restaurantId, id, { status }));
      this._tables.update(tables =>
        tables.map(table => (table.id === updated.id ? updated : table))
      );
    } catch (err: unknown) {
      this._error.set(this.toMessage(err, 'Error al cambiar el estado de la mesa'));
      if (err instanceof HttpErrorResponse && err.status === 404) {
        await this.loadTables(restaurantId);
      }
    }
  }

  startPolling(restaurantId: string): void {
    this.stopPolling();
    this.loadTables(restaurantId);
    this.pollingInterval = setInterval(() => {
      this.loadTables(restaurantId);
    }, 30000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 403) {
        return 'No tienes permisos para gestionar las mesas';
      }
      const name = err.error?.error;
      if (typeof name === 'string' && ERROR_MESSAGES[name]) {
        return ERROR_MESSAGES[name];
      }
    }
    return fallback;
  }
}
