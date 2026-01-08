import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageTitle } from '@/components/PageTitle';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';

export default function HelpWiki() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <PageTitle>
          <h1 className="text-2xl font-bold tracking-tight">Central de Ajuda</h1>
        </PageTitle>
        <p className="text-sm text-muted-foreground">
          Guia rápido para donos de loja e funcionários. Consulte sempre que tiver dúvida sobre o uso diário do sistema.
        </p>

        <Card>
          <CardContent className="pt-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
              <AccordionItem value="visao-geral">
                <AccordionTrigger>Visão geral do sistema</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>
                    O sistema é dividido em três partes principais: cardápio público (cliente faz pedidos), painel da loja
                    (você gerencia pedidos, cardápio, entregadores e promoções) e painel do entregador (acompanha as entregas).
                  </p>
                  <p>
                    No menu à esquerda você encontra as principais áreas: Dashboard, Pedidos, Cardápio, Entregadores,
                    Promoções, Cupons, Avaliações, Minha Loja e Planos.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="fluxo-pedidos">
                <AccordionTrigger>Fluxo básico de pedidos (do recebimento à entrega)</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Acompanhe a tela de <strong>Pedidos</strong> durante o expediente.</li>
                    <li>
                      Quando chegar um novo pedido, ele aparecerá na coluna <strong>Pendentes</strong> e também como
                      notificação no sino do topo.
                    </li>
                    <li>Clique no pedido, confira itens, endereço e forma de pagamento.</li>
                    <li>Se estiver tudo correto, mude de <strong>Pendente</strong> para <strong>Confirmado</strong>.</li>
                    <li>Quando a cozinha começar, mude para <strong>Preparando</strong>.</li>
                    <li>Pedido pronto e embalado: mude para <strong>Pronto</strong>.</li>
                    <li>Defina o entregador e, quando ele sair, mude para <strong>Em entrega</strong>.</li>
                    <li>Após confirmar com o entregador que o cliente recebeu, mude para <strong>Entregue</strong>.</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="checklist">
                <AccordionTrigger>Checklist rápido para cada pedido</AccordionTrigger>
                <AccordionContent className="text-sm space-y-1">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verificou se há novo pedido em <strong>Pendentes</strong> ou no sino?</li>
                    <li>Conferiu itens, valor, forma de pagamento e endereço completo?</li>
                    <li>Ligou para o cliente se faltava alguma informação importante?</li>
                    <li>Atualizou o status no sistema em cada etapa (Confirmado, Preparando, Pronto, Em entrega, Entregue)?</li>
                    <li>Falou com o responsável antes de cancelar qualquer pedido?</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="situacoes">
                <AccordionTrigger>Situações comuns e o que fazer</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p className="font-medium">Endereço incompleto</p>
                  <ul className="list-disc list-inside mb-2">
                    <li>Ligue para o cliente usando o telefone do pedido.</li>
                    <li>Complete o endereço nas observações internas.</li>
                    <li>Se não conseguir contato, avise o responsável para decidir se o pedido será cancelado.</li>
                  </ul>

                  <p className="font-medium">Produto ou sabor indisponível</p>
                  <ul className="list-disc list-inside mb-2">
                    <li>Ligue para o cliente e ofereça troca de produto ou sabor.</li>
                    <li>Se o cliente aceitar, ajuste o pedido conforme a política da loja.</li>
                    <li>Se não aceitar, alinhe com o responsável e cancele o pedido.</li>
                  </ul>

                  <p className="font-medium">Pagamento online com problema</p>
                  <ul className="list-disc list-inside">
                    <li>Verifique se o pagamento foi realmente aprovado.</li>
                    <li>Se estiver pendente ou falhou, entre em contato com o cliente.</li>
                    <li>Nunca libere o pedido sem uma forma de pagamento combinada e registrada.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="onde-ficar">
                <AccordionTrigger>Onde devo ficar durante o expediente?</AccordionTrigger>
                <AccordionContent className="text-sm space-y-2">
                  <p>
                    Mantenha a tela de <strong>Pedidos</strong> aberta o tempo todo. É nela que você acompanha novas vendas,
                    muda status e organiza a cozinha e as entregas.
                  </p>
                  <p>
                    Use o ícone de <strong>notificações</strong> (sino) apenas como apoio para saber que chegou algo novo ou
                    que há avisos importantes do sistema.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq">
                <AccordionTrigger>FAQ rápido: dúvidas mais comuns</AccordionTrigger>
                <AccordionContent className="text-sm space-y-4">
                  <section>
                    <p className="font-medium">Pedidos</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <strong>Não vejo um pedido novo, o que faço?</strong> Atualize a página de <strong>Pedidos</strong> e
                        confira se o filtro está mostrando todos os status.
                      </li>
                      <li>
                        <strong>Posso editar um pedido depois de confirmar?</strong> Combine com o responsável; em geral,
                        é melhor cancelar e refazer o pedido corretamente.
                      </li>
                      <li>
                        <strong>O cliente quer mudar o endereço.</strong> Alinhe por telefone e registre a mudança nas
                        observações internas do pedido.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <p className="font-medium">Pagamentos</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <strong>Pagamento online não confirmou.</strong> Verifique o status do pagamento; se estiver pendente
                        ou falhou, ligue para o cliente antes de prosseguir.
                      </li>
                      <li>
                        <strong>Cliente vai pagar em dinheiro.</strong> Marque a forma de pagamento correta e registre se
                        precisa de troco em <strong>observações</strong>.
                      </li>
                      <li>
                        <strong>Forma de pagamento diferente na entrega.</strong> Alinhe com o responsável e atualize o
                        registro no sistema.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <p className="font-medium">Notificações</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <strong>O sino não apareceu, mas chegou pedido.</strong> Sempre confira a tela de
                        <strong> Pedidos</strong>; o sino é um apoio, não a única forma de aviso.
                      </li>
                      <li>
                        <strong>Há muitas notificações acumuladas.</strong> Leia os avisos importantes e limpe as que já
                        foram resolvidas.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <p className="font-medium">Entregadores</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>
                        <strong>Não tem entregador disponível.</strong> Avise o responsável imediatamente para decidir se
                        pausa os pedidos ou atrasa o prazo.
                      </li>
                      <li>
                        <strong>Entregador atrasou muito.</strong> Confirme com ele a situação e, se necessário, avise o
                        cliente sobre o novo horário estimado.
                      </li>
                      <li>
                        <strong>Vou trocar o entregador de um pedido.</strong> Atualize o pedido no sistema e informe ambos:
                        o entregador anterior e o novo.
                      </li>
                    </ul>
                  </section>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
