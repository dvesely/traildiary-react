export function uuidv7(): string {
  const now = Date.now()

  const timeHex = now.toString(16).padStart(12, '0')

  const random = new Uint8Array(10)
  crypto.getRandomValues(random)

  // Set version 7 (0111) in the high nibble of byte 6
  random[0] = (random[0] & 0x0f) | 0x70
  // Set variant 10xx in byte 8
  random[2] = (random[2] & 0x3f) | 0x80

  const hex = Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('')

  return [
    timeHex.slice(0, 8),
    timeHex.slice(8, 12) + hex.slice(0, 2) + hex.slice(2, 4),
    hex.slice(4, 8),
    hex.slice(8, 12),
    hex.slice(12, 20),
  ].join('')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}
