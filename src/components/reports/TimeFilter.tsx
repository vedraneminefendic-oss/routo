import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import type { TimeFilterType } from "@/pages/Reports";

interface TimeFilterProps {
  value: TimeFilterType;
  onChange: (value: TimeFilterType) => void;
  dateRange?: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date } | undefined) => void;
}

export const TimeFilter = ({ value, onChange, dateRange, onDateRangeChange }: TimeFilterProps) => {
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={(v) => onChange(v as TimeFilterType)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Välj period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Denna vecka</SelectItem>
          <SelectItem value="month">Denna månad</SelectItem>
          <SelectItem value="quarter">Detta kvartal</SelectItem>
          <SelectItem value="year">Detta år</SelectItem>
          <SelectItem value="custom">Anpassat</SelectItem>
        </SelectContent>
      </Select>

      {value === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "d MMM", { locale: sv })} -{" "}
                    {format(dateRange.to, "d MMM yyyy", { locale: sv })}
                  </>
                ) : (
                  format(dateRange.from, "d MMM yyyy", { locale: sv })
                )
              ) : (
                "Välj datum"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onDateRangeChange({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
              locale={sv}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
