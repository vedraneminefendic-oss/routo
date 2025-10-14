import { useState } from "react";
import { useQuoteStatus, QuoteStatus } from "@/hooks/useQuoteStatus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Check,
} from "lucide-react";

interface QuoteStatusManagerProps {
  quoteId: string;
  currentStatus: QuoteStatus;
  onStatusChanged?: () => void;
}

const STATUS_CONFIG = {
  draft: {
    label: "Utkast",
    icon: FileText,
    color: "bg-gray-500",
  },
  sent: {
    label: "Skickad",
    icon: Send,
    color: "bg-blue-500",
  },
  viewed: {
    label: "Visad",
    icon: Eye,
    color: "bg-sky-400",
  },
  accepted: {
    label: "Accepterad",
    icon: CheckCircle,
    color: "bg-green-500",
  },
  rejected: {
    label: "Avvisad",
    icon: XCircle,
    color: "bg-red-500",
  },
  completed: {
    label: "Slutförd",
    icon: Check,
    color: "bg-emerald-700",
  },
};

export const QuoteStatusManager = ({
  quoteId,
  currentStatus,
  onStatusChanged,
}: QuoteStatusManagerProps) => {
  const { changeStatus, getAllowedTransitions, isChangingStatus } = useQuoteStatus();
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | null>(null);
  const [note, setNote] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const allowedTransitions = getAllowedTransitions(currentStatus);
  const StatusIcon = STATUS_CONFIG[currentStatus].icon;

  const handleStatusSelect = (status: string) => {
    setSelectedStatus(status as QuoteStatus);
    setShowConfirmDialog(true);
  };

  const handleConfirmChange = async () => {
    if (!selectedStatus) return;

    const success = await changeStatus(quoteId, currentStatus, selectedStatus, note);
    if (success) {
      setShowConfirmDialog(false);
      setSelectedStatus(null);
      setNote("");
      onStatusChanged?.();
    }
  };

  const handleCancelChange = () => {
    setShowConfirmDialog(false);
    setSelectedStatus(null);
    setNote("");
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-5 w-5 text-muted-foreground" />
            <Badge className={`${STATUS_CONFIG[currentStatus].color} text-white`}>
              {STATUS_CONFIG[currentStatus].label}
            </Badge>
          </div>

          {allowedTransitions.length > 0 && (
            <Select onValueChange={handleStatusSelect} disabled={isChangingStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ändra status..." />
              </SelectTrigger>
              <SelectContent>
                {allowedTransitions.map((status) => {
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;
                  return (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {currentStatus === "draft" && (
          <p className="text-xs text-muted-foreground">
            💡 Status ändras automatiskt till "Skickad" när du skickar offerten via e-post
          </p>
        )}
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta statusändring</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedStatus && (
                <>
                  Vill du ändra status från{" "}
                  <strong>{STATUS_CONFIG[currentStatus].label}</strong> till{" "}
                  <strong>{STATUS_CONFIG[selectedStatus].label}</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedStatus === "draft" && currentStatus === "sent" && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              <p className="text-sm text-amber-900">
                ⚠️ Om du ändrar tillbaka till utkast kommer kunden fortfarande ha tillgång till den skickade länken.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Anteckning (valfritt)</Label>
            <Textarea
              id="note"
              placeholder="Lägg till en kommentar om varför statusen ändrades..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelChange}>
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChange}>
              Bekräfta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
