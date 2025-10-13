import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface Quote {
  id: string;
  title: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  generated_quote: any;
  edited_quote: any;
}

interface QuotesTableProps {
  quotes: Quote[];
  loading: boolean;
}

const STATUS_CONFIG = {
  draft: { label: "Utkast", color: "bg-gray-500" },
  sent: { label: "Skickad", color: "bg-blue-500" },
  viewed: { label: "Visad", color: "bg-purple-500" },
  accepted: { label: "Accepterad", color: "bg-green-500" },
  rejected: { label: "Avvisad", color: "bg-red-500" },
  completed: { label: "Slutförd", color: "bg-emerald-500" },
};

export const QuotesTable = ({ quotes, loading }: QuotesTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredQuotes = quotes.filter((quote) =>
    quote.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offerter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Offerter</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök offerter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "Inga offerter hittades" : "Inga offerter för denna period"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Skapad</TableHead>
                <TableHead>Skickad</TableHead>
                <TableHead className="text-right">Värde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.map((quote) => {
                const quoteData = quote.edited_quote || quote.generated_quote;
                const value = quoteData?.summary?.customerPays || 0;
                const statusInfo = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;

                return (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.title}</TableCell>
                    <TableCell>
                      <Badge className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(quote.created_at), "d MMM yyyy", { locale: sv })}
                    </TableCell>
                    <TableCell>
                      {quote.sent_at
                        ? format(new Date(quote.sent_at), "d MMM yyyy", { locale: sv })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(value)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
