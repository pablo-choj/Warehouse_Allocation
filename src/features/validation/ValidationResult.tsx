import { DecisionCard } from '../../components/DecisionCard'
import type { DecisionState } from '../../components/DecisionCard'
import type { ValidationResponse } from './types'

export type ValidationResultProps = {
  result?: ValidationResponse
  isLoading?: boolean
  error?: Error | null
}

export function ValidationResult({ result, isLoading, error }: ValidationResultProps) {
  if (isLoading) {
    return (
      <section className="validation-result validation-result--loading">
        <p>Procesando validación con Foundry y Proxy...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="validation-result">
        <DecisionCard
          status="error"
          title="No pudimos validar el pedido"
          description={error.message}
        />
      </section>
    )
  }

  if (!result) {
    return (
      <section className="validation-result validation-result--empty">
        <p>Envía un pedido para ver la comparación Foundry vs Proxy.</p>
      </section>
    )
  }

  const permissionStatus: DecisionState = result.allowed ? 'approved' : 'rejected'

  return (
    <section className="validation-result">
      <DecisionCard
        status={permissionStatus}
        title={result.allowed ? 'Permitido' : 'Bloqueado'}
        description={result.reason}
        meta={
          <dl>
            <dt>Autorización requerida</dt>
            <dd>{result.authorizationRequired ? 'Sí' : 'No'}</dd>
          </dl>
        }
      />

      <header className="validation-result__header">
        <div>
          <p className="validation-result__eyebrow">Tracking</p>
          <h2>Correlation {result.correlationId}</h2>
        </div>
        <p className="validation-result__timestamp">
          {new Date(result.completedAt).toLocaleString()}
        </p>
      </header>
      {result.decisions && result.decisions.length > 0 && (
        <div className="validation-result__grid">
          {result.decisions.map((decision) => (
            <DecisionCard
              key={`${decision.source}-${decision.referenceId ?? decision.summary}`}
              status={decision.state}
              title={`${decision.source.toUpperCase()} · ${(decision.confidence * 100).toFixed(0)}%`}
              description={decision.summary}
              meta={
                decision.referenceId ? (
                  <dl>
                    <dt>Referencia</dt>
                    <dd>{decision.referenceId}</dd>
                    {typeof decision.latencyMs === 'number' && (
                      <>
                        <dt>Latency</dt>
                        <dd>{decision.latencyMs} ms</dd>
                      </>
                    )}
                  </dl>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {result.warnings && result.warnings.length > 0 && (
        <ul className="validation-result__warnings">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
