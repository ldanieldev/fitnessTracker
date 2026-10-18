import { errorMessage } from '~/utils/apiError'
import { reportFailure } from '~/utils/reportFailure'

type FailToast = (title: string, err: unknown, fallback: string, retry?: () => unknown) => void

export function useFailToast(): FailToast {
  const toast = useToast()
  return (title, err, fallback, retry) => {
    reportFailure(err, title)
    toast.add({
      title,
      description: errorMessage(err, fallback),
      color: 'error',
      actions: retry
        ? [
            {
              label: 'Retry',
              onClick: () => {
                retry()
              }
            }
          ]
        : undefined
    })
  }
}
