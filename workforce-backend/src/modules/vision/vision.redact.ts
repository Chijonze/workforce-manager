/**
 * Screenshots of a work desktop routinely contain customer names, email
 * addresses, phone numbers and card fragments. The vision prompt already tells
 * the model not to transcribe them; this is the mechanical backstop for the
 * OCR path, where the text would otherwise be passed through verbatim.
 */
export const redactPii = (text: string) =>
  text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    // 9+ digit runs with common separators: phone numbers, card numbers, IDs.
    .replace(/\+?\d(?:[\d\s().-]{7,})\d/g, "[number]")
    .replace(/\b\d{9,}\b/g, "[number]");
