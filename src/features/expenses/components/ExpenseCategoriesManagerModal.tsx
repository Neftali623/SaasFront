import { useId, useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { ExpenseCategory } from '../types'
import { validateExpenseCategoryName } from '../utils/expensesValidation'

export interface ExpenseCategoriesManagerModalProps {
  categories: ExpenseCategory[]
  isOpen: boolean
  onClose: () => void
  onSaveCategory: (params: {
    id?: string
    name: string
  }) => { ok: true } | { ok: false; error: string }
  onToggleCategoryStatus: (categoryId: string) => { ok: true } | { ok: false; error: string }
}

export function ExpenseCategoriesManagerModal({
  categories,
  isOpen,
  onClose,
  onSaveCategory,
  onToggleCategoryStatus,
}: ExpenseCategoriesManagerModalProps) {
  const titleId = useId()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleStartCreate = () => {
    setEditingId(null)
    setName('')
    setFormError(null)
    setSuccessMessage(null)
  }

  const handleStartEdit = (category: ExpenseCategory) => {
    setEditingId(category.id)
    setName(category.name)
    setFormError(null)
    setSuccessMessage(null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSuccessMessage(null)

    const valErr = validateExpenseCategoryName(name, categories, editingId ?? undefined)
    if (valErr) {
      setFormError(valErr)
      return
    }

    const res = onSaveCategory({
      id: editingId ?? undefined,
      name: name.trim(),
    })

    if (!res.ok) {
      setFormError(res.error)
      return
    }

    setSuccessMessage(
      editingId ? 'Categoría actualizada exitosamente.' : 'Categoría creada exitosamente.',
    )
    setName('')
    setEditingId(null)
  }

  const handleToggle = (categoryId: string) => {
    setFormError(null)
    setSuccessMessage(null)
    const res = onToggleCategoryStatus(categoryId)
    if (!res.ok) {
      setFormError(res.error)
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="modal-dialog modal-dialog--wide">
        <header className="modal-dialog__header">
          <div>
            <h2 id={titleId} className="modal-dialog__title">
              Administrar categorías de gastos
            </h2>
            <p className="modal-dialog__subtitle">
              Crea o edita las categorías para clasificar egresos operativos. Las
              categorías no se eliminan para no desvincular gastos históricos.
            </p>
          </div>
          <button
            type="button"
            className="modal-dialog__close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </header>

        <div className="modal-dialog__body modal-dialog__body--split">
          {/* Formulario lateral */}
          <div className="category-manager__form-col">
            <h3 className="category-manager__subheading">
              {editingId ? 'Editar categoría' : 'Nueva categoría'}
            </h3>
            <form onSubmit={handleSubmit} className="category-manager__form">
              <Input
                label="Nombre de la categoría"
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Servicios e insumos"
                required
              />

              {formError && (
                <div className="form-feedback form-feedback--error" role="alert">
                  {formError}
                </div>
              )}

              {successMessage && (
                <div className="form-feedback form-feedback--success" role="status">
                  {successMessage}
                </div>
              )}

              <div className="category-manager__form-actions">
                <Button type="submit" variant="primary">
                  {editingId ? 'Guardar cambios' : 'Crear categoría'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleStartCreate}
                  >
                    Cancelar edición
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Listado de categorías */}
          <div className="category-manager__list-col">
            <h3 className="category-manager__subheading">
              Categorías registradas ({categories.length})
            </h3>
            <div className="category-manager__list">
              {categories.length === 0 ? (
                <p className="empty-state-text">No hay categorías configuradas.</p>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`category-item-card ${
                      editingId === cat.id ? 'category-item-card--active' : ''
                    }`}
                  >
                    <div className="category-item-card__header">
                      <div className="category-item-card__title-row">
                        <strong className="category-item-card__name">{cat.name}</strong>
                        <Badge variant={cat.isActive ? 'success' : 'neutral'}>
                          {cat.isActive ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </div>
                    <div className="category-item-card__actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEdit(cat)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggle(cat.id)}
                      >
                        {cat.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <footer className="modal-dialog__actions">
          <Button type="button" variant="primary" onClick={onClose}>
            Listo
          </Button>
        </footer>
      </div>
    </div>
  )
}
