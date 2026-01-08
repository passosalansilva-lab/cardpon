import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface OrderData {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  status: string;
  payment_method: string;
  payment_status: string;
}

interface ReportData {
  orders: OrderData[];
  period: string;
  companyName: string;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    averageTicket: number;
    deliveredOrders: number;
    cancelledOrders: number;
  };
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready: 'Pronto',
  out_for_delivery: 'Em entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const paymentMethodLabels: Record<string, string> = {
  online: 'Online',
  cash: 'Dinheiro',
  card_on_delivery: 'Cartão na entrega',
  pix: 'PIX',
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Reembolsado',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function useReportExport() {
  const exportToPDF = (data: ReportData) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Vendas', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(data.companyName, pageWidth / 2, 28, { align: 'center' });
      doc.text(`Período: ${data.period}`, pageWidth / 2, 35, { align: 'center' });
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 42, { align: 'center' });

      // Summary section
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo', 14, 55);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const summaryData = [
        ['Total de Pedidos', data.stats.totalOrders.toString()],
        ['Faturamento Total', formatCurrency(data.stats.totalRevenue)],
        ['Ticket Médio', formatCurrency(data.stats.averageTicket)],
        ['Pedidos Entregues', data.stats.deliveredOrders.toString()],
        ['Pedidos Cancelados', data.stats.cancelledOrders.toString()],
      ];

      autoTable(doc, {
        startY: 60,
        head: [['Métrica', 'Valor']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 },
        tableWidth: 80,
      });

      // Orders table
      const finalY = (doc as any).lastAutoTable?.finalY || 110;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalhamento de Pedidos', 14, finalY + 15);

      const ordersTableData = data.orders.map((order) => [
        `#${order.id.slice(0, 8)}`,
        format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
        order.customer_name,
        formatCurrency(order.total),
        statusLabels[order.status] || order.status,
        paymentMethodLabels[order.payment_method] || order.payment_method,
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [['Pedido', 'Data', 'Cliente', 'Total', 'Status', 'Pagamento']],
        body: ordersTableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      // Save PDF
      const fileName = `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  const exportToExcel = (data: ReportData) => {
    try {
      // Summary sheet data
      const summaryData = [
        ['Relatório de Vendas'],
        [data.companyName],
        [`Período: ${data.period}`],
        [`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`],
        [],
        ['Resumo'],
        ['Métrica', 'Valor'],
        ['Total de Pedidos', data.stats.totalOrders],
        ['Faturamento Total', data.stats.totalRevenue],
        ['Ticket Médio', data.stats.averageTicket],
        ['Pedidos Entregues', data.stats.deliveredOrders],
        ['Pedidos Cancelados', data.stats.cancelledOrders],
      ];

      // Orders sheet data
      const ordersHeader = [
        'ID do Pedido',
        'Data/Hora',
        'Cliente',
        'Telefone',
        'Subtotal',
        'Taxa de Entrega',
        'Total',
        'Status',
        'Método de Pagamento',
        'Status do Pagamento',
      ];

      const ordersData = data.orders.map((order) => [
        order.id,
        format(new Date(order.created_at), 'dd/MM/yyyy HH:mm'),
        order.customer_name,
        order.customer_phone,
        order.subtotal,
        order.delivery_fee,
        order.total,
        statusLabels[order.status] || order.status,
        paymentMethodLabels[order.payment_method] || order.payment_method,
        paymentStatusLabels[order.payment_status] || order.payment_status,
      ]);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

      // Orders sheet
      const wsOrders = XLSX.utils.aoa_to_sheet([ordersHeader, ...ordersData]);
      wsOrders['!cols'] = [
        { wch: 36 }, // ID
        { wch: 18 }, // Data
        { wch: 25 }, // Cliente
        { wch: 15 }, // Telefone
        { wch: 12 }, // Subtotal
        { wch: 15 }, // Taxa
        { wch: 12 }, // Total
        { wch: 15 }, // Status
        { wch: 20 }, // Pagamento
        { wch: 18 }, // Status Pag
      ];
      XLSX.utils.book_append_sheet(wb, wsOrders, 'Pedidos');

      // Save file
      const fileName = `relatorio-vendas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  return { exportToPDF, exportToExcel };
}
