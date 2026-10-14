export interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
}

export function verifiedPrimaryEmail(emails: GitHubEmail[]): string | null {
  const primary = emails.find((e) => e.primary)
  return primary?.verified ? primary.email : null
}

export function fetchGitHubEmails(accessToken: string): Promise<GitHubEmail[]> {
  return $fetch<GitHubEmail[]>('https://api.github.com/user/emails', {
    headers: { 'User-Agent': 'My-Fitness-Journal', Authorization: `token ${accessToken}` }
  })
}
