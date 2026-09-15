export function useBackOrTo() {
  const router = useRouter()
  return (fallback: string) => (router.options.history.state.back ? router.back() : navigateTo(fallback))
}
