import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bell, GripVertical } from "lucide-react";

const POSITION_STORAGE_KEY = "floating-orders-button-position";

const DEFAULT_POSITION = { x: 16, y: 16 };

// Calcula os limites considerando a sidebar
function getPositionConstraints() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const sidebarWidth = isMobile ? 0 : 256;
  const buttonWidth = 150;
  const buttonHeight = 60;
  const padding = 16;

  return {
    minX: padding,
    maxX: Math.max(padding, (typeof window !== 'undefined' ? window.innerWidth : 1024) - sidebarWidth - buttonWidth - padding),
    minY: padding,
    maxY: Math.max(padding, (typeof window !== 'undefined' ? window.innerHeight : 768) - buttonHeight - padding),
  };
}

function loadSavedPosition(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        const constraints = getPositionConstraints();
        const validX = Math.min(Math.max(constraints.minX, parsed.x), constraints.maxX);
        const validY = Math.min(Math.max(constraints.minY, parsed.y), constraints.maxY);
        return { x: validX, y: validY };
      }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_POSITION;
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore storage errors
  }
}

export function FloatingOrdersButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const companyIdRef = useRef<string | null>(null);
  const { playSound: playNewOrderSound } = useNotificationSound('new_order');
  const isOnOrdersPage = location.pathname === "/dashboard/orders";

  // posição arrastável (em px a partir do canto inferior-direito)
  const [position, setPosition] = useState<{ x: number; y: number }>(loadSavedPosition);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const fetchPendingCount = useCallback(async (companyId: string) => {
    const { count, error } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["pending", "confirmed"]);

    if (!error && count !== null) {
      setPendingCount(count);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let isCancelled = false;
    let channel: any = null;

    const setup = async () => {
      // Try as owner first
      let { data: companyData } = await supabase
        .from("companies")
        .select("id, show_floating_orders_button")
        .eq("owner_id", user.id)
        .maybeSingle();

      // If not owner, check if staff
      if (!companyData) {
        const { data: staffData } = await supabase
          .from("company_staff")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (staffData?.company_id) {
          const { data: staffCompany } = await supabase
            .from("companies")
            .select("id, show_floating_orders_button")
            .eq("id", staffData.company_id)
            .maybeSingle();
          companyData = staffCompany;
        }
      }

      if (!companyData?.id || isCancelled) return;

      companyIdRef.current = companyData.id;
      setIsVisible(companyData.show_floating_orders_button ?? true);
      await fetchPendingCount(companyData.id);

      channel = supabase
        .channel(`floating-orders-${companyData.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `company_id=eq.${companyData.id}`,
          },
          () => {
            playNewOrderSound();
            setHasNewOrder(true);
            fetchPendingCount(companyData.id);
            setTimeout(() => setHasNewOrder(false), 3000);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `company_id=eq.${companyData.id}`,
          },
          () => {
            fetchPendingCount(companyData.id);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "companies",
            filter: `id=eq.${companyData.id}`,
          },
          (payload) => {
            if (payload.new && "show_floating_orders_button" in payload.new) {
              setIsVisible(payload.new.show_floating_orders_button ?? true);
            }
          },
        )
        .subscribe();
    };

    setup();

    // Fallback: atualiza contagem periodicamente caso o realtime falhe por algum motivo
    const interval = setInterval(() => {
      if (companyIdRef.current) {
        fetchPendingCount(companyIdRef.current);
      }
    }, 5000);

    return () => {
      isCancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, [user?.id, fetchPendingCount, playNewOrderSound]);

  // handlers de drag (mouse + touch) - apenas na alça
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { mouseX: clientX, mouseY: clientY, x: position.x, y: position.y };
    isDraggingRef.current = true;
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const dx = dragStartRef.current.mouseX - clientX;
      const dy = dragStartRef.current.mouseY - clientY;
      
      const constraints = getPositionConstraints();
      const newX = Math.min(Math.max(constraints.minX, dragStartRef.current.x + dx), constraints.maxX);
      const newY = Math.min(Math.max(constraints.minY, dragStartRef.current.y + dy), constraints.maxY);
      
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      if (dragStartRef.current) {
        // Salvar posição ao soltar
        savePosition(position);
      }
      dragStartRef.current = null;
      // Pequeno delay para evitar click após drag
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [position]);

  // Salvar posição quando mudar (debounced via handleEnd)
  useEffect(() => {
    savePosition(position);
  }, [position]);

  // Validar posição quando a janela for redimensionada
  useEffect(() => {
    const validatePosition = () => {
      const constraints = getPositionConstraints();
      setPosition(prev => ({
        x: Math.min(Math.max(constraints.minX, prev.x), constraints.maxX),
        y: Math.min(Math.max(constraints.minY, prev.y), constraints.maxY),
      }));
    };

    window.addEventListener('resize', validatePosition);
    // Validar posição inicial
    validatePosition();

    return () => window.removeEventListener('resize', validatePosition);
  }, []);

  const handleButtonClick = () => {
    // Não navegar se estiver arrastando
    if (isDraggingRef.current) return;
    navigate("/dashboard/orders");
  };

  if (!user || !isVisible || isOnOrdersPage) return null;

  return (
    <div
      className="fixed z-40 animate-fade-in flex items-center gap-0"
      style={{ right: position.x, bottom: position.y }}
    >
      {/* Alça de arrasto */}
      <div
        className="flex items-center justify-center h-10 w-6 bg-amber-500/90 hover:bg-amber-500 rounded-l-full cursor-grab active:cursor-grabbing shadow-xl touch-none select-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        title="Arraste para mover"
      >
        <GripVertical className="h-4 w-4 text-white/80" />
      </div>
      
      {/* Botão de pedidos */}
      <Button
        className={cn(
          "floating-button flex items-center gap-2 rounded-r-full rounded-l-none bg-amber-500 text-white px-4 py-2 shadow-xl hover:bg-amber-600 hover-scale border-0",
          hasNewOrder && "animate-bounce",
          pendingCount === 0 && "opacity-80",
        )}
        onClick={handleButtonClick}
      >
        <Bell className={cn("h-4 w-4", hasNewOrder && "text-white")} />
        <span className="text-sm font-medium hidden sm:inline">Pedidos</span>
        <Badge
          className={cn(
            "ml-1 h-5 min-w-6 px-1 text-xs flex items-center justify-center bg-white/20 text-white border-0",
            pendingCount === 0 && "bg-white/10",
          )}
        >
          {pendingCount}
        </Badge>
      </Button>
    </div>
  );
}