import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Coins,
  Grid3x3,
  Layers,
  ShoppingCart,
  Plus,
  Check,
  Flame,
  Droplets,
  Mountain,
  Wind,
  Sun,
  Moon,
} from 'lucide-react';
import { getUserCards, buyCard as buyCardApi, equipCards, getMarketplace } from '@/services/rpg';
import type { RPGCard, RPGUserCards, CardRarity, CardElement } from '@/types';
import { cn } from '@/lib/utils';

const ELEMENT_ICONS: Record<CardElement, React.ElementType> = {
  Fire: Flame,
  Water: Droplets,
  Earth: Mountain,
  Wind: Wind,
  Light: Sun,
  Dark: Moon,
};

const ELEMENT_COLORS: Record<CardElement, string> = {
  Fire: 'text-orange-500 bg-orange-500/10',
  Water: 'text-blue-500 bg-blue-500/10',
  Earth: 'text-amber-700 bg-amber-700/10',
  Wind: 'text-cyan-400 bg-cyan-400/10',
  Light: 'text-yellow-300 bg-yellow-300/10',
  Dark: 'text-purple-600 bg-purple-600/10',
};

const RARITY_COLORS: Record<CardRarity, string> = {
  Common: 'border-gray-400 bg-gray-400/10 text-gray-400',
  'Super Rare': 'border-blue-400 bg-blue-400/10 text-blue-400',
  Legendary: 'border-purple-400 bg-purple-400/10 text-purple-400',
  Mythic: 'border-yellow-400 bg-yellow-400/10 text-yellow-400',
};

const RARITY_ORDER: CardRarity[] = ['Common', 'Super Rare', 'Legendary', 'Mythic'];

type Tab = 'inventory' | 'marketplace' | 'deck';

export default function CardsPage() {
  const [userCards, setUserCards] = useState<RPGUserCards | null>(null);
  const [marketplace, setMarketplace] = useState<RPGCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForDeck, setSelectedForDeck] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('inventory');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [userCardsData, marketplaceData] = await Promise.all([
        getUserCards(),
        getMarketplace(),
      ]);
      setUserCards(userCardsData);
      setMarketplace(marketplaceData);
      setSelectedForDeck(userCardsData.equipped);
    } catch {
      setError('Failed to load cards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBuyCard = async (card: RPGCard) => {
    if (!card.price || card.owned) return;
    try {
      setIsLoading(true);
      const updated = await buyCardApi(card.id);
      setUserCards(updated);
      setSelectedForDeck(updated.equipped);
      await fetchData();
    } catch {
      setError('Failed to buy card');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquipCards = async () => {
    if (!userCards) return;
    try {
      setIsLoading(true);
      const updated = await equipCards(selectedForDeck);
      setUserCards(updated);
      setSelectedForDeck(updated.equipped);
    } catch {
      setError('Failed to equip cards');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDeckSelection = (cardId: string) => {
    if (selectedForDeck.includes(cardId)) {
      setSelectedForDeck(selectedForDeck.filter(id => id !== cardId));
    } else {
      if (selectedForDeck.length >= (userCards?.maxEquipped || 5)) return;
      setSelectedForDeck([...selectedForDeck, cardId]);
    }
  };

  const renderCard = (card: RPGCard, showBuy = false, showEquip = false) => {
    const ElementIcon = ELEMENT_ICONS[card.element];
    const isSelected = selectedForDeck.includes(card.id);
    return (
      <motion.div
        key={card.id}
        whileHover={{ scale: 1.02 }}
        className={cn(
          'relative p-4 rounded-xl border-2 transition-all',
          RARITY_COLORS[card.rarity],
          showEquip && isSelected ? 'ring-2 ring-green-500' : ''
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('w-6 h-6 rounded flex items-center justify-center', ELEMENT_COLORS[card.element])}>
            <ElementIcon className="w-3 h-3" />
          </div>
          <span className="text-xs font-medium uppercase">{card.type}</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">{card.rarity}</Badge>
        </div>
        <h4 className="font-semibold text-sm mb-1">{card.name}</h4>
        <p className="text-xs opacity-80 mb-3 line-clamp-2">{card.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {card.abilities.slice(0, 3).map((ability, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">
              {ability}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span>PWR: {card.power} | SP: {card.cost}</span>
          {card.quantity > 1 && <span className="text-muted-foreground">x{card.quantity}</span>}
        </div>
        {showBuy && card.price && !card.owned && (
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={() => handleBuyCard(card)}
          >
            <Coins className="w-3 h-3 mr-1" /> {card.price} SLC
          </Button>
        )}
        {showEquip && (
          <Button
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            className="w-full mt-3"
            onClick={() => toggleDeckSelection(card.id)}
          >
            {isSelected ? <Check className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
            {isSelected ? 'Equipped' : 'Equip'}
          </Button>
        )}
      </motion.div>
    );
  };

  const userInventoryCards = userCards ? userCards.cards.filter(c => c.owned) : [];
  const sortedInventory = [...userInventoryCards].sort((a, b) => {
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Grid3x3 className="w-5 h-5 text-white" />
              </div>
              Card Collection
            </h1>
            <p className="text-muted-foreground mt-1">
              {userCards ? `${userCards.cards.filter(c => c.owned).length} cards collected` : 'Loading collection...'}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Custom Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {[
            { key: 'inventory', label: 'My Cards', icon: Grid3x3 },
            { key: 'marketplace', label: 'Marketplace', icon: ShoppingCart },
            { key: 'deck', label: 'Deck Builder', icon: Layers },
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

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {tab === 'inventory' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {sortedInventory.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Grid3x3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No cards yet</h3>
                    <p className="text-muted-foreground mb-4">Visit the marketplace to buy your first cards!</p>
                    <Button onClick={() => setTab('marketplace')}>Browse Marketplace</Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {sortedInventory.map((card) => renderCard(card))}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'marketplace' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {marketplace.length === 0 ? (
                  <Card className="p-12 text-center">
                    <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Marketplace empty</h3>
                    <p className="text-muted-foreground">Check back later for new cards!</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {marketplace.map((card) => renderCard(card, true))}
                  </div>
                )}
              </motion.div>
            )}

            {tab === 'deck' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Equipped Cards</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedForDeck.length} / {userCards?.maxEquipped || 5} slots used
                      </p>
                    </div>
                    <Button
                      onClick={handleEquipCards}
                      disabled={selectedForDeck.length === 0}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      Save Deck
                    </Button>
                  </div>
                  <Separator className="mb-4" />
                  {sortedInventory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No cards available to equip.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {sortedInventory.map((card) => renderCard(card, false, true))}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
