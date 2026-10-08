import { Component, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { TableStatus, TABLE_STATUSES } from '../../models/table.model';
import { OrderStore } from '../../../orders/store/order.store';
import { Order, OrderStatus } from '../../../orders/models/order.model';

@Component({
  selector: 'app-tables',
  standalone: true,
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.css'
})
export class TablesComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);

  readonly statuses = TABLE_STATUSES;
  readonly restaurantId = computed(() => this.authStore.user()?.restaurantId ?? null);

  readonly ordersByTable = computed(() => {
    const occupiedIds = new Set(
      this.tableStore.tables()
        .filter(table => table.status === 'ocupada')
        .map(table => table.id)
    );
    const grouped = new Map<string, Order[]>();
    for (const order of this.orderStore.orders()) {
      if (order.tableId && occupiedIds.has(order.tableId)) {
        grouped.set(order.tableId, [...(grouped.get(order.tableId) ?? []), order]);
      }
    }
    return grouped;
  });

  ngOnInit(): void {
    const restaurantId = this.restaurantId();
    if (restaurantId) {
      this.tableStore.startPolling(restaurantId);
      this.orderStore.startPolling(restaurantId);
    }
  }

  ngOnDestroy(): void {
    this.tableStore.stopPolling();
    this.orderStore.stopPolling();
  }

  ordersFor(tableId: string): Order[] {
    return this.ordersByTable().get(tableId) ?? [];
  }

  getOrderStatusClass(status: OrderStatus): string {
    return `badge badge-${status}`;
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
