import { useState, type FormEvent } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Input } from '../../../components/ui/Input'
import type { Product, ProductCategory } from '../types'
import { cleanCategoryName, validateCategoryName } from '../utils/validation'

export interface CategoriesManagerPanelProps {
  organizationName: string
  categories: ProductCategory[]
  products: Product[]
  onCreateCategory: (name: string) => { ok: boolean; error?: string }
  onRenameCategory: (
    categoryId: string,
    newName: string,
  ) => { ok: boolean; error?: string }
  onToggleCategoryStatus: (
    category: ProductCategory,
  ) => { ok: boolean; error?: string }
  onBackToCatalog: () => void
}

export function CategoriesManagerPanel({
  organizationName,
  categories,
  products,
  onCreateCategory,
  onRenameCategory,
  onToggleCategoryStatus,
  onBackToCatalog,
}: CategoriesManagerPanelProps) {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryError, setNewCategoryError] = useState<string | undefined>(
    undefined,
  )

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  )
  const [editingName, setEditingName] = useState('')
  const [editingError, setEditingError] = useState<string | undefined>(
    undefined,
  )

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const countProductsForCategory = (categoryId: string): number => {
    return products.filter((prod) => prod.categoryId === categoryId).length
  }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback(null)

    const validationError = validateCategoryName(newCategoryName, categories)
    if (validationError) {
      setNewCategoryError(validationError)
      return
    }

    const cleanName = cleanCategoryName(newCategoryName)
    const outcome = onCreateCategory(cleanName)
    if (!outcome.ok) {
      setNewCategoryError(
        outcome.error ?? 'No se pudo guardar la nueva categoría.',
      )
      return
    }

    setNewCategoryName('')
    setNewCategoryError(undefined)
    setFeedback({
      type: 'success',
      message: `Categoría "${cleanName}" creada para ${organizationName}.`,
    })
  }

  const startRenaming = (category: ProductCategory) => {
    setEditingCategoryId(category.id)
    setEditingName(category.name)
    setEditingError(undefined)
    setFeedback(null)
  }

  const cancelRenaming = () => {
    setEditingCategoryId(null)
    setEditingName('')
    setEditingError(undefined)
  }

  const handleRenameSubmit = (
    event: FormEvent<HTMLFormElement>,
    category: ProductCategory,
  ) => {
    event.preventDefault()
    setFeedback(null)

    const validationError = validateCategoryName(
      editingName,
      categories,
      category.id,
    )
    if (validationError) {
      setEditingError(validationError)
      return
    }

    const cleanName = cleanCategoryName(editingName)
    const outcome = onRenameCategory(category.id, cleanName)
    if (!outcome.ok) {
      setEditingError(
        outcome.error ?? 'No se pudo renombrar la categoría.',
      )
      return
    }

    setEditingCategoryId(null)
    setEditingName('')
    setEditingError(undefined)
    setFeedback({
      type: 'success',
      message: `Categoría renombrada a "${cleanName}".`,
    })
  }

  const handleToggleStatus = (category: ProductCategory) => {
    setFeedback(null)
    const outcome = onToggleCategoryStatus(category)
    if (!outcome.ok) {
      setFeedback({
        type: 'error',
        message:
          outcome.error ??
          'No se pudo actualizar el estado de la categoría.',
      })
      return
    }

    const nextStatusLabel =
      category.status === 'active' ? 'desactivada' : 'reactivada'
    setFeedback({
      type: 'success',
      message: `Categoría "${category.name}" ${nextStatusLabel}.`,
    })
  }

  return (
    <div className="categories-manager-stack">
      <Card
        as="section"
        title={`Nueva categoría en ${organizationName}`}
        subtitle="Las categorías son propias de cada negocio y no permiten duplicados equivalentes por mayúsculas o espacios"
        headerAction={
          <Button variant="outline" size="sm" onClick={onBackToCatalog}>
            Volver al listado de productos
          </Button>
        }
      >
        <form
          onSubmit={handleCreateSubmit}
          className="category-create-form"
          noValidate
        >
          <div className="category-create-form__input">
            <Input
              label="Nombre de la categoría *"
              value={newCategoryName}
              onChange={(event) => {
                setNewCategoryName(event.target.value)
                if (newCategoryError) {
                  setNewCategoryError(undefined)
                }
              }}
              placeholder="Ej. Papelería escolar, Bebidas calientes, Insumos"
              helpText="Entre 2 y 60 caracteres. Estará disponible de inmediato para asignar a productos."
              error={newCategoryError}
              maxLength={65}
            />
          </div>
          <div className="category-create-form__action">
            <Button type="submit" variant="primary">
              Crear categoría
            </Button>
          </div>
        </form>
      </Card>

      {feedback ? (
        <div
          className={`settings-feedback settings-feedback--${feedback.type}`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      <Card
        as="section"
        title={`Categorías registradas (${categories.length})`}
        subtitle="Las categorías inactivas conservan sus productos históricos asociados, pero no pueden asignarse a productos nuevos"
      >
        {categories.length === 0 ? (
          <EmptyState
            title="Aún no hay categorías en este negocio"
            description="Crea tu primera categoría arriba para clasificar los productos del catálogo."
          />
        ) : (
          <ul className="categories-list" aria-label="Categorías del negocio">
            {categories.map((category) => {
              const linkedCount = countProductsForCategory(category.id)
              const isRenaming = editingCategoryId === category.id

              return (
                <li
                  key={category.id}
                  className={`categories-list__item ${
                    category.status === 'inactive'
                      ? 'categories-list__item--inactive'
                      : ''
                  }`}
                >
                  {isRenaming ? (
                    <form
                      onSubmit={(event) => handleRenameSubmit(event, category)}
                      className="category-rename-form"
                      noValidate
                    >
                      <div className="category-rename-form__field">
                        <Input
                          label={`Renombrar "${category.name}"`}
                          value={editingName}
                          onChange={(event) => {
                            setEditingName(event.target.value)
                            if (editingError) {
                              setEditingError(undefined)
                            }
                          }}
                          error={editingError}
                          maxLength={65}
                          autoFocus
                        />
                      </div>
                      <div className="category-rename-form__actions">
                        <Button type="submit" variant="primary" size="sm">
                          Guardar nombre
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={cancelRenaming}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="categories-list__main">
                        <div className="categories-list__title-row">
                          <span className="categories-list__name">
                            {category.name}
                          </span>
                          <Badge
                            variant={
                              category.status === 'active'
                                ? 'success'
                                : 'neutral'
                            }
                          >
                            {category.status === 'active'
                              ? 'Activa'
                              : 'Inactiva'}
                          </Badge>
                        </div>
                        <span className="categories-list__meta">
                          {linkedCount}{' '}
                          {linkedCount === 1
                            ? 'producto asociado'
                            : 'productos asociados'}
                          {category.status === 'inactive'
                            ? ' · No elegible para nuevas asignaciones'
                            : ''}
                        </span>
                      </div>

                      <div className="categories-list__actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startRenaming(category)}
                        >
                          Renombrar
                        </Button>
                        <Button
                          variant={
                            category.status === 'active' ? 'ghost' : 'secondary'
                          }
                          size="sm"
                          onClick={() => handleToggleStatus(category)}
                        >
                          {category.status === 'active'
                            ? 'Desactivar'
                            : 'Activar'}
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

