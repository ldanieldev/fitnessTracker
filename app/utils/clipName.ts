export const clipName = (name: string) => (name.length > 32 ? `${name.slice(0, 31)}…` : name)
