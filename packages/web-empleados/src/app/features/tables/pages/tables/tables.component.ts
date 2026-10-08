import { Component, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { TableStatus, TABLE_STATUSES } from '../../models/table.model';

@Component({
  selector: 'app-tables',
  standalone: true,
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.css'
})
export class TablesComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);

  readonly statuses = TABLE_STATUSES;
  readonly restaurantId = computed(() => this.authStore.user()?.restaurantId ?? null);

  ngOnInit(): void {
    const restaurantId = this.restaurantId();
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
  }

  changeStatus(tableId: string, event: Event): void {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return;
    const status = (event.target as HTMLSelectElement).value as TableStatus;
    this.tableStore.changeStatus(restaurantId, tableId, status);
  }

  getStatusClass(status: TableStatus): string {
    return `badge table-status-${status}`;
  }
}
