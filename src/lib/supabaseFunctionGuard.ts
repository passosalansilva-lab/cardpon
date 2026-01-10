import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let isPatched = false;

async function handleAuthError() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Erro ao fazer logout após 401/403:", error);
  }

  const currentPath = window.location.pathname;

  toast.error("Sua sessão expirou. Faça login novamente para continuar.");

  if (currentPath.startsWith("/driver")) {
    window.location.href = "/driver/login";
  } else {
    window.location.href = "/auth";
  }
}

export function setupSupabaseFunctionAuthGuard() {
  if (isPatched) return;
  isPatched = true;

  const originalInvoke = supabase.functions.invoke.bind(supabase.functions);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase.functions.invoke = (async (...args: any[]) => {
    const [functionName, options] = args as [string, any?];

    try {
      // Busca o JWT atual da sessão (se existir)
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      const mergedOptions = {
        ...(options || {}),
        headers: {
          ...(options?.headers || {}),
          ...(accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {}),
        },
      };

      const result = await originalInvoke(functionName, mergedOptions);
      const status = (result as any)?.error?.status;

      if (status === 401 || status === 403) {
        await handleAuthError();
      }

      return result;
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const message = err?.message || "";

      if (status === 401 || status === 403 || /invalid jwt/i.test(message)) {
        await handleAuthError();
      }

      throw err;
    }
  }) as typeof supabase.functions.invoke;
}
