export const PASSWORD_MIN_CHARACTERS = 12
export const PASSWORD_MAX_UTF8_BYTES = 72
export const PASSWORD_POLICY_MESSAGE =
  `Use at least ${PASSWORD_MIN_CHARACTERS} characters and no more than ${PASSWORD_MAX_UTF8_BYTES} UTF-8 bytes.`

export function validateNewPassword(password: string) {
  const characterCount = Array.from(password).length
  const utf8Bytes = new TextEncoder().encode(password).length
  return {
    valid: characterCount >= PASSWORD_MIN_CHARACTERS && utf8Bytes <= PASSWORD_MAX_UTF8_BYTES,
    characterCount,
    utf8Bytes,
  }
}

