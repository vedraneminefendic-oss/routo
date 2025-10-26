import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Eye, Send, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ActionableInsight {
  id: string;
  type: 'urgent' | 'attention' | 'opportunity';
  title: string;
  description: string;
  quoteId?: string;
  quoteName?: string;
  daysSince?: number;
  amount?: number;
  action: {
    label: string;
    onClick: () => void;
  };
}

interface ActionableInsightsProps {
  insights: ActionableInsight[];
}

export const ActionableInsights = ({ insights }: ActionableInsightsProps) => {
  const navigate = useNavigate();

  const getInsightIcon = (type: ActionableInsight['type']) => {
    switch (type) {
      case 'urgent':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'attention':
        return <Clock className="h-5 w-5 text-warning" />;
      case 'opportunity':
        return <TrendingUp className="h-5 w-5 text-success" />;
    }
  };

  const getInsightBadge = (type: ActionableInsight['type']) => {
    switch (type) {
      case 'urgent':
        return <Badge variant="destructive">Brådskande</Badge>;
      case 'attention':
        return <Badge className="bg-warning text-warning-foreground">Uppmärksamhet</Badge>;
      case 'opportunity':
        return <Badge className="bg-success text-white">Möjlighet</Badge>;
    }
  };

  if (insights.length === 0) {
    return (
      <Card className="border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="h-6 w-6 text-primary" />
            Allt är under kontroll! 🎉
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Du har inga offerter som behöver uppmärksamhet just nu. Bra jobbat!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <AlertCircle className="h-6 w-6 text-primary" />
          Att göra idag ({insights.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="flex items-start gap-4 p-4 rounded-xl bg-card border-2 border-border/50 hover:border-primary/30 transition-all"
          >
            <div className="mt-1">
              {getInsightIcon(insight.type)}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-foreground">{insight.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {insight.description}
                  </p>
                  {insight.quoteName && (
                    <p className="text-sm text-primary font-medium mt-1">
                      "{insight.quoteName}"
                      {insight.amount && (
                        <span className="text-muted-foreground ml-2">
                          • {insight.amount.toLocaleString('sv-SE')} kr
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  {getInsightBadge(insight.type)}
                </div>
              </div>
              
              <Button
                size="sm"
                onClick={insight.action.onClick}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {insight.action.label}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};