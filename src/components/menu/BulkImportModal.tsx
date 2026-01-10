import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, Check, X, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface Category {
  id: string;
  name: string;
}

interface ImportRow {
  name: string;
  description?: string;
  price: number;
  category?: string;
  tags?: string;
  preparation_time?: number;
  valid: boolean;
  errors: string[];
}

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  categories: Category[];
  onImported: () => void;
}

export function BulkImportModal({ open, onClose, companyId, categories, onImported }: BulkImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const parsed: ImportRow[] = jsonData.map((row: any) => {
        const errors: string[] = [];
        const name = String(row['Nome'] || row['nome'] || row['name'] || '').trim();
        const description = String(row['Descrição'] || row['descricao'] || row['description'] || '').trim();
        const priceStr = String(row['Preço'] || row['preco'] || row['price'] || '0');
        const price = parseFloat(priceStr.replace(',', '.').replace(/[^\d.]/g, ''));
        const category = String(row['Categoria'] || row['categoria'] || row['category'] || '').trim();
        const tags = String(row['Selos'] || row['selos'] || row['tags'] || '').trim();
        const prepTimeStr = String(row['Tempo Preparo'] || row['tempo_preparo'] || row['preparation_time'] || '');
        const preparation_time = parseInt(prepTimeStr) || undefined;

        if (!name) errors.push('Nome obrigatório');
        if (isNaN(price) || price < 0) errors.push('Preço inválido');

        return {
          name,
          description: description || undefined,
          price: isNaN(price) ? 0 : price,
          category: category || undefined,
          tags: tags || undefined,
          preparation_time,
          valid: errors.length === 0,
          errors,
        };
      });

      setParsedData(parsed);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: 'Erro ao ler arquivo',
        description: 'O arquivo não pôde ser processado. Verifique o formato.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!companyId || !defaultCategoryId) {
      toast({
        title: 'Selecione uma categoria',
        description: 'Escolha a categoria padrão para os produtos importados.',
        variant: 'destructive',
      });
      return;
    }

    const validRows = parsedData.filter((row) => row.valid);
    if (validRows.length === 0) {
      toast({
        title: 'Nenhum produto válido',
        description: 'Corrija os erros antes de importar.',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      let imported = 0;
      for (const row of validRows) {
        // Find category by name or use default
        let categoryId = defaultCategoryId;
        if (row.category) {
          const matchedCategory = categories.find(
            (c) => c.name.toLowerCase() === row.category?.toLowerCase()
          );
          if (matchedCategory) {
            categoryId = matchedCategory.id;
          }
        }

        // Parse tags
        const tags = row.tags
          ? row.tags.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '_'))
          : [];

        const { error } = await supabase.from('products').insert({
          company_id: companyId,
          name: row.name,
          description: row.description || null,
          price: row.price,
          category_id: categoryId,
          tags,
          preparation_time_minutes: row.preparation_time || 30,
          is_active: true,
          is_featured: false,
        });

        if (error) {
          console.error('Error importing product:', row.name, error);
        } else {
          imported++;
        }

        setImportProgress(Math.round((imported / validRows.length) * 100));
      }

      toast({
        title: 'Importação concluída',
        description: `${imported} de ${validRows.length} produtos importados com sucesso.`,
      });

      onImported();
      handleClose();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setParsedData([]);
    setImportProgress(0);
    onClose();
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Nome': 'Hambúrguer Clássico',
        'Descrição': 'Pão, carne 150g, queijo, alface e tomate',
        'Preço': '29.90',
        'Categoria': 'Lanches',
        'Selos': 'mais_vendido, favorito_casa',
        'Tempo Preparo': '20',
      },
      {
        'Nome': 'Salada Caesar',
        'Descrição': 'Alface romana, croutons, parmesão e molho caesar',
        'Preço': '24.50',
        'Categoria': 'Saladas',
        'Selos': 'vegetariano',
        'Tempo Preparo': '10',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'modelo_importacao_produtos.xlsx');
  };

  const validCount = parsedData.filter((r) => r.valid).length;
  const invalidCount = parsedData.filter((r) => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Produtos em Massa
          </DialogTitle>
          <DialogDescription>
            Importe produtos de uma planilha Excel ou CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A planilha deve conter as colunas: <strong>Nome</strong> (obrigatório), <strong>Preço</strong> (obrigatório), 
                Descrição, Categoria, Selos, Tempo Preparo
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Categoria padrão <span className="text-destructive">*</span></Label>
              <Select value={defaultCategoryId} onValueChange={setDefaultCategoryId}>
                <SelectTrigger className={!defaultCategoryId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione a categoria padrão" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Produtos sem categoria especificada serão adicionados nesta categoria
              </p>
            </div>

            <div className="flex justify-center">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar modelo de planilha
              </Button>
            </div>

            <div
              onClick={() => {
                if (!defaultCategoryId) {
                  toast({
                    title: 'Selecione uma categoria',
                    description: 'Escolha a categoria padrão antes de selecionar o arquivo.',
                    variant: 'destructive',
                  });
                  return;
                }
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                defaultCategoryId 
                  ? 'cursor-pointer hover:border-primary' 
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {defaultCategoryId 
                  ? 'Clique para selecionar ou arraste seu arquivo aqui'
                  : 'Selecione uma categoria acima primeiro'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Suporta: .xlsx, .xls, .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
                disabled={!defaultCategoryId}
              />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {validCount} válidos
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <X className="h-3 w-3" />
                    {invalidCount} com erros
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                Escolher outro arquivo
              </Button>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Selos</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, index) => (
                    <TableRow key={index} className={row.valid ? '' : 'bg-destructive/5'}>
                      <TableCell>
                        {row.valid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.name || '-'}</TableCell>
                      <TableCell>R$ {row.price.toFixed(2)}</TableCell>
                      <TableCell>{row.category || 'Padrão'}</TableCell>
                      <TableCell>
                        {row.tags && (
                          <span className="text-xs text-muted-foreground">{row.tags}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.errors.length > 0 && (
                          <span className="text-xs text-destructive">{row.errors.join(', ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedData.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Mostrando 50 de {parsedData.length} produtos
              </p>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="text-lg font-medium">Importando produtos...</p>
            <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${importProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{importProgress}% concluído</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancelar
          </Button>
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={validCount === 0 || !defaultCategoryId}>
              Importar {validCount} produto{validCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
