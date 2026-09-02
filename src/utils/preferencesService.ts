const AUTO_PLATE_READ_KEY = 'cmdit_auto_plate_read_enabled';

/**
 * Obtém a preferência do usuário para Leitura Automática de Placas (Padrão: Ligado)
 */
export function getAutoPlateReadPreference(): boolean {
  try {
    const saved = localStorage.getItem(AUTO_PLATE_READ_KEY);
    if (saved === null) return true;
    return saved !== 'false';
  } catch {
    return true;
  }
}

/**
 * Salva a preferência de Leitura Automática de Placas (Liga / Desliga)
 */
export function setAutoPlateReadPreference(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_PLATE_KEY_ALIAS(AUTO_PLATE_READ_KEY), String(enabled));
    localStorage.setItem(AUTO_PLATE_READ_KEY, String(enabled));
  } catch (e) {
    console.warn('Erro ao salvar preferência de leitura automática:', e);
  }
}

function AUTO_PLATE_KEY_ALIAS(k: string) {
  return k;
}
