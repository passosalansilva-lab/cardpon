import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Smartphone,
  Truck,
  BarChart3,
  ArrowRight,
  Check,
  Star,
  Zap,
  CreditCard,
  FileText,
  Package,
  Percent,
  Globe,
  Mail,
  Phone,
  Linkedin,
  ChefHat,
  Shield,
  TrendingUp,
  Clock,
  Receipt,
  MapPinned,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSystemLogo } from '@/hooks/useSystemLogo';
import { ChromaKeyImage } from '@/components/ui/chroma-key-image';
import foodPizza from '@/assets/food-pizza-transparent.png';
import foodBurger from '@/assets/food-burger-transparent.png';
import foodSushi from '@/assets/food-sushi-transparent.png';
import foodAcai from '@/assets/food-acai-transparent.png';

const features = [
  { icon: Smartphone, title: 'Cardápio Digital', description: 'Interface moderna e responsiva com QR Code integrado para seus clientes.' },
  { icon: QrCode, title: 'Pedido em Mesa', description: 'QR Code exclusivo por mesa para pedidos direto do celular do cliente.' },
  { icon: ChefHat, title: 'KDS - Cozinha', description: 'Tela para tablet na cozinha com pedidos em tempo real e controle de preparo.', isNew: true },
  { icon: CreditCard, title: 'Pagamento Online', description: 'Receba via PIX e cartão pelo Mercado Pago e PicPay.' },
  { icon: FileText, title: 'Nota Fiscal', description: 'Emissão automática de NF-e integrada ao seu fluxo.' },
  { icon: Truck, title: 'Gestão de Entregas', description: 'Rastreamento GPS em tempo real para você e seu cliente.' },
  { icon: BarChart3, title: 'Relatórios', description: 'Métricas detalhadas e insights para decisões estratégicas.' },
  { icon: Zap, title: 'Notificações Push', description: 'Alertas instantâneos para novos pedidos e atualizações.' },
];

