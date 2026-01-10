import { useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira', shortLabel: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', shortLabel: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', shortLabel: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', shortLabel: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', shortLabel: 'Sex' },
  { key: 'saturday', label: 'Sábado', shortLabel: 'Sáb' },
  { key: 'sunday', label: 'Domingo', shortLabel: 'Dom' },
];

export interface TimePeriod {
  open: string;
  close: string;
}

export interface DayHours {
  enabled: boolean;
  open: string;
  close: string;
  periods?: TimePeriod[];
}

export interface OperatingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

const DEFAULT_HOURS: OperatingHours = {
  monday: { enabled: true, open: '08:00', close: '18:00', periods: [{ open: '08:00', close: '18:00' }] },
  tuesday: { enabled: true, open: '08:00', close: '18:00', periods: [{ open: '08:00', close: '18:00' }] },
  wednesday: { enabled: true, open: '08:00', close: '18:00', periods: [{ open: '08:00', close: '18:00' }] },
  thursday: { enabled: true, open: '08:00', close: '18:00', periods: [{ open: '08:00', close: '18:00' }] },
  friday: { enabled: true, open: '08:00', close: '18:00', periods: [{ open: '08:00', close: '18:00' }] },
  saturday: { enabled: true, open: '08:00', close: '14:00', periods: [{ open: '08:00', close: '14:00' }] },
  sunday: { enabled: false, open: '08:00', close: '14:00', periods: [{ open: '08:00', close: '14:00' }] },
};

// Helper to migrate old format (single period) to new format (multiple periods)
function migrateDayHours(day: DayHours): DayHours {
  if (day.periods && day.periods.length > 0) {
    return day;
  }
  // Migrate from old format
  return {
    ...day,
    periods: [{ open: day.open, close: day.close }],
  };
}

// Helper to ensure all days have valid data by merging with defaults
function ensureValidHours(input: Partial<OperatingHours> | null | undefined): OperatingHours {
  if (!input || typeof input !== 'object') {
    return DEFAULT_HOURS;
  }
  
  return {
    monday: migrateDayHours({ ...DEFAULT_HOURS.monday, ...(input.monday || {}) }),
    tuesday: migrateDayHours({ ...DEFAULT_HOURS.tuesday, ...(input.tuesday || {}) }),
    wednesday: migrateDayHours({ ...DEFAULT_HOURS.wednesday, ...(input.wednesday || {}) }),
    thursday: migrateDayHours({ ...DEFAULT_HOURS.thursday, ...(input.thursday || {}) }),
    friday: migrateDayHours({ ...DEFAULT_HOURS.friday, ...(input.friday || {}) }),
    saturday: migrateDayHours({ ...DEFAULT_HOURS.saturday, ...(input.saturday || {}) }),
    sunday: migrateDayHours({ ...DEFAULT_HOURS.sunday, ...(input.sunday || {}) }),
  };
}

interface OperatingHoursEditorProps {
  value: OperatingHours | null;
  onChange: (hours: OperatingHours) => void;
}

