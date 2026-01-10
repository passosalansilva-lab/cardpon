import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
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
          Política de Privacidade
        </h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-sm text-gray-500 mb-8">Última atualização: Janeiro de 2025</p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">1. Introdução</h2>
            <p className="text-gray-600 leading-relaxed">
              A sua privacidade é importante para nós. Esta Política de Privacidade explica como o Cardápio On 
              coleta, usa, armazena e protege suas informações pessoais em conformidade com a Lei Geral de 
              Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">2. Dados que Coletamos</h2>
            
            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">2.1. Dados dos Estabelecimentos</h3>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Nome do estabelecimento e razão social</li>
              <li>CNPJ e Inscrição Estadual</li>
              <li>Endereço comercial</li>
              <li>E-mail e telefone de contato</li>
              <li>Dados bancários para recebimento de pagamentos</li>
              <li>Informações do cardápio (produtos, preços, fotos)</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">2.2. Dados dos Clientes Finais</h3>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Nome completo</li>
              <li>Telefone celular</li>
              <li>E-mail (quando fornecido)</li>
              <li>Endereço de entrega</li>
              <li>Histórico de pedidos</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">2.3. Dados de Navegação</h3>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Endereço IP</li>
              <li>Tipo de navegador e dispositivo</li>
              <li>Páginas visitadas e tempo de permanência</li>
              <li>Cookies e tecnologias similares</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">3. Como Utilizamos seus Dados</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Utilizamos seus dados para as seguintes finalidades:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Prestação e melhoria dos nossos serviços</li>
              <li>Processamento de pedidos e pagamentos</li>
              <li>Comunicação sobre atualizações, promoções e novidades</li>
              <li>Emissão de notas fiscais eletrônicas</li>
              <li>Análises estatísticas e relatórios de desempenho</li>
              <li>Prevenção de fraudes e segurança da plataforma</li>
              <li>Cumprimento de obrigações legais e regulatórias</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">4. Base Legal para Tratamento</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              O tratamento de dados pessoais pelo Cardápio On é fundamentado nas seguintes bases legais da LGPD:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Execução de contrato:</strong> para prestação dos serviços contratados</li>
              <li><strong>Consentimento:</strong> para comunicações de marketing e promoções</li>
              <li><strong>Interesse legítimo:</strong> para melhorias na plataforma e prevenção de fraudes</li>
              <li><strong>Obrigação legal:</strong> para emissão de notas fiscais e cumprimento de leis tributárias</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">5. Compartilhamento de Dados</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Podemos compartilhar seus dados com:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Gateways de pagamento:</strong> Mercado Pago e PicPay para processamento de transações</li>
              <li><strong>Emissores de NF-e:</strong> Focus NFe para emissão de notas fiscais</li>
              <li><strong>Serviços de geolocalização:</strong> Mapbox para rastreamento de entregas</li>
              <li><strong>Autoridades governamentais:</strong> quando exigido por lei ou ordem judicial</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              Não vendemos, alugamos ou comercializamos seus dados pessoais para terceiros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">6. Armazenamento e Segurança</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Adotamos medidas técnicas e organizacionais para proteger seus dados:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
              <li>Criptografia de dados sensíveis em repouso</li>
              <li>Controle de acesso baseado em funções</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares com redundância geográfica</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              Seus dados são armazenados em servidores seguros localizados no Brasil e nos Estados Unidos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">7. Retenção de Dados</h2>
            <p className="text-gray-600 leading-relaxed">
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política 
              ou conforme exigido por lei. Dados fiscais são mantidos pelo prazo legal de 5 anos. 
              Após o cancelamento da conta, dados pessoais são excluídos em até 30 dias, exceto quando 
              necessária retenção por obrigação legal.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. Seus Direitos</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Conforme a LGPD, você tem direito a:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> solicitar correção de dados incompletos ou incorretos</li>
              <li><strong>Anonimização ou exclusão:</strong> solicitar eliminação de dados desnecessários</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado</li>
              <li><strong>Revogação do consentimento:</strong> retirar consentimento a qualquer momento</li>
              <li><strong>Oposição:</strong> opor-se a tratamentos baseados em interesse legítimo</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              Para exercer seus direitos, entre em contato através do e-mail contato@cardapon.com.br
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">9. Cookies</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Utilizamos cookies para:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Cookies essenciais:</strong> necessários para funcionamento da plataforma</li>
              <li><strong>Cookies de desempenho:</strong> para análise de uso e melhorias</li>
              <li><strong>Cookies de funcionalidade:</strong> para lembrar suas preferências</li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              Você pode gerenciar cookies através das configurações do seu navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">10. Menores de Idade</h2>
            <p className="text-gray-600 leading-relaxed">
              Nossos serviços são destinados a pessoas maiores de 18 anos. Não coletamos intencionalmente 
              dados de menores de idade. Se tomarmos conhecimento de que coletamos dados de um menor, 
              tomaremos medidas para excluí-los imediatamente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">11. Alterações nesta Política</h2>
            <p className="text-gray-600 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Alterações significativas 
              serão comunicadas por e-mail ou através de aviso na plataforma. Recomendamos revisar 
              esta página regularmente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">12. Contato e Encarregado de Dados</h2>
            <p className="text-gray-600 leading-relaxed">
              Para questões sobre esta Política de Privacidade ou exercício de seus direitos, entre em contato:
            </p>
            <div className="mt-4 text-gray-600">
              <p><strong>E-mail:</strong> contato@cardapon.com.br</p>
              <p className="mt-2"><strong>Encarregado de Proteção de Dados (DPO):</strong> contato@cardapon.com.br</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
