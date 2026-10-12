# OAuth token encryption key rotation

OmniSocial encrypts provider access and refresh tokens with AES-256-GCM. Keep the dedicated `SOCIAL_OAUTH_ENCRYPTION_KEY` stable across deploys; do not derive production encryption solely from the Supabase service-role secret.

## Planned rotation

1. Generate a new base64-encoded 32-byte key and store it as `SOCIAL_OAUTH_ENCRYPTION_KEY`.
2. Keep the old dedicated key as `SOCIAL_OAUTH_ENCRYPTION_KEY_PREVIOUS` during the transition. Decryption tries the primary, previous, and legacy service-role-derived key; new encryption uses only the primary key.
3. Deploy and verify OAuth refresh/read operations before removing the previous key.
4. Do not rotate the Supabase service-role key until all tokens encrypted with its legacy derived key have been refreshed or explicitly re-encrypted. If any legacy ciphertext remains, preserve the old derived key as the previous key before rotating the service-role secret.
5. Remove `SOCIAL_OAUTH_ENCRYPTION_KEY_PREVIOUS` only after confirming no persisted tokens require it.

The previous key must be the exact old 32-byte encryption key, base64-encoded. Never log token ciphertext/plaintext or key values. A key rotation without the previous key can make persisted provider connections undecryptable.
