import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ValidationResult } from './ValidationResult'
import { useValidate } from './useValidate'
import type { ValidationRequest } from './types'

const defaultPayload: ValidationRequest = {
  orderId: '',
  customerId: '',
  amount: 0,
  currency: 'USD',
}

const samplePayload: ValidationRequest = {
  orderId: 'PO-DEMO-001',
  customerId: 'CUST-ACME',
  amount: 125000,
  currency: 'USD',
}

export function ValidationForm() {
  const [payload, setPayload] = useState<ValidationRequest>(() => ({ ...defaultPayload }))
  const { mutate, data, error, isPending, reset } = useValidate()

  function handleChange(field: keyof ValidationRequest, value: string) {
    setPayload((prev) => {
      if (field === 'amount') {
        return { ...prev, amount: Number(value) || 0 }
      }
      return { ...prev, [field]: value }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutate(payload)
  }

  function handleReset() {
    setPayload({ ...defaultPayload })
    reset()
  }

  function handleDemoSubmit() {
    mutate(samplePayload)
  }

  return (
    <div className="validation-form">
      <form className="validation-form__panel" onSubmit={handleSubmit}>
        <header>
          <p className="validation-form__eyebrow">Solicitud</p>
          <h2>Pedido a validar</h2>
        </header>

        <Input
          label="Order ID"
          name="orderId"
          placeholder="PO-123456"
          required
          value={payload.orderId}
          onChange={(event) => handleChange('orderId', event.target.value)}
        />

        <Input
          label="Customer ID"
          name="customerId"
          placeholder="CUST-90001"
          required
          value={payload.customerId}
          onChange={(event) => handleChange('customerId', event.target.value)}
        />

        <div className="validation-form__grid">
          <Input
            label="Amount"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            required
            value={payload.amount}
            onChange={(event) => handleChange('amount', event.target.value)}
          />

          <Input
            label="Currency"
            name="currency"
            maxLength={3}
            value={payload.currency}
            onChange={(event) => handleChange('currency', event.target.value.toUpperCase())}
          />
        </div>

        <div className="validation-form__actions">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Validando…' : 'Validar pedido'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleDemoSubmit} disabled={isPending}>
            Enviar payload demo
          </Button>
          <Button type="button" variant="ghost" onClick={handleReset} disabled={isPending}>
            Limpiar
          </Button>
        </div>
      </form>

      <ValidationResult result={data} error={error} isLoading={isPending} />
    </div>
  )
}
