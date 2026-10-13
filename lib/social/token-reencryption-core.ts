export type EncryptedOAuthTokenPair = {
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
};

export type TokenCipher = {
  decrypt: (ciphertext: string) => string;
  encrypt: (plaintext: string) => string;
};

export function reencryptOAuthTokenPair(
  pair: EncryptedOAuthTokenPair,
  cipher: TokenCipher,
): Partial<EncryptedOAuthTokenPair> {
  const updated: Partial<EncryptedOAuthTokenPair> = {};
  if (pair.access_token_ciphertext) {
    updated.access_token_ciphertext = cipher.encrypt(cipher.decrypt(pair.access_token_ciphertext));
  }
  if (pair.refresh_token_ciphertext) {
    updated.refresh_token_ciphertext = cipher.encrypt(cipher.decrypt(pair.refresh_token_ciphertext));
  }
  return updated;
}
