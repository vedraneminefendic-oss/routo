import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const QuoteListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <Card key={i} className="animate-pulse border-primary/10">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4 bg-primary/10" />
              <Skeleton className="h-4 w-1/2 bg-muted" />
              <Skeleton className="h-3 w-1/3 bg-muted" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="h-6 w-24 bg-primary/10" />
              <Skeleton className="h-5 w-20 bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const QuoteFormSkeleton = () => (
  <Card className="border-primary/10 animate-pulse">
    <CardHeader>
      <Skeleton className="h-7 w-1/3 bg-primary/10" />
      <Skeleton className="h-4 w-2/3 bg-muted" />
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 bg-muted" />
        <Skeleton className="h-11 w-full bg-primary/5" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36 bg-muted" />
        <Skeleton className="h-32 w-full bg-primary/5" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28 bg-muted" />
        <Skeleton className="h-11 w-full bg-primary/5" />
      </div>
      <Skeleton className="h-11 w-full bg-primary/10" />
    </CardContent>
  </Card>
);

export const QuoteDisplaySkeleton = () => (
  <Card className="border-primary/10 animate-pulse">
    <CardHeader>
      <Skeleton className="h-8 w-1/2 bg-primary/10" />
      <Skeleton className="h-4 w-1/3 bg-muted" />
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-muted" />
        <Skeleton className="h-4 w-5/6 bg-muted" />
        <Skeleton className="h-4 w-3/4 bg-muted" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full bg-primary/5" />
        <Skeleton className="h-24 w-full bg-primary/5" />
        <Skeleton className="h-24 w-full bg-primary/5" />
      </div>
      <div className="border-t pt-4 space-y-2">
        <Skeleton className="h-6 w-40 bg-primary/10" />
        <Skeleton className="h-6 w-32 bg-muted" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-11 flex-1 bg-primary/10" />
        <Skeleton className="h-11 flex-1 bg-muted" />
      </div>
    </CardContent>
  </Card>
);
