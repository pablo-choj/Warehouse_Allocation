import { useMutation } from '@tanstack/react-query'
import { validateOrder } from './api'
import type { ValidationRequest, ValidationResponse } from './types'

export function useValidate() {
  return useMutation<ValidationResponse, Error, ValidationRequest>({
    mutationFn: (variables) => validateOrder(variables),
  })
}
