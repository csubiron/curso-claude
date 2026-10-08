import { Component, inject, OnInit, signal, computed } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { TableService } from '../../core/services/table.service'
import { RestaurantService } from '../../core/services/restaurant.service'
import { CartStore } from '../../core/store/cart.store'
import { Table } from '../../core/models/table.model'
import { Restaurant } from '../../core/models/restaurant.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>{{ restaurant()?.name || 'Elige tu mesa' }}</h1>
          <p>Indica cuántas personas sois para ver las mesas disponibles</p>
        </div>
      </div>

      @if (currentTable(); as table) {
        <div class="card current-table">
          <p>
            Ya tienes la <strong>Mesa {{ table.number }}</strong> en este restaurante.
          </p>
          <button class="btn btn-primary" (click)="goToMenu()">Continuar a la carta</button>
        </div>
      } @else {
        <form class="card people-form" (submit)="search($event)">
          <label for="people">Número de personas</label>
          <div class="people-row">
            <input
              id="people"
              type="number"
              min="1"
              step="1"
              [value]="peopleInput()"
              (input)="onPeopleInput($event)"
            />
            <button type="submit" class="btn btn-primary" [disabled]="loading()">
              Buscar mesas
            </button>
          </div>
          @if (formError()) {
            <p class="error-msg">{{ formError() }}</p>
          }
        </form>

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        @if (loading()) {
          <div class="spinner"></div>
        } @else if (searchedPeople() !== null) {
          @if (tables().length === 0) {
            <div class="empty-state card">
              <p>No hay mesas disponibles para {{ searchedPeople() }} personas</p>
            </div>
          } @else {
            <div class="tables-grid">
              @for (table of tables(); track table.id) {
                <button
                  type="button"
                  class="table-card card"
                  [class.selected]="selectedTableId() === table.id"
                  (click)="selectTable(table.id)"
                >
                  <span class="table-number">Mesa {{ table.number }}</span>
                  <span class="table-capacity">Hasta {{ table.capacity }} personas</span>
                  @if (table.description) {
                    <span class="table-description">{{ table.description }}</span>
                  }
                </button>
              }
            </div>

            <div class="actions">
              <button
                class="btn btn-primary"
                [disabled]="!selectedTable() || occupying()"
                (click)="continue()"
              >
                @if (occupying()) {
                  Reservando...
                } @else {
                  Continuar
                }
              </button>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [
    `
      .container {
        max-width: 900px;
        margin: 0 auto;
      }
      .back-link {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 8px;
        display: inline-block;
      }
      .current-table,
      .people-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 20px;
        margin-bottom: 24px;
      }
      .current-table .btn {
        align-self: flex-start;
      }
      .people-form label {
        font-weight: 600;
        color: var(--text-secondary);
      }
      .people-row {
        display: flex;
        gap: 12px;
      }
      .people-row input {
        width: 120px;
        padding: 8px 12px;
        background: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
      }
      .tables-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
      }
      .table-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 20px;
        text-align: left;
        color: var(--text-primary);
        cursor: pointer;
        transition: all var(--transition);
      }
      .table-card:hover {
        border-color: var(--green-medium);
      }
      .table-card.selected {
        border-color: var(--green-light);
        background: var(--green-glow);
      }
      .table-number {
        font-size: 16px;
        font-weight: 600;
      }
      .table-capacity {
        color: var(--text-secondary);
        font-size: 13px;
      }
      .table-description {
        color: var(--text-muted);
        font-size: 13px;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 24px;
      }
      .error-msg {
        color: var(--red);
        font-size: 13px;
      }
    `,
  ],
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly restaurantService = inject(RestaurantService)
  private readonly cartStore = inject(CartStore)

  private restaurantId = ''

  readonly restaurant = signal<Restaurant | null>(null)
  readonly tables = signal<Table[]>([])
  readonly peopleInput = signal('2')
  readonly searchedPeople = signal<number | null>(null)
  readonly selectedTableId = signal<string | null>(null)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly error = signal<string | null>(null)
  readonly formError = signal<string | null>(null)

  readonly selectedTable = computed(
    () => this.tables().find((table) => table.id === this.selectedTableId()) ?? null,
  )

  readonly currentTable = computed(() => {
    const table = this.cartStore.table()
    return table && table.restaurantId === this.restaurantId ? table : null
  })

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    this.restaurantService.getById(this.restaurantId).subscribe({
      next: (restaurant) => this.restaurant.set(restaurant),
      error: () => {},
    })
  }

  onPeopleInput(event: Event): void {
    this.peopleInput.set((event.target as HTMLInputElement).value)
  }

  search(event?: Event): void {
    event?.preventDefault()
    const people = Number(this.peopleInput())
    if (!Number.isInteger(people) || people < 1) {
      this.formError.set('Indica un número entero de personas (1 o más)')
      return
    }
    this.formError.set(null)
    this.loadTables(people)
  }

  selectTable(tableId: string): void {
    this.selectedTableId.set(tableId)
  }

  continue(): void {
    const table = this.selectedTable()
    const people = this.searchedPeople()
    if (!table || people === null) return

    this.occupying.set(true)
    this.error.set(null)

    this.tableService.occupy(this.restaurantId, table.id, people).subscribe({
      next: (occupied) => {
        this.cartStore.setTable(this.restaurantId, occupied)
        this.occupying.set(false)
        this.goToMenu()
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        this.handleOccupyError(err, people)
      },
    })
  }

  goToMenu(): void {
    this.router.navigate(['/restaurants', this.restaurantId])
  }

  private loadTables(people: number): void {
    this.loading.set(true)
    this.error.set(null)
    this.selectedTableId.set(null)

    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedPeople.set(people)
        this.loading.set(false)
      },
      error: (err: HttpErrorResponse) => {
        this.tables.set([])
        this.searchedPeople.set(null)
        this.error.set(
          err.error?.error === 'InvalidPeopleCountError'
            ? 'El número de personas no es válido'
            : 'Error al cargar las mesas',
        )
        this.loading.set(false)
      },
    })
  }

  private handleOccupyError(err: HttpErrorResponse, people: number): void {
    const errorName = err.error?.error
    if (errorName === 'TableNotAvailableError' || errorName === 'TableNotFoundError') {
      this.loadTables(people)
      this.error.set('Esa mesa ya no está disponible')
      return
    }
    if (err.status === 403) {
      this.error.set('Solo los clientes pueden reservar mesa')
      return
    }
    if (errorName === 'InvalidPeopleCountError') {
      this.error.set('El número de personas no es válido')
      return
    }
    this.error.set('No se ha podido reservar la mesa. Inténtalo de nuevo.')
  }
}