export function OperatingHoursEditor({ value, onChange }: OperatingHoursEditorProps) {
  const hours = ensureValidHours(value);

  const updateDayEnabled = (dayKey: keyof OperatingHours, enabled: boolean) => {
    onChange({
      ...hours,
      [dayKey]: {
        ...hours[dayKey],
        enabled,
      },
    });
  };

  const updatePeriod = (dayKey: keyof OperatingHours, periodIndex: number, field: 'open' | 'close', value: string) => {
    const dayHours = hours[dayKey];
    const periods = [...(dayHours.periods || [])];
    periods[periodIndex] = { ...periods[periodIndex], [field]: value };
    
    // Keep legacy fields in sync with first period
    const firstPeriod = periods[0];
    
    onChange({
      ...hours,
      [dayKey]: {
        ...dayHours,
        periods,
        open: firstPeriod.open,
        close: firstPeriod.close,
      },
    });
  };

  const addPeriod = (dayKey: keyof OperatingHours) => {
    const dayHours = hours[dayKey];
    const periods = [...(dayHours.periods || [])];
    const lastPeriod = periods[periods.length - 1];
    
    // Add new period starting 1 hour after last close
    const newOpen = lastPeriod ? addHours(lastPeriod.close, 1) : '18:00';
    const newClose = addHours(newOpen, 4);
    
    periods.push({ open: newOpen, close: newClose });
    
    onChange({
      ...hours,
      [dayKey]: {
        ...dayHours,
        periods,
      },
    });
  };

  const removePeriod = (dayKey: keyof OperatingHours, periodIndex: number) => {
    const dayHours = hours[dayKey];
    const periods = [...(dayHours.periods || [])];
    
    if (periods.length <= 1) return; // Keep at least one period
    
    periods.splice(periodIndex, 1);
    
    // Update legacy fields with first period
    const firstPeriod = periods[0];
    
    onChange({
      ...hours,
      [dayKey]: {
        ...dayHours,
        periods,
        open: firstPeriod.open,
        close: firstPeriod.close,
      },
    });
  };

  const copyToAll = (sourceDay: keyof OperatingHours) => {
    const sourceHours = hours[sourceDay];
    const newHours = { ...hours };
    DAYS_OF_WEEK.forEach((day) => {
      if (day.key !== sourceDay) {
        newHours[day.key as keyof OperatingHours] = { 
          ...sourceHours,
          periods: sourceHours.periods?.map(p => ({ ...p })) || [],
        };
      }
    });
    onChange(newHours);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Horários de Funcionamento
        </CardTitle>
        <CardDescription>
          Configure os dias e horários que sua loja está aberta. Você pode adicionar múltiplos períodos por dia (ex: almoço e jantar).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day, dayIndex) => {
            const dayHours = hours[day.key as keyof OperatingHours];
            const periods = dayHours.periods || [{ open: dayHours.open, close: dayHours.close }];
            
            return (
              <div
                key={day.key}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                {/* Day header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={dayHours.enabled}
                      onCheckedChange={(checked) => updateDayEnabled(day.key as keyof OperatingHours, checked)}
                    />
                    <Label className={`font-medium ${!dayHours.enabled ? 'text-muted-foreground' : ''}`}>
                      <span className="hidden sm:inline">{day.label}</span>
                      <span className="sm:hidden">{day.shortLabel}</span>
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {dayIndex === 0 && (
                      <button
                        type="button"
                        onClick={() => copyToAll(day.key as keyof OperatingHours)}
                        className="text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        Copiar para todos
                      </button>
                    )}
                    {dayHours.enabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addPeriod(day.key as keyof OperatingHours)}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="hidden sm:inline">Período</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Time periods */}
                <div className={`space-y-2 ${!dayHours.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  {periods.map((period, periodIndex) => (
                    <div key={periodIndex} className="flex items-center gap-2 pl-10">
                      {periods.length > 1 && (
                        <span className="text-xs text-muted-foreground w-16 shrink-0">
                          {periodIndex === 0 ? '1º período' : `${periodIndex + 1}º período`}
                        </span>
                      )}
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground">Abre:</Label>
                          <Input
                            type="time"
                            value={period.open}
                            onChange={(e) => updatePeriod(day.key as keyof OperatingHours, periodIndex, 'open', e.target.value)}
                            className="w-[100px] h-8 text-sm"
                          />
                        </div>
                        <span className="text-muted-foreground">–</span>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs text-muted-foreground">Fecha:</Label>
                          <Input
                            type="time"
                            value={period.close}
                            onChange={(e) => updatePeriod(day.key as keyof OperatingHours, periodIndex, 'close', e.target.value)}
                            className="w-[100px] h-8 text-sm"
                          />
                        </div>
                        {periods.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePeriod(day.key as keyof OperatingHours, periodIndex)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          O cardápio online verificará automaticamente se está dentro do horário de funcionamento. Use o botão "Loja Aberta/Fechada" para controle manual.
        </p>
      </CardContent>
    </Card>
  );
}

// Helper to add hours to a time string
function addHours(time: string, hoursToAdd: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const newHours = (hours + hoursToAdd) % 24;
  return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export { DEFAULT_HOURS };
