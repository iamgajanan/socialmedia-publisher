# OAuth token key-rotation acceptance

This acceptance uses the dedicated `SOCIAL_OAUTH_ENCRYPTION_KEY` as the only encryption key for new ciphertext. The compatibility decryptor supports existing ciphertext encrypted with the previous or legacy key so records can be re-encrypted without revoking provider sessions.

The one-time guarded endpoint at `/api/ops/oauth-key-rotation-acceptance` is protected by the temporary `OAUTH_TOKEN_ROTATION_SECRET`. A POST with no action re-encrypts each stored access/refresh token using the primary key and performs read-only profile checks for connected accounts. A POST body of `{"action":"analytics-sync"}` runs a controlled sync for each profile and records normal `socialmedia_analytics_sync_runs` evidence. It never returns plaintext or ciphertext token material and does not publish posts. After acceptance, remove the endpoint and blank the temporary secret.

Provider API acceptance is reported per connected account. A missing LinkedIn analytics permission is treated as a documented capability warning rather than a false failed sync; analytics metrics remain unavailable until LinkedIn grants the scope. X refresh-token rotations must persist the replacement refresh token to avoid invalidating future refresh attempts.
