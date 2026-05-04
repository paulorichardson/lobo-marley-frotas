export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abastecimentos: {
        Row: {
          bem_descricao: string | null
          bem_identificacao: string | null
          combustivel: string | null
          comprovante_url: string | null
          criado_em: string
          data_hora: string
          empresa_id: string | null
          fornecedor_id: string | null
          id: string
          km_atual: number | null
          litros: number
          motorista_id: string | null
          nota_fiscal: string | null
          observacoes: string | null
          posto: string | null
          valor_litro: number
          valor_total: number | null
          veiculo_id: string | null
          via_qrcode: boolean
        }
        Insert: {
          bem_descricao?: string | null
          bem_identificacao?: string | null
          combustivel?: string | null
          comprovante_url?: string | null
          criado_em?: string
          data_hora?: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          km_atual?: number | null
          litros: number
          motorista_id?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          posto?: string | null
          valor_litro: number
          valor_total?: number | null
          veiculo_id?: string | null
          via_qrcode?: boolean
        }
        Update: {
          bem_descricao?: string | null
          bem_identificacao?: string | null
          combustivel?: string | null
          comprovante_url?: string | null
          criado_em?: string
          data_hora?: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          km_atual?: number | null
          litros?: number
          motorista_id?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          posto?: string | null
          valor_litro?: number
          valor_total?: number | null
          veiculo_id?: string | null
          via_qrcode?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_financeira: {
        Row: {
          acao: string
          contrato_id: string | null
          criado_em: string
          empresa_id: string | null
          id: string
          justificativa: string | null
          manutencao_id: string | null
          usuario_id: string | null
          valores_antes: Json | null
          valores_depois: Json | null
        }
        Insert: {
          acao: string
          contrato_id?: string | null
          criado_em?: string
          empresa_id?: string | null
          id?: string
          justificativa?: string | null
          manutencao_id?: string | null
          usuario_id?: string | null
          valores_antes?: Json | null
          valores_depois?: Json | null
        }
        Update: {
          acao?: string
          contrato_id?: string | null
          criado_em?: string
          empresa_id?: string | null
          id?: string
          justificativa?: string | null
          manutencao_id?: string | null
          usuario_id?: string | null
          valores_antes?: Json | null
          valores_depois?: Json | null
        }
        Relationships: []
      }
      checklists: {
        Row: {
          agua_ok: boolean
          aprovado_por: string | null
          assinatura_url: string | null
          combustivel_ok: boolean
          criado_em: string
          data_hora: string
          documentos_ok: boolean
          empresa_id: string | null
          foto_hodometro_url: string | null
          freios_ok: boolean
          id: string
          km_registrado: number | null
          lataria_ok: boolean
          luzes_ok: boolean
          motorista_id: string
          observacoes: string | null
          oleo_ok: boolean
          pneus_ok: boolean
          status: string
          tipo: string
          veiculo_id: string
        }
        Insert: {
          agua_ok?: boolean
          aprovado_por?: string | null
          assinatura_url?: string | null
          combustivel_ok?: boolean
          criado_em?: string
          data_hora?: string
          documentos_ok?: boolean
          empresa_id?: string | null
          foto_hodometro_url?: string | null
          freios_ok?: boolean
          id?: string
          km_registrado?: number | null
          lataria_ok?: boolean
          luzes_ok?: boolean
          motorista_id: string
          observacoes?: string | null
          oleo_ok?: boolean
          pneus_ok?: boolean
          status?: string
          tipo?: string
          veiculo_id: string
        }
        Update: {
          agua_ok?: boolean
          aprovado_por?: string | null
          assinatura_url?: string | null
          combustivel_ok?: boolean
          criado_em?: string
          data_hora?: string
          documentos_ok?: boolean
          empresa_id?: string | null
          foto_hodometro_url?: string | null
          freios_ok?: boolean
          id?: string
          km_registrado?: number | null
          lataria_ok?: boolean
          luzes_ok?: boolean
          motorista_id?: string
          observacoes?: string | null
          oleo_ok?: boolean
          pneus_ok?: boolean
          status?: string
          tipo?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_clientes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          exigir_justificativa: boolean
          id: string
          margem_alerta: number
          margem_minima: number
          numero_contrato: string | null
          numero_processo: string | null
          observacoes: string | null
          percentual_taxa: number
          permitir_prejuizo: boolean
          tipo_taxa: string
          valor_global: number | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          exigir_justificativa?: boolean
          id?: string
          margem_alerta?: number
          margem_minima?: number
          numero_contrato?: string | null
          numero_processo?: string | null
          observacoes?: string | null
          percentual_taxa?: number
          permitir_prejuizo?: boolean
          tipo_taxa?: string
          valor_global?: number | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          exigir_justificativa?: boolean
          id?: string
          margem_alerta?: number
          margem_minima?: number
          numero_contrato?: string | null
          numero_processo?: string | null
          observacoes?: string | null
          percentual_taxa?: number
          permitir_prejuizo?: boolean
          tipo_taxa?: string
          valor_global?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          comprovante_url: string | null
          criado_em: string
          data_despesa: string
          descricao: string | null
          empresa_id: string | null
          id: string
          lancado_por: string | null
          observacoes: string | null
          tipo: string
          valor: number
          veiculo_id: string
        }
        Insert: {
          comprovante_url?: string | null
          criado_em?: string
          data_despesa?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          lancado_por?: string | null
          observacoes?: string | null
          tipo: string
          valor: number
          veiculo_id: string
        }
        Update: {
          comprovante_url?: string | null
          criado_em?: string
          data_despesa?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          lancado_por?: string | null
          observacoes?: string | null
          tipo?: string
          valor?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_lancado_por_fkey"
            columns: ["lancado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          atualizado_em: string
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          criado_em: string
          criado_por: string | null
          data_inicio: string | null
          data_vencimento: string | null
          email: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          limite_veiculos: number | null
          logo_url: string | null
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          plano: string
          razao_social: string
          site: string | null
          status: string
          telefone: string | null
          valor_mensal: number | null
        }
        Insert: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          data_vencimento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          limite_veiculos?: number | null
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          plano?: string
          razao_social: string
          site?: string | null
          status?: string
          telefone?: string | null
          valor_mensal?: number | null
        }
        Update: {
          atualizado_em?: string
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          data_vencimento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          limite_veiculos?: number | null
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          plano?: string
          razao_social?: string
          site?: string | null
          status?: string
          telefone?: string | null
          valor_mensal?: number | null
        }
        Relationships: []
      }
      faturas: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_emissao: string | null
          data_pagamento: string | null
          empresa_id: string | null
          id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          taxa_gestao_percentual: number | null
          valor_abastecimentos: number | null
          valor_despesas: number | null
          valor_servicos: number | null
          valor_taxa: number | null
          valor_total: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          taxa_gestao_percentual?: number | null
          valor_abastecimentos?: number | null
          valor_despesas?: number | null
          valor_servicos?: number | null
          valor_taxa?: number | null
          valor_total?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          taxa_gestao_percentual?: number | null
          valor_abastecimentos?: number | null
          valor_despesas?: number | null
          valor_servicos?: number | null
          valor_taxa?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_cadastro: {
        Row: {
          aceitou_dados_bancarios: boolean
          aceitou_termos: boolean
          agencia: string | null
          aprovado_por: string | null
          atualizado_em: string
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          complemento: string | null
          conta: string | null
          criado_em: string
          data_aprovacao: string | null
          email_login: string
          estado: string | null
          id: string
          logo_url: string | null
          logradouro: string | null
          motivo_reprovacao: string | null
          nome_fantasia: string | null
          numero: string | null
          pix_chave: string | null
          pix_tipo: string | null
          razao_social: string
          responsavel_cargo: string | null
          responsavel_cpf: string | null
          responsavel_nome: string
          status: string
          telefone: string | null
          tipo_conta: string | null
          tipos_fornecimento: string[]
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          aceitou_dados_bancarios?: boolean
          aceitou_termos?: boolean
          agencia?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          complemento?: string | null
          conta?: string | null
          criado_em?: string
          data_aprovacao?: string | null
          email_login: string
          estado?: string | null
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          motivo_reprovacao?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social: string
          responsavel_cargo?: string | null
          responsavel_cpf?: string | null
          responsavel_nome: string
          status?: string
          telefone?: string | null
          tipo_conta?: string | null
          tipos_fornecimento?: string[]
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          aceitou_dados_bancarios?: boolean
          aceitou_termos?: boolean
          agencia?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          complemento?: string | null
          conta?: string | null
          criado_em?: string
          data_aprovacao?: string | null
          email_login?: string
          estado?: string | null
          id?: string
          logo_url?: string | null
          logradouro?: string | null
          motivo_reprovacao?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social?: string
          responsavel_cargo?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string
          status?: string
          telefone?: string | null
          tipo_conta?: string | null
          tipos_fornecimento?: string[]
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      manutencao_pecas: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          manutencao_id: string
          quantidade: number
          valor_unitario: number
        }
        Insert: {
          criado_em?: string
          descricao: string
          id?: string
          manutencao_id: string
          quantidade?: number
          valor_unitario: number
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          manutencao_id?: string
          quantidade?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "manutencao_pecas_manutencao_id_fkey"
            columns: ["manutencao_id"]
            isOneToOne: false
            referencedRelation: "manutencoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_pecas_manutencao_id_fkey"
            columns: ["manutencao_id"]
            isOneToOne: false
            referencedRelation: "manutencoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      manutencoes: {
        Row: {
          aprovado_admin_id: string | null
          aprovado_nome: string | null
          aprovado_por: string | null
          atualizado_em: string
          avaliacao_comentario: string | null
          avaliacao_estrelas: number | null
          codigo_autorizacao: string | null
          comprovante_url: string | null
          confirmada_pelo_solicitante: boolean
          criado_em: string
          custo_fornecedor: number | null
          data_aprovacao: string | null
          data_conclusao: string | null
          data_envio_faturamento: string | null
          data_inicio: string | null
          data_solicitacao: string
          desconto: number | null
          descricao: string
          diagnostico: string | null
          empresa_id: string | null
          enviado_para_rede: boolean | null
          exigir_orcamento: boolean | null
          fornecedor_id: string | null
          id: string
          justificativa_prejuizo: string | null
          km_na_manutencao: number | null
          lucro_bruto: number | null
          margem_percentual: number | null
          nota_fiscal: string | null
          numero_os: string | null
          observacoes: string | null
          oficina_nome: string | null
          os_oficina: string | null
          percentual_aplicado: number | null
          prazo_esperado: string | null
          prioridade: string
          servico_executado: string | null
          solicitacao_pai_id: string | null
          solicitado_por: string | null
          status: string
          status_financeiro: string | null
          tipo: string
          total_orcamentos_recebidos: number | null
          validade_orcamento: string | null
          valor_bruto_pecas: number | null
          valor_bruto_servicos: number | null
          valor_final: number | null
          valor_liquido_faturavel: number | null
          valor_mao_obra: number | null
          valor_maximo_autorizado: number | null
          valor_previsto: number | null
          veiculo_id: string
        }
        Insert: {
          aprovado_admin_id?: string | null
          aprovado_nome?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_estrelas?: number | null
          codigo_autorizacao?: string | null
          comprovante_url?: string | null
          confirmada_pelo_solicitante?: boolean
          criado_em?: string
          custo_fornecedor?: number | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_envio_faturamento?: string | null
          data_inicio?: string | null
          data_solicitacao?: string
          desconto?: number | null
          descricao: string
          diagnostico?: string | null
          empresa_id?: string | null
          enviado_para_rede?: boolean | null
          exigir_orcamento?: boolean | null
          fornecedor_id?: string | null
          id?: string
          justificativa_prejuizo?: string | null
          km_na_manutencao?: number | null
          lucro_bruto?: number | null
          margem_percentual?: number | null
          nota_fiscal?: string | null
          numero_os?: string | null
          observacoes?: string | null
          oficina_nome?: string | null
          os_oficina?: string | null
          percentual_aplicado?: number | null
          prazo_esperado?: string | null
          prioridade?: string
          servico_executado?: string | null
          solicitacao_pai_id?: string | null
          solicitado_por?: string | null
          status?: string
          status_financeiro?: string | null
          tipo: string
          total_orcamentos_recebidos?: number | null
          validade_orcamento?: string | null
          valor_bruto_pecas?: number | null
          valor_bruto_servicos?: number | null
          valor_final?: number | null
          valor_liquido_faturavel?: number | null
          valor_mao_obra?: number | null
          valor_maximo_autorizado?: number | null
          valor_previsto?: number | null
          veiculo_id: string
        }
        Update: {
          aprovado_admin_id?: string | null
          aprovado_nome?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_estrelas?: number | null
          codigo_autorizacao?: string | null
          comprovante_url?: string | null
          confirmada_pelo_solicitante?: boolean
          criado_em?: string
          custo_fornecedor?: number | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_envio_faturamento?: string | null
          data_inicio?: string | null
          data_solicitacao?: string
          desconto?: number | null
          descricao?: string
          diagnostico?: string | null
          empresa_id?: string | null
          enviado_para_rede?: boolean | null
          exigir_orcamento?: boolean | null
          fornecedor_id?: string | null
          id?: string
          justificativa_prejuizo?: string | null
          km_na_manutencao?: number | null
          lucro_bruto?: number | null
          margem_percentual?: number | null
          nota_fiscal?: string | null
          numero_os?: string | null
          observacoes?: string | null
          oficina_nome?: string | null
          os_oficina?: string | null
          percentual_aplicado?: number | null
          prazo_esperado?: string | null
          prioridade?: string
          servico_executado?: string | null
          solicitacao_pai_id?: string | null
          solicitado_por?: string | null
          status?: string
          status_financeiro?: string | null
          tipo?: string
          total_orcamentos_recebidos?: number | null
          validade_orcamento?: string | null
          valor_bruto_pecas?: number | null
          valor_bruto_servicos?: number | null
          valor_final?: number | null
          valor_liquido_faturavel?: number | null
          valor_mao_obra?: number | null
          valor_maximo_autorizado?: number | null
          valor_previsto?: number | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          para_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          para_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          para_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_para_id_fkey"
            columns: ["para_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      os_eventos: {
        Row: {
          acao: string
          criado_em: string
          id: string
          manutencao_id: string
          observacao: string | null
          perfil: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: string
          manutencao_id: string
          observacao?: string | null
          perfil?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: string
          manutencao_id?: string
          observacao?: string | null
          perfil?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_eventos_manutencao_id_fkey"
            columns: ["manutencao_id"]
            isOneToOne: false
            referencedRelation: "manutencoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_eventos_manutencao_id_fkey"
            columns: ["manutencao_id"]
            isOneToOne: false
            referencedRelation: "manutencoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_itens: {
        Row: {
          criado_em: string
          id: string
          pagamento_id: string
          servico_id: string
          tipo_servico: string
          valor_aplicado: number
        }
        Insert: {
          criado_em?: string
          id?: string
          pagamento_id: string
          servico_id: string
          tipo_servico: string
          valor_aplicado: number
        }
        Update: {
          criado_em?: string
          id?: string
          pagamento_id?: string
          servico_id?: string
          tipo_servico?: string
          valor_aplicado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_itens_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos_fornecedor"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_fornecedor: {
        Row: {
          comprovante_url: string | null
          criado_em: string
          data_pagamento: string
          forma_pagamento: string
          fornecedor_id: string
          id: string
          observacoes: string | null
          pago_por: string | null
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          criado_em?: string
          data_pagamento?: string
          forma_pagamento: string
          fornecedor_id: string
          id?: string
          observacoes?: string | null
          pago_por?: string | null
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          criado_em?: string
          data_pagamento?: string
          forma_pagamento?: string
          fornecedor_id?: string
          id?: string
          observacoes?: string | null
          pago_por?: string | null
          valor?: number
        }
        Relationships: []
      }
      perfis: {
        Row: {
          ativo: boolean
          atualizado_em: string
          avatar_url: string | null
          criado_em: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          email: string
          empresa_id?: string | null
          id: string
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string
          empresa_id: string | null
          foto_url: string | null
          id: string
          manutencao_id: string | null
          motorista_id: string
          resposta_gestor: string | null
          status: string
          tipo_problema: string
          urgencia: string
          veiculo_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao: string
          empresa_id?: string | null
          foto_url?: string | null
          id?: string
          manutencao_id?: string | null
          motorista_id: string
          resposta_gestor?: string | null
          status?: string
          tipo_problema: string
          urgencia?: string
          veiculo_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string
          empresa_id?: string | null
          foto_url?: string | null
          id?: string
          manutencao_id?: string | null
          motorista_id?: string
          resposta_gestor?: string | null
          status?: string
          tipo_problema?: string
          urgencia?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_manutencao_id_fkey"
            columns: ["manutencao_id"]
            isOneToOne: false
            referencedRelation: "manutencoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_manutencao_id_fkey"
            columns: ["manutencao_id"]
            isOneToOne: false
            referencedRelation: "manutencoes_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculo_fotos: {
        Row: {
          criado_em: string
          empresa_id: string | null
          enviado_por: string | null
          id: string
          legenda: string | null
          tipo: string
          url: string
          veiculo_id: string
        }
        Insert: {
          criado_em?: string
          empresa_id?: string | null
          enviado_por?: string | null
          id?: string
          legenda?: string | null
          tipo?: string
          url: string
          veiculo_id: string
        }
        Update: {
          criado_em?: string
          empresa_id?: string | null
          enviado_por?: string | null
          id?: string
          legenda?: string | null
          tipo?: string
          url?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculo_fotos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_fotos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_fotos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano_fabricacao: number | null
          ano_modelo: number | null
          atualizado_em: string
          cadastrado_por: string | null
          categoria: string | null
          chassi: string | null
          combustivel: string | null
          cor: string | null
          criado_em: string
          doc_crlv_url: string | null
          doc_seguro_url: string | null
          empresa_id: string | null
          foto_principal_url: string | null
          horimetro: number | null
          id: string
          km_atual: number
          km_proxima_revisao: number | null
          marca: string
          modelo: string
          motorista_id: string | null
          numero_patrimonio: string | null
          numero_serie: string | null
          placa: string
          renavam: string | null
          setor: string | null
          status: string
          tipo_bem: string
          vencimento_ipva: string | null
          vencimento_licenciamento: string | null
          vencimento_seguro: string | null
        }
        Insert: {
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          atualizado_em?: string
          cadastrado_por?: string | null
          categoria?: string | null
          chassi?: string | null
          combustivel?: string | null
          cor?: string | null
          criado_em?: string
          doc_crlv_url?: string | null
          doc_seguro_url?: string | null
          empresa_id?: string | null
          foto_principal_url?: string | null
          horimetro?: number | null
          id?: string
          km_atual?: number
          km_proxima_revisao?: number | null
          marca: string
          modelo: string
          motorista_id?: string | null
          numero_patrimonio?: string | null
          numero_serie?: string | null
          placa: string
          renavam?: string | null
          setor?: string | null
          status?: string
          tipo_bem?: string
          vencimento_ipva?: string | null
          vencimento_licenciamento?: string | null
          vencimento_seguro?: string | null
        }
        Update: {
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          atualizado_em?: string
          cadastrado_por?: string | null
          categoria?: string | null
          chassi?: string | null
          combustivel?: string | null
          cor?: string | null
          criado_em?: string
          doc_crlv_url?: string | null
          doc_seguro_url?: string | null
          empresa_id?: string | null
          foto_principal_url?: string | null
          horimetro?: number | null
          id?: string
          km_atual?: number
          km_proxima_revisao?: number | null
          marca?: string
          modelo?: string
          motorista_id?: string | null
          numero_patrimonio?: string | null
          numero_serie?: string | null
          placa?: string
          renavam?: string | null
          setor?: string | null
          status?: string
          tipo_bem?: string
          vencimento_ipva?: string | null
          vencimento_licenciamento?: string | null
          vencimento_seguro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_cadastrado_por_fkey"
            columns: ["cadastrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      viagens: {
        Row: {
          criado_em: string
          data_chegada: string | null
          data_saida: string
          destino: string | null
          empresa_id: string | null
          finalidade: string | null
          id: string
          km_chegada: number | null
          km_percorrido: number | null
          km_saida: number | null
          motorista_id: string
          observacoes: string | null
          veiculo_id: string
        }
        Insert: {
          criado_em?: string
          data_chegada?: string | null
          data_saida?: string
          destino?: string | null
          empresa_id?: string | null
          finalidade?: string | null
          id?: string
          km_chegada?: number | null
          km_percorrido?: number | null
          km_saida?: number | null
          motorista_id: string
          observacoes?: string | null
          veiculo_id: string
        }
        Update: {
          criado_em?: string
          data_chegada?: string | null
          data_saida?: string
          destino?: string | null
          empresa_id?: string | null
          finalidade?: string | null
          id?: string
          km_chegada?: number | null
          km_percorrido?: number | null
          km_saida?: number | null
          motorista_id?: string
          observacoes?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      manutencoes_publicas: {
        Row: {
          aprovado_nome: string | null
          aprovado_por: string | null
          atualizado_em: string | null
          avaliacao_comentario: string | null
          avaliacao_estrelas: number | null
          comprovante_url: string | null
          criado_em: string | null
          data_aprovacao: string | null
          data_conclusao: string | null
          data_inicio: string | null
          data_solicitacao: string | null
          desconto: number | null
          descricao: string | null
          diagnostico: string | null
          empresa_id: string | null
          enviado_para_rede: boolean | null
          exigir_orcamento: boolean | null
          fornecedor_id: string | null
          id: string | null
          km_na_manutencao: number | null
          nota_fiscal: string | null
          numero_os: string | null
          observacoes: string | null
          oficina_nome: string | null
          os_oficina: string | null
          prazo_esperado: string | null
          prioridade: string | null
          servico_executado: string | null
          solicitacao_pai_id: string | null
          solicitado_por: string | null
          status: string | null
          tipo: string | null
          total_orcamentos_recebidos: number | null
          validade_orcamento: string | null
          valor_final: number | null
          valor_mao_obra: number | null
          valor_maximo_autorizado: number | null
          valor_previsto: number | null
          veiculo_id: string | null
        }
        Insert: {
          aprovado_nome?: string | null
          aprovado_por?: string | null
          atualizado_em?: string | null
          avaliacao_comentario?: string | null
          avaliacao_estrelas?: number | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_solicitacao?: string | null
          desconto?: number | null
          descricao?: string | null
          diagnostico?: string | null
          empresa_id?: string | null
          enviado_para_rede?: boolean | null
          exigir_orcamento?: boolean | null
          fornecedor_id?: string | null
          id?: string | null
          km_na_manutencao?: number | null
          nota_fiscal?: string | null
          numero_os?: string | null
          observacoes?: string | null
          oficina_nome?: string | null
          os_oficina?: string | null
          prazo_esperado?: string | null
          prioridade?: string | null
          servico_executado?: string | null
          solicitacao_pai_id?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo?: string | null
          total_orcamentos_recebidos?: number | null
          validade_orcamento?: string | null
          valor_final?: number | null
          valor_mao_obra?: number | null
          valor_maximo_autorizado?: number | null
          valor_previsto?: number | null
          veiculo_id?: string | null
        }
        Update: {
          aprovado_nome?: string | null
          aprovado_por?: string | null
          atualizado_em?: string | null
          avaliacao_comentario?: string | null
          avaliacao_estrelas?: number | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_solicitacao?: string | null
          desconto?: number | null
          descricao?: string | null
          diagnostico?: string | null
          empresa_id?: string | null
          enviado_para_rede?: boolean | null
          exigir_orcamento?: boolean | null
          fornecedor_id?: string | null
          id?: string | null
          km_na_manutencao?: number | null
          nota_fiscal?: string | null
          numero_os?: string | null
          observacoes?: string | null
          oficina_nome?: string | null
          os_oficina?: string | null
          prazo_esperado?: string | null
          prioridade?: string | null
          servico_executado?: string | null
          solicitacao_pai_id?: string | null
          solicitado_por?: string | null
          status?: string | null
          tipo?: string | null
          total_orcamentos_recebidos?: number | null
          validade_orcamento?: string | null
          valor_final?: number | null
          valor_mao_obra?: number | null
          valor_maximo_autorizado?: number | null
          valor_previsto?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_empresa_id: { Args: never; Returns: string }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_perfil: { Args: never; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalcular_financeiro_os: {
        Args: { _manutencao_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "gestor_frota" | "fornecedor" | "motorista"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor_frota", "fornecedor", "motorista"],
    },
  },
} as const