function FeaturesMegaMenu() {
  return (
    <div className="w-[760px] rounded-2xl bg-white border border-orange-200 shadow-2xl backdrop-blur-xl p-6">
      
      <div className="grid grid-cols-3 gap-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex gap-4 p-4 rounded-xl hover:bg-orange-50 transition group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">
              <feature.icon className="h-5 w-5 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {feature.title}
                </h4>

                {"isNew" in feature && feature.isNew && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold">
                    Novo
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 leading-snug mt-1">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 border-t border-orange-100 pt-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Plataforma completa para delivery
        </span>

        <a
          href="#features"
          className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-2"
        >
          Ver todas
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

const integrations = [
  { name: 'Mercado Pago', description: 'Pix, cartão e boleto', icon: CreditCard },
  { name: 'PicPay', description: 'Receba via Pix', icon: Receipt },
  { name: 'Focus NFe', description: 'Emissão fiscal', icon: FileText },
  { name: 'Mapbox', description: 'Rastreamento GPS', icon: MapPinned },
];

const benefits = [
  { icon: TrendingUp, title: 'Aumente suas vendas', description: 'Plataforma otimizada para conversão.' },
  { icon: Clock, title: 'Economize tempo', description: 'Automatize processos operacionais.' },
  { icon: Shield, title: 'Segurança', description: 'Dados protegidos e criptografados.' },
];


interface LandingStats {
  total_orders: number;
  total_companies: number;
  avg_rating: number;
}

interface Testimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  content: string;
  rating: number;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  features: string[] | null;
  revenue_limit: number | null;
}




export default function Index() {
  const { user, hasRole } = useAuth();
  const { setTheme } = useTheme();
  const { logoUrl } = useSystemLogo("landing");
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [currentFoodIndex, setCurrentFoodIndex] = useState(0);

  const foodImages = [
    { src: foodPizza, alt: 'Pizza', label: 'Pizzarias' },
    { src: foodBurger, alt: 'Hambúrguer', label: 'Hamburguerias' },
    { src: foodSushi, alt: 'Sushi', label: 'Japonês' },
    { src: foodAcai, alt: 'Açaí', label: 'Açaiterias' },
  ];

  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  useEffect(() => {
    loadStats();
    loadTestimonials();
    loadPlans();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentFoodIndex((prev) => (prev + 1) % foodImages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [foodImages.length]);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_landing_stats');

      if (error) throw error;
      setStats(data as unknown as LandingStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from('testimonials')
        .select('id, author_name, author_role, content, rating')
        .eq('is_featured', true)
        .eq('is_approved', true)
        .limit(3);

      if (error) throw error;
      setTestimonials(data || []);
    } catch (error) {
      console.error('Error loading testimonials:', error);
    }
  };

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, description, price, features, revenue_limit')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      setPlans((data || []) as Plan[]);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(0) + 'k+';
    return num.toString();
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    if (hasRole('delivery_driver') && !hasRole('store_owner') && !hasRole('super_admin')) {
      return '/driver';
    }
    return '/dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white font-sans antialiased">
      {/* Header */}
<header className="sticky top-0 z-50 border-b border-orange-100/60 bg-white/95 backdrop-blur-sm">
  <div className="container max-w-6xl mx-auto px-6 flex h-16 items-center justify-between">
    
    {/* Logo */}
    <Link to={getDashboardPath()} className="flex items-center">
      <ChromaKeyImage
        src={logoUrl}
        alt="Cardápio On"
        className="h-10 sm:h-12 w-auto"
      />
    </Link>

    {/* Navigation */}
    <nav className="hidden md:flex items-center gap-10 relative">
      
      {/* FUNCIONALIDADES – Mega Menu */}
      <div className="relative group">
        <span className="text-sm font-medium text-gray-600 hover:text-orange-600 cursor-pointer flex items-center gap-1">
          Funcionalidades
        </span>

        {/* Dropdown */}
        <div className="absolute left-1/2 top-full pt-4 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
         <FeaturesMegaMenu />
        </div>
      </div>

      <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors">
        Planos
      </a>
      <a href="#contact" className="text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors">
        Contato
      </a>
    </nav>

    {/* Right actions */}
    <div className="flex items-center gap-3">
      {user ? (
        <Button asChild size="sm" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/25">
          <Link to={getDashboardPath()}>Acessar Painel</Link>
        </Button>
      ) : (
        <>
          <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex text-gray-600 font-medium hover:text-orange-600 hover:bg-orange-50">
            <Link to="/auth?mode=login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold shadow-lg shadow-orange-500/25">
            <Link to="/auth?mode=signup">Começar Grátis</Link>
          </Button>
        </>
      )}
    </div>
  </div>
</header>


      {/* Hero */}
      <section className="py-20 lg:py-28 overflow-hidden">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-100 to-red-100 border border-orange-200/60 mb-6">
                <span className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" />
                <span className="text-sm font-semibold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Grátis até R$ 2.000/mês</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.1] font-display">
                A plataforma que{' '}
                <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">transforma</span>
                {' '}seu delivery
              </h1>
              
              <p className="text-lg text-gray-600 mb-10 max-w-xl leading-relaxed">
                Gerencie pedidos, entregas e pagamentos em um único lugar. 
                Tudo que seu negócio precisa para crescer.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <Button size="lg" asChild className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 h-12 font-semibold shadow-lg shadow-orange-500/25">
                  <Link to="/auth?mode=signup">
                    Criar conta grátis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="border-orange-200 text-orange-600 hover:bg-orange-50 h-12 font-semibold">
                  <a href="#features">Ver funcionalidades</a>
                </Button>
              </div>
              
              {/* Stats */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-10 pt-6 border-t border-orange-100">
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent tracking-tight">
                    {stats ? formatNumber(stats.total_orders) : '—'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Pedidos processados</div>
                </div>
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent tracking-tight">
                    {stats ? formatNumber(stats.total_companies) : '—'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Estabelecimentos</div>
                </div>
                <div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent tracking-tight flex items-center gap-1.5">
                    {stats ? stats.avg_rating : '—'}
                    <Star className="h-5 w-5 text-orange-500 fill-orange-500" />
                  </div>
                  <div className="text-sm text-gray-500 mt-1">Avaliação média</div>
                </div>
              </div>
            </div>

            {/* Right - Food Carousel */}
            <div className="relative hidden lg:block">
              <div className="relative w-full h-[480px] flex items-center justify-center">
                {/* Background shapes */}
                <div className="absolute w-[380px] h-[380px] rounded-full bg-gradient-to-br from-orange-100 to-red-50 border border-orange-200/50" />
                <div className="absolute w-[300px] h-[300px] rounded-full bg-white border border-orange-100 shadow-sm" />
                
                {/* Food image */}
                <div className="relative z-10 w-[260px] h-[260px] flex items-center justify-center">
                  {foodImages.map((food, index) => (
                    <div
                      key={food.alt}
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-out ${
                        index === currentFoodIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                      }`}
                    >
                      <ChromaKeyImage
                        src={food.src}
                        alt={food.alt}
                        className="w-full h-full object-contain drop-shadow-xl"
                      />
                    </div>
                  ))}
                </div>

                {/* Category label */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
                  <div className="px-5 py-2 rounded-full bg-white border border-orange-100 shadow-md">
                    <span className="text-sm font-semibold text-gray-700">
                      {foodImages[currentFoodIndex].label}
                    </span>
                  </div>
                </div>

                {/* Floating cards */}
                <div className="absolute right-4 top-16 bg-white p-4 rounded-2xl shadow-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                      <Check className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Novo pedido!</div>
                      <div className="text-xs text-gray-500">R$ 89,90</div>
                    </div>
                  </div>
                </div>

                <div className="absolute left-4 bottom-24 bg-white p-4 rounded-2xl shadow-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                      <Truck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Entrega em andamento</div>
                      <div className="text-xs text-gray-500">15 min restantes</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits bar */}
      <section className="py-8 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{benefit.title}</h3>
                  <p className="text-white/80 text-xs">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 font-display">
              Funcionalidades <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">completas</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Tudo que você precisa para gerenciar seu delivery de forma profissional
            </p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div 
                key={feature.title} 
                className="group relative p-6 rounded-2xl border border-orange-100 bg-orange-50/30 hover:bg-white hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300"
              >
                {'isNew' in feature && feature.isNew && (
                  <div className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold shadow-lg animate-pulse">
                    Novo!
                  </div>
                )}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

            
      {/* Integrations */}
      <section className="py-20 bg-orange-50/50">
        <div className="container max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 font-display">
              Integrações <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">disponíveis</span>
            </h2>
            <p className="text-gray-600">
              Conecte com as principais plataformas do mercado
            </p>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((integration) => (
              <div 
                key={integration.name} 
                className="flex items-center gap-4 p-5 rounded-xl border border-orange-100 bg-white hover:shadow-md hover:shadow-orange-500/10 transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center flex-shrink-0">
                  <integration.icon className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{integration.name}</div>
                  <div className="text-xs text-gray-500">{integration.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Demos - Phone Mockups */}
      <section id="demos" className="py-24 bg-white overflow-hidden">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 font-display">
              Veja na <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">prática</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Experiência completa para seus clientes e entregadores
            </p>
          </div>
          
          <div className="grid gap-12 lg:gap-20 lg:grid-cols-2">
            {/* Customer Menu Demo */}
            <div className="flex flex-col items-center">
              <div className="relative mb-8">
                {/* Phone Frame */}
                <div className="relative w-[280px] h-[580px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl shadow-gray-900/30">
                  {/* Phone notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />
                  
                  {/* Screen */}
                  <div className="relative w-full h-full bg-gradient-to-br from-orange-100 to-red-50 rounded-[2.4rem] overflow-hidden">
                    {/* Placeholder for video/gif - replace src with actual video */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center mb-4 shadow-lg">
                        <Smartphone className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-sm text-gray-600 font-medium">
                        Vídeo do cardápio digital
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Adicione seu GIF/vídeo aqui
                      </p>
                    </div>
                    
                    {/* When you have a video/gif, uncomment and use this: */}
                    {/* 
                    <video 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      className="w-full h-full object-cover"
                    >
                      <source src="/path-to-your-video.mp4" type="video/mp4" />
                    </video>
                    */}
                    
                    {/* Or for a GIF: */}
                    {/* <img src="/path-to-your-gif.gif" alt="Demo cardápio" className="w-full h-full object-cover" /> */}
                  </div>
                  
                  {/* Phone button */}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-gray-700 rounded-full" />
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -right-4 top-20 bg-white p-3 rounded-xl shadow-lg border border-orange-100 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Item adicionado!</span>
                  </div>
                </div>
                
                <div className="absolute -left-4 bottom-32 bg-white p-3 rounded-xl shadow-lg border border-orange-100 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                      <Package className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Pedido enviado</span>
                  </div>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">Cardápio Digital</h3>
              <p className="text-sm text-gray-600 text-center max-w-xs">
                Seus clientes fazem pedidos diretamente pelo celular, de forma rápida e intuitiva.
              </p>
            </div>

            {/* Driver Tracking Demo */}
            <div className="flex flex-col items-center">
              <div className="relative mb-8">
                {/* Phone Frame */}
                <div className="relative w-[280px] h-[580px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl shadow-gray-900/30">
                  {/* Phone notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />
                  
                  {/* Screen */}
                  <div className="relative w-full h-full bg-gradient-to-br from-blue-100 to-indigo-50 rounded-[2.4rem] overflow-hidden">
                    {/* Placeholder for video/gif - replace src with actual video */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                        <Truck className="h-8 w-8 text-white" />
                      </div>
                      <p className="text-sm text-gray-600 font-medium">
                        Vídeo do app do entregador
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Adicione seu GIF/vídeo aqui
                      </p>
                    </div>
                    
                    {/* When you have a video/gif, uncomment and use this: */}
                    {/* 
                    <video 
                      autoPlay 
                      loop 
                      muted 
                      playsInline
                      className="w-full h-full object-cover"
                    >
                      <source src="/path-to-your-driver-video.mp4" type="video/mp4" />
                    </video>
                    */}
                    
                    {/* Or for a GIF: */}
                    {/* <img src="/path-to-your-driver-gif.gif" alt="Demo entregador" className="w-full h-full object-cover" /> */}
                  </div>
                  
                  {/* Phone button */}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-gray-700 rounded-full" />
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -right-4 top-32 bg-white p-3 rounded-xl shadow-lg border border-blue-100 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <MapPinned className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">GPS ativo</span>
                  </div>
                </div>
                
                <div className="absolute -left-4 bottom-40 bg-white p-3 rounded-xl shadow-lg border border-blue-100 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Entrega concluída</span>
                  </div>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">App do Entregador</h3>
              <p className="text-sm text-gray-600 text-center max-w-xs">
                Entregadores acompanham pedidos e fazem entregas com rastreamento GPS em tempo real.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="container max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 font-display">
              Comece em <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">3 passos</span>
            </h2>
            <p className="text-gray-600">Simples e rápido para você começar a vender</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: '01', title: 'Crie sua conta', desc: 'Cadastre-se gratuitamente e configure as informações do seu estabelecimento.' },
              { step: '02', title: 'Monte o cardápio', desc: 'Adicione seus produtos, fotos e preços de forma simples e intuitiva.' },
              { step: '03', title: 'Receba pedidos', desc: 'Compartilhe seu link e comece a receber pedidos imediatamente.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-orange-500/25">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="py-24 bg-orange-50/50">
          <div className="container max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 font-display">
                O que dizem nossos <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">clientes</span>
              </h2>
              <p className="text-gray-600">Depoimentos de quem já utiliza a plataforma</p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="bg-white p-8 rounded-2xl border border-orange-100 shadow-sm hover:shadow-lg hover:shadow-orange-500/10 transition-shadow">
                  <div className="flex items-center gap-1 mb-5">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-orange-500 fill-orange-500" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed">&ldquo;{testimonial.content}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-5 border-t border-orange-100">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                      <ChefHat className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{testimonial.author_name}</div>
                      {testimonial.author_role && (
                        <div className="text-xs text-gray-500">{testimonial.author_role}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 font-display">
              Planos <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">transparentes</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Preço baseado no seu faturamento mensal
            </p>
          </div>
          
          {/* Plan cards */}
          {loadingPlans ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-80 rounded-2xl bg-orange-100 animate-pulse" />
              ))}
            </div>
          ) : plans.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto mb-12">
              {plans.map((plan, index) => {
                const isPopular = index === 2; // Third plan is popular (R$ 99)
                return (
                  <div
                    key={plan.id}
                    className={`relative p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 ${
                      isPopular
                        ? 'border-orange-300 bg-gradient-to-b from-orange-50 to-white shadow-md'
                        : 'border-orange-100 bg-white hover:border-orange-200'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full shadow-sm">
                          Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mb-6">
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{plan.name}</h3>
                      {plan.revenue_limit ? (
                        <p className="text-sm text-gray-500">
                          Até R$ {plan.revenue_limit.toLocaleString('pt-BR')}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Faturamento ilimitado</p>
                      )}
                    </div>
                    
                    <div className="text-center mb-6">
                      {plan.price === 0 ? (
                        <span className="text-3xl font-bold text-emerald-600">Grátis</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-gray-900">
                            R$ {plan.price}
                          </span>
                          <span className="text-gray-500 text-sm">/mês</span>
                        </>
                      )}
                    </div>
                    
                    {plan.description && (
                      <p className="text-sm text-gray-600 text-center mb-6">{plan.description}</p>
                    )}
                    
                    {plan.features && plan.features.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {(plan.features as string[]).slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                            <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    <Button
                      asChild
                      className={`w-full ${
                        isPopular
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                    >
                      <Link to="/auth?mode=signup">
                        {plan.price === 0 ? 'Começar grátis' : 'Assinar'}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Nenhum plano disponível no momento.
            </div>
          )}
          
          {/* Free tier explanation */}
          <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                <Check className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Como funciona?</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Use a plataforma <strong>gratuitamente</strong> enquanto seu faturamento for de até <strong>R$ 2.000/mês</strong>. 
                  Ao atingir esse valor, escolha um plano para continuar. Sem cobrança retroativa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="container max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 font-display">
            Pronto para <span className="underline decoration-white/40 underline-offset-4">crescer</span>?
          </h2>
          <p className="text-white/80 mb-10 max-w-xl mx-auto">
            Junte-se a centenas de estabelecimentos que já transformaram sua operação de delivery.
          </p>
          <Button size="lg" asChild className="bg-white text-orange-600 hover:bg-orange-50 px-10 h-12 font-semibold shadow-lg">
            <Link to="/auth">
              Criar conta grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-gray-400 py-16">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="grid gap-10 md:grid-cols-4 mb-12">
            <div className="md:col-span-2">
              <Link to={getDashboardPath()} className="inline-block mb-4">
                <ChromaKeyImage
                  src={logoUrl}
                  alt="Cardápio On"
                  className="h-8 w-auto brightness-0 invert opacity-70"
                />
              </Link>
              <p className="text-sm leading-relaxed max-w-sm">
                Plataforma completa para gestão de delivery e cardápio digital. 
                Simplifique sua operação e aumente suas vendas.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Produto</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-sm hover:text-orange-400 transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="text-sm hover:text-orange-400 transition-colors">Planos</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Contato</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  contato@cardapon.com.br
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
            <p className="text-gray-500">© 2025 Cardápio On. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <Link to="/termos" className="hover:text-orange-400 transition-colors">Termos de Uso</Link>
              <Link to="/privacidade" className="hover:text-orange-400 transition-colors">Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}