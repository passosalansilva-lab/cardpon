import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, Terminal, AlertCircle, CheckCircle, Clock, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogEntry {
  id: string;
  timestamp: string;
  function_name: string;
  level: "info" | "error" | "warn";
  message: string;
  details?: Record<string, unknown>;
}

// Simulated logs for demonstration - in production these would come from the edge function
const generateMockLogs = (): LogEntry[] => {
  const functions = ["create-subscription", "check-subscription", "customer-portal", "create-checkout"];
  const levels: ("info" | "error" | "warn")[] = ["info", "info", "info", "error", "warn"];
  const messages = {
    "create-subscription": [
      "Function started",
      "User authenticated",
      "Plan selected",
      "Checkout session created",
      "ERROR - Price cannot be zero"
    ],
    "check-subscription": [
      "Function started",
      "User authenticated",
      "Customer found",
      "Active subscription found",
      "No active subscription - free plan"
    ],
    "customer-portal": [
      "Function started",
      "User authenticated",
      "Portal session created"
    ],
    "create-checkout": [
      "Function started",
      "User authenticated",
      "Session created"
    ]
  };

  const logs: LogEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const funcName = functions[Math.floor(Math.random() * functions.length)] as keyof typeof messages;
    const funcMessages = messages[funcName];
    const message = funcMessages[Math.floor(Math.random() * funcMessages.length)];
    const level = message.includes("ERROR") ? "error" : message.includes("No active") ? "warn" : "info";

    logs.push({
      id: `log-${i}`,
      timestamp: new Date(now.getTime() - i * 60000 * Math.random() * 10).toISOString(),
      function_name: funcName,
      level,
      message,
      details: level === "error" ? { planKey: "basic", price: 0 } : undefined
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export default function AdminLogs() {
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      // In production, this would call the edge function
      // For now, return mock data
      return generateMockLogs();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const filteredLogs = logs?.filter(log => {
    const matchesFunction = selectedFunction === "all" || log.function_name === selectedFunction;
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesSearch = searchQuery === "" || 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.function_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFunction && matchesLevel && matchesSearch;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warn":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      case "warn":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Aviso</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const errorCount = logs?.filter(l => l.level === "error").length || 0;
  const warnCount = logs?.filter(l => l.level === "warn").length || 0;
  const infoCount = logs?.filter(l => l.level === "info").length || 0;

  return (
    <DashboardLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Logs do Sistema</h1>
        <p className="text-muted-foreground">
          Monitore as edge functions e transações do Stripe
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avisos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warnCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{infoCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nos logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedFunction} onValueChange={setSelectedFunction}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                <SelectItem value="create-subscription">create-subscription</SelectItem>
                <SelectItem value="check-subscription">check-subscription</SelectItem>
                <SelectItem value="customer-portal">customer-portal</SelectItem>
                <SelectItem value="create-checkout">create-checkout</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Logs das Edge Functions
          </CardTitle>
          <CardDescription>
            Últimos logs das funções do sistema (atualiza automaticamente a cada 30s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredLogs?.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg border ${
                      log.level === "error" 
                        ? "border-destructive/50 bg-destructive/5" 
                        : log.level === "warn"
                        ? "border-yellow-500/50 bg-yellow-500/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {getLevelIcon(log.level)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.function_name}
                            </Badge>
                            {getLevelBadge(log.level)}
                          </div>
                          <p className="mt-1 text-sm font-medium">{log.message}</p>
                          {log.details && (
                            <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.timestamp), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredLogs?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado com os filtros selecionados
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
