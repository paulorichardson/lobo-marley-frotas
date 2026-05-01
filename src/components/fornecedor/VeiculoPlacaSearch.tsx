import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VeiculoBusca {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  cor: string | null;
  km_atual: number;
  motorista_id: string | null;
  empresa_id: string | null;
  foto_principal_url: string | null;
}

interface Props {
  onSelect: (v: VeiculoBusca | null) => void;
  selected: VeiculoBusca | null;
  required?: boolean;
}

export function VeiculoPlacaSearch({ onSelect, selected, required }: Props) {
  const [placa, setPlaca] = useState("");
  const [loading, setLoading] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  useEffect(() => {
    if (!placa || placa.length < 5 || selected) {
      setNaoEncontrado(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const norm = placa.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const { data } = await supabase
        .from("veiculos")
        .select("id, placa, modelo, marca, cor, km_atual, motorista_id, empresa_id, foto_principal_url")
        .ilike("placa", `%${norm}%`)
        .limit(1);
      setLoading(false);
      if (data && data.length > 0) {
        onSelect(data[0] as VeiculoBusca);
        setNaoEncontrado(false);
      } else {
        setNaoEncontrado(true);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [placa, selected, onSelect]);

  if (selected) {
    return (
      <Card className="p-3 flex items-center gap-3">
        {selected.foto_principal_url ? (
          <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center">
            <Truck className="w-6 h-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center">
            <Truck className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold tracking-wider">{selected.placa}</p>
          <p className="text-sm text-muted-foreground truncate">
            {selected.marca} {selected.modelo} {selected.cor ? `• ${selected.cor}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Último KM: {Number(selected.km_atual).toLocaleString("pt-BR")}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            onSelect(null);
            setPlaca("");
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <Label>Placa do veículo {required && "*"}</Label>
      <div className="relative">
        <Input
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          placeholder="ABC1D23"
          autoCapitalize="characters"
          className="uppercase tracking-wider font-mono"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {naoEncontrado && !loading && (
        <p className="text-xs text-destructive">
          Veículo não cadastrado na rede. Verifique com o gestor.
        </p>
      )}
    </div>
  );
}
