import { errorMessage } from '~/utils/apiError'

type FailToast = (title: string, err: unknown, fallback: string, retry?: () => unknown) => void

export function useFailToast(): FailToast {
  const toast = useToast()
  return (title, err, fallback, retry) => {
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
