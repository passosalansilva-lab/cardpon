/**
 * Utilitário para verificar se uma categoria deve ser exibida
 * baseado nos períodos do dia configurados.
 */

export interface DayPeriod {
  id: string;
  name: string;
  start_time: string; // formato "HH:MM:SS" ou "HH:MM"
  end_time: string;
  is_active: boolean;
}

export interface CategoryDayPeriod {
  category_id: string;
  day_period_id: string;
}

/**
 * Verifica se o horário atual está dentro de um período
 */
function isWithinPeriod(currentTime: string, startTime: string, endTime: string): boolean {
  const start = startTime.slice(0, 5); // "HH:MM"
  const end = endTime.slice(0, 5);
  const current = currentTime.slice(0, 5);

  // Período que cruza a meia-noite (ex: 22:00 - 02:00)
  if (end < start) {
    return current >= start || current < end;
  }

  // Período normal
  return current >= start && current < end;
}

/**
 * Retorna o horário atual no formato "HH:MM"
 */
function getCurrentTime(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Filtra categorias que devem ser exibidas baseado nos períodos do dia.
 * 
 * Regras:
 * - Se não há períodos configurados, todas as categorias são exibidas
 * - Se uma categoria NÃO está vinculada a nenhum período, ela é exibida sempre
 * - Se uma categoria está vinculada a um ou mais períodos, ela só é exibida
 *   se o horário atual estiver dentro de algum desses períodos (ativos)
 */
export function filterCategoriesByDayPeriod(
  categoryIds: string[],
  dayPeriods: DayPeriod[],
  categoryDayPeriods: CategoryDayPeriod[]
): string[] {
  // Se não há períodos configurados, retorna todas as categorias
  if (dayPeriods.length === 0) {
    return categoryIds;
  }

  const currentTime = getCurrentTime();
  
  // Períodos que estão ativos e dentro do horário atual
  const activePeriodsNow = dayPeriods.filter(
    (p) => p.is_active && isWithinPeriod(currentTime, p.start_time, p.end_time)
  );

  // IDs dos períodos ativos agora
  const activeNowPeriodIds = new Set(activePeriodsNow.map((p) => p.id));

  // Para cada categoria, verificar se deve ser exibida
  return categoryIds.filter((categoryId) => {
    // Quais períodos esta categoria está vinculada?
    const linkedPeriodIds = categoryDayPeriods
      .filter((cp) => cp.category_id === categoryId)
      .map((cp) => cp.day_period_id);

    // Se a categoria não está vinculada a nenhum período, exibe sempre
    if (linkedPeriodIds.length === 0) {
      return true;
    }

    // Se está vinculada, verifica se algum dos períodos vinculados está ativo agora
    return linkedPeriodIds.some((periodId) => activeNowPeriodIds.has(periodId));
  });
}
