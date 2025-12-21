"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ICPProvider } from "@/lib/icp-context";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30000, // 30 seconds
                refetchInterval: 60000, // 1 minute
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <ICPProvider>
                {children}
            </ICPProvider>
        </QueryClientProvider>
    );
}
