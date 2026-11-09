// Supabase ve ağ hatalarını sakin, Türkçe cümlelere çevirir.

type MaybeError = { message?: string; code?: string; status?: number } | null | undefined;

export function friendlyError(error: unknown, fallback = 'Bir şeyler ters gitti. Biraz sonra tekrar dene.') {
  const e = error as MaybeError;
  const msg = (e?.message ?? '').toLowerCase();

  // Veritabanı tetikleyicilerinin kendi Türkçe mesajları olduğu gibi gösterilir.
  if (e?.message && /[çğıöşüİ]/.test(e.message) && !msg.includes('failed to fetch')) return e.message;

  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch failed')) {
    return 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';
  }
  if (e?.code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Bunu yapmaya yetkin yok. Bir yanlışlık olduğunu düşünüyorsan bir yöneticiye yaz.';
  }
  if (e?.code === '23505') return 'Bu zaten kayıtlı görünüyor.';
  if (msg.includes('jwt') || e?.status === 401) return 'Oturumun sona ermiş. Çıkış yapıp yeniden gir.';
  return fallback;
}
