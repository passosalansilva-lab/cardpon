import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <div className="container max-w-4xl mx-auto px-6 py-12">
        <Button variant="ghost" asChild className="mb-8 text-gray-600 hover:text-orange-600">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-8 font-display">
          Termos de Uso
        </h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-500 mb-8">Última atualização: Janeiro de 2025</p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Aceitação dos Termos</h2>
            <p className="text-gray-600 leading-relaxed">
              Ao acessar e utilizar a plataforma Cardápio On, você concorda em cumprir e estar vinculado a estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não poderá acessar ou usar nossos serviços.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. Descrição do Serviço</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              O Cardápio On é uma plataforma de gestão de delivery e cardápio digital que oferece:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Criação e gerenciamento de cardápio digital</li>
              <li>Recebimento e gestão de pedidos online</li>
              <li>Integração com meios de pagamento (PIX, cartão de crédito via Mercado Pago e PicPay)</li>
              <li>Gestão de entregas e rastreamento em tempo real</li>
              <li>Emissão de notas fiscais eletrônicas (NF-e/NFC-e)</li>
              <li>Relatórios e análises de vendas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. Cadastro e Conta</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Para utilizar nossos serviços, você deve:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Ter no mínimo 18 anos de idade</li>
              <li>Fornecer informações verdadeiras, precisas e completas</li>
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Notificar imediatamente sobre qualquer uso não autorizado da sua conta</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              Você é responsável por todas as atividades realizadas em sua conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Planos e Pagamentos</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              O Cardápio On oferece planos gratuitos e pagos baseados no faturamento mensal do estabelecimento:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>O plano gratuito é válido para faturamento de até R$ 2.000/mês</li>
              <li>Ao ultrapassar este limite, será necessário escolher um plano pago</li>
              <li>Os valores dos planos estão sujeitos a alterações mediante aviso prévio</li>
              <li>O não pagamento pode resultar na suspensão do acesso aos serviços</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Uso Aceitável</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Ao utilizar a plataforma, você concorda em NÃO:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Violar leis, regulamentos ou direitos de terceiros</li>
              <li>Publicar conteúdo falso, enganoso ou ilegal</li>
              <li>Utilizar a plataforma para fins fraudulentos</li>
              <li>Tentar acessar dados de outros usuários sem autorização</li>
              <li>Interferir no funcionamento adequado da plataforma</li>
              <li>Revender ou sublicenciar nossos serviços sem autorização</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Propriedade Intelectual</h2>
            <p className="text-gray-600 leading-relaxed">
              Todo o conteúdo da plataforma, incluindo mas não limitado a textos, gráficos, logotipos, ícones, imagens, 
              código-fonte e software, é propriedade exclusiva do Cardápio On ou de seus licenciadores e está protegido 
              por leis de direitos autorais e propriedade intelectual.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. Conteúdo do Usuário</h2>
            <p className="text-gray-600 leading-relaxed">
              Você mantém a propriedade de todo conteúdo que enviar à plataforma (fotos, descrições de produtos, etc.). 
              Ao enviar conteúdo, você nos concede uma licença não exclusiva para usar, exibir e distribuir esse conteúdo 
              exclusivamente para a prestação dos nossos serviços.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. Limitação de Responsabilidade</h2>
            <p className="text-gray-600 leading-relaxed">
              O Cardápio On não se responsabiliza por:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2 mt-4">
              <li>Interrupções temporárias do serviço por manutenção ou problemas técnicos</li>
              <li>Perdas resultantes de uso indevido da plataforma pelo usuário</li>
              <li>Disputas entre estabelecimentos e seus clientes finais</li>
              <li>Falhas em integrações de terceiros (gateways de pagamento, emissores de NF-e, etc.)</li>
              <li>Danos indiretos, incidentais ou consequenciais</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">9. Cancelamento e Rescisão</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Você pode cancelar sua conta a qualquer momento. O Cardápio On reserva-se o direito de suspender ou 
              encerrar contas que violem estes termos, sem aviso prévio.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Após o cancelamento, seus dados serão mantidos por até 30 dias para eventual recuperação, 
              após o que serão permanentemente excluídos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">10. Alterações nos Termos</h2>
            <p className="text-gray-600 leading-relaxed">
              Podemos atualizar estes Termos de Uso periodicamente. Alterações significativas serão comunicadas 
              por e-mail ou através de aviso na plataforma. O uso continuado dos serviços após as alterações 
              constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">11. Legislação Aplicável</h2>
            <p className="text-gray-600 leading-relaxed">
              Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Qualquer disputa 
              será submetida ao foro da comarca de São Paulo, SP, com exclusão de qualquer outro.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">12. Contato</h2>
            <p className="text-gray-600 leading-relaxed">
              Para dúvidas sobre estes Termos de Uso, entre em contato conosco:
            </p>
            <p className="text-gray-600 mt-2">
              <strong>E-mail:</strong> contato@cardapon.com.br
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
