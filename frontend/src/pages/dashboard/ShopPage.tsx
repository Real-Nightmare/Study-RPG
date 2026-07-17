import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Store,
  Coins,
  Shield,
  Wand2,
  Shirt,
  Check,
} from 'lucide-react';
import { getWallet, getAbilities, getItems, getCosmetics, buyAbility, buyItem, buyCosmetic } from '@/services/rpg';
import type { RPGAbility, RPGItem, RPGCosmetic, RPGWallet } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'abilities' | 'items' | 'cosmetics';

export default function ShopPage() {
  const [wallet, setWallet] = useState<RPGWallet | null>(null);
  const [abilities, setAbilities] = useState<RPGAbility[]>([]);
  const [items, setItems] = useState<RPGItem[]>([]);
  const [cosmetics, setCosmetics] = useState<RPGCosmetic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('abilities');
  const [confirmItem, setConfirmItem] = useState<{ type: Tab; item: RPGAbility | RPGItem | RPGCosmetic } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [walletData, abilitiesData, itemsData, cosmeticsData] = await Promise.all([
        getWallet(),
        getAbilities(),
        getItems(),
        getCosmetics(),
      ]);
      setWallet(walletData);
      setAbilities(abilitiesData);
      setItems(itemsData);
      setCosmetics(cosmeticsData);
    } catch {
      setError('Failed to load shop');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBuy = async () => {
    if (!confirmItem) return;
    try {
      setIsLoading(true);
      if (confirmItem.type === 'abilities') {
        await buyAbility(confirmItem.item.id);
      } else if (confirmItem.type === 'items') {
        await buyItem(confirmItem.item.id);
      } else {
        await buyCosmetic(confirmItem.item.id);
      }
      setConfirmItem(null);
      await fetchData();
    } catch {
      setError('Purchase failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAbilities = () => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {abilities.map((ability) => (
        <Card key={ability.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-purple-500" />
            </div>
            {ability.owned && <Badge variant="secondary">Owned</Badge>}
          </div>
          <h3 className="font-semibold mb-1">{ability.name}</h3>
          <p className="text-sm text-muted-foreground mb-2">{ability.description}</p>
          <p className="text-xs text-muted-foreground mb-4">Effect: {ability.effect}</p>
          {!ability.owned ? (
            <Button
              className="w-full bg-green-500 hover:bg-green-600"
              onClick={() => setConfirmItem({ type: 'abilities', item: ability })}
            >
              <Coins className="w-4 h-4 mr-2" /> {ability.price} SLC
            </Button>
          ) : (
            <Button className="w-full" variant="outline" disabled>
              <Check className="w-4 h-4 mr-2" /> Owned
            </Button>
          )}
        </Card>
      ))}
    </div>
  );

  const renderItems = () => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <Card key={item.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <Badge variant="secondary">x{item.quantity}</Badge>
          </div>
          <h3 className="font-semibold mb-1">{item.name}</h3>
          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
          <p className="text-xs text-muted-foreground mb-1">Effect: {item.effect}</p>
          {item.counters.length > 0 && (
            <p className="text-xs text-muted-foreground mb-4">Counters: {item.counters.join(', ')}</p>
          )}
          <Button
            className="w-full bg-green-500 hover:bg-green-600"
            onClick={() => setConfirmItem({ type: 'items', item: item })}
          >
            <Coins className="w-4 h-4 mr-2" /> {item.price} SLC
          </Button>
        </Card>
      ))}
    </div>
  );

  const renderCosmetics = () => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cosmetics.map((cosmetic) => (
        <Card key={cosmetic.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <Shirt className="w-5 h-5 text-pink-500" />
            </div>
            {cosmetic.equipped && <Badge className="bg-green-500/10 text-green-500">Equipped</Badge>}
          </div>
          <h3 className="font-semibold mb-1">{cosmetic.name}</h3>
          <p className="text-sm text-muted-foreground mb-2">{cosmetic.description}</p>
          {cosmetic.previewUrl && (
            <img src={cosmetic.previewUrl} alt={cosmetic.name} className="w-full h-32 object-cover rounded-lg mb-3" />
          )}
          {!cosmetic.owned ? (
            <Button
              className="w-full bg-green-500 hover:bg-green-600"
              onClick={() => setConfirmItem({ type: 'cosmetics', item: cosmetic })}
            >
              <Coins className="w-4 h-4 mr-2" /> {cosmetic.price} SLC
            </Button>
          ) : (
            <Button className="w-full" variant="outline" disabled>
              <Check className="w-4 h-4 mr-2" /> Owned
            </Button>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              Shop
            </h1>
            <p className="text-muted-foreground mt-1">
              Balance: <span className="font-bold text-green-500">{wallet?.balance ?? 0} SLC</span>
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Custom Tabs */}
            <div className="flex gap-2 mb-6 border-b border-border">
              {[
                { key: 'abilities', label: 'Abilities', icon: Wand2 },
                { key: 'items', label: 'Items', icon: Shield },
                { key: 'cosmetics', label: 'Cosmetics', icon: Shirt },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key as Tab)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                    tab === key
                      ? 'border-green-500 text-green-600 dark:text-green-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {tab === 'abilities' && renderAbilities()}
            {tab === 'items' && renderItems()}
            {tab === 'cosmetics' && renderCosmetics()}
          </>
        )}

        {/* Purchase Confirmation Modal */}
        {confirmItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Confirm Purchase</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to purchase <strong>{confirmItem.item.name}</strong> for <strong>{confirmItem.item.price} SLC</strong>?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmItem(null)}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-green-500 hover:bg-green-600" onClick={handleBuy}>
                  Confirm
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
